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

## Yo'l A — hammasi Render'da (tavsiya: eng kam qadam)

1. https://render.com — bepul akkaunt oching (GitHub bilan kiring).
2. **New → Blueprint** → agentnet repo'sini tanlang → **Apply**.
   - `render.yaml` avtomatik o'qiladi: Postgres + 3 servis yaratiladi.
3. Deploy tugagach, `agentnet-web` servis URL'i — bu sizning **jonli manzilingiz**
   (masalan `https://agentnet-web.onrender.com`).
4. (ixtiyoriy) `agentnet-engine` va `agentnet-api` → Environment →
   `ANTHROPIC_API_KEY` qo'shing → Save (avtomatik qayta deploy bo'ladi).

**Eslatma (Render free plan):** servislar 15 daqiqa faoliyatsizlikdан keyin
"uxlaydi"; birinchi so'rov 30–50 soniya sekin bo'lishi mumkin. Doimiy ishlashi
uchun har servisni Starter ($7/oy) rejasiga o'tkazing.

---

## Yo'l B — web Vercel'da + backend Render'da

**Backend (Render):** yuqoridagi Yo'l A'ni bajaring, lekin `agentnet-web`
servisini o'chirib qo'yishingiz mumkin (faqat engine + api + db kerak).

**Web (Vercel):**
1. https://vercel.com — GitHub bilan kiring → **Add New → Project** → repo.
2. **Root Directory** = `apps/web` (muhim — monorepo).
3. Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://agentnet-api.onrender.com`
   - `AGENT_ENGINE_URL` = `https://agentnet-engine.onrender.com`
4. **Deploy**. Vercel bergan URL — sizning jonli manzilingiz.

---

## Kerakli sozlamalar xulosasi

| O'zgaruvchi | Qayerda | Majburiymi | Izoh |
|---|---|---|---|
| `DATABASE_URL` | api | ✅ (avtomatik) | Render Postgres'dan blueprint orqali |
| `AGENT_ENGINE_URL` | api, web | ✅ (oldindan to'ldirilgan) | engine servis URL'i |
| `NEXT_PUBLIC_API_URL` | web | ✅ (oldindan to'ldirilgan) | api servis URL'i |
| `ANTHROPIC_API_KEY` | engine, api | ⚪ ixtiyoriy | console.anthropic.com |
| `TELEGRAM_BOT_TOKEN` | api | ⚪ ixtiyoriy | Telegram bot |

## SQLite → Postgres

Lokal — SQLite (`apps/api/prisma/dev.db`). Production'da API Dockerfile
build vaqtida `schema.prisma` provider'ini avtomatik `postgresql`ga o'zgartiradi
va `prisma migrate deploy` (yoki `db push`) ishga tushiradi. Bitta manba fayl —
drift yo'q. Ma'lumot ko'chirilmaydi (dev.db lokal qoladi); production toza
bazadan boshlanadi.
