import swaggerJSDoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API - Meu Orçamento",
            version: "1.0.0",
            description: "Documentação oficial da API de controle financeiro pessoal.",
        },
        servers: [
            {
                url: "https://meuorcamentoapi-m9t47ll9.b4a.run",
                description: "Servidor de Produção (Nuvem)",
            },
            {
                url: "http://localhost:3000",
                description: "Servidor Local",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },
    // Aqui indicamos onde o Swagger deve procurar as anotações para gerar a vitrine
    apis: ["./src/routes/*.ts", "./src/docs/*.yaml"],
};

export const swaggerSpec = swaggerJSDoc(options);