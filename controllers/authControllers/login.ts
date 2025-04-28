import { Request, Response } from "express";
import bcrypt from "bcrypt"
import prisma from "../../prisma/prismaClient";
import jwt from "jsonwebtoken"

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const JWT_SECRET = process.env.JWT_SECRET;
    
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required.' });
        }
    
        // Find user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials.' });
        }
    
        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Invalid credentials.' });
        }
    
        // Generate JWT
        const token = jwt.sign(
          { userId: user.id, email: user.email },  // payload
          JWT_SECRET,                             // secret
          { expiresIn: '1d' }                     // options (7 days validity)
        );
    
        res.status(200).json({ token });
    
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong.' });
      }
}