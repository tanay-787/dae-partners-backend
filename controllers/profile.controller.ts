import { Request, Response } from 'express';
import prisma from "../prisma/prismaClient";

export const getProfile = async (req: Request, res: Response) => {
    try {
        // User information is attached to req.user by the authenticateToken middleware
        const userId = (req as any).user.userId; 

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
            // Select fields to return, exclude sensitive ones like password
            select: {
                id: true,
                email: true,
                // Add other profile fields you want to return
                // name: true,
                // address: true,
            },
        });

        if (!user) {
            // This case should ideally not happen if authentication is successful
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const updates = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Basic validation: prevent updating sensitive fields like ID or role
        if (updates.id || updates.email || updates.role) {
            return res.status(400).json({ error: 'Cannot update sensitive fields' });
        }

        // Add more specific validation here for allowed fields

        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: updates,
            select: {
                id: true,
                email: true,
                // Add other profile fields you want to return after update
                // name: true,
                // address: true,
            },
        });

        res.json({ message: 'Profile updated successfully', profile: updatedUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};
