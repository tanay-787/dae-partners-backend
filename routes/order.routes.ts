import express from 'express';
import { createOrder, getOrdersForUser, getOrderById } from '../controllers/order.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// POST /api/orders - Create a new order from the user's cart
router.post('/', authenticateToken, createOrder);

// GET /api/orders - Get all orders for the authenticated user
router.get('/', authenticateToken, getOrdersForUser);

// GET /api/orders/:id - Get a specific order by ID for the authenticated user
// TODO: Add validation for order ID format if necessary
router.get('/:id', authenticateToken, getOrderById);

export default router;