import request from "supertest";
import { app } from "../app";
import { prisma } from "../config/prisma";

// 1. O SEQUESTRO (MOCK): Avisamos ao Jest para interceptar as chamadas do Prisma
jest.mock("../config/prisma", ()=> ({
    prisma: {
        transaction: {
            create: jest.fn(), // Transforma a função de criar em uma função "espiã" vazia
            findMany: jest.fn(),
            count: jest.fn(),
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
            .send({
                amount: 1500.50,
                date: "2026-05-23T10:00:00.000Z",
                type: "EXPENSE",
                userId: "marcelino-id"
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
        // A. Preparamos a resposta falsa que o banco deveria devolver
        const mockTransaction = {
            id: "uuid-falso-12345",
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

        // B. Ensinamos a nosssa função "espiã" a devolver esse objeto
        (prisma.transaction.create as jest.Mock).mockResolvedValue(mockTransaction);

        // C. Disparamos a requisição correta
        const response = await request(app).post("/transactions").send({
            description: "Mensalidade da escola",
            amount: 1500.50,
            date: "2026-05-23T10:00:00.000Z",
            type: "EXPENSE",
            status: "PAID",
            userId: "marcelino-id",
        });

        // D. Verificamos se tudo ocorreu perfeitamente
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty("id", "uuid-falso-12345"); // O ID falso passou!

        // Garante que o Controller tentou salvar no banco exatamente 1 vez
        expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    });
});

// --- BUSCAR TRANSAÇÕES (GET) ----
describe("GET /transactions", () => {
    // 1 - Valida o filtro de data e a paginação padrão (Pagina 1, Limite 10)
    it("Deve filtrar as transações por mês/ano e aplicar a paginação padrão", async () => {
        const mockTransactions = [
            {
            id: "uuid-falso-1",
            description: "Mensalidade da escola",
            amount: 1500.50,
            date: new Date("2026-05-10T10:00:00.000Z"),
            type: "EXPENSE",
            status: "PAID",
            categoryId: null,
            userId: "marcelino-id",
            }
        ];

        // Ensinamos o findMany a devolver a lista e o count a devolver o total de registros
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);
        (prisma.transaction.count as jest.Mock).mockResolvedValue(1);

        // Disparamos o GET enviando os Query Parameters (?month=5&year=2026&userId=marcelino-id)
        const response = await request(app)
            .get("/transactions")
            .query({ month: "5", year: "2026", userId: "marcelino-id"});

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
                userId: "marcelino-id",
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
            .query({ month: "5", year: "2026", userId: "marcelino-id", page: "2", limit: "5" });

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