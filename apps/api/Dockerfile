# AgentNet — NestJS API (Core SaaS)
# Postgres uchun: build vaqtida schema.prisma provider'i sqlite→postgresql
# ga o'zgartiriladi (drift yo'q — bitta manba fayl).
FROM node:26.5.0-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Monorepo root manifestlari
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN npm install --no-audit --no-fund

# web.automate (Web Operator agenti) uchun Playwright chromium + OS-bog'liqliklari.
# MUHIM: busiz prod'da HAR brauzer-yurgizish "Executable doesn't exist" bilan
# yiqilardi — feature marketingda bor edi-yu, deploy'da umuman ishlamasdi.
# `--with-deps` kerakli apt paketlarini ham o'rnatadi (image ~400MB kattalashadi;
# Web Operator uchun zarur). Playwright versiyasi package.json bilan mos keladi.
RUN npx playwright install --with-deps chromium

# Prisma schema'ni Postgres'ga moslash + client generatsiya
RUN sed 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma > prisma/schema.prod.prisma \
    && npx prisma generate --schema=prisma/schema.prod.prisma

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Migratsiyani deploy qilib, so'ng serverni ishga tushirish.
# MUHIM (H3): ilgari `migrate deploy` muvaffaqiyatsiz bo'lsa `|| db push
# --accept-data-loss` ishlab ketardi — bu sxemaga moslash uchun prod'da
# ustun/jadval O'CHIRIB YUBORISHI (ma'lumot yo'qolishi) mumkin edi. Yana `;`
# tufayli server migratsiya natijasidan QAT'I NAZAR ishga tushardi. Endi:
# faqat `migrate deploy` (halol, versiyalangan migratsiyalar) va `&&` bilan
# server FAQAT migratsiya muvaffaqiyatli bo'lsa boshlanadi. Migratsiya
# yiqilsa konteyner xato-kod bilan to'xtaydi (deploy ovozli tarzda qulaydi,
# ma'lumot buzilmaydi).
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prod.prisma && node dist/main.js"]
