import "dotenv/config";
import  express  from "express"
import { transactionRoutes } from "./routes/transaction.routes";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import { authRoutes } from "./routes/auth.routes";
import { categoryRoutes } from "./routes/category.routes";

const app = express();

app.use(express.json());

// Rota oficial da nossa Documentação (A Vitrine!)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Nossas rotas de negócio
app.use("/auth", authRoutes);
app.use("/transactions", transactionRoutes);
app.use("/categories", categoryRoutes);

export { app };