# AgentNet — Backend'ni Fly.io'ga deploy qilish (BOSQICH 1)

Bu qo'llanma `render.yaml`'dagi backend servislarni (NestJS **API** + Python
**agent-engine**) va **Postgres**'ni Fly.io'ga ko'chirish uchun. Frontend
(Next.js) alohida — Vercel'ga (BOSQICH 2, keyingi hujjat).

Yaratilgan fayllar:
- `apps/api/fly.toml` — NestJS API servisi
- `apps/agent-engine/fly.toml` — FastAPI engine servisi
- Dockerfile'lar allaqachon mavjud va `$PORT` ni to'g'ri o'qiydi — **o'zgartirish shart emas**.

---

## render.yaml → Fly.io moslik jadvali

| Render tushunchasi | Fly.io ekvivalenti |
|---|---|
| `plan: free` (web) | `[[vm]] size = "shared-cpu-1x", memory = "512mb"` |
| harakatsizlikda spin-down (sovuq start) | `auto_stop_machines = 'off'` + `min_machines_running = 1` → **uxlamaydi** |
| `healthCheckPath` | `[[http_service.checks]] path` |
| `value:` (ochiq env) | `fly.toml` ichidagi `[env]` bloki |
| `sync: false` (maxfiy) | `fly secrets set KEY=...` |
| `generateValue: true` | `fly secrets set KEY=$(openssl rand -hex 32)` |
| `fromGroup` (umumiy sir) | bir xil qiymatni HAR IKKALA app'ga `fly secrets set` |
| `fromDatabase` (DATABASE_URL) | `fly postgres attach` — DATABASE_URL'ni avtomatik sekret qiladi |

**Muhim:** `INTERNAL_API_TOKEN` — API va engine'da **AYNAN bir xil** bo'lishi
SHART (aks holda ichki chaqiruvlar 401 bo'ladi). Bir marta generatsiya qilib,
ikkala app'ga bir xil qiymat bilan qo'yamiz.

---

## 0) Bir martalik tayyorgarlik

### Fly.io CLI (`flyctl`) o'rnatish
```bash
# macOS / Linux:
curl -L https://fly.io/install.sh | sh
# Windows (PowerShell):
#   pwsh -c "iwr https://fly.io/install.sh -useb | iex"
```

### Ro'yxatdan o'tish / kirish
```bash
fly auth signup   # yangi hisob (GitHub bilan ham bo'ladi)
# yoki mavjud hisob:
fly auth login
```
> ⚠️ Fly.io hozir to'lov kartasini talab qiladi (firibgarlikka qarshi), lekin
> kichik `shared-cpu-1x` mashinalar juda arzon. Xarajat nazorati uchun pastdagi
> "Bepul limit va xarajat nazorati" bo'limiga qarang.

---

## 1) Postgres yaratish (bepul-darajaga yaqin, 1 ta kichik instance)

```bash
fly postgres create \
  --name agentnet-db \
  --region fra \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1
```
- `--initial-cluster-size 1` → bitta node (arzon, launch uchun yetarli).
- `--volume-size 1` → 1GB disk (eng kichik).
- So'ralganda `Development` (single node) presetini tanlang.

> Bu buyruq bergan **postgres parolini bir joyga saqlab qo'ying** — keyin
> kerak bo'lishi mumkin (garchi `attach` DATABASE_URL'ni avtomatik bersa ham).

---

## 2) Ikkala app'ni yaratish (deploy'siz)

Repo **ildizida** turib (monorepo — build-konteksti muhim):

```bash
# API app'ini yaratamiz (hali deploy qilmaymiz)
fly apps create agentnet-api

# Engine app'ini yaratamiz
fly apps create agentnet-engine
```
> `fly.toml`'dagi `app = "..."` nomlari shu bilan mos: `agentnet-api`,
> `agentnet-engine`. Agar bu nomlar band bo'lsa, boshqa nom tanlab, `fly.toml`
> ichidagi `app` va URL'larni (`AGENT_ENGINE_URL`, `API_URL`) mos yangilang.

---

## 3) Postgres'ni API'ga ulash (DATABASE_URL avtomatik sekret bo'ladi)

```bash
fly postgres attach agentnet-db --app agentnet-api
```
Bu `agentnet-api` app'iga `DATABASE_URL` sekretini avtomatik qo'shadi.
(Engine'ga DB kerak emas — u faqat API orqali ishlaydi.)

---

## 4) Sirlarni o'rnatish (`fly secrets set`)

### 4a) Umumiy ichki token (ikkalasida BIR XIL bo'lishi SHART)
```bash
# Bir marta generatsiya qilamiz va o'zgaruvchiga saqlaymiz:
TOKEN=$(openssl rand -hex 32)

fly secrets set INTERNAL_API_TOKEN="$TOKEN" --app agentnet-api
fly secrets set INTERNAL_API_TOKEN="$TOKEN" --app agentnet-engine
```

### 4b) API'ning majburiy generatsiya-sirlari
```bash
fly secrets set \
  AUTH_JWT_SECRET="$(openssl rand -hex 32)" \
  ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --app agentnet-api
```

### 4c) API — login kanali (KAMIDA BITTASI SHART, bo'lmasa server ishga tushmaydi)
```bash
# Email-OTP (Resend) — tavsiya etilgan minimal:
fly secrets set RESEND_API_KEY="re_xxx" --app agentnet-api

# (ixtiyoriy) SMS-OTP (Eskiz.uz):
# fly secrets set ESKIZ_EMAIL="you@mail.uz" ESKIZ_PASSWORD="xxx" --app agentnet-api
```

### 4d) API + Engine — Anthropic (ixtiyoriy; bo'lmasa demo/heuristik rejim)
```bash
fly secrets set ANTHROPIC_API_KEY="sk-ant-xxx" --app agentnet-api
fly secrets set ANTHROPIC_API_KEY="sk-ant-xxx" --app agentnet-engine
```

### 4e) API — to'lov (sandbox test uchun ixtiyoriy)
```bash
# fly secrets set PAYME_MERCHANT_ID="xxx" PAYME_SECRET_KEY="xxx" --app agentnet-api
# (PAYME_TEST_MODE=true allaqachon fly.toml [env]'da)
```

### 4f) API — Telegram (ixtiyoriy)
```bash
# fly secrets set TELEGRAM_BOT_TOKEN="xxx" --app agentnet-api
```

> `NEXT_PUBLIC_APP_URL` (CORS origin) hozircha `fly.toml [env]`'da
> `https://agentnet-web.vercel.app` placeholder. Vercel'da real domen
> olgach BOSQICH 2'da yangilaymiz.

---

## 5) Deploy qilish

Repo **ildizida** turib — tartib muhim: **avval engine, keyin API**
(API boot'da engine'ga ping qilmaydi, lekin mantiqan engine tayyor tursin).

```bash
# Engine (build-konteksti = apps/agent-engine)
fly deploy \
  --config apps/agent-engine/fly.toml \
  --dockerfile apps/agent-engine/Dockerfile \
  apps/agent-engine

# API (build-konteksti = monorepo ILDIZI '.')
fly deploy \
  --config apps/api/fly.toml \
  --dockerfile apps/api/Dockerfile \
  .
```

> Oxiridagi pozitsion argument (`apps/agent-engine` yoki `.`) — **build
> konteksti**. Buni almashtirib yubormang: engine'niki o'z papkasi, API'niki
> monorepo ildizi (chunki API Dockerfile'i `packages/` va `apps/api` ni
> ildizdan nusxalaydi).

API deploy'i Dockerfile CMD'ida `prisma migrate deploy` ni ishga tushiradi —
migratsiyalar avtomatik qo'llanadi (muvaffaqiyatsiz bo'lsa konteyner qulaydi,
ma'lumot buzilmaydi).

---

## 6) Tekshirish

```bash
# Health endpointlar 200 qaytarishi kerak:
curl https://agentnet-api.fly.dev/api/health
curl https://agentnet-engine.fly.dev/health

# Loglar:
fly logs --app agentnet-api
fly logs --app agentnet-engine

# Mashina holati (min_machines_running=1 → doim 'started'):
fly status --app agentnet-api
fly status --app agentnet-engine
```

Kutilayotgan natija: har ikkala health `{"status":"ok"}` (yoki 200), va
`fly status`'da mashinalar `started` (uxlamaydi).

---

## Bepul limit va xarajat nazorati (MUHIM)

- Fly'da narx `shared-cpu-1x` mashinalar soni va RAM'ga bog'liq. Bizda:
  **2 ta app (API + engine) × 1 mashina + 1 Postgres node** = 3 ta kichik VM.
- `auto_stop_machines='off'` doim yonib turadi → oyiga bir necha dollar
  darajasida kichik xarajat bo'lishi mumkin (aniq summa mintaqa/RAM'ga bog'liq).
- **Xarajat nazorati:**
  ```bash
  # Ortiqcha mashina yaratilmasin (min=max=1):
  fly scale count 1 --app agentnet-api
  fly scale count 1 --app agentnet-engine
  # Joriy holat:
  fly scale show --app agentnet-api
  ```
- Fly dashboard → **Billing** bo'limida "spending alerts" (xarajat
  ogohlantirishi) yoqib qo'ying.
- 512MB yetarli bo'lmasa (Web Operator OOM), `[[vm]] memory` ni `1024mb`
  qiling — bu xarajatni oshiradi.

---

## Keyingi bosqichlar

- **BOSQICH 2** — Frontend (Next.js) Vercel'ga; `NEXT_PUBLIC_API_URL` ni
  `https://agentnet-api.fly.dev` ga sozlash.
- **BOSQICH 3** — CORS ulash (`fly secrets set NEXT_PUBLIC_APP_URL=<vercel-domen>`),
  ro'yxatdan o'tish → agent yaratish → sandbox to'lov oqimini production'da test.
