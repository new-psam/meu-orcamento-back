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
            findMany: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
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