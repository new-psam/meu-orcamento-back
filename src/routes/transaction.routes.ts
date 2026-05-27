import { Router } from "express";
import { 
    createTransaction, 
    getTransactionById, 
    getTransactions,
    updateTransaction
} from '../controllers/transaction.controller';

const transactionRoutes = Router();

// Define que qualquer requisição POST para '/transaction'será tratada pelo nosso controller
transactionRoutes.post("/", createTransaction);
transactionRoutes.get("/", getTransactions);
transactionRoutes.get("/:id", getTransactionById);
transactionRoutes.put("/:id", updateTransaction);


export { transactionRoutes };