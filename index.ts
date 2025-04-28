import express from "express";
import authRoutes from "./routes/auth"

const app = express();
const port = parseInt(process.env.PORT) || process.argv[3] || 8080;

app.use(express.json())

app.get('/api', (req, res) => {
  res.json({"msg": "Hello world"});
});

app.use('/api/auth', authRoutes)

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});

