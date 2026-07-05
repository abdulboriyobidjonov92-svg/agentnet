# 🧠 AgentNet — Universal Agentic Intelligence Platform

**AgentNet** (Baraka AI) — har qanday kasbga moslashuvchan, sun'iy intellektga asoslangan agentlar platformasi.

Prezident, shifokor, o'qituvchi, dehqon, haydovchi, do'kon egasi — har kim o'z kasbiga mos AI agentlarni yaratishi va boshqarishi mumkin.

---

## 🏗️ Arxitektura

```
┌────────────────────────────────────────────────────────┐
│                      AgentNet                          │
├──────────────┬──────────────┬──────────────────────────┤
│   🌐 Web     │   ⚙️ API     │   🤖 Agent Engine        │
│   Next.js    │   NestJS     │   FastAPI (Python)       │
│   :3000      │   :3001      │   :8000                  │
├──────────────┴──────────────┴──────────────────────────┤
│   📦 Shared Types  │  🗄️ Prisma/Postgres  │  📮 Redis  │
└────────────────────────────────────────────────────────┘
```

| Servis | Texnologiya | Port | Vazifa |
|--------|-------------|------|--------|
| **Web** | Next.js + Tailwind | `:3000` | Frontend UI, dashboard, landing |
| **API** | NestJS + Prisma | `:3001` | REST API, auth, CRUD, billing |
| **Agent Engine** | FastAPI + LangChain | `:8000` | AI agentlar, streaming, halal filter |

---

## 🚀 Tez boshlash

Batafsil yo'riqnoma: [`ISHGA_TUSHIRISH.md`](./ISHGA_TUSHIRISH.md)

```bash
# 1. Klonlash
git clone <repo-url> && cd agentnet

# 2. .env sozlash
copy .env.example .env
# Clerk, Anthropic kalitlarini qo'shing

# 3. Docker servislar (Postgres + Redis)
docker compose up -d

# 4. O'rnatish
npm install

# 5. DB migratsiya
cd apps/api && npx prisma migrate dev --name init && cd ../..

# 6. Python muhit
cd apps/agent-engine && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt && cd ../..

# 7. Ishga tushirish
# Terminal 1: cd apps/agent-engine && uvicorn main:app --reload --port 8000
# Terminal 2: cd apps/api && npm run dev
# Terminal 3: cd apps/web && npm run dev
```

---

## 📁 Loyiha strukturasi

```
agentnet/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   └── src/
│   │       ├── app/            # Pages & routes
│   │       ├── components/     # UI komponentlar
│   │       └── lib/            # Utilities, i18n, API client
│   ├── api/                    # NestJS backend
│   │   ├── src/                # Modullar (agents, auth, billing...)
│   │   └── prisma/             # Schema & migratsiyalar
│   └── agent-engine/           # FastAPI Python agent runtime
│       ├── main.py             # Asosiy FastAPI server
│       ├── agent_engine.py     # Agent orkestratsiya
│       ├── halal_filter.py     # Halal/etik filter
│       ├── streaming.py        # Real-time streaming
│       ├── role_detection.py   # Kasb aniqlash
│       └── tools/              # Agent toollar (namoz, moliya, health...)
│
├── packages/
│   └── shared-types/           # Frontend/backend uchun umumiy tiplar
│
├── docs/
│   ├── architecture/           # Texnik strategiya
│   ├── guides/                 # Deployment, SDK, integratsiya
│   ├── status/                 # Prototip holati, roadmap
│   ├── prompts/                # Claude Code CTO promptlar
│   └── pitch/                  # Pitch deck va video skript
│
├── .github/workflows/          # CI/CD
├── ISHGA_TUSHIRISH.md          # Quick start
├── docker-compose.yml          # Postgres + Redis
├── turbo.json                  # Turborepo konfiguratsiya
└── package.json                # Monorepo root
```

---

## 🔑 Asosiy xususiyatlar

- **🎭 Kasb aniqlash** — Foydalanuvchi kasbiga qarab dashboard va agentlar avtomatik moslashadi
- **🤖 No-code agent yaratish** — Chat orqali o'z agentingizni yarating
- **🔗 Integratsiyalar** — Kamera (RTSP), bank, Telegram, Gmail, taqvim
- **☪️ Halal filter** — Har bir agent etik va halol standartlarga mos
- **🌐 Ko'p tilli** — O'zbek, ingliz va boshqa tillar
- **⚡ Real-time** — Streaming javoblar va jonli dashboard
- **🏪 Marketplace** — Tayyor agentlarni o'rnatish yoki sotish

---

## 📄 Hujjatlar

| Hujjat | Tavsif |
|--------|--------|
| [Texnik strategiya](./docs/architecture/texnik-strategiya.md) | Arxitektura qarorlari va reja |
| [Deployment](./docs/guides/deployment.md) | Render/Docker ga deploy qilish |
| [Connector SDK](./docs/guides/connector-sdk.md) | Tashqi xizmatlar bilan integratsiya |
| [Prototip holati](./docs/status/prototip-holati.md) | Hozirgi holatda nima ishlaydi |
| [Roadmap](./docs/status/roadmap.md) | Kelajak rejalari va WOW features |

---

## 🛠️ Tech Stack

**Frontend:** Next.js 15, React 19, Tailwind CSS, Framer Motion, Three.js, Clerk Auth  
**Backend:** NestJS 10, Prisma ORM, PostgreSQL, Redis  
**AI Engine:** FastAPI, LangChain, Anthropic Claude API  
**DevOps:** Turborepo, Docker Compose, Render, GitHub Actions

---

## 📜 Litsenziya

Private — barcha huquqlar himoyalangan.
