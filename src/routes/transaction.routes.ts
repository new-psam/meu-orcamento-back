import { Router } from "express";
import { 
    createTransaction, 
    getTransactionById, 
    getTransactions,
    updateTransaction,
    deleteTransaction
} from '../controllers/transaction.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const transactionRoutes = Router();

// O Segurança da Porta: O Express aplica isso de cima para baixo.
// Todas as rotas declaradas ABAIXO desta linha exigirão o Token JWT!
transactionRoutes.use(authMiddleware); 

// Define que qualquer requisição POST para '/transaction'será tratada pelo nosso controller
transactionRoutes.post("/", createTransaction);
transactionRoutes.get("/", getTransactions);
transactionRoutes.get("/:id", getTransactionById);
transactionRoutes.put("/:id", updateTransaction);
transactionRoutes.delete("/:id", deleteTransaction);


export { transactionRoutes };