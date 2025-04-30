import { Request, Response } from 'express';
import prisma from "../../prisma/prismaClient";
import { PricingTier, DiscountRule, Product, CartItem } from '../generated/prisma';

// Helper function to calculate the effective *unit* price of a single cart item for order creation
// This is similar to the one in the cart controller but focused on storing the per-unit price in OrderItem
const calculateOrderItemUnitPrice = (
    cartItem: CartItem & { product: Product },
    userPricingTier: PricingTier | null,
    discountRules: DiscountRule[]
): number => {
    let itemPrice = cartItem.product.price; // Start with base product price
    let bestDiscountAmount = 0; // Track the largest discount amount per unit

    const applicableRules = discountRules.filter(rule =>
        rule.isActive &&
        // Rule applies if it's a general rule OR applies to the user's tier OR applies to this specific product
        (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === userPricingTier?.id) &&
        (!rule.applicableToProductId || rule.applicableToProductId === cartItem.productId) &&
        // Check quantity condition if it exists
        (!rule.minimumQuantity || cartItem.quantity >= rule.minimumQuantity)
        // Note: minimumOrderAmount rules are not applied here, only at the order total level
    );

    applicableRules.forEach(rule => {
        let discountAmount = 0;
        if (rule.type === 'percentage') {
            discountAmount = itemPrice * rule.value; // Apply percentage to base price per unit
        } else if (rule.type === 'fixed') {
             // For fixed discounts on items, apply per unit.
             discountAmount = rule.value;
        }

         // For simplicity, apply the best single discount to the item's base price per unit
        if (discountAmount > bestDiscountAmount) {
            bestDiscountAmount = discountAmount;
        }
    });

    // Calculate the final unit price after applying the best discount per unit
    const finalUnitPrice = Math.max(0, itemPrice - bestDiscountAmount);

    return finalUnitPrice;
};

export const createOrder = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Fetch user's cart with items and product details, user's pricing tier, and all active discount rules
         const [userCart, user, discountRules] = await Promise.all([
             prisma.cart.findUnique({
                 where: {
                     userId: userId,
                 },
                 include: {
                     items: {
                         include: {
                             product: true,
                         },
                     },
                 },
             }),
             prisma.user.findUnique({
                 where: { id: userId },
                 include: { pricingTier: true },
             }),
             prisma.discountRule.findMany({ where: { isActive: true } }), // Fetch all active rules
         ]);

        if (!userCart || userCart.items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

         const userPricingTier = user?.pricingTier || null;

        let calculatedSubtotal = 0;
        const orderItemsData = userCart.items.map(item => {
             // Calculate the discounted unit price for this item at the time of order creation
             const discountedUnitPrice = calculateOrderItemUnitPrice(item, userPricingTier, discountRules);
             const itemTotal = discountedUnitPrice * item.quantity;
             calculatedSubtotal += itemTotal; // Sum up item totals for subtotal

            return {
                orderId: '', // Will be filled during transaction
                productId: item.productId,
                quantity: item.quantity,
                price: discountedUnitPrice, // Store the calculated discounted unit price
                // TODO: Potentially store applied discount info on OrderItem
            };
        });

        // TODO: Apply cart-level discounts (e.g., minimum order amount discount) to the calculated subtotal
        let finalOrderTotal = calculatedSubtotal;
         const cartLevelDiscounts = discountRules.filter(rule =>
              rule.isActive &&
             (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === userPricingTier?.id) &&
             rule.minimumOrderAmount !== null && // Rule has a minimum order amount condition
             calculatedSubtotal >= rule.minimumOrderAmount // Condition is met based on subtotal
         );

          // For simplicity, apply the best single cart-level discount
         let bestCartDiscount = 0;
          cartLevelDiscounts.forEach(rule => {
             let discountAmount = 0;
              if (rule.type === 'percentage') {
                  discountAmount = calculatedSubtotal * rule.value;
              } else if (rule.type === 'fixed') {
                  discountAmount = rule.value;
              }
              if (discountAmount > bestCartDiscount) {
                  bestCartDiscount = discountAmount;
              }
          });

         finalOrderTotal = Math.max(0, calculatedSubtotal - bestCartDiscount);

        // Use a transaction to ensure atomicity of order creation and cart clearing
        const order = await prisma.$transaction(async (prisma) => {
            // Create the Order record with the final calculated total amount
            const newOrder = await prisma.order.create({
                data: {
                    userId: userId,
                    totalAmount: finalOrderTotal,
                    status: 'Pending', // Initial status (e.g., Pending, Processing, etc.)
                    // TODO: Add other order fields as per your schema (e.g., shippingAddress)
                },
            });

            // Assign the created order's ID to the order items data
            const orderItemsDataWithOrderId = orderItemsData.map(item => ({
                ...item,
                orderId: newOrder.id,
            }));

            // Create OrderItem records
            await prisma.orderItem.createMany({
                data: orderItemsDataWithOrderId,
            });

            // TODO: Update product inventory (Decrement stock for each item purchased)
            // This would involve iterating through cart items and updating Product models *within the transaction*.
            // You'd need to handle cases where inventory is insufficient and potentially roll back the transaction.
            // Example: for (const item of userCart.items) { await prisma.product.update({ where: { id: item.productId }, data: { inventory: { decrement: item.quantity } } }); }

            // Clear the user's cart items
            await prisma.cartItem.deleteMany({
                where: {
                    cartId: userCart.id,
                },
            });
            // Optional: Delete the cart itself if you don't want to keep empty carts
            // await prisma.cart.delete({ where: { id: userCart.id } });

            return newOrder; // Return the created order
        });

        // TODO: Optional: Integrate Payment Initiation
        // If payment is required at this stage, initiate the payment process here
        // using a payment gateway SDK and potentially update the order status based on payment outcome.

        res.status(201).json({ message: 'Order created successfully', orderId: order.id, totalAmount: order.totalAmount });

    } catch (error) {
        console.error('Error creating order with pricing:', error);
        // If an error occurred within the transaction, Prisma automatically rolls it back.
        res.status(500).json({ error: 'Failed to create order' });
    }
};

// GET /api/orders - Get all orders for the authenticated user
export const getOrdersForUser = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const orders = await prisma.order.findMany({
            where: {
                userId: userId,
            },
            include: {
                items: { // Include order items and their product details
                    include: {
                        product: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc', // Show most recent orders first
            },
        });

        res.json(orders);

    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

// GET /api/orders/:id - Get a specific order by ID for the authenticated user
export const getOrderById = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const { id } = req.params; // Order ID from URL parameters

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!id) {
            return res.status(400).json({ error: 'Order ID is required' });
        }

        // Find the order by ID and ensure it belongs to the authenticated user
        const order = await prisma.order.findUnique({
            where: {
                id: id,
                userId: userId, // Crucially filter by userId
            },
            include: {
                items: { // Include order items and their product details
                    include: {
                        product: true,
                    },
                },
            },
        });

        if (!order) {
            // Return 404 if the order doesn't exist OR doesn't belong to the user
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(order);

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
};
