import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';


// 1. Ensinamos ao TypeScript que a requisição agora pode ter um userID
export interface AuthRequest extends Request {
  userId?: string; // O ponto de interrogação indica que essa propriedade é opcional
}

// 2. Criamos o middleware de autenticação
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    // 3. Verificamos se o token de autenticação está presente no header da requisição
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Token de autenticação não fornecido' });
  }
  
  // 4. O padrão HTTP manda o token assim: "Bearer dhashdsahdjas..."
  // Precisamos separar a palavra "Bearer" do token em si
  const parts = authHeader.split(' '); // Supondo que o token seja enviado como "Bearer <token>"

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Token de autenticação inválido' });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET || "segredo_fallback"; // Substitua isso pela sua chave secreta real

  try {
    // 5. Verificamos se o token é válido e se não expirou
    const decoded = jwt.verify(token, secret) as { userId: string }; // Supondo que o payload do token tenha um campo userID

    // 6. O pulo do gato: Injetamos o ID do usuário na requisição!
    // Assim, o Controller das transações saberá exatamente de quem é a requisição
    req.userId = decoded.userId; // Agora o userID está disponível para os próximos middlewares e rotas

    // 7. tudo certo liberamos a entrada!
    return next(); // Chama o próximo middleware ou rota
  } catch (_error) {
    return res.status(401).json({error: 'Token de autenticação inválido' });
  }
}