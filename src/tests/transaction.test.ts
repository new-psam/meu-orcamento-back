import request from "supertest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { validMockTransaction, mockTransactionsList } from "./mocks/transaction.mock";
import jwt from "jsonwebtoken";

const mockToken = jwt.sign(
    { userId: "123e4567-e89b-12d3-a456-426614174000" },
    process.env.JWT_SECRET || "segredo_fallback",
        
);

// 1. O SEQUESTRO (MOCK): Avisamos ao Jest para interceptar as chamadas do Prisma
jest.mock("../config/prisma", ()=> ({
    prisma: {
        transaction: {
            create: jest.fn(), // Transforma a função de criar em uma função "espiã" vazia
            createMany: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        category: {
            findFirst: jest.fn(),
        }
    },
}));

describe("Transaction API", ()=> {
    // Limpa o histórico do nosso "espião" antes de cada teste
    beforeEach(()=> {
        jest.clearAllMocks();
    });

    // --- O CAMINHO TRISTE (SAD PATH) ---
    it("Deve retornar erro 400 se a descrição não for enviada", async ()=> {
        //Simulamos um POST para /transactions faltando a 'description' e outros campos
        const response = await request(app)
            .post("/transactions")
            .set("Authorization", `Bearer ${mockToken}`) // Simula o envio do token de autenticação
            .send({
                amount: 1500.50,
                date: "2026-05-23T10:00:00.000Z",
                type: "EXPENSE",
                // userId: "marcelino-id"
            });

        // As nossas asserções ( o que esperamos que aconteça)
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Dados inválidos");
        expect(response.body.details).toHaveProperty("description");

        // Garante que o banco de dados NÃO foi chamado
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    // --- CAMINHO FELIZ (HAPPY PATH) ---
    it("Deve criar uma transação com sucesso e retornar 201", async ()=> {
        
        // A. Ensinamos a nosssa função "espiã" a devolver esse objeto
        (prisma.transaction.create as jest.Mock).mockResolvedValue(validMockTransaction);

        // B. Disparamos a requisição correta
        const response = await request(app)
            .post("/transactions")
            .set("Authorization", `Bearer ${mockToken}`)
            .send({
                description: "Mensalidade da escola",
                amount: 1500.50,
                date: "2026-05-23T10:00:00.000Z",
                type: "EXPENSE",
                status: "PAID",
            // userId: "marcelino-id",
        });

        // C. Verificamos se tudo ocorreu perfeitamente
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty("id", "123e4567-e89b-12d3-a456-426614174000"); // O ID passou!

        // Garante que o Controller tentou salvar no banco exatamente 1 vez
        expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    });
    

    it("deve projetar 12 transações futuras se a transação for recorretne mensal", async () =>  {
        // Arrange (Preparação)
        // 1. Ensinamos o PRisma a fingir que a categoria existe e pertence ao usuário
        (prisma.category.findFirst as jest.Mock).mockResolvedValue({
            id: "123e4567-e89b-12d3-a456-426614174000",
            name: "Assinaturas",
            userId: "123e4567-e89b-12d3-a456-426614174000"
        });
        
        // 2. Ensinamos o Prisma a fingir que o createMany funcionou e devolveu 12 transações
        (prisma.transaction.createMany as jest.Mock).mockResolvedValue({
            count: 12
        });

        const newRecurringTransaction ={
            description: "Assinatura Netflix",
            amount: 29.90,
            date: new Date().toISOString(), // Data atual
            type: "EXPENSE",
            status: "PAID",
            categoryId: "123e4567-e89b-12d3-a456-426614174000", 
            isRecurring: true,
            recurrencePeriod: "MONTHLY"
        };

        // Act
        const response = await request(app)
            .post("/transactions")
            .set("Authorization", `Bearer ${mockToken}`)
            .send(newRecurringTransaction);

        // Assert (Verificação)
        expect(response.status).toBe(201);

        // Como projetamos 1 ano, o PRisma deve ter usado o createMany
        expect(prisma.transaction.createMany).toHaveBeenCalledTimes(1); 

        // Vamos inspecionar o que o Controller mando para o Prisma
        const createManyPayload = (prisma.transaction.createMany as jest.Mock).mock.calls[0][0];
        const transactionArray = createManyPayload.data;

        // Garante que gerou 12 transações
        expect(transactionArray.length).toBe(12);

        // Garante que a primeira (mês atual) manteve o status enviado e a próxima ficou pendente
        expect(transactionArray[0].status).toBe("PAID");
        expect(transactionArray[1].status).toBe("PENDING");
        
        // Garante que o "COrdão Umbilical" foi criado e é o mesmo para as duas transações
        expect(transactionArray[0].recurrenceGroupId).toBeDefined();
        expect(transactionArray[0].recurrenceGroupId).toBe(transactionArray[1].recurrenceGroupId);
    });
});

// --- BUSCAR TRANSAÇÕES (GET) ----
describe("GET /transactions", () => {
    // 1 - Valida o filtro de data e a paginação padrão (Pagina 1, Limite 10)
    it("Deve filtrar as transações por mês/ano e aplicar a paginação padrão", async () => {
        
        // Ensinamos o findMany a devolver a lista e o count a devolver o total de registros
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue(mockTransactionsList);
        (prisma.transaction.count as jest.Mock).mockResolvedValue(1);

        // Disparamos o GET enviando os Query Parameters (?month=5&year=2026&userId=marcelino-id)
        const response = await request(app)
            .get("/transactions")
            .set("Authorization", `Bearer ${mockToken}`)
            .query({ month: "5", year: "2026" });

        // Asserções das respostas HTTP
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("data");
        expect(response.body).toHaveProperty("meta");
        expect(response.body.meta).toEqual({
            total: 1,
            page: 1,
            limit: 10,
            totalPage: 1,
        });

        // Asserção do Prisma: Garante que o Controller calculou os limites de data e paginação certos
        expect(prisma.transaction.findMany).toHaveBeenCalledWith({
            where: {
                userId: "123e4567-e89b-12d3-a456-426614174000", // O userID do token
                date: {
                    gte: new Date("2026-05-01T00:00:00.000Z"),
                    lte: new Date("2026-05-31T23:59:59.999Z"),
                },
            },
            take: 10,
            skip: 0,
            orderBy: { date: "desc"},
        });
    });

    // Teste 2: Valida se o Controller obedece quando o usuário pede a página 2 com limite de 5 itens
    it("Deve aplicar paginação customizada quando os parâmetros page e limit forem enviados", async () => {
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

        const response = await request(app)
            .get("/transactions")
            .set("Authorization", `Bearer ${mockToken}`)
            .query({ month: "5", year: "2026", page: "2", limit: "5" });

        expect(response.status).toBe(200);
        expect(response.body.meta.page).toBe(2);
        expect(response.body.meta.limit).toBe(5);

        // Se é página 2 com limite 5, o Prisma tem que pular (skip) os primeiros 5 registros e pegar (take) 5
        expect(prisma.transaction.findMany).toHaveBeenCalledWith({
            where: expect.any(Object),
            take: 5,
            skip: 5,
            orderBy: { date: "desc"},
        });
    });


    it("Deve filtrar as transações por categoryId com status 200", async () => {
        // 1. Prisma simula devolvendo uma transação desssa categoria
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
            { id: "123e4567-e89b-12d3-a456-426614174000", amount: 200, categoryId: "123e4567-e89b-12d3-a456-426614174000" }
        ]);

        // 2. Fazemos a requisição passando o filtro na URL
        const response = await request(app)
            .get("/transactions?categoryId=123e4567-e89b-12d3-a456-426614174000")
            .set("Authorization", `Bearer ${mockToken}`);
        expect(response.status).toBe(200);

        // 3. A prova real: O prisma tem que receber a consulta com o filtro de categoryId correto
        expect(prisma.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    categoryId: "123e4567-e89b-12d3-a456-426614174000"
                })
            })
        );
    });

});

describe("GET /transactions/:id", () => {

    it("Deve retornar erro 404 se a transação não for encontrada", async () => {
        // Simula que o banco procurou o ID e não achou nda (retornou null)
        (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
        .get("/transactions/00000000-0000-0000-0000-000000000000").set("Authorization", `Bearer ${mockToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Transação não encontrada");
    });

    it("Deve retornar a transação com status 200 se o ID existir", async () =>{
        const mockTransaction = validMockTransaction;

        //Simulamos que o banco encontrou a transação
        (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);

        const response = await request(app)
            .get("/transactions/123e4567-e89b-12d3-a456-426614174000")
            .set("Authorization", `Bearer ${mockToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("description", "Mensalidade da escola");
    });
});

// --- ATUALIZAR A TRANSAÇÃO ----
describe("PUT /transactions/:id", () => {

    it("Deve retornar erro 400 se enviar dados de atualização inválidos", async () => {
        // Simulamos um usuário tentando atualizar o valor para um texto em vez de um número
        const response = await request(app)
            .put("/transactions/123e4567-e89b-12d3-a456-426614174000")
            .set("Authorization", `Bearer ${mockToken}`)
            .send({amount: "mil reais" });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");
    });

    it("Deve atualizar a transação com sucesso e retornar o status 200", async ()=> {
        // Preparamos o objeto que o banco vai devolver (Copiamos o mock e mudamos o status)
        const updatedTransaction = {... validMockTransaction, status: "PENDING" };

        //2. Ensinamos o Prisma a devolver a transação atualizada
        (prisma.transaction.update as jest.Mock).mockResolvedValue(updatedTransaction);

        //3. Disparamos o PUT querendo mudar o status para PENDING
        const response = await request(app)
            .put("/transactions/123e4567-e89b-12d3-a456-426614174000")
            .set("Authorization", `Bearer ${mockToken}`)
            .send({ status: "PENDING" });

        // 4. Verificamos se deu tudo certo (Isso vai falhar n afase vermelha)
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("status", "PENDING");
    });
});

// --- DELETAR TRANSAÇÃO (Delete /:id) ----
describe("DELETE /transactions/:id", () => {
    it("Deve retornar erro 400 se o ID fornecido não for válido", async () =>{
        // tentamos deletar enviando um texto qualquer no lugar do ID
        const response = await request(app)
            .delete("/transactions/id-falso-nao-uuid")
            .set("Authorization", `Bearer ${mockToken}`);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("Deve deletar a transação com sucesso e retornar status 200", async () => {
        // Ensinamos o Prisma a fingir que deletou retornando os dados do mock
        (prisma.transaction.delete as jest.Mock).mockResolvedValue(validMockTransaction);

        //Disparamos o DELETE com o UUID correto
        const response = await request(app)
            .delete("/transactions/123e4567-e89b-12d3-a456-426614174000")
            .set("Authorization", `Bearer ${mockToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("message", "Transação deletada com sucesso");
    
        // Garantinos que o comando de deletar do Prisma foi chamado
        expect(prisma.transaction.delete).toHaveBeenCalledTimes(1);
    });
});

describe("Transaction API - GET / transactions/summary", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Teste 1: Porta Trancada
    it("Deve retornar erro 401 se o token não for fornecido", async () => {
        const response = await request(app).get("/transactions/summary");
        expect(response.status).toBe(401);
    });

    // Teste 2: O Caminho Feliz (Matemática correta)
    it("Deve retornar o resumo financeiro com status 200", async () => {
        // Simulamos o banco de dados entregando 3 transações (1 receita e 2 despesas)
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
            { amount: 5000, type: "INCOME" },
            { amount: 1500, type: "EXPENSE" },
            { amount: 200, type: "EXPENSE" }
        ]);

        const response = await request(app)
            .get("/transactions/summary")
            .set("Authorization", `Bearer ${mockToken}`);

        // O nosso backend vai ter que fazer essa conta fechar
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("incomes", 5000);
        expect(response.body).toHaveProperty("expenses", 1700);
        expect(response.body).toHaveProperty("balance", 3300);
    });

});