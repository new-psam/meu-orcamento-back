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

    //2. Caminho Simples: Se não for recorrente, cria apenas a transação normal
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

    // 3. Caminho recorrente: A magia da Projeção futura
    const recurrenceGroupId = randomUUID();
    const transactionToCreate = [];
    const baseDate = new Date(data.date);

    // Ajuste Dinâmico do período de recorrência
    //Se 'installments' for enviado pela interface, ele assume o controle. Se não, usamos a regra padrão
    let totalOccurrences = data.installments;
    
    const transactionInstallments = totalOccurrences ? true : false;

    if(!totalOccurrences){
        if (data.recurrencePeriod === "MONTHLY") totalOccurrences = 12;
        else if (data.recurrencePeriod === "WEEKLY") totalOccurrences = 4;
        else if (data.recurrencePeriod === "DAILY") totalOccurrences = 30;
        else if (data.recurrencePeriod === "YEARLY") totalOccurrences = 5;
        else totalOccurrences = 1;
    }

    for (let i = 0; i < totalOccurrences; i++) {
        const nextDate = new Date(baseDate);
        if (data.recurrencePeriod === "MONTHLY") nextDate.setMonth(baseDate.getMonth() + i);
        else if (data.recurrencePeriod === "WEEKLY") nextDate.setDate(baseDate.getDate() + i * 7);
        else if (data.recurrencePeriod === "DAILY") nextDate.setDate(baseDate.getDate() + i);
        else if (data.recurrencePeriod === "YEARLY") nextDate.setFullYear(baseDate.getFullYear() + i);

        const transactionDescription = transactionInstallments 
            ? `${data.description} (${i+1}/${totalOccurrences})`
            : data.description;

        transactionToCreate.push({
            // Adiciona a contagem (ex: 1/10) na descrição para facilitar o controle
            description: transactionDescription,
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

        // Removemos o status para não pagar parcelas futuras sem querer
        const { status, ...dataForBulkUpdate } = data;

        //2.1 Busca todas as transações futuras deste grupo (incluindo a atual), ordenadas por data
        const futureTransactions = await prisma.transaction.findMany({
            where: {
                userId,
                recurrenceGroupId: transaction.recurrenceGroupId,
                date: {
                    gte: transaction.date
                },
            },
            orderBy: {date: 'asc'}
        });

        const hasNewDate = data.date !== undefined;
        const newBaseDate = hasNewDate ? new Date(data.date!) : null;

        // 2.2 Monta as instruções de atualização individuais calculando o "pulo de calendário"
        const updatePromises = futureTransactions.map((tx, index) => {
            let nextDate = new Date(tx.date);

            if(hasNewDate && newBaseDate) {
                // Usamos UTC para evitar que o fuso horário mude o dia acidentalmente
                if (tx.recurrencePeriod === "MONTHLY"){
                    // Mantém o mês e ano originais, muda só o dia
                    nextDate.setUTCDate(newBaseDate.getUTCDate());
                } else if (tx.recurrencePeriod === "YEARLY"){
                    // Mantém o ano futuro original, muda o dia e o mês
                    nextDate.setUTCDate(newBaseDate.getUTCDate());
                    nextDate.setUTCMonth(newBaseDate.getUTCMonth());
                } else if (tx.recurrencePeriod === "WEEKLY") {
                    // Recalcula somando 7 dias a partir da nova data base
                    nextDate = new Date(newBaseDate);
                    nextDate.setUTCDate(newBaseDate.getUTCDate() + (index * 7));
                } else if (tx.recurrencePeriod === "DAILY") {
                    // Recalcula somando 1 dia a partir da nova data base
                    nextDate = new Date(newBaseDate);
                    nextDate.setUTCDate(newBaseDate.getUTCDate() + index);
                }
            }

            // --- NOVA LÓGICA DE PRESERVAÇÃO DE PARCELA ---
            let finalDescription = tx.description; // Padrão: mantém o que já está no banco
            
            if (dataForBulkUpdate.description) {
                // 1. Remove qualquer "(X/Y)" do nome que veio do frontend
                const baseIncomingName = dataForBulkUpdate.description.replace(/\s\(\d+\/\d+\)$/, "");
                
                // 2. Busca qual era a numeração original desta parcela específica no banco
                const originalSuffix = tx.description.match(/\s\(\d+\/\d+\)$/);
                
                // 3. Monta o nome final preservando a numeração correta
                finalDescription = originalSuffix 
                    ? `${baseIncomingName}${originalSuffix[0]}` 
                    : baseIncomingName;
            }

            // Retorna a promessa de atualização (ainda não executada)
            return prisma.transaction.update({
                where: {id: tx.id},
                data: {
                    ...dataForBulkUpdate,
                    description: finalDescription,
                    date: nextDate
                }
            });
        });

        // 2.3 Executa todas as atualizações simultaneamente de forma segura
        await prisma.$transaction(updatePromises);

        return { message: "Transações atualizadas dinamicamente com sucesso"};
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