FROM node:20-bookworm-slim

WORKDIR /app

# Install OS deps needed by Prisma engines
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma
COPY assets ./assets
COPY src ./src

RUN npm install
RUN npm run prisma:generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Apply migrations, then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
