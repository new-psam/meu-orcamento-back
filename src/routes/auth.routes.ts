import { Router } from "express";
import { signin, signup } from "../controllers/auth.controller";

const authRoutes = Router();

authRoutes.post("/signup", signup);
authRoutes.post("/signin", signin); // Substitua 'signup' por 'signin' quando a função signin estiver implementada

export { authRoutes };