# AgentNet — NestJS API (Core SaaS)
# Postgres uchun: build vaqtida schema.prisma provider'i sqlite→postgresql
# ga o'zgartiriladi (drift yo'q — bitta manba fayl).
FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Monorepo root manifestlari
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund

# Prisma schema'ni Postgres'ga moslash + client generatsiya
RUN sed 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma > prisma/schema.prod.prisma \
    && npx prisma generate --schema=prisma/schema.prod.prisma

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Migratsiyani deploy qilib, so'ng serverni ishga tushirish
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prod.prisma || npx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss; node dist/main.js"]
