import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { Product, PricingTier, DiscountRule } from '../generated/prisma';

// Helper function to calculate discounted price for a product based on user's tier and rules
const calculateDiscountedPrice = (
    product: Product,
    userPricingTier: PricingTier | null | undefined,
    discountRules: DiscountRule[]
): number => {
    let finalPrice = product.price;
    let bestDiscount = 0; // Store the best discount amount found

    // Filter rules applicable to this product or the user's pricing tier
    const applicableRules = discountRules.filter(rule =>
        rule.isActive &&
        (!rule.applicableToProductId || rule.applicableToProductId === product.id) &&
        (!rule.applicableToPricingTierId || rule.applicableToPricingTierId === userPricingTier?.id)
        // Note: minimumQuantity and minimumOrderAmount rules are not applied here
        // as product list view doesn't have context of quantity or total cart value.
        // These should be applied in cart/order calculation.
    );

    applicableRules.forEach(rule => {
        let discountAmount = 0;
        if (rule.type === 'percentage') {
            discountAmount = product.price * rule.value;
        } else if (rule.type === 'fixed') {
            discountAmount = rule.value;
        }

        // For simplicity, apply the best single discount
        if (discountAmount > bestDiscount) {
            bestDiscount = discountAmount;
        }
    });

    finalPrice = product.price - bestDiscount;

    // Ensure price doesn't go below zero
    return Math.max(0, finalPrice);
};

export const getProducts = async (req: Request, res: Response) => {
    try {
        // Extract filtering and pagination parameters from query string
        const { category, minPrice, maxPrice, search, page = '1', limit = '10' } = req.query;
        const userId = (req as any).user?.userId; // Get user ID from authenticated request

        const where: any = {};

        if (category) {
            where.category = String(category);
        }

        // Note: Price filtering here still uses the base price in the database.
        // Applying filtering based on discounted price would require more complex querying or post-processing.
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) {
                where.price.gte = parseFloat(String(minPrice));
            }
            if (maxPrice) {
                where.price.lte = parseFloat(String(maxPrice));
            }
        }

        // Basic search implementation (can be enhanced later)
        if (search) {
            where.name = {
                contains: String(search),
                mode: 'insensitive', // Case-insensitive search
            };
        }

        const pageNumber = parseInt(String(page), 10);
        const limitNumber = parseInt(String(limit), 10);
        const skip = (pageNumber - 1) * limitNumber;

        // Fetch products
        const products = await prisma.product.findMany({
            where,
            take: limitNumber,
            skip: skip,
        });

        // Fetch user's pricing tier and relevant discount rules if user is authenticated
        let userPricingTier: PricingTier | null = null;
        let discountRules: DiscountRule[] = [];

        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { pricingTier: true },
            });
            userPricingTier = user?.pricingTier || null;

            // Fetch general rules and rules specific to the user's pricing tier
            discountRules = await prisma.discountRule.findMany({
                 where: {
                    isActive: true,
                    OR: [
                         { applicableToPricingTierId: userPricingTier?.id },
                         { applicableToPricingTierId: null } // General rules
                    ]
                 }
            });
             // Also fetch rules specific to the products being fetched (optimization if many rules exist)
             const productIds = products.map(p => p.id);
             const productSpecificRules = await prisma.discountRule.findMany({
                where: {
                   isActive: true,
                   applicableToProductId: { in: productIds }
                }
             });
            discountRules = [...discountRules, ...productSpecificRules];
             // Remove duplicates if any
             discountRules = Array.from(new Set(discountRules.map(r => r.id))).map(id => discountRules.find(r => r.id === id)!);

        }

        // Calculate and add discounted price to each product
        const productsWithDiscount = products.map(product => {
            const discountedPrice = calculateDiscountedPrice(product, userPricingTier, discountRules);
            return {
                ...product,
                price: discountedPrice, // Overwrite with discounted price
                basePrice: product.price, // Optionally include original base price
            };
        });

        // Optional: Get total count for pagination metadata (more complex query)
        // const totalCount = await prisma.product.count({ where });
        // res.json({ products: productsWithDiscount, totalCount, page: pageNumber, limit: limitNumber });

        res.json(productsWithDiscount);
    } catch (error) {
        console.error('Error fetching products with discounts:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};

export const getProductById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId; // Get user ID

        if (!id) {
             return res.status(400).json({ error: 'Product ID is required' });
        }

        // Fetch the product
        const product = await prisma.product.findUnique({
            where: {
                id: String(id), // Assuming product ID is a string
            },
        });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

         // Fetch user's pricing tier and relevant discount rules if user is authenticated
        let userPricingTier: PricingTier | null = null;
        let discountRules: DiscountRule[] = [];

        if (userId) {
             const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { pricingTier: true },
            });
            userPricingTier = user?.pricingTier || null;

             // Fetch general rules, rules specific to the user's pricing tier, and rules specific to this product
             discountRules = await prisma.discountRule.findMany({
                 where: {
                    isActive: true,
                    OR: [
                         { applicableToPricingTierId: userPricingTier?.id },
                         { applicableToPricingTierId: null }, // General rules
                         { applicableToProductId: product.id } // Rules specific to this product
                    ]
                 }
            });
            // Remove duplicates if any
             discountRules = Array.from(new Set(discountRules.map(r => r.id))).map(id => discountRules.find(r => r.id === id)!);
        }

        // Calculate discounted price
        const discountedPrice = calculateDiscountedPrice(product, userPricingTier, discountRules);

        // Return product details with calculated price
        res.json({
            ...product,
            price: discountedPrice, // Overwrite with discounted price
            basePrice: product.price, // Optionally include original base price
        });

    } catch (error) {
        console.error('Error fetching product details with discounts:', error);
        res.status(500).json({ error: 'Failed to fetch product details' });
    }
};
