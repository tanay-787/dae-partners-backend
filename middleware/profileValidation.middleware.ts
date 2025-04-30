import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const updateProfileValidation = [
    // Example validation for a 'name' field
    body('name').optional().isString().trim().notEmpty().withMessage('Name must be a non-empty string'),
    // TODO: Add validation for other profile fields users are allowed to update (e.g., address, phone)
    // body('address').optional().isString().trim().notEmpty().withMessage('Address must be a non-empty string'),
    // body('phone').optional().isString().trim().isMobilePhone('any').withMessage('Invalid phone number'),
];

// Optional: Middleware to check validation results and send error response
// This can be placed after the validation chain in the route
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};
