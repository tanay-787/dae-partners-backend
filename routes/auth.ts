import { Router } from "express";
import { signup } from "../controllers/authControllers/signup";
import { login } from "../controllers/authControllers/login";

const router = Router();

router.post('/signup', signup);

router.post('/login', login);

export default router;
