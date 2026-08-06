import { z } from 'zod';


// 1. O Schema de validação (regras de negócio para a entrada de dados)
export const createTransactionSchema = z.object({
    description: z.string().min(1, "A descrição é obrigatória"),
    amount: z.number().positive("O valor deve ser maior que zero"),
    date: z.iso.datetime(), //Exige um formato de data válido (ISO 8601)
    type: z.enum(['INCOME', 'EXPENSE']),
    status: z.enum(['PAID', 'PENDING']).optional().default('PENDING'),
    isRecurring: z.boolean().optional().default(false),
    categoryId: z.uuid("ID da categoria inváido").optional(),
    //userId: z.string(), //O ID do usuário que criamos no Prisma Studio
});

// 2. Extraímos o tipo do TypeScript automaticamente a partir di Zod
export type CreateTransactionDTO = z.infer<typeof createTransactionSchema>;