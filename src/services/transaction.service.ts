import { prisma } from "../config/prisma";

export const calculateTransactionSummary = async (userId: string) => {
    // 1. O Serviço fas a busca no banco
    const transactions = await prisma.transaction.findMany({
        where: { userId },
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