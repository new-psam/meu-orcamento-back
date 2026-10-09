import { PrismaClient } from '@prisma/client'
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL não foi definido na variável de ambiente .env');
}

const meuUserId = process.env.MEU_USER_ID as string;
if (!meuUserId) {
  throw new Error('MEU_USER_ID não foi definido na variável de ambiente .env');
}

const pool = new Pool({
    connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
    // ----------------------------------------------
    const ususarios = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
        },
    });

    console.log('Usuários existentes no banco de dados:');
    console.table(ususarios);
    // ----------------------------------------------
    const categoriasIniciais = [
        { name: 'Moradia', color: 'blue' },
        { name: 'Alimentação', color: 'red' },
        { name: 'Transporte', color: 'yellow' },
        { name: 'Saúde', color: 'green' },
        { name: 'Educação', color: 'purple' },
        { name: 'Lazer', color: 'orange' },
        { name: 'Investimentos', color: 'teal' },
        { name: 'Salário', color: '#10B981' },
        { name: 'Outros', color: 'gray' },
    ];

    console.log('Iniciando inserção de categorias base...');

    for (const cat of categoriasIniciais) {
        // O upsert busca pela chave única que você definiu no schema: @@unique([name, userId])
        await prisma.category.upsert({
            where: {
                name_userId: { name: cat.name, userId: meuUserId},
            },
            update: {color: cat.color}, // Não faz nada se a categoria já existir
            create: {
                name: cat.name,
                color: cat.color,
                userId: meuUserId,
            },
        });
    }

    console.log('categorias raiz criadas com sucesso!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });