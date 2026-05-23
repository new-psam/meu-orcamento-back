import "dotenv/config";
import express  from "express";
import { transactionRoutes } from "./routes/transaction.routes";

const app = express();

// Middleware obrigatório para o Express conseguir ler os dados em formato JSON
app.use(express.json());

// Injeta as rotas que acabamos de criar no servidor
app.use("/transactions", transactionRoutes);

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor backend a rodar com sucesso na porta ${PORT}!`);
});