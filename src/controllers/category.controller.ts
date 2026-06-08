import { Response } from "express";
import { createCategorySchema } from "../dtos/create-category.dto";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../config/prisma";
import { z, ZodError } from "zod";

export const createCategory = async (req: AuthRequest, res: Response) => {
    try {
        // 1. o Escudo valida a requisição
        const data = createCategorySchema.parse(req.body);
        const userId = req.userId!;

        // 2. Normalioza os dados (exemplo: trim, lowercase)
        const normalizedName = data.name.trim().toLowerCase();

        // 3. Regra de negócio: Verificar se a categoria já existe para o usuário
        const existingCategory = await prisma.category.findFirst({
            where: {
                name: normalizedName,
                userId: userId,
            },
        });

        if (existingCategory) {
            // O texto aqui deve bater exatamente com o que o seu teste espear
            return res.status(400).json({ error: "Você já possui uma categoria com esse nome" });
        }

        // 4. Criação do Banco
        const category = await prisma.category.create({
            data: {
                name: normalizedName,
                color: data.color,
                parentId: data.parentId,
                userId: userId,
            },
        });
        
        // 5. Retorna a resposta
        return res.status(201).json(category);

    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                error: "Dados Inválidos" , 
                details: z.flattenError(error).fieldErrors});
        }
        return res.status(500).json({ error: "Erro interno do servidor" });
    }
};

export const getCategories = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const categories = await prisma.category.findMany({
            where: { userId },
            orderBy: { name: 'asc' },
        });
        return res.status(200).json(categories);
    } catch (error) {
        
        return res.status(500).json({ error: "Erro interno do servidor" });
    }
};