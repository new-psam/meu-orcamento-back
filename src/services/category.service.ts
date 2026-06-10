import { prisma } from "../config/prisma";

export const verifyCategoryOwnership = async (categoryId: string, userId: string) => {
    const category = await prisma.category.findFirst({
        where: { id: categoryId, userId },
    });
    return category; 
};