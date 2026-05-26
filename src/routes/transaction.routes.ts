import { Router } from "express";
import { createTransaction, getTransactions } from '../controllers/transaction.controller';

const transactionRoutes = Router();

// Define que qualquer requisição POST para '/transaction'será tratada pelo nosso controller
transactionRoutes.post("/", createTransaction);
transactionRoutes.get("/", getTransactions);


export { transactionRoutes };