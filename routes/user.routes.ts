import express from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { updateProfileValidation, handleValidationErrors } from '../middleware/profileValidation.middleware';

const router = express.Router();

// GET /api/profile
router.get('/profile', authenticateToken, getProfile);

// PUT /api/profile
// Apply authentication middleware first, then validation middleware, then the controller
router.put('/profile', authenticateToken, updateProfileValidation, handleValidationErrors, updateProfile);

export default router;