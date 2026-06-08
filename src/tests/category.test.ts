import request from 'supertest';
import { app } from '../app';
import {prisma } from '../config/prisma';
import jwt from 'jsonwebtoken';

// Fabricamos a pulseira VIP para os testes de categoria
const mockToken = jwt.sign(
    { userId: "123e4567-e89b-12d3-a456-426614174000" },
    process.env.JWT_SECRET || "segredo_fallback",
);

// O Sequestro (Mock): Isolamos o Prisma para não tocar no banco real durante os testes
jest.mock('../config/prisma', () => ({
        prisma: {
            category: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
            },
        },
}));

describe("Category API - POST / categories", () => {
    beforeEach(() => {
        // Limpa os mocks antes de cada teste para garantir um ambiente limpo
        jest.clearAllMocks();
    });

    // Teste 1: Segurança na porta
    it("Deve retornar erro 401 se o token de autenticação não for fornecido", async () => {
        // Simulamos uma requisição sem o token
        const response = await request(app)
            .post('/categories')
            .send({ name: "Alimentação", color: "azul" });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message', "Token de autenticação não fornecido");
        expect(prisma.category.create).not.toHaveBeenCalled();
    });

    // Teste 2: Escudo do Zod
    it("Deve retornar erro 400 se o nome da categoria não for enviado", async () => {
        // Simulamos uma requisição com dados inválidos (falta o campo 'name')
        const response = await request(app)
            .post('/categories')
            .set('Authorization', `Bearer ${mockToken}`)
            .send({ color: "azul" }); // Falta o campo 'name'

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', "Dados Inválidos");
        expect(prisma.category.create).not.toHaveBeenCalled();
    });

    // Teste 3: O Sucesso da Criação
    it("Deve criar uma nova categoria com sucesso e retornar status 201", async () => {
        // Configuramos o mock do Prisma para simular a criação bem-sucedida
        (prisma.category.create as jest.Mock).mockResolvedValue({
            id: "623e4567-e89b-12d3-a456-426614174001",
            name: "alimentação",
            color: "azul",
            userId: "123e4567-e89b-12d3-a456-426614174000",
        });

        const response = await request(app)
            .post('/categories')
            .set('Authorization', `Bearer ${mockToken}`)
            .send({ name: "Alimentação", color: "azul" });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id', "623e4567-e89b-12d3-a456-426614174001");
        expect(response.body).toHaveProperty('name', "alimentação");
        expect(prisma.category.create).toHaveBeenCalledTimes(1);
        expect(prisma.category.create).toHaveBeenCalledWith({
            data: {
                name: "alimentação",
                color: "azul",
                userId: "123e4567-e89b-12d3-a456-426614174000",
            },
        });
    });

    // Teste 4: Regra de negócio (Duplicidade)
    it("Deve retornar erro 400 se a categoria já existir para o usuário", async () => {
        // Configuramos o mock do Prisma para simular um erro de duplicidade
        (prisma.category.findFirst as jest.Mock).mockResolvedValue({
            id: "623e4567-e89b-12d3-a456-426614174001",
            name: "Alimentação",
            color: "azul",
            userId: "123e4567-e89b-12d3-a456-426614174000",
        });

        const response = await request(app)
            .post('/categories')
            .set('Authorization', `Bearer ${mockToken}`)
            .send({ name: "Alimentação", color: "azul" });

            //. Esperamos que a API retorne um erro de duplicidade
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', "Você já possui uma categoria com esse nome");
        expect(prisma.category.create).not.toHaveBeenCalled();
    }); 
});

describe ("Category API - GET / categories", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Teste 1: Segurança na porta
    it("Deve retornar erro 401 se o token de autenticação não for fornecido", async () => {
        const response = await request(app)
            .get('/categories');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message', "Token de autenticação não fornecido");
        expect(prisma.category.findMany).not.toHaveBeenCalled();
    });

    // 2. Teste 2: Usuário novo (sem categorias)
    it("Deve retornar uma lista vazia (status 200) se o usuário não tiver categorias", async () => {
        // Simulamos o banco retornando um array vazio
        (prisma.category.findMany as jest.Mock).mockResolvedValue([]);

        const response = await request(app)
            .get('/categories')
            .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
        expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    });

    // 3. Teste 3: Caminho Feliz (com categorias)
    it("Deve retornar uma lista de categorias (status 200) se o usuário tiver categorias", async () => {
        // Simulamos o banco retornando uma lista de categorias
        const mockCategories = [
            { id: "234t4567-e89b-12d3-a456-426614174000", name: "alimentação", userId: "123e4567-e89b-12d3-a456-426614174000" },
            { id: "623e4567-e89b-12d3-a456-426614174001", name: "transporte", userId: "123e4567-e89b-12d3-a456-426614174000" }
        ];
        (prisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

        const response = await request(app)
            .get('/categories')
            .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body[0]).toHaveProperty("name", "alimentação");
        expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    });
});