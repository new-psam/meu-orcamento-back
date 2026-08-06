import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { createTransactionSchema } from "../dtos/create-transaction.dto"
import { z, ZodError } from "zod";
import { getTransactionSchema } from "../dtos/get-transactions.dto";
import { Prisma } from "@prisma/client";
import { AuthRequest } from "../middlewares/auth.middleware";
import { verifyCategoryOwnership } from "../services/category.service";
import { calculateTransactionSummary } from "../services/transaction.service";

export const createTransaction = async (req: AuthRequest, res: Response) => {
    try {
        //1. Validação : Passa os dados recebidos pelo nosso "porteiro" zod
        const data = createTransactionSchema.parse(req.body);

        const userId = req.userId!; // Pegamos o userID que o nosso middleware de autenticação injetou na requisição

        if (data.categoryId){
            const isCategoryValid = await verifyCategoryOwnership(data.categoryId, userId)
            if (!isCategoryValid) {
                return res.status(404).json({error: "Categoria inválida ou não pertence a este usuário" })
            }
        }


        // 2. Banco de dados: Manda o Prisma criar a linha na tabela
        const transaction = await prisma.transaction.create({
            data:{
                description: data.description,
                amount: data.amount,
                date: data.date, // O frontend vai mandar uma string ISO, o prisma converte para datetime
                type: data.type,
                status: data.status,
                userId: userId, // O ID do usuário vem do token, não da requisição
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

export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {

        const userIdToken = req.userId!; // Pegamos o userID que o nosso middleware de autenticação injetou na requisição
        // 1. O zod valida e já converte os números
        const query = getTransactionSchema.parse(req.query);

        // 2. Matemática da paginação  (skip e take)
        const skip = (query.page - 1) * query.limit;
        const take = query.limit;

        
        // 3. Criamos o filtro de data como um objeto isolado (e vazio caso não tenha mês e ano)
        const dataFilter = (query.month && query.year)
            ? {
                    date: {
                        gte: new Date(Date.UTC(query.year, query.month -1, 1, 0, 0, 0, 0)),
                        lte: new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999))
                    }
                }
            : {};

        // 4. Criamos o filtro de categoria, também como um objeto isolado (e vazio caso não tenha categoryId)
        const categoryFilter = query.categoryId
            ? { categoryId: query.categoryId }
            : {};

        // filtro de status, também como um objeto isolado (e vazio caso não tenha status)
        const statusFilter = query.status
            ? { status: query.status }
            : {};

        // 5. Montamos o "where" final usando tipagem estrita e imutabilidade
        const where: Prisma.TransactionWhereInput = {
            userId: userIdToken,
            ...dataFilter, // O "Spread" espalha o filtro de data aqui dentro (se ele existir)
            ...categoryFilter, // O "Spread" espalha o filtro de categoria aqui dentro (se ele existir)
            ...statusFilter, // O "Spread" espalha o filtro de status aqui dentro (se ele existir)
        }


        //6. Passamos a variável "where" pronta para o prisma e adicionamos o orderBy
        const transactions = await prisma.transaction.findMany({
                where,
                take,
                skip,
                orderBy: { date: 'desc'},
        });
        const total = await prisma.transaction.count({
             where // Usa o mesmo objeto para contar o total correto, incluindo o filtro de data se tiver sido aplicado
        });
        

        // 6. Devolvemos no formato paginado que a industria usa
        return res.status(200).json({
            data: transactions,
            meta: {
                total,
                page: query.page,
                limit: query.limit,
                totalPage: Math.ceil(total / query.limit),
            },
        });

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
        const transaction = await prisma.transaction.findUnique({
            where: { id, userId: req.userId! }, // Garantimos que o usuário só possa acessar suas próprias transações
        });

        // Se o prisma retornar nulo (não achou), devolvemos o nosso 404 customizado
        if(!transaction) {
            return res.status(404).json({ error: "Transação não encontrada"});
        }

        // se achou, devolvemos a transação com status 200
        return res.status(200).json(transaction);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                error: "Parâmetros inválidos",
                details: z.flattenError(error).fieldErrors,
            });
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

        const data = createTransactionSchema.partial().parse(req.body);

        // Verifica se a categoria enviada para atualização é válida
        if (data.categoryId) {
            const isCategoryValid = await verifyCategoryOwnership(data.categoryId, req.userId!);
            
            if (!isCategoryValid) {
                return res.status(404).json({ error: "Categoria inválida ou não pertence a este usuário" });
            }
        }

        const transaction =  await prisma.transaction.update({
            where: { id , userId: req.userId! },
            data,
    });

        return res.status(200).json(transaction);
    } catch (error) {
        if (error instanceof ZodError) {
            return  res.status(400).json({
                error: "Dados de atualização inválidos",
                message: z.flattenError(error).fieldErrors,
            });
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

        // mandamos para o Prisma deletar a transação
        await prisma.transaction.delete({
            where: { id, userId: req.userId! },
        });

        // Devolvemos a mensagem exata que o nosso teste está esperando
        return res.status(200).json({message: "Transação deletada com sucesso"});

    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: "ID inválido",
                details: z.flattenError(error).fieldErrors,
            });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'){
            return res.status(404).json({error: "Transação não encontrada"})
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
    } catch (error) {
        return res.status(500).json({ error: "Erro interno do servidor"});
    }
};