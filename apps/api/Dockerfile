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
# 2026-08-12 INSIDENTI — migratsiya BOOT yo'lidan CHIQARILDI.
#
# Yuqoridagi mulohaza (migratsiya avval, keyin server) TO'G'RI edi, lekin
# u BITTA narsani hisobga olmagan: `migrate deploy` server portni
# ochishdan OLDIN tugashi kerak. Baza endi Supabase'da (ap-northeast-1,
# ya'ni tarmoq kechikishi katta) va Render FREE instansi sovuq startda
# sekin. Natijada ketma-ketlik Render'ning port-skan oynasidan oshib
# ketdi va deploy AYNAN shu sababdan yiqildi:
#     ==> Timed Out
#     ==> Detected service running on port 10000   <- 1 soniya KECH
# Ilova aslida ishlagan — Render uni kutib ulgurmagan va konteynerni
# o'chirgan. Ya'ni migratsiyaning boot'da turishi mavjudlikni (uptime)
# migratsiya kechikishiga BOG'LAB qo'yadi.
#
# ENDI: konteyner DARHOL portni ochadi. Migratsiya — ALOHIDA qadam:
#     npx prisma migrate deploy --schema=prisma/schema.prod.prisma
# (lokal/CI'dan MIGRATION_URL bilan, yoki Render "One-Off Job").
# MUHIM: port 5432 (session pooler) ishlatilsin — 6543 (transaction)
# da `migrate deploy` advisory-lock'da MUZLAB QOLADI.
#
# YO'QOTILGAN KAFOLAT (halol): endi server sxema eskirgan bo'lsa ham
# ishga tushadi. Shu sababli migratsiya deploy'dan OLDIN qo'lda
# bajarilishi SHART — bu `render.yaml` va runbook'da yozilgan.
CMD ["node", "dist/main.js"]
