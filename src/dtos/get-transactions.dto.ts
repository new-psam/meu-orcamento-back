import { z } from "zod";

export const getTransactionSchema = z.object({
    // coerce transforma a string da URL em número automaticamente
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(1900).max(2100),
    userId: z.string().min(1, "O ID do usuário é obrigatório"),

    // Paginação com valores padrão caso o usuário não envie na URL
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(100).optional().default(10),
});