import { z } from "zod";

// O Schema da validação
export const signupSchema = z.object({
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    email: z.email("Formato de email inválido"),
    password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

//Extrai a tipagem do TypeScript magicamente a partir do Zod
export type SignupDTO = z.infer<typeof signupSchema>;