import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
    eslint.configs.recommended,
    
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            
            globals: {
                ...globals.node,
                ...globals.browser,
            },

            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    ...tseslint.configs.recommendedTypeChecked,

    {
        rules: {
            "no-undef": "off", // O typeScript já faz o trabalho de verificar variáveis indefinidas

            // Boas práticas
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],

            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/await-thenable": "error",

            // Permite async sem await (útil em controllers)
            "@typescript-eslint/require-await": "off",
        },
    },

    // --- ZONA DE TOLERÂNCIA PARA TESTES ---
    {
        files: ["**/*.test.ts"],
        rules: {
        "@typescript-eslint/no-unsafe-member-access": "off", 
        "@typescript-eslint/no-unsafe-assignment": "off",    
        "@typescript-eslint/unbound-method": "off"           
        }
    }
);
        