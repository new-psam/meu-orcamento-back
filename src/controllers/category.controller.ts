import type { Response } from "express";
import { createCategorySchema } from "../dtos/create-category.dto";
import { updateCategorySchema } from "../dtos/update-category.dto";
import type { AuthRequest } from "../middlewares/auth.middleware";

import { z, ZodError } from "zod";
import { 
    createCategoryService,
    getCategoriesService,
    updateCategoryService,
    deleteCategoryService
 } from "../services/category.service";


export const createCategory = async (req: AuthRequest, res: Response) => {
    try {
        // 1. o Escudo valida a requisição
        const data = createCategorySchema.parse(req.body);
        const userId = req.userId!;

        const category = await createCategoryService(data, userId);

        return res.status(201).json(category);
        
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                error: "Dados Inválidos" , 
                details: z.flattenError(error).fieldErrors});
        }
        if (error instanceof Error && error.message === "CATEGORY_NAME_CONFLICT") {
            return res.status(400).json({ error: "Você já possui uma categoria com esse nome" });
        }
        return res.status(500).json({ error: "Erro interno do servidor" });
    }
};

export const getCategories = async (req: AuthRequest, res: Response) => {
    try {
        const categories = await getCategoriesService(req.userId!);
        return res.status(200).json(categories);
    } catch (_error) {
        
        return res.status(500).json({ error: "Erro interno do servidor" });
    }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
    try {
        const categoryId = req.params.id as string;
        const data = updateCategorySchema.parse(req.body);

        const updatedCategory = await updateCategoryService(categoryId, data, req.userId!);
            
        return res.status(200).json(updatedCategory);

    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                error: "Dados Inválidos" , 
                details: z.flattenError(error).fieldErrors});
        }
        if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
            return res.status(404).json({ error: "Categoria não encontrada" });
        }
        if (error instanceof Error && error.message === "CATEGORY_NAME_CONFLICT") {
            return res.status(400).json({ error: "Você já possui uma categoria com esse nome" });
        }
        return res.status(500).json({ error: "Erro interno do servidor" });
    }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
    try {
        const categoryId = req.params.id as string;
        
        await deleteCategoryService(categoryId, req.userId!);

        return res.status(204).send();
    }catch (error) {
        if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
            return res.status(404).json({ error: "Categoria não encontrada" });
        }
        return res.status(500).json({ error: "Erro interno do servidor" });
    }
};