FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm install
RUN npm run prisma:generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Apply migrations, then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
