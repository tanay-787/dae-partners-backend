import { Request, Response } from 'express';
import prisma from "../prisma/prismaClient";
import { PricingTier, DiscountRule, Product, CartItem } from '../generated/prisma';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Razorpay client
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// Helper function to calculate the effective *unit* price of a single cart item for order creation
const calculateOrderItemUnitPrice = (
    cartItem: CartItem & { product: Product },
    userPricingTier: PricingTier | null,
    discountRules: DiscountRule[]
): number => {
    let itemPrice = cartItem.product.price; // Start with base product price
    let bestDiscountAmount = 0; // Track the largest discount amount per unit

    const applicableRules = discountRules.filter(rule =>
        rule.isActive &&
        (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === userPricingTier?.id) &&
        (!rule.applicableToProductId || rule.applicableToProductId === cartItem.productId) &&
        (!rule.minimumQuantity || cartItem.quantity >= rule.minimumQuantity)
    );

    applicableRules.forEach(rule => {
        let discountAmount = 0;
        if (rule.type === 'percentage') {
            discountAmount = itemPrice * rule.value;
        } else if (rule.type === 'fixed') {
            discountAmount = rule.value;
        }

        if (discountAmount > bestDiscountAmount) {
            bestDiscountAmount = discountAmount;
        }
    });

    const finalUnitPrice = Math.max(0, itemPrice - bestDiscountAmount);

    return finalUnitPrice;
};

export const createOrder = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

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
             prisma.discountRule.findMany({ where: { isActive: true } }),
         ]);

        if (!userCart || userCart.items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

         const userPricingTier = user?.pricingTier || null;

        let calculatedSubtotal = 0;
        const orderItemsData = userCart.items.map(item => {
             const discountedUnitPrice = calculateOrderItemUnitPrice(item, userPricingTier, discountRules);
             const itemTotal = discountedUnitPrice * item.quantity;
             calculatedSubtotal += itemTotal;

            return {
                orderId: '',
                productId: item.productId,
                quantity: item.quantity,
                price: discountedUnitPrice,
            };
        });

        let finalOrderTotal = calculatedSubtotal;
         const cartLevelDiscounts = discountRules.filter(rule =>
              rule.isActive &&
             (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === userPricingTier?.id) &&
             rule.minimumOrderAmount !== null &&
             calculatedSubtotal >= rule.minimumOrderAmount
         );

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

        // Ensure total amount is a positive integer (Razorpay requires amount in smallest unit like paisa)
        const razorpayAmount = Math.round(finalOrderTotal * 100);
        if (razorpayAmount <= 0) {
             return res.status(400).json({ error: 'Order total must be positive for payment' });
        }

        // Use a transaction to ensure atomicity
        const order = await prisma.$transaction(async (prisma) => {

             // 1. Check and update product inventory
             for (const item of userCart.items) {
                 const product = await prisma.product.findUnique({
                     where: { id: item.productId },
                     select: { inventory: true, name: true },
                 });

                 if (!product) {
                      throw new Error(`Product with ID ${item.productId} not found.`);
                 }

                 if (product.inventory === null || product.inventory < item.quantity) {
                     throw new Error(`Insufficient inventory for product: ${product.name}. Available: ${product.inventory || 0}, Requested: ${item.quantity}`);
                 }

                 await prisma.product.update({
                     where: { id: item.productId },
                     data: { inventory: { decrement: item.quantity } },
                 });
             }

            // 2. Create the Order record
            const newOrder = await prisma.order.create({
                data: {
                    userId: userId,
                    totalAmount: finalOrderTotal,
                    status: 'PendingPayment', // Set status to reflect pending payment
                    // TODO: Add other order fields
                },
            });

            // Assign the created order's ID
            const orderItemsDataWithOrderId = orderItemsData.map(item => ({
                ...item,
                orderId: newOrder.id,
            }));

            // 3. Create OrderItem records
            await prisma.orderItem.createMany({
                data: orderItemsDataWithOrderId,
            });

            // 4. Clear the user's cart items
            await prisma.cartItem.deleteMany({
                where: {
                    cartId: userCart.id,
                },
            });

            // 5. Create Razorpay Order
            const razorpayOrder = await razorpay.orders.create({ // Corrected variable name here
                amount: razorpayAmount, // amount in paisa
                currency: 'INR', // Your currency
                receipt: newOrder.id, // Use your internal order ID as receipt
                // TODO: Add other parameters as needed (e.g., notes)
            });

             // 6. Store the razorpay_order_id in your database order record
             const updatedOrder = await prisma.order.update({
                 where: { id: newOrder.id },
                 data: {
                     razorpayOrderId: razorpayOrder.id,
                 }
             });

            return { ...updatedOrder, razorpayOrder }; // Return both internal order and razorpay order details
        });

        // Send the internal order ID and Razorpay order details to the frontend
        res.status(201).json({
            message: 'Order created and payment initiated',
            orderId: order.id, // Your internal order ID
            totalAmount: order.totalAmount, // Final calculated total
            razorpayOrder: order.razorpayOrder, // Details from Razorpay
            razorpayKeyId: process.env.RAZORPAY_KEY_ID, // Send Key ID to frontend for checkout
        });

    } catch (error) {
        console.error('Error during order creation and payment initiation:', error);
        // Check if the error is an inventory error
        if (error instanceof Error && error.message.startsWith('Insufficient inventory')) {
             res.status(400).json({ error: error.message });
        } else {
            // Log other errors and send a generic failure message
            res.status(500).json({ error: 'Failed to create order and initiate payment' });
        }
    }
};

// TODO: Implement webhook endpoint for Razorpay
// This endpoint will receive payment updates from Razorpay and update order status

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
