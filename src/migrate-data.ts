import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({
    adapter: new PrismaPg(pool)
});

// Função  para converter data do formato brasileiro  (DD/MM/YYYY) para objeto Date
function parseDate(dateString: string): Date {
    const [day, month, year] = dateString.split('/');
    // T12:00:00Z é adicionado para evitar problemas de fuso horário
    return new Date(`${year}-${month}-${day}T12:00:00Z`);
}

async function importCSV(fileName:  string) {
    // Aponta para a pasta  'data' que está no mesmo nível do arquivo migrate-data.ts
    const filePath = path.resolve(process.cwd(), 'data', fileName);

    // Lê o conteúdo do arquivo CSV como texto
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    // Separa o texto com linhas e remove o cabeçalho
    const lines = fileContent.split('\n').slice(1);

    // Regex que corta ns vírgulas, ms que ignora as que estão dento das aspas
    const cvsRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    
    //1. Identificar o usuário no Banco
    const user = await prisma.user.findUnique({
        where: { email: 'marcelinops@gmail.com'}
    });
    if (!user) {
        throw new Error('Usuário pawn@test.com não encontrado no banco local.');
    }

    console.log(`\nIniciando importação de ${fileName} para o usuário: ${user.email}`);
    let successCount = 0;

    for (const line of lines) {
        // Ignora linhas totalmente vazias no final do arquivo
        if (line.trim() === '') continue;
        // O split(',') divide a linha em pedaços
        // Ao desestruturar apenas as 4 primeiras variáveis ,as virgulas extras são descartadas
        const [rawDate, description, rawAmount, categoryNameRaw] = line.split(cvsRegex);


        // Higienização do Número para o banco de dados
        const cleanAmountString = rawAmount
            .replace(/"/g, '') // Remove aspas duplas
            .replace(/\./g, '') // Remove pontos de milhar
            .replace(',', '.'); // Substitui vírgula decimal por ponto
        const amountNum = parseFloat(cleanAmountString);
        let cleanCategoryName = categoryNameRaw ? categoryNameRaw.replace(/"/g, '').trim() : 'Outros';

        if (isNaN(amountNum) || !rawDate) continue; // Pula linhas com valores inválidos
        
        // 2. Definir o tipo e garatinr valor positivo ( o banco espera valor absoluto)
        const type = amountNum >= 0 ? 'INCOME' : 'EXPENSE';
        const absoluteAmount = Math.abs(amountNum);
        const transactionDate = parseDate(rawDate);

        // 3. Verificar se a categoria já existe no banco de dados
        cleanCategoryName = cleanCategoryName.charAt(0).toUpperCase() + cleanCategoryName.slice(1).toLowerCase();
        let category = await prisma.category.findFirst({
            where: {
                name: {equals: cleanCategoryName, mode: 'insensitive'},userId: user.id
            }
        });
        if (!category) {
            category = await prisma.category.create({
                data: {
                    name: cleanCategoryName,
                    color: '#9CA3AF',
                    userId: user.id
                }
            });
        }

        // 4. Gravar a transação no banco de dados
        await prisma.transaction.create({
            data: {
                description: description.replace(/"/g, '').trim(),
                amount: absoluteAmount,
                type: type,
                status: 'PAID',
                date: transactionDate,
                isRecurring: false,
                userId: user.id,
                categoryId: category.id
            }
        });

        successCount++;
    }

    console.log(`✅ Sucesso! ${successCount} transações migradas de ${fileName}.`);
}

async function main() {
    try {
        await importCSV('orça 2023 - 2023.csv');
        await importCSV('orça 2023 - 2024.csv');
        await importCSV('orça 2023 - 2025.csv');
        await importCSV('orça 2023 - 2026.csv');

    } catch (error) {
        console.error('Erro durante a importação:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}main();