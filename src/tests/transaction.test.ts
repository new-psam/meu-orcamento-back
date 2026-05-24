import request from "supertest";
import { app } from "../app";
import { prisma } from "../config/prisma";

// 1. O SEQUESTRO (MOCK): Avisamos ao Jest para interceptar as chamadas do Prisma
jest.mock("../config/prisma", ()=> ({
    prisma: {
        transaction: {
            create: jest.fn(), // Transforma a função de criar em uma função "espiã" vazia
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