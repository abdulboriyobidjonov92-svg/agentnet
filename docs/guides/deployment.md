# AgentNet — Ishga tushirish (Deployment) yo'riqnomasi

Uchala servis va Postgres uchun tayyor konfiguratsiya mavjud. Ikkita yo'l bor —
**A: hammasi Render'da** (eng oddiy, bitta akkaunt) yoki
**B: web Vercel'da + backend Render'da** (Next.js uchun eng tez).

> **Muhim:** `ANTHROPIC_API_KEY` **ixtiyoriy**. Kalitsiz ham butun platforma
> ishlaydi (heuristik/demo rejim, natijalarda "offline mode" belgisi bilan).
> Kalit qo'shilsa — barcha aqlli funksiyalar to'liq Claude mulohazasiga o'tadi.

---

## Oldindan: kodni GitHub'ga chiqarish

```bash
cd C:/Users/User/Claude/Projects/agentnet
git add -A
git commit -m "AgentNet Part 2: design system + AgentOS"
git remote add origin https://github.com/<SIZNING-USERNAME>/agentnet.git
git push -u origin main
```

Menга kerak bo'lgan yagona narsa — GitHub repo (bepul) va quyidagi hosting
akkauntlaridan biri. Bularsiz men serverga chiqara olmayman (login talab qiladi).

---

## Yo'l A — hammasi Render'da (yagona qo'llab-quvvatlanadigan yo'l)

1. https://render.com — akkaunt oching (GitHub bilan kiring).
2. **New → Blueprint** → agentnet repo'sini tanlang → **Apply**.
   - `render.yaml` avtomatik o'qiladi: Postgres + 3 servis yaratiladi
     (web + api ommaviy, **engine — private service**).
3. **SEC-10 majburiy qadami** — quyidagi "SEC-10" bo'limiga qarang:
   `agentnet-api` va `agentnet-web`ga `AGENT_ENGINE_URL` ni qo'lda kiriting.
   Busiz API **boot bo'lmaydi** (ataylab: fail-closed).
4. Deploy tugagach, `agentnet-web` servis URL'i — bu sizning **jonli manzilingiz**
   (masalan `https://agentnet-web.onrender.com`).
5. (ixtiyoriy) `agentnet-engine` va `agentnet-api` → Environment →
   `ANTHROPIC_API_KEY` qo'shing → Save (avtomatik qayta deploy bo'ladi).

**Eslatma (Render free plan):** `free` servislar 15 daqiqa faoliyatsizlikdan keyin
"uxlaydi"; birinchi so'rov 30–50 soniya sekin bo'lishi mumkin. Doimiy ishlashi
uchun api/web'ni ham Starter ($7/oy) rejasiga o'tkazing. Engine allaqachon
`starter` — Render'da private service uchun `free` instance turi yo'q.

---

## Yo'l B — frontend Vercel'da + backend Render'da (**yakuniy arxitektura**, ADR-021)

Bu — **maqsadli** topologiya:

| Qatlam | Platforma |
|---|---|
| Next.js UI + BFF | **Vercel** |
| NestJS API | Render (ommaviy web servis) |
| Python agent-engine | Render (**private service**) |
| PostgreSQL | Render |
| Redis (Phase 6) | Render |
| Background worker'lar (Phase 6) | Render |

SEC-10 buni **mumkin qildi**: frontend endi engine'ni umuman bilmaydi. Chat
oqimi API orqali o'tadi (`brauzer → Vercel BFF → Render API → Render engine`),
shuning uchun frontend deploy-portativ — unga faqat ikkita env kerak.

**Backend (Render):** yuqoridagi Yo'l A'ni bajaring. `agentnet-web` servisini
saqlab qolish shart emas (Vercel uni almashtiradi), lekin zaxira sifatida
qoldirish ham xavfsiz — ikkalasi bir xil env bilan ishlaydi.

**Frontend (Vercel):**
1. https://vercel.com → **Add New → Project** → repo.
2. **Root Directory** = `apps/web` (muhim — monorepo).
3. Environment Variables (**bor-yo'g'i ikkitasi**):
   - `NEXT_PUBLIC_API_URL` = `https://<api>.onrender.com`
   - `INTERNAL_API_TOKEN` = Render'dagi `agentnet-shared` guruhidagi **aynan
     shu qiymat** (BFF `/billing/refund` va `/agents/stream` ni shu bilan
     chaqiradi; mos kelmasa 401).
   - `AGENT_ENGINE_URL` **KERAK EMAS** — frontend engine'ga bormaydi.
4. **Deploy**. Vercel bergan domen — jonli manzilingiz.
5. Render → `agentnet-api` → `NEXT_PUBLIC_APP_URL` ni **Vercel domeniga**
   o'zgartiring (CORS origin; `main.ts` bitta aniq origin qabul qiladi).

> **Ochiq qarz (ADR-021'da hujjatlashtirilgan):** chat orkestratsiyasi
> (charge → consume → refund) hamon BFF'da, ya'ni Vercel serverless
> funksiyasida ishlaydi. Funksiya davomiyligi limitiga urilsa oqim uziladi —
> pul `stream_failed` yo'li bilan **qaytariladi**, lekin javob to'liq bo'lmaydi.
> Orkestratsiyani API'ga ko'chirish alohida ADR bilan ko'riladi.

---

## Kerakli sozlamalar xulosasi

| O'zgaruvchi | Qayerda | Majburiymi | Izoh |
|---|---|---|---|
| `DATABASE_URL` | api | ✅ (avtomatik) | Render Postgres'dan blueprint orqali |
| `AGENT_ENGINE_URL` | **faqat api** | ✅ **qo'lda** (SEC-10) | engine xususiy tarmoq manzili, `http://<internal-host>:8000`. Frontend'ga KERAK EMAS |
| `INTERNAL_API_TOKEN` | engine, api, frontend | ✅ (Render'da avtomatik) | `agentnet-shared` env-guruhi. Vercel'da qo'lda ko'chiriladi |
| `NEXT_PUBLIC_API_URL` | frontend | ✅ (oldindan to'ldirilgan) | api servis URL'i |
| `NEXT_PUBLIC_APP_URL` | api | ✅ | CORS origin = frontend domeni (Vercel'ga ko'chganda yangilanadi) |
| `ANTHROPIC_API_KEY` | engine, api | ⚪ ixtiyoriy | console.anthropic.com |
| `TELEGRAM_BOT_TOKEN` | api | ⚪ ixtiyoriy | Telegram bot |

---

## SEC-10 — engine private service (Render Private Networking)

**Nima o'zgardi:** `agentnet-engine` `type: web` → `type: pserv`. Private service
`onrender.com` subdomeni **olmaydi** va ommaviy internetdan umuman ochilmaydi.
Ichki `x-internal-token` **saqlanadi** — himoya ikki qatlamli (tarmoq + ilova).

**Kod tomonidagi yagona oqibat:** frontend endi engine'ga to'g'ridan-to'g'ri
bormaydi. Chat oqimi API orqali o'tadi — `POST /api/agents/stream`
(`InternalTokenGuard` + `AuthGuard`, ya'ni "chaqiruvchi bizning BFF" **va**
"qaysi foydalanuvchi" ikkalasi ham isbotlanadi). `user_id` endi body'dan emas,
imzolangan tokendan olinadi. Pul/kvota tartibi o'zgarmadi.

### Shartlar (Render)

- Xususiy tarmoq **bitta akkaunt + bitta mintaqa** ichida ishlaydi. Uchala servis
  va DB bir xil mintaqada ekanini tekshiring (blueprint `region` ni ataylab
  belgilamaydi — mavjud servislarni ko'chirmaslik uchun).
- Private service'da `free` instance turi **yo'q** → `plan: starter`.
- `free` web servis xususiy tarmoqqa so'rov **yubora oladi** (api/web → engine
  ishlaydi), lekin xususiy tarmoqdan so'rov **qabul qila olmaydi**.
- Xususiy tarmoq uchun **10000, 18012, 18013, 19099** portlari band. Engine
  shuning uchun `PORT=8000` bilan ishga tushadi (blueprint'da aniq belgilangan).

### Migratsiya tartibi (mavjud deploy uchun)

Render servisning **turini joyida o'zgartirmaydi** (`type` — o'zgarmas maydon):

1. Render panelida mavjud **`agentnet-engine` (web) servisini o'chiring**.
   (Blueprint'dagi eski ta'rif allaqachon `pserv`ga almashtirilgan, shuning
   uchun u qayta yaratilmaydi.)
2. Blueprint'ni qayta **Apply** qiling → `agentnet-engine` endi private service
   sifatida yaratiladi.
3. Render → **agentnet-engine → Connect → Internal** → internal address'ni
   nusxalang (masalan `agentnet-engine-2j3e:8000`).
4. `agentnet-api` → Environment → `AGENT_ENGINE_URL` =
   `http://agentnet-engine-2j3e:8000` (protokol bilan!) → Save.
   **Faqat API'da** — frontend'ga bu env kerak emas.
5. Deploy tugagach smoke-test:

```bash
API_URL=https://<api>.onrender.com ENGINE_URL= ENGINE_PUBLIC_URL=https://agentnet-engine.onrender.com node scripts/smoke-test.mjs
```

`SEC-10: engine ommaviy internetdan OCHILMAYDI` tekshiruvi ✓ bo'lishi shart.

### Rollback (15 daqiqa ichida)

SEC-10 commit'ini `git revert` qiling — u bitta commit'da hammasini qaytaradi:
engine yana `type: web` / `plan: free` / `healthCheckPath: /health`,
`AGENT_ENGINE_URL` yana ommaviy URL, `validateEnv` talabi olib tashlanadi,
frontend BFF yana engine'ga to'g'ridan-to'g'ri boradi. So'ng Render panelida
`agentnet-engine` (pserv) ni o'chirib blueprint'ni Apply qiling.

**Oraliq holat xavfsiz:** `POST /api/agents/stream` endpointi revert'dan keyin
ham zararsiz qoladi (eski BFF undan foydalanmaydi) — ya'ni frontend va backend
turli tartibda deploy bo'lsa ham chat sinmaydi. Yangi BFF + eski API kombinatsiyasi
esa 404 beradi va **pul avtomatik qaytariladi** (`engine_error` yo'li), shuning
uchun avval API'ni, keyin frontend'ni deploy qiling.

## SQLite → Postgres

Lokal — SQLite (`apps/api/prisma/dev.db`). Production'da API Dockerfile
build vaqtida `schema.prisma` provider'ini avtomatik `postgresql`ga o'zgartiradi
va `prisma migrate deploy` (yoki `db push`) ishga tushiradi. Bitta manba fayl —
drift yo'q. Ma'lumot ko'chirilmaydi (dev.db lokal qoladi); production toza
bazadan boshlanadi.
