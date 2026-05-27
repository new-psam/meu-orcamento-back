import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { createTransactionSchema } from "../dtos/create-transaction.dto"
import { uuid, z, ZodError } from "zod";
import { getTransactionSchema } from "../dtos/get-transactions.dto";

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

export const getTransactions = async (req: Request, res: Response) => {
    try {
        // 1. O zod valida e já converte os números
        const query = getTransactionSchema.parse(req.query);

        // 2. Matemática da paginação  (skip e take)
        const skip = (query.page - 1) * query.limit;
        const take = query.limit;

        // 3. lógica das datas (PEgar o primeiro e o último segundo do mês no padrão UTC)
        const startDate = new Date(Date.UTC(query.year, query.month -1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999));

        // 4. Montamos o filtro (Where)
        const where = {
            userId: query.userId,
            date: {
                gte: startDate,
                lte: endDate,
            },
        };

        //5. Disparamos o banco de dados (Buscamos os dados e o total de registros ao mesmo tempo)
        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                take,
                skip,
                orderBy: { date: 'desc'},
            }),
            prisma.transaction.count({ where })
        ]);

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

export const getTransactionById = async (req: Request, res: Response) => {
    try {
        // o zod valida se o ID na URL existe e se tem o formato UUID
        const paramsSchema = z.object({
            id: z.uuid({message: "Formato de ID inválido"}),
        })
        const { id } = paramsSchema.parse(req.params); // PEgamos o ID direto da URL

        // Mandamos o Prisma procurar a transação específica
        const transaction = await prisma.transaction.findUnique({
            where: { id },
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

export const updateTransaction = async (req: Request, res: Response) => {
    try {
        // 1- validamos o ID da URL igual fizemos na rota de busca
        const paramsSchema = z.object({
            id: z.uuid({message: "Formato de ID inválido"}),
        });
        const { id } = paramsSchema.parse(req.params);

        // 2. A Mágica do Zod: reaproveitamos o schema de criação, mas usamos o .partial()
        // Isso diz ao Zod: "Aplique as mesmas regras, mas aceite se o usuário mandar só 1 ou 2 campos"
        const data = createTransactionSchema.partial().parse(req.body);

        const transaction =  await prisma.transaction.update({
            where: { id },
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
        // Obs: Se o Prisma tentar atualizar um ID que não existe, ele cai aqui no 500
        // (Podemos refinar esse erro de banco depois, mas para o TDD passar agora, é suficiente)
        return res.status(500).json({ error: "Erro interno do servidor"});
    }
};