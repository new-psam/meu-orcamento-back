import "dotenv/config";
import  express  from "express"
import { transactionRoutes } from "./routes/transaction.routes";

const app = express();

app.use(express.json());
app.use("/transactions", transactionRoutes);

export { app };