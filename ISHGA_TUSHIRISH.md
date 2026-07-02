# AgentNet — Ishga tushirish yo'riqnomasi

## 1-qadam: .env sozlash

```bash
cd C:\Users\User\Claude\Projects\agentnet
copy .env.example .env
```

`.env` faylni oching va quyidagilarni to'ldiring:

| O'zgaruvchi | Qayerdan olish |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | https://clerk.com → Create app → API Keys |
| `CLERK_SECRET_KEY` | Yuqoridagi sahifadan |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |

## 2-qadam: Postgres + Redis (Docker)

```bash
docker compose up -d
```

## 3-qadam: Paketlarni o'rnatish

```bash
npm install
```

## 4-qadam: DB migratsiya

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
cd ../..
```

## 5-qadam: Python muhit (FastAPI)

```bash
cd apps/agent-engine
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cd ../..
```

## 6-qadam: Barcha servislarni ishga tushirish

**Terminal 1** — FastAPI (agent engine):
```bash
cd apps/agent-engine
.venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**Terminal 2** — NestJS (API):
```bash
cd apps/api
npm run dev
```

**Terminal 3** — Next.js (web):
```bash
cd apps/web
npm run dev
```

## Manzillar

| Servis | Manzil |
|---|---|
| Web UI | http://localhost:3000 |
| NestJS API | http://localhost:3001/api/docs |
| FastAPI | http://localhost:8000/docs |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

## Tez test

1. http://localhost:3000 oching
2. Ro'yxatdan o'ting (Clerk)
3. "Yangi agent" bosing
4. Nom: "Namoz yordamchi", system prompt: "Sen namoz vaqtlari yordamchisan."
5. Tools: "Namoz vaqtlari" belgilang
6. Yarating → Suhbat boshing
7. "Bugungi namoz vaqtlari?" yozing
