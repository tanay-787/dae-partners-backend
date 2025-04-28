import express from "express";
import authRoutes from "./routes/auth"
import { authenticateToken } from "./middleware/authMiddleware";

const app = express();
const port = parseInt(process.env.PORT) || process.argv[3] || 8080;

app.use(express.json())

app.get('/protected', authenticateToken, (req, res) => {
  res.json({"msg": "Hello world"});
});

app.use('/api/auth', authRoutes)

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});

