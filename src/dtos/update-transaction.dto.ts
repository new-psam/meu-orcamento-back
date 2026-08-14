import { z } from 'zod';

const transactionPeriodEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

export const updateTransactionSchema = z.object({
    description: z.string().min(1, "A descrição não pode ser vazia").optional(),
    amount: z.number().positive("O valor deve ser maior que zero").optional(),
    date: z.iso.datetime().optional(), // Mudamos para z.string().datetime() pois o express recebe string no JSON
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    status: z.enum(['PAID', 'PENDING']).optional(), // <-- SEM O DEFAULT AQUI
    categoryId: z.uuid("ID da categoria inválido").nullable().optional(),
    isRecurring: z.boolean().optional(),            // <-- SEM O DEFAULT AQUI
    recurrencePeriod: transactionPeriodEnum.optional(),
});

export type UpdateTransactionDTO = z.infer<typeof updateTransactionSchema>;