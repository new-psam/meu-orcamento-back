import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'O nome da categoria é obrigatório'),
  color: z.string().optional(),
  parentId: z.uuid().optional(),
});