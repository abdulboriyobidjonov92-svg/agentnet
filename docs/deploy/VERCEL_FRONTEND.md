# AgentNet — Frontend'ni Vercel'ga deploy qilish (BOSQICH 2)

Next.js frontend (`apps/web`) Vercel'ga deploy qilinadi. Backend (API + engine)
allaqachon Fly.io'da (BOSQICH 1). Bu bosqich frontendni Fly backendga
to'g'ri ishora qilishga sozlaydi.

Tegishli fayllar:
- `apps/web/vercel.json` — framework, build/install buyruqlari, `fra1` mintaqa (o'zgartirish shart emas)
- `apps/web/next.config.ts` — tozalandi (ishlatilmaydigan `transpilePackages` olib tashlandi)

---

## Muhim: frontend to'liq mustaqil

Tekshirildi — `apps/web` monorepo workspace paketlarini **import qilmaydi**
(`@agentnet/shared-types` → 0 ta import). Shu sabab Vercel'da **Root Directory =
`apps/web`** qilib qo'ysak, izolyatsiyalangan `npm install` + `next build` toza
ishlaydi (monorepo ildizi kerak emas).

---

## Vercel'da kerak bo'ladigan environment-o'zgaruvchilar

Frontend'ning ba'zi so'rovlari **brauzerdan** (`NEXT_PUBLIC_*`), ba'zilari
**server tomondan** (Vercel serverless — BFF `/api/chat/stream`) boradi.

| O'zgaruvchi | Qiymat | Nima uchun |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://agentnet-api.fly.dev` | Brauzer + server: NestJS API'ga so'rovlar (auth, agents, billing) |
| `AGENT_ENGINE_URL` | `https://agentnet-engine.fly.dev` | Server (BFF): chat-stream engine'ga proksilaydi |
| `INTERNAL_API_TOKEN` | **Fly'dagi bilan AYNAN bir xil qiymat** | Server (BFF): engine + refund ichki auth |

> ⚠️ **`INTERNAL_API_TOKEN` uchta joyda bir xil bo'lishi SHART**: Fly `agentnet-api`,
> Fly `agentnet-engine` va Vercel frontend. Bu — render.yaml'dagi `agentnet-shared`
> envVarGroup'ining o'rnini bosadi. Bosqich 1'da `openssl rand -hex 32` bilan
> yaratgan `$TOKEN` qiymatini shu yerga ham kiriting.
>
> `NODE_ENV=production` — Vercel avtomatik qo'yadi, qo'lda kiritish shart emas.

---

## Qadam-baqadam (mobil-telefondan ham bajarsa bo'ladi)

### 1) Vercel'da ro'yxatdan o'tish
- https://vercel.com → **Sign Up** → **Continue with GitHub** (eng oson).

### 2) Loyihani import qilish
- Dashboard → **Add New… → Project**.
- GitHub'dan `abdulboriyobidjonov92-svg/agentnet` repo'sini tanlang (kerak
  bo'lsa "Install Vercel" bilan repo'ga ruxsat bering).

### 3) ⚙️ Root Directory'ni sozlash (ENG MUHIM qadam)
- **Configure Project** ekranida **Root Directory** → **Edit** → `apps/web` tanlang.
- Framework avtomatik **Next.js** deb aniqlanadi (`vercel.json`'dan).
- Build/Install buyruqlari `apps/web/vercel.json`'dan olinadi — qo'lda tegmang.

### 4) Environment Variables qo'shish
Xuddi shu **Configure Project** ekranida (yoki keyin Settings → Environment
Variables) yuqoridagi jadvaldan 3 ta o'zgaruvchini qo'shing:
```
NEXT_PUBLIC_API_URL   = https://agentnet-api.fly.dev
AGENT_ENGINE_URL      = https://agentnet-engine.fly.dev
INTERNAL_API_TOKEN    = <Fly'dagi bilan bir xil $TOKEN>
```
Har birini **Production** (va xohlasangiz Preview) muhitiga belgilang.

### 5) Deploy
- **Deploy** tugmasini bosing. 1-2 daqiqada tayyor bo'ladi.
- Manzil: `https://<loyiha-nomi>.vercel.app` (masalan `agentnet-web.vercel.app`).

### 6) Avtomatik deploy
- Endi `claude/session-5jtomd` (yoki `master`) branchiga har push → Vercel
  avtomatik qayta deploy qiladi. Sozlash shart emas.
- Production branch'ni Settings → Git'da belgilashingiz mumkin (default: `master`).

---

## ⚠️ Keyingi qadam — CORS ulash (BOSQICH 3'da)

Vercel real domenni bergach (masalan `https://agentnet-web.vercel.app`), uni
Fly API'ning CORS origin'iga bog'lash SHART, aks holda brauzer so'rovlari
bloklanadi:

```bash
fly secrets set NEXT_PUBLIC_APP_URL="https://<sizning-vercel-domeningiz>" --app agentnet-api
```
(Bu `apps/api/fly.toml [env]`'dagi placeholder qiymatning ustidan yozadi va API
avtomatik qayta ishga tushadi.)

To'liq ulash + real test (ro'yxatdan o'tish → agent → sandbox to'lov) — **BOSQICH 3**.
