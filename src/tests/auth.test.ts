import request from 'supertest';
import { prisma } from "../config/prisma"
import bcrypt from "bcrypt";
import { app } from '../app';

// 1. MOCK DO PRISMA E DO BCRYPT
jest.mock("../config/prisma", () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
    },
}));

jest.mock("bcrypt", () => ({
    hash: jest.fn().mockResolvedValue("senha_criptografada_mock"),
}));

describe("Rotas de Autenticação", ()=> {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // -- CADASTRO (POST /auth/signup) ----
    describe("POST /auth/signup", () => {
        it("Deve retornar erro 400 se faltarem dados obrigatórios", async () => {
            const response = await request(app).post("/auth/signup").send({
                email: "teste@teste.com"
                // faltando nome e password de propósito
            });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty("error");
        });

        it("Deve criar um usuário com sucesso, retornar 201 e não devolver a senha", async () =>{
            // Fingimos que o e-mail ainda não existe no banco
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

            // Fingimos a criação do usuário
            (prisma.user.create as jest.Mock).mockResolvedValue({
                id: "123e4567-e89b-12d3-a456-426614174000",
                name: "Marcelino",
                email: "teste@teste.com",
                password: "senha_criptografada_mock",
            });

            const response = await request(app).post("/auth/signup").send({
                name: "Marcelino",
                email: "teste@teste.com",
                password: "senhaSuperSegura123",
            });

            expect(response.status).toBe(201);
            expect(response.body.user).toHaveProperty("email", "teste@teste.com");

            // TESTE DE SEGURANÇA"A senha NUNCA pode voltar na resposta da API
            expect(response.body.user).not.toHaveProperty("password");

            // Garantimos que houve criptografia
            expect(bcrypt.hash).toHaveBeenCalled();

            // Garantimos que a senha salva foi a criptografada
            expect(prisma.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    password: "senha_criptografada_mock",
                }),
            });
        });
    });
});