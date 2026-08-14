import type { Response } from "express";
import { createTransactionSchema } from "../dtos/create-transaction.dto";
import { updateTransactionSchema } from "../dtos/update-transaction.dto";
import { z, ZodError } from "zod";
import { getTransactionSchema } from "../dtos/get-transactions.dto";
import { Prisma } from "@prisma/client";
import type { AuthRequest } from "../middlewares/auth.middleware";

import { 
    calculateTransactionSummary,
    createTransactionService,
    getTransactionService,
    updateTransactionService,
    deleteTransactionService,
    getTransactionByIdService
 } from "../services/transaction.service";

export const createTransaction = async (req: AuthRequest, res: Response) => {
    try {
        //1. Validação : Passa os dados recebidos pelo nosso "porteiro" zod
        const data = createTransactionSchema.parse(req.body);

        const userId = req.userId!; // Pegamos o userID que o nosso middleware de autenticação injetou na requisição

        const transaction = await createTransactionService(data, userId);

        // 3. sucesso: Devolve a transação criada com o status HTTP 201 (Created)
        return res.status(201).json(transaction);
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
        if (error instanceof Error && error.message === "CATEGORY_INVALID") {
            return res.status(404).json({
                error: "Categoria inválida ou não pertence a este usuário",
            });
        }

        return res.status(500).json({
            error: "Erro interno do servidor",
        })
    }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {

        const userId = req.userId!; // Pegamos o userID que o nosso middleware de autenticação injetou na requisição
        // 1. O zod valida e já converte os números
        const query = getTransactionSchema.parse(req.query);

        const result = await getTransactionService(query, userId);

        return res.status(200).json(result);

    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: "Parâmetros de busca inválidos",
                details: z.flattenError(error).fieldErrors,
            });
        }
        return res.status(500).json({ error: "Erro interno do servidor"})
    }
};

export const getTransactionById = async (req: AuthRequest, res: Response) => {
    try {
        // o zod valida se o ID na URL existe e se tem o formato UUID
        const paramsSchema = z.object({
            id: z.uuid({message: "Formato de ID inválido"}),
        })
        const { id } = paramsSchema.parse(req.params); // Pegamos o ID direto da URL

        // Mandamos o Prisma procurar a transação específica
        const transaction = await getTransactionByIdService(id, req.userId!);

        // se achou, devolvemos a transação com status 200
        return res.status(200).json(transaction);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                error: "Parâmetros inválidos",
                details: z.flattenError(error).fieldErrors,
            });
        }
        if (error instanceof Error && error.message === "TRANSACTION_NOT_FOUND") {
            return res.status(404).json({ error: "Transação não encontrada" });
        }
        return res.status(500).json({error: "Erro interno do servidor"});
    }
};

export const updateTransaction = async (req: AuthRequest, res: Response) => {
    try {
        // 1- validamos o ID da URL igual fizemos na rota de busca
        const paramsSchema = z.object({
            id: z.uuid({message: "Formato de ID inválido"}),
        });
        const { id } = paramsSchema.parse(req.params);

        const data = updateTransactionSchema.parse(req.body);

        // Captura a flag updateAll
        const updateAll = req.query.updateAll === "true";

        // passa a flag para o service
        const result = await updateTransactionService(id, data, req.userId!, updateAll);

        return res.status(200).json(result);
    } catch (error) {
        
        if (error instanceof ZodError) {
            return  res.status(400).json({
                error: "Dados de atualização inválidos",
                message: z.flattenError(error).fieldErrors,
            });
        }
        if (error instanceof Error && error.message === "CATEGORY_INVALID") {
            return res.status(404).json({
                error: "Categoria inválida ou não pertence a este usuário",
            });
        }
        if (error instanceof Error && error.message === "TRANSACTION_NOT_FOUND") {
            return res.status(404).json({ error: "Transação não encontrada" });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'){
            return res.status(404).json({error: "Transação não encontrada"})
        }
        // Obs: Se o Prisma tentar atualizar um ID que não existe, ele cai aqui no 500
        // (Podemos refinar esse erro de banco depois, mas para o TDD passar agora, é suficiente)
        return res.status(500).json({ error: "Erro interno do servidor"});
    }
};

export const deleteTransaction = async (req: AuthRequest, res: Response) => {
    try {
        // Validamos o ID da URL usando o nosso escudo Zod
        const paramsSchema = z.object({
            id: z.uuid({message: "Formato de ID inválido"}),
        });

        const { id } = paramsSchema.parse(req.params); 

        // Captura a flag deleteAll vinda da URL (?deleteAll=true)
        const deleteAll= req.query.deleteAll === "true";

        const result = await deleteTransactionService(id, req.userId!, deleteAll);

        // Devolvemos a mensagem exata que o nosso teste está esperando
        return res.status(200).json(result);

    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: "ID inválido",
                details: z.flattenError(error).fieldErrors,
            });
        }
        if (error instanceof Error && error.message === "TRANSACTION_NOT_FOUND") {
            return res.status(404).json({ error: "Transação não encontrada" });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'){
            return res.status(404).json({error: "Transação não encontrada"});
        }
        // Obs: Se o Prisma tentar atualizar um ID que não existe, ele cai aqui no 500
        // (Podemos refinar esse erro de banco depois, mas para o TDD passar agora, é suficiente)
        return res.status(500).json({ error: "Erro interno do servidor"});

    }
};

export const getTransactionSummary = async (req: AuthRequest, res: Response) => {
    try{
        const userId = req.userId!;

        const { month, year, status } = req.query;

        // 2. Convertemos para número (garantindo valores padrão se não vierem)
        const monthNumber = Number(month) || new Date().getMonth() + 1;
        const yearNumber = Number(year) || new Date().getFullYear();

        const summary = await calculateTransactionSummary(
            userId, 
            monthNumber, 
            yearNumber, 
            status as string | undefined)
            ;

        return res.status(200).json(summary);
    } catch (_error) {
        return res.status(500).json({ error: "Erro interno do servidor"});
    }
};