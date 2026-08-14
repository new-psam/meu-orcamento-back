import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma";
import type { Prisma } from "@prisma/client";
import { type z } from "zod";
import { verifyCategoryOwnership } from "./category.service";
import type { createTransactionSchema } from "../dtos/create-transaction.dto";
import type { updateTransactionSchema } from "../dtos/update-transaction.dto";
import type { getTransactionSchema } from "../dtos/get-transactions.dto";


type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
type GetTransactionQuery = z.infer<typeof getTransactionSchema>;
type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const createTransactionService = async (data: CreateTransactionInput, userId: string) =>{
    //1. Regra de Negócio: Verifica a propriedade da categoria
    if(data.categoryId){
        const isCategoryValid = await verifyCategoryOwnership(data.categoryId, userId);
        if(!isCategoryValid){
            throw new Error("CATEGORY_INVALID");
        }
    }

    //2. Caminho Simples: Se não for recorrente, criai apenas a transação normal
    if (!data.isRecurring || !data.recurrencePeriod) {
        return await prisma.transaction.create({
            data: {
                description: data.description,
                amount: data.amount,
                date: data.date,
                type: data.type,
                status: data.status,
                userId: userId,
                categoryId: data.categoryId,
                isRecurring: false,
            },
        });
    }

    // 3. Camino recorrente: A magia da Projeção futura
    const recurrenceGroupId = randomUUID();
    const transactionToCreate = [];
    const baseDate = new Date(data.date);

    // Ajuste Dinâmico do período de recorrência
    let totalOccurrences = 1;
    if (data.recurrencePeriod === "MONTHLY") totalOccurrences = 12;
    else if (data.recurrencePeriod === "WEEKLY") totalOccurrences = 4;
    else if (data.recurrencePeriod === "DAILY") totalOccurrences = 30;
    else if (data.recurrencePeriod === "YEARLY") totalOccurrences = 5;

    for (let i = 0; i < totalOccurrences; i++) {
        const nextDate = new Date(baseDate);
        if (data.recurrencePeriod === "MONTHLY") nextDate.setMonth(baseDate.getMonth() + i);
        else if (data.recurrencePeriod === "WEEKLY") nextDate.setDate(baseDate.getDate() + i * 7);
        else if (data.recurrencePeriod === "DAILY") nextDate.setDate(baseDate.getDate() + i);
        else if (data.recurrencePeriod === "YEARLY") nextDate.setFullYear(baseDate.getFullYear() + i);
        transactionToCreate.push({
            description: data.description,
            amount: data.amount,
            date: nextDate,
            type: data.type,
            status: i === 0 ? data.status : "PENDING", // Apenas a primeira transação pode ter o status definido pelo usuário
            userId: userId,
            categoryId: data.categoryId,
            isRecurring: true,
            recurrencePeriod: data.recurrencePeriod,
            recurrenceGroupId: recurrenceGroupId
        });
    }

    // 4. Inserção em massa
    await prisma.transaction.createMany({
        data: transactionToCreate,
    });

    // 5. Retorna a primeira transação criada
    return transactionToCreate[0];
};

export const getTransactionService = async (query: GetTransactionQuery, userId: string) => {
    // 1. Matemática da paginação
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    // 2. Filtros isolados
    const dataFilter = (query.month && query.year) 
        ?   {
                date: {
                    gte: new Date(Date.UTC(query.year, query.month - 1, 1, 0, 0, 0, 0)),
                    lte: new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999))
                }
            } 
        : {};

    const categoryFilter = query.categoryId ? { categoryId: query.categoryId } : {};
    const statusFilter = query.status ? { status: query.status } : {};

    // 3. Monta o "where" unificado
    const where: Prisma.TransactionWhereInput = {
        userId: userId,
        ...dataFilter, // O "Spread" espalha o filtro de data aqui dentro (se ele existir)
        ...categoryFilter, // O "Spread" espalha o filtro de categoria aqui dentro (se ele existir)
        ...statusFilter // O "Spread" espalha o filtro de status aqui dentro (se ele existir)
    };

    // 4. Busca no banco de dados
    const transactions = await prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { date: "desc" }
    });

    const total = await prisma.transaction.count({ where });

    // 5. Devolve o objeto paginado para o controller
    return {
        data: transactions,
        meta: {
            total,
            page: query.page,
            limit: query.limit,
            totalPage: Math.ceil(total / query.limit)
        },
    };
};

export const getTransactionByIdService = async (id: string, userId: string) => {
    const transaction = await prisma.transaction.findUnique({
        where: { id, userId }
    });

    if (!transaction) {
        throw new Error("TRANSACTION_NOT_FOUND");
    }
    return transaction;
};

export const updateTransactionService = async (id: string, data: UpdateTransactionInput, userId: string, updateAll?: boolean) => {
    // 1. procuramos a transação alvo
    const transaction = await prisma.transaction.findUnique({
        where: { id, userId}
    });

    if (!transaction) {
        throw new Error("TRANSACTION_NOT_FOUND");

    }

    if (data.categoryId) {
        const isCategoryValid = await verifyCategoryOwnership(data.categoryId, userId);
        if (!isCategoryValid) {
            throw new Error("CATEGORY_INVALID");
        }
    }

    // 2. Caminho em Massa: Se pediu updateAll E a transação pertence a um grupo
    if (updateAll && transaction.recurrenceGroupId) {
        await prisma.transaction.updateMany({
            where: {
                userId, 
                recurrenceGroupId: transaction.recurrenceGroupId,
                date: {
                    gte: transaction.date
                },
            },
            data: data,
        });

        return { message: "Transações atualizadas com sucesso"};
    }


    // 3. Caminho simples: Atualiza apenas uma
    const updateTransaction = await prisma.transaction.update({
        where: { id, userId },
        data: data,
    });
    
    return updateTransaction;
};

export const deleteTransactionService = async (id: string, userId: string, deleteAll?: boolean) => {
    // 1. Primeiro procuramos a transação alvo para entender a data e se ela tem um grupo de recorrência
    const transaction = await prisma.transaction.findUnique({
        where: { id, userId },
    });

    if (!transaction) {
        throw new Error("TRANSACTION_NOT_FOUND");
    }

    // 2. Se o usuário pediu para deletar todas as futuras e a transação pertence a um grupo
    if (deleteAll && transaction.recurrenceGroupId) {
        await prisma.transaction.deleteMany({
            where: {
                userId,
                recurrenceGroupId: transaction.recurrenceGroupId,
                date: {
                    gte: transaction.date, // Apenas as transações futuras (ou a própria)
                },
            },

        });
        return {message: "Transações deletadas com sucesso"};
    }
    // O prisma automaticamente dispara o erro P2025 se a transação não existir ou não pertencer ao usuário
    await prisma.transaction.delete({
        where: { id, userId },
    });

    return {message: "Transação deletada com sucesso"};
};

export const calculateTransactionSummary = async (
    userId: string, month: number, year: number, status?: string) => {
    // Definimos o início e fim do mês para o Prisma filtrar
    const startDate = new Date(year, month -1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    // 1. O Serviço faz a busca no banco
    const transactions = await prisma.transaction.findMany({
        where: { 
            userId,
            date: {
                gte: startDate,
                lte: endDate
            },
            ...(status ? {status: status as "PAID" | "PENDING"} : {})
        },
        select: { amount: true, type: true}
    });

    // 2. O serviço faz a matemática do negócio
    const { incomes, expenses} = transactions.reduce(
        (acc, transaction) => {
            if (transaction.type === 'INCOME') {
                acc.incomes += Number(transaction.amount);
            } else if (transaction.type === 'EXPENSE') {
                acc.expenses += Number(transaction.amount);
            }
            return acc; // Passa o balse atualizado para a próxima interação
        },
        { incomes: 0, expenses: 0} // Este é o nosso acumulador inicial (acc)
    );

    return {
        incomes,
        expenses,
        balance: incomes - expenses
    };
}