import { Router } from 'express';
import { createCategorySchema } from '../dtos/create-category.dto';
import { createCategory, getCategories } from '../controllers/category.controller';
import { authMiddleware } from '../middlewares/auth.middleware';


const router = Router();

// Exige a pulseira VIP em todas as rotas de categoria
router.use(authMiddleware);

router.post("/", createCategory);
router.get("/", getCategories);

export { router as categoryRoutes };
