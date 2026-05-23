import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { createTransactionSchema } from "../dtos/create-transaction.dto"
import { z, ZodError } from "zod";

export const createTransaction = async (req: Request, res: Response) => {
    try {
        //1. Validação : Passa os dados recebidos pelo nosso "porteiro" zod
        const data = createTransactionSchema.parse(req.body);

        // 2. Banco de dados: Manda o Prisma criar a linha na tabela
        const transaction = await prisma.transaction.create({
            data:{
                description: data.description,
                amount: data.amount,
                date: data.date, // O frontend vai mandar uma string ISO, o prisma converte para datetime
                type: data.type,
                status: data.status,
                userId: data.userId,
                categoryId: data.categoryId,
            },
        });

        // 3. sucesso: Devolve a transação criada com o status HTTP 201 (Created)
        res.status(201).json(transaction);
    } catch (error) {
        // 4. utilizando o zod error
        // erro de validação
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: "Dados inválidos",
                details: z.flattenError(error).fieldErrors,
            });
        }

        // erro genérico
        if (error instanceof Error) {
            return res.status(500).json({
                error: error.message,
            });
        }

        return res.status(500).json({
            error: "Erro interno do servidor",
        })
    }
};