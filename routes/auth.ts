import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma';
import { Router } from 'express';

const prisma = new PrismaClient();

const router = Router();

router.post('/signup', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
  
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists.' });
      }
  
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });
  
      res.status(201).json({ message: 'User created successfully.', userId: user.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  });

  export default router;