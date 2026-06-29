import { prisma } from "../config/prisma";

export const calculateTransactionSummary = async (userId: string, month: number, year: number) => {
    // Definimos o início e fim do mês para o Prisma filtrar
    const startDate = new Date(year, month -1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    // 1. O Serviço fas a busca no banco
    const transactions = await prisma.transaction.findMany({
        where: { 
            userId,
            date: {
                gte: startDate,
                lte: endDate
            } },
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