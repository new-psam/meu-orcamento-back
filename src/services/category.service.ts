import { z } from "zod";
import { prisma } from "../config/prisma";
import type { createCategorySchema } from "../dtos/create-category.dto";
import type { updateCategorySchema } from "../dtos/update-category.dto";

type CreateCategoryInput = z.infer<typeof createCategorySchema>;
type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const verifyCategoryOwnership = async (categoryId: string, userId: string) => {
    const category = await prisma.category.findFirst({
        where: { id: categoryId, userId },
    });
    return category; 
};

export const createCategoryService = async (data: CreateCategoryInput, userId: string) => {
    const normalizedName = data.name.trim().toLowerCase();

    const existingCategory = await prisma.category.findFirst({
        where: { 
            name: normalizedName, 
            userId: userId,
        },
    });

    if (existingCategory) {
        throw new Error("CATEGORY_NAME_CONFLICT");
    }

    return await prisma.category.create({
        data: {
            name: normalizedName,
            color: data.color,
            parentId: data.parentId,
            userId: userId,
        },
    });
};

export const getCategoriesService = async (userId: string) => {
    return await prisma.category.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
    });
};

export const updateCategoryService = async (categoryId: string, data: UpdateCategoryInput, userId: string) => {
    const existingCategory = await verifyCategoryOwnership(categoryId, userId);
    if (!existingCategory) {
        throw new Error("CATEGORY_NOT_FOUND");
    }

    // 2 - Verificar se o novo nome já existe para o usuário (se estiver sendo atualizado)
    let normalizedName = existingCategory.name;
    if (data.name) {
        normalizedName = data.name.trim().toLocaleLowerCase();

        if (normalizedName !== existingCategory.name) {
            const nameConflict = await prisma.category.findFirst({
                where: {
                    name: normalizedName,
                    userId: userId,
                },
            });

            if (nameConflict) {
                throw new Error("CATEGORY_NAME_CONFLICT");
            }
        }
    }

    // 3 - Atualizar a categoria
    return await prisma.category.update({
        where: { id: categoryId },
        data: {
            name: normalizedName,
            color: data.color !== undefined ? data.color : existingCategory.color,
        },
    });
};

export const deleteCategoryService = async (categoryId: string, userId: string) => {
    const existingCategory = await verifyCategoryOwnership(categoryId, userId);
    if (!existingCategory) {
        throw new Error("CATEGORY_NOT_FOUND");
    }

    return await prisma.category.delete({
        where: { id: categoryId },
    });
};

