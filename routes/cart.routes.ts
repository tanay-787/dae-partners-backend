import express from 'express';
import { body, param } from 'express-validator';
import { getCart, addItemToCart, updateCartItemQuantity, removeCartItem } from '../controllers/cartControllers/cart.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/profileValidation.middleware'; // Using the existing error handler

const router = express.Router();

// All cart routes require authentication
router.use(authenticateToken);

// Validation middleware for adding item to cart
const addItemValidation = [
    body('productId').exists().isString().notEmpty().withMessage('Product ID is required'),
    body('quantity').exists().isInt({ gt: 0 }).withMessage('Quantity must be a positive integer'),
];

// Validation middleware for updating item quantity in cart
const updateItemQuantityValidation = [
    param('itemId').exists().isString().notEmpty().withMessage('Item ID is required in URL'),
    body('quantity').exists().isInt({ gt: -1 }).withMessage('Quantity must be a non-negative integer'), // Allow 0 to remove item
];

// Validation middleware for removing item from cart
const removeItemValidation = [
    param('itemId').exists().isString().notEmpty().withMessage('Item ID is required in URL'),
];

// GET /api/cart - Get user's cart
router.get('/', getCart);

// POST /api/cart/items - Add item to cart
router.post('/items', addItemValidation, handleValidationErrors, addItemToCart);

// PUT /api/cart/items/:itemId - Update item quantity in cart
router.put('/items/:itemId', updateItemQuantityValidation, handleValidationErrors, updateCartItemQuantity);

// DELETE /api/cart/items/:itemId - Remove item from cart
router.delete('/items/:itemId', removeItemValidation, handleValidationErrors, removeCartItem);

export default router;