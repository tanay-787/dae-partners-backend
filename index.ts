import express from "express";
import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
import userRoutes from "./routes/user.routes";
import cartRoutes from "./routes/cart.routes";
import orderRoutes from "./routes/order.routes";
import webhookRoutes from "./routes/webhook.routes"; // Import webhook routes
import { authenticateToken } from "./middleware/auth.middleware";
import cors from "cors";

const app = express();
const port = parseInt(process.env.PORT) || process.argv[3] || 8080;

// Mount webhook routes BEFORE express.json()
// app.use('/api/webhooks', webhookRoutes);

app.use(cors()); // Enable CORS for all origins
app.use(express.json());

app.get('/protected', authenticateToken, (req, res) => {
  res.json({"msg": "Hello world"});
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});