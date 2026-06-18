# 1. Usa a imagem oficial do Node.js (versão leve 'alpine')
FROM node:20-alpine

# 2. Define a pasta onde o app vai morar dentro do servidor
WORKDIR /usr/src/app

# 3. Copia apenas os arquivos de dependências primeiro (para otimizar o cache)
COPY package*.json ./
COPY prisma ./prisma/

# 4. Instala as dependências e gera o Prisma Cliente
RUN npm install

# 5. GERA O CLIENTE DO PRISMA NA MÁQUINA LINUX 
RUN npx prisma generate

# 6. Copia todo o resto do código da sua máquina para o container
COPY . .

# 7. Converte o código TypeScript para JavaScript (Gera a pasta /dist)
RUN npm run build

# 8. Expõe a porta que a API vai conversar com o mundo externo
EXPOSE 3000

# 9. O comando final que liga a API emprodução
CMD ["npm", "start"]