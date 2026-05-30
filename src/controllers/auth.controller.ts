import { Request, Response } from "express";
import { signupSchema } from "../dtos/auth.dto"
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma"
import { z, ZodError } from "zod";

export const signup = async (req: Request, res: Response) => {
    try {
        // 1. O Escudo doZod agindo direto do arquivo DTO
        const { name, email, password } = signupSchema.parse(req.body);

        // 2. Verificar se o e-mail já existe
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({error: "Este e-mail já esta em uso"});
        }

        // 3. Criptografar a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Salvar no Banco
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        // 5.  Retornar sem a senha
        return res.status(201).json({
            message: "Usuário criado com sucesso",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error) {
        // O tratamento de erro do Zod continua aqui para capturar as falhas do parse acima
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                error: "Dados inválidos", 
                details: z.flattenError(error).fieldErrors 
        });
        }
        return res.status(500).json({ error: "Erro interno do servidor" });
    }
};
