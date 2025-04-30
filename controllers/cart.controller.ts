import { Request, Response } from 'express';
import prisma from "../prisma/prismaClient";
import { Cart, CartItem, Product, PricingTier, DiscountRule } from '../generated/prisma';

// Helper function to get or create a user's cart
// This helper now fetches user's pricing tier and all active discount rules
const getUserCart = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { pricingTier: true },
    });

    if (!user) {
        throw new Error('User not found'); // Should not happen if authenticated
    }

    let cart = await prisma.cart.findUnique({
        where: {
            userId: userId,
        },
        include: {
            items: {
                include: {
                    product: true, // Include product details for each item
                },
            },
        },
    });

    if (!cart) {
        cart = await prisma.cart.create({
            data: {
                userId: userId,
            },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
            },
        });
    }

    // Fetch all active discount rules
    const discountRules = await prisma.discountRule.findMany({
        where: {
            isActive: true,
        },
        // Optionally filter rules here if fetching all is too much,
        // e.g., only fetch rules applicable to the user's tier or products in the cart.
    });

    return { cart, userPricingTier: user.pricingTier, discountRules };
};

// Helper function to calculate the effective price of a single cart item
const calculateCartItemPrice = (
    cartItem: CartItem & { product: Product },
    userPricingTier: PricingTier | null,
    discountRules: DiscountRule[]
): number => {
    let itemPrice = cartItem.product.price; // Start with base product price
    let bestDiscountAmount = 0; // Track the largest discount amount for this item

    const applicableRules = discountRules.filter(rule =>
        // Rule applies if it's a general rule OR applies to the user's tier OR applies to this specific product
        (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === userPricingTier?.id) &&
        (!rule.applicableToProductId || rule.applicableToProductId === cartItem.productId) &&
        // Check quantity condition if it exists
        (!rule.minimumQuantity || cartItem.quantity >= rule.minimumQuantity)
        // Note: minimumOrderAmount rules are not applied here, only at the cart total level
    );

    applicableRules.forEach(rule => {
        let discountAmount = 0;
        if (rule.type === 'percentage') {
            discountAmount = itemPrice * rule.value; // Apply percentage to base price
        } else if (rule.type === 'fixed') {
            // For fixed discounts on items, apply per unit or per item? Assuming per unit for now.
            // You might adjust this logic based on discount type/intention.
            discountAmount = rule.value;
        }

         // For simplicity, apply the best single discount to the item's base price per unit
        if (discountAmount > bestDiscountAmount) {
            bestDiscountAmount = discountAmount;
        }
    });

    // Calculate the price for the item unit after applying the best discount
    const discountedUnitPrice = Math.max(0, itemPrice - bestDiscountAmount);

    // Return the total price for the quantity of this item
    return discountedUnitPrice * cartItem.quantity;
};

// GET /api/cart - Get user's cart with calculated prices and total
export const getCart = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { cart, userPricingTier, discountRules } = await getUserCart(userId);

        let calculatedTotal = 0;
        const itemsWithCalculatedPrice = cart.items.map(item => {
            const itemTotal = calculateCartItemPrice(item, userPricingTier, discountRules);
            calculatedTotal += itemTotal;
            return {
                ...item,
                calculatedPrice: itemTotal, // Total price for this item (quantity * discounted unit price)
                 unitPrice: item.product.price, // Original unit price
                 discountedUnitPrice: itemTotal / item.quantity, // Discounted unit price
            };
        });

        // TODO: Apply cart-level discounts (e.g., minimum order amount discount)
        let finalCartTotal = calculatedTotal;
        const cartLevelDiscounts = discountRules.filter(rule =>
             rule.isActive &&
            (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === userPricingTier?.id) &&
            rule.minimumOrderAmount !== null && // Rule has a minimum order amount condition
            calculatedTotal >= rule.minimumOrderAmount // Condition is met
        );

         // For simplicity, apply the best single cart-level discount
        let bestCartDiscount = 0;
         cartLevelDiscounts.forEach(rule => {
            let discountAmount = 0;
             if (rule.type === 'percentage') {
                 discountAmount = calculatedTotal * rule.value;
             } else if (rule.type === 'fixed') {
                 discountAmount = rule.value;
             }
             if (discountAmount > bestCartDiscount) {
                 bestCartDiscount = discountAmount;
             }
         });

        finalCartTotal = Math.max(0, calculatedTotal - bestCartDiscount);

        res.json({
            ...cart,
            items: itemsWithCalculatedPrice,
            subTotal: calculatedTotal, // Total before cart-level discounts
            discountApplied: bestCartDiscount, // Total discount applied at cart level
            totalAmount: finalCartTotal, // Final calculated total
        });

    } catch (error) {
        console.error('Error fetching cart with pricing:', error);
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
};

// POST /api/cart/items - Add item to cart (Refetch and return updated cart with pricing)
export const addItemToCart = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const { productId, quantity } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!productId || quantity === undefined || quantity <= 0) {
            return res.status(400).json({ error: 'Invalid product ID or quantity' });
        }

        // Need to fetch the cart first to check for existing item and get cart ID
        const userCartData = await getUserCart(userId);
        const cart = userCartData.cart; // Get cart object from the helper result

        // Check if the product already exists in the cart
        const existingItem = cart.items.find(item => item.productId === productId);

        let updatedCartItem;

        if (existingItem) {
            // If item exists, update the quantity
            updatedCartItem = await prisma.cartItem.update({
                where: {
                    id: existingItem.id,
                },
                data: {
                    quantity: existingItem.quantity + parseInt(quantity, 10),
                },
                include: {
                     product: true, // Include product details in the response
                }
            });
        } else {
            // If item does not exist, create a new cart item
             // First, check if the product exists
            const product = await prisma.product.findUnique({
                where: {
                    id: productId
                }
            });

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            updatedCartItem = await prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId: productId,
                    quantity: parseInt(quantity, 10),
                },
                include: {
                    product: true, // Include product details in the response
                }
            });
        }

        // Refetch the updated cart with pricing and return the complete cart state
        const updatedCartData = await getUserCart(userId);
         let calculatedTotal = 0;
        const itemsWithCalculatedPrice = updatedCartData.cart.items.map(item => {
            const itemTotal = calculateCartItemPrice(item, updatedCartData.userPricingTier, updatedCartData.discountRules);
            calculatedTotal += itemTotal;
            return {
                ...item,
                calculatedPrice: itemTotal,
                 unitPrice: item.product.price,
                 discountedUnitPrice: itemTotal / item.quantity,
            };
        });

         let finalCartTotal = calculatedTotal;
        const cartLevelDiscounts = updatedCartData.discountRules.filter(rule =>
             rule.isActive &&
            (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === updatedCartData.userPricingTier?.id) &&
            rule.minimumOrderAmount !== null &&
            calculatedTotal >= rule.minimumOrderAmount
        );

        let bestCartDiscount = 0;
         cartLevelDiscounts.forEach(rule => {
            let discountAmount = 0;
             if (rule.type === 'percentage') {
                 discountAmount = calculatedTotal * rule.value;
             } else if (rule.type === 'fixed') {
                 discountAmount = rule.value;
             }
             if (discountAmount > bestCartDiscount) {
                 bestCartDiscount = discountAmount;
             }
         });

        finalCartTotal = Math.max(0, calculatedTotal - bestCartDiscount);

        res.json({ message: 'Item added/updated in cart', cart: {
             ...updatedCartData.cart,
             items: itemsWithCalculatedPrice,
             subTotal: calculatedTotal,
             discountApplied: bestCartDiscount,
             totalAmount: finalCartTotal,
        } });

    } catch (error) {
        console.error('Error adding item to cart with pricing:', error);
        res.status(500).json({ error: 'Failed to add item to cart' });
    }
};

// PUT /api/cart/items/:itemId - Update item quantity in cart (Refetch and return updated cart with pricing)
export const updateCartItemQuantity = async (req: Request, res: Response) => {
     try {
        const userId = (req as any).user?.userId;
        const { itemId } = req.params;
        const { quantity } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (quantity === undefined || quantity < 0) {
             return res.status(400).json({ error: 'Invalid quantity' });
        }

        // Find the cart item and ensure it belongs to the user's cart
        const cartItem = await prisma.cartItem.findUnique({
            where: {
                id: itemId,
            },
             include: {
                cart: true,
            }
        });

        if (!cartItem || cartItem.cart.userId !== userId) {
            return res.status(404).json({ error: 'Cart item not found or does not belong to the user' });
        }

        if (quantity === 0) {
            // If quantity is 0, remove the item
            await prisma.cartItem.delete({
                where: {
                    id: itemId,
                },
            });
             // Refetch the updated cart with pricing and return the complete cart state
            const updatedCartData = await getUserCart(userId);
             let calculatedTotal = 0;
            const itemsWithCalculatedPrice = updatedCartData.cart.items.map(item => {
                const itemTotal = calculateCartItemPrice(item, updatedCartData.userPricingTier, updatedCartData.discountRules);
                calculatedTotal += itemTotal;
                return {
                    ...item,
                    calculatedPrice: itemTotal,
                     unitPrice: item.product.price,
                     discountedUnitPrice: itemTotal / item.quantity,
                };
            });

             let finalCartTotal = calculatedTotal;
            const cartLevelDiscounts = updatedCartData.discountRules.filter(rule =>
                 rule.isActive &&
                (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === updatedCartData.userPricingTier?.id) &&
                rule.minimumOrderAmount !== null &&
                calculatedTotal >= rule.minimumOrderAmount
            );

            let bestCartDiscount = 0;
             cartLevelDiscounts.forEach(rule => {
                let discountAmount = 0;
                 if (rule.type === 'percentage') {
                     discountAmount = calculatedTotal * rule.value;
                 } else if (rule.type === 'fixed') {
                     discountAmount = rule.value;
                 }
                 if (discountAmount > bestCartDiscount) {
                     bestCartDiscount = discountAmount;
                 }
             });

            finalCartTotal = Math.max(0, calculatedTotal - bestCartDiscount);

            res.json({ message: 'Item removed from cart', cart: {
                 ...updatedCartData.cart,
                 items: itemsWithCalculatedPrice,
                 subTotal: calculatedTotal,
                 discountApplied: bestCartDiscount,
                 totalAmount: finalCartTotal,
            } });

        } else {
            // Otherwise, update the quantity
            const updatedItem = await prisma.cartItem.update({
                where: {
                    id: itemId,
                },
                data: {
                    quantity: parseInt(quantity, 10),
                },
                 include: {
                     product: true, // Include product details in the response
                }
            });
             // Refetch the updated cart with pricing and return the complete cart state
            const updatedCartData = await getUserCart(userId);
             let calculatedTotal = 0;
            const itemsWithCalculatedPrice = updatedCartData.cart.items.map(item => {
                const itemTotal = calculateCartItemPrice(item, updatedCartData.userPricingTier, updatedCartData.discountRules);
                calculatedTotal += itemTotal;
                return {
                    ...item,
                    calculatedPrice: itemTotal,
                     unitPrice: item.product.price,
                     discountedUnitPrice: itemTotal / item.quantity,
                };
            });

             let finalCartTotal = calculatedTotal;
            const cartLevelDiscounts = updatedCartData.discountRules.filter(rule =>
                 rule.isActive &&
                (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === updatedCartData.userPricingTier?.id) &&
                rule.minimumOrderAmount !== null &&
                calculatedTotal >= rule.minimumOrderAmount
            );

            let bestCartDiscount = 0;
             cartLevelDiscounts.forEach(rule => {
                let discountAmount = 0;
                 if (rule.type === 'percentage') {
                     discountAmount = calculatedTotal * rule.value;
                 } else if (rule.type === 'fixed') {
                     discountAmount = rule.value;
                 }
                 if (discountAmount > bestCartDiscount) {
                     bestCartDiscount = discountAmount;
                 }
             });

            finalCartTotal = Math.max(0, calculatedTotal - bestCartDiscount);

            res.json({ message: 'Cart item quantity updated', cart: {
                 ...updatedCartData.cart,
                 items: itemsWithCalculatedPrice,
                 subTotal: calculatedTotal,
                 discountApplied: bestCartDiscount,
                 totalAmount: finalCartTotal,
            } });
        }

    } catch (error) {
        console.error('Error updating cart item quantity with pricing:', error);
        res.status(500).json({ error: 'Failed to update cart item quantity' });
    }
};

// DELETE /api/cart/items/:itemId - Remove item from cart (Refetch and return updated cart with pricing)
export const removeCartItem = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const { itemId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

         // Find the cart item and ensure it belongs to the user's cart
        const cartItem = await prisma.cartItem.findUnique({
            where: {
                id: itemId,
            },
             include: {
                cart: true,
            }
        });

        if (!cartItem || cartItem.cart.userId !== userId) {
            return res.status(404).json({ error: 'Cart item not found or does not belong to the user' });
        }

        await prisma.cartItem.delete({
            where: {
                id: itemId,
            },
        });

        // Refetch the updated cart with pricing and return the complete cart state
        const updatedCartData = await getUserCart(userId);
         let calculatedTotal = 0;
        const itemsWithCalculatedPrice = updatedCartData.cart.items.map(item => {
            const itemTotal = calculateCartItemPrice(item, updatedCartData.userPricingTier, updatedCartData.discountRules);
            calculatedTotal += itemTotal;
            return {
                ...item,
                calculatedPrice: itemTotal,
                 unitPrice: item.product.price,
                 discountedUnitPrice: itemTotal / item.quantity,
            };
        });

         let finalCartTotal = calculatedTotal;
        const cartLevelDiscounts = updatedCartData.discountRules.filter(rule =>
             rule.isActive &&
            (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === updatedCartData.userPricingTier?.id) &&
            rule.minimumOrderAmount !== null &&
            calculatedTotal >= rule.minimumOrderAmount
        );

        let bestCartDiscount = 0;
         cartLevelDiscounts.forEach(rule => {
            let discountAmount = 0;
             if (rule.type === 'percentage') {
                 discountAmount = calculatedTotal * rule.value;
             } else if (rule.type === 'fixed') {
                 discountAmount = rule.value;
             }
             if (discountAmount > bestCartDiscount) {
                 bestCartDiscount = discountAmount;
             }
         });

        finalCartTotal = Math.max(0, calculatedTotal - bestCartDiscount);

        res.json({ message: 'Item removed from cart', cart: {
             ...updatedCartData.cart,
             items: itemsWithCalculatedPrice,
             subTotal: calculatedTotal,
             discountApplied: bestCartDiscount,
             totalAmount: finalCartTotal,
        } });

    } catch (error) {
        console.error('Error removing cart item with pricing:', error);
        res.status(500).json({ error: 'Failed to remove item from cart' });
    }
};
