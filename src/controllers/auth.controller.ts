import { Request, Response } from "express";
import { signinSchema, signupSchema } from "../dtos/auth.dto"
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma"
import { z, ZodError } from "zod";
import jwt from "jsonwebtoken";

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

export const signin = async (req: Request, res: Response) => {
    try{
            // 1. O Escudo doZod agindo direto do arquivo DTO
            const { email, password } = signinSchema.parse(req.body);

            // 2. Verificar se o usuário existe
            const user = await prisma.user.findUnique({
                where: { email },
            });

            if (!user) {
                return res.status(400).json({ error: "E-mail ou senha inválidos" });
            }

            // 3. Verificar a senha
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                return res.status(400).json({ error: "E-mail ou senha inválidos" });
            }

            // 4. Gerar o token JWT
            // Usamos a chave do .env ou um fallback de segurança
            const secret = process.env.JWT_SECRET || "segredo_fallback";

            const token = jwt.sign(
                { userId: user.id },
                secret,
                { expiresIn: process.env.JWT_EXPIRES_IN || "1h" } as jwt.SignOptions
            );

            // 5. Retornar o token e os dados do usuário (sem a senha)
            return res.status(200).json({
                message: "Login bem-sucedido",
                token,
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
