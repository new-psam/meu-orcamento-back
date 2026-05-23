import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// 1. Cria a piscina de conexões usando o driver nativo do Postgres
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// 2. Cria o adaptador do PRisma
const adapter = new PrismaPg(pool);

// 3. Passa o adaptdor para o construtor do PrismaClient
export const prisma = new PrismaClient({
    adapter,
    log: ["query", "error"],
});