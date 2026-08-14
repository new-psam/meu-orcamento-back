export const validMockTransaction = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    description: "Mensalidade da escola",
    amount: 1500.50,
    date: new Date("2026-05-23T10:00:00.000Z"),
    type: "EXPENSE",
    status: "PAID",
    categoryId: null,
    userId: "marcelino-id",
    createdAt: new Date(),
    updatedAt: new Date(),
};


// Exportamos uma lista para testar a paginação/busca mútipla
export const mockTransactionsList = [
    validMockTransaction, // Reutilizamos o objeto de cima!
    {
        ...validMockTransaction, // Copiamos tudo do primeiro e só mudamos o que importa
        id: "987fcdeb-51a2-43d7-9012-345678901234",
        description: "Salário",
        amount: 5000.00,
        type: "INCOME",
    }
];