import express from "express";
import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
import userRoutes from "./routes/user.routes";
import cartRoutes from "./routes/cart.routes";
import orderRoutes from "./routes/order.routes"; // Import order routes
import { authenticateToken } from "./middleware/auth.middleware";

const app = express();
const port = parseInt(process.env.PORT) || process.argv[3] || 8080;

app.use(express.json());

app.get('/protected', authenticateToken, (req, res) => {
  res.json({"msg": "Hello world"});
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes); // Mount order routes under /api/orders

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});