import { z } from "zod";

export const updateCategorySchema = z.object({
    name: z.string().min(1, "O nome não pode ser vazio").optional(),
    color: z.string().optional(),
});