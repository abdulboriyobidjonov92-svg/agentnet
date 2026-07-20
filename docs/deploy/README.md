# AgentNet — Production Deploy Runbook (Vercel + Fly.io, bepul-yo'naltirilgan)

Bu — **to'liq amaliy qo'llanma** (BOSQICH 3). Har qadam mobil-telefondan ham
bajarsa bo'ladigan darajada sodda. Batafsil izohlar uchun:
- Backend tafsilotlari → [`FLY_BACKEND.md`](./FLY_BACKEND.md)
- Frontend tafsilotlari → [`VERCEL_FRONTEND.md`](./VERCEL_FRONTEND.md)

## Arxitektura (nima qayerda ishlaydi)

```
  Foydalanuvchi (brauzer)
        │
        ▼
  ┌──────────────┐   NEXT_PUBLIC_API_URL    ┌────────────────────┐
  │  Vercel      │ ───────────────────────► │  Fly: agentnet-api │  (NestJS, :3001)
  │  Next.js web │                          │  + Postgres        │
  └──────┬───────┘                          └─────────┬──────────┘
         │ BFF (server) AGENT_ENGINE_URL              │ AGENT_ENGINE_URL
         │           + INTERNAL_API_TOKEN             ▼
         └──────────────────────────────────► ┌────────────────────────┐
                                               │ Fly: agentnet-engine   │ (FastAPI, :8000)
                                               └────────────────────────┘
```
- **Vercel**: Next.js frontend (bepul Hobby plan).
- **Fly.io**: 2 ta app (API + engine) + 1 Postgres node = **3 ta kichik VM**.

---

## 0-QADAM — Old shartlar (bir marta)

1. **GitHub**: repo allaqachon bor (`abdulboriyobidjonov92-svg/agentnet`).
2. **Fly.io hisob**: https://fly.io → Sign up (GitHub bilan). Karta so'raydi.
3. **Vercel hisob**: https://vercel.com → Continue with GitHub.
4. **Resend hisob** (email-OTP login uchun SHART): https://resend.com → API key
   yarating (`re_...`). Busiz API server ishga tushmaydi.
5. **(ixtiyoriy) Anthropic**: real Claude javoblari uchun `ANTHROPIC_API_KEY`.
   Bo'lmasa platforma demo/heuristik rejimda ishlaydi.
6. **(ixtiyoriy) Payme sandbox**: to'lov oqimini test qilish uchun
   `PAYME_MERCHANT_ID` + `PAYME_SECRET_KEY` (test rejim).

### flyctl CLI o'rnatish
```bash
curl -L https://fly.io/install.sh | sh     # macOS/Linux
fly auth login
```

---

## 1-QADAM — Backend'ni Fly.io'ga chiqarish

> Barcha buyruqlar repo **ildizida** (`agentnet/`) turib bajariladi.

```bash
# 1.1 Postgres (1 kichik node)
fly postgres create --name agentnet-db --region fra \
  --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1

# 1.2 Ikkala app'ni yaratamiz
fly apps create agentnet-api
fly apps create agentnet-engine

# 1.3 Postgres'ni API'ga ulaymiz (DATABASE_URL avtomatik sekret bo'ladi)
fly postgres attach agentnet-db --app agentnet-api

# 1.4 UMUMIY ichki token — uchala joyda bir xil bo'ladi (shu qiymatni saqlang!)
TOKEN=$(openssl rand -hex 32)
echo "INTERNAL_API_TOKEN = $TOKEN   ← Vercel'ga ham shu kiritiladi"
fly secrets set INTERNAL_API_TOKEN="$TOKEN" --app agentnet-api
fly secrets set INTERNAL_API_TOKEN="$TOKEN" --app agentnet-engine

# 1.5 API majburiy generatsiya-sirlari
fly secrets set \
  AUTH_JWT_SECRET="$(openssl rand -hex 32)" \
  ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --app agentnet-api

# 1.6 Login kanali (SHART) — Resend
fly secrets set RESEND_API_KEY="re_xxx" --app agentnet-api

# 1.7 (ixtiyoriy) Anthropic — ikkala app'ga
fly secrets set ANTHROPIC_API_KEY="sk-ant-xxx" --app agentnet-api
fly secrets set ANTHROPIC_API_KEY="sk-ant-xxx" --app agentnet-engine

# 1.8 (ixtiyoriy) Payme sandbox
# fly secrets set PAYME_MERCHANT_ID="xxx" PAYME_SECRET_KEY="xxx" --app agentnet-api

# 1.9 DEPLOY — avval engine, keyin API (build-konteksti farqiga e'tibor bering!)
fly deploy --config apps/agent-engine/fly.toml \
  --dockerfile apps/agent-engine/Dockerfile apps/agent-engine

fly deploy --config apps/api/fly.toml \
  --dockerfile apps/api/Dockerfile .
```

Tekshirish:
```bash
curl https://agentnet-engine.fly.dev/health     # {"status":...}
curl https://agentnet-api.fly.dev/api/health     # 200
fly status --app agentnet-api                     # mashina 'started' (uxlamaydi)
```

---

## 2-QADAM — Frontend'ni Vercel'ga chiqarish

1. https://vercel.com → **Add New → Project** → repo'ni import qiling.
2. **Root Directory** → `apps/web` (ENG MUHIM — Edit tugmasi orqali).
3. **Environment Variables** (Production) qo'shing:
   ```
   NEXT_PUBLIC_API_URL = https://agentnet-api.fly.dev
   AGENT_ENGINE_URL    = https://agentnet-engine.fly.dev
   INTERNAL_API_TOKEN  = <1.4-qadamdagi $TOKEN — AYNAN bir xil>
   ```
4. **Deploy** → 1-2 daqiqada tayyor → manzil: `https://<nom>.vercel.app`.
5. Bundan keyin har git-push → avtomatik qayta deploy.

---

## 3-QADAM — Ikki tomonni ulash (CORS)

Vercel domenini (2-qadam natijasi) API'ning CORS origin'iga bog'lang —
**busiz brauzer so'rovlari bloklanadi**:

```bash
fly secrets set NEXT_PUBLIC_APP_URL="https://<sizning-vercel-domeningiz>" \
  --app agentnet-api
```
(API avtomatik qayta ishga tushadi. `apps/api/fly.toml`'dagi placeholder
qiymat ustidan yoziladi.)

---

## 4-QADAM — Production'da real test (mobil brauzerdan)

Vercel manzilini telefon brauzerida oching va oqimni bosib o'ting:

1. **Ro'yxatdan o'tish / kirish** — email kiriting → pochtaga kelgan
   OTP-kodni tasdiqlang (Resend orqali). *Backendda: `POST /api/auth/otp/request`
   → `POST /api/auth/otp/verify`.*
2. **Agent yaratish** — dashboard'da yangi agent qo'shing (soha tanlang, chat
   sinab ko'ring). Anthropic kaliti bo'lsa real javob, bo'lmasa demo-javob.
3. **To'lov (sandbox)** — Billing/Balans → **To'ldirish** → Payme (test rejim).
   *Backendda: `POST /api/billing/topup`. `PAYME_TEST_MODE=true` allaqachon
   `fly.toml`'da; Payme sandbox kalitlari (1.8) kiritilgan bo'lishi kerak, aks
   holda topup aniq xato beradi.*

### Tez smoke-test (curl, ixtiyoriy)
```bash
# CORS to'g'ri sozlanganini tekshirish (Vercel origin bilan):
curl -i -H "Origin: https://<vercel-domen>" https://agentnet-api.fly.dev/api/health
# Javobda 'access-control-allow-origin' sarlavhasi bo'lishi kerak.
```

Muammo bo'lsa loglar:
```bash
fly logs --app agentnet-api
fly logs --app agentnet-engine
# Vercel: Dashboard → loyiha → Deployments → Runtime Logs
```

---

## ⚠️ Bepul limit va xarajat nazorati

- Ishlab turadigan resurs: **API + engine + Postgres = 3 kichik VM**
  (`shared-cpu-1x`, 512MB). `auto_stop_machines='off'` → doim yoniq (uxlamaydi).
- Fly hozir sof "bepul" emas — kichik mashinalar juda arzon, lekin **doim
  yoniq** bo'lgani uchun oyiga bir necha dollar bo'lishi mumkin.
- **Nazorat:**
  ```bash
  fly scale count 1 --app agentnet-api      # ortiqcha mashina yaratilmasin
  fly scale count 1 --app agentnet-engine
  fly scale show --app agentnet-api          # joriy holat
  ```
  Fly Dashboard → **Billing → Spending alerts** yoqib qo'ying.
- **Vercel** Hobby plan — shaxsiy/non-commercial uchun bepul.
- 512MB kamlik qilsa (Web Operator OOM) → `apps/api/fly.toml`'da
  `[[vm]] memory = "1024mb"` (xarajat oshadi).

## ⚠️ Anthropic spend-limit (tashqi dunyoga ochilishdan OLDIN tasdiqlang)

Endi platforma ommaviy internetda — har kim ro'yxatdan o'tib LLM sarflashi
mumkin. Anthropic hisobingizni himoyalang:

1. https://console.anthropic.com → **Settings → Billing / Limits**.
2. **Monthly spend limit** (oylik sarf chegarasi) belgilangan va **faol**
   ekanini tasdiqlang.
3. Kodda ham himoya bor (bularni Fly'da o'zgartirsa bo'ladi):
   - `USAGE_FREE_CHAT_PER_DAY=20` — bepul foydalanuvchiga kunlik chat.
   - `USAGE_GLOBAL_LLM_PER_DAY=2000` — butun platforma bo'yicha kunlik LLM
     chaqiruv shifti (global tormoz).
   - `AGENT_MAX_TOOL_ITERATIONS=8` — bitta agent-yugurishdagi tool-tsikl chegarasi.
4. Engine ommaviy URL'da tursa ham `INTERNAL_API_TOKEN` bilan yopiq —
   ruxsatsiz odam engine'ni to'g'ridan-to'g'ri chaqirib kalit sarflay olmaydi.

---

## Yakuniy tekshiruv ro'yxati (checklist)

- [ ] `curl .../api/health` va `.../health` → 200
- [ ] `fly status` — mashinalar `started` (uxlamaydi)
- [ ] Vercel sayti ochiladi, `NEXT_PUBLIC_API_URL` to'g'ri
- [ ] `NEXT_PUBLIC_APP_URL` Fly API'da Vercel domeniga sozlangan (CORS)
- [ ] `INTERNAL_API_TOKEN` uchala joyda AYNAN bir xil
- [ ] Ro'yxatdan o'tish (OTP) ishlaydi
- [ ] Agent yaratish + chat ishlaydi
- [ ] Sandbox to'lov (topup) oqimi ishlaydi
- [ ] Fly spending-alert + `fly scale count 1` qo'yilgan
- [ ] Anthropic oylik spend-limit faol
