# AgentNet — Bazani Supabase'da yaratish (bepul Postgres)

Fly Postgres o'rniga **Supabase**'ning bepul Postgres bazasidan foydalanamiz.
**Kod umuman o'zgarmaydi** — faqat `DATABASE_URL` sekretini Supabase satriga
qo'yamiz. Hammasi brauzerda (telefondan ham) bajariladi.

---

## 1) Supabase loyihasi yaratish

1. https://supabase.com → **Start your project** → GitHub bilan kiring.
2. **New project**:
   - **Name**: `agentnet`
   - **Database Password**: kuchli parol o'ylab toping va **saqlab qo'ying**
     (bu — DATABASE_URL ichidagi parol). Maxsus belgilar (`@`, `:`, `/`) dan
     qoching — ulanish satrini buzadi. Harf+raqamdan uzun parol yaxshi.
   - **Region**: `Central EU (Frankfurt)` — Fly `fra` bilan bir xil, tez ishlaydi.
3. **Create new project** → 1-2 daqiqa kutiladi.

---

## 2) Ulanish satrini (DATABASE_URL) olish

1. Loyiha ochilgach, yuqoridagi **Connect** tugmasini bosing.
2. **ORM** yoki **Connection string** bo'limida **"Session pooler"** ni tanlang.
   > ⚠️ MUHIM: **"Session pooler" (port 5432)** ni oling — "Transaction pooler"
   > (6543) EMAS. Prisma migratsiyalari transaction-pooler bilan ishlamaydi;
   > session-pooler ikkalasiga (migratsiya + ishlash) mos va IPv4'da ishlaydi.
3. Satr shunga o'xshaydi:
   ```
   postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```
4. `[YOUR-PASSWORD]` o'rniga 1-bosqichda o'ylab topgan **haqiqiy parolni** qo'ying.

Bu tayyor satr — bu sizning `DATABASE_URL`.

---

## 3) Fly API'ga sekret qilib qo'yish

Repo ildizida terminalda:
```bash
fly secrets set DATABASE_URL="postgresql://postgres.abcdefgh:PAROL@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" --app agentnet-api
```
> Tirnoq (`"`) ichida bo'lsin. Engine'ga DATABASE_URL kerak EMAS (u faqat API orqali ishlaydi).

---

## 4) Migratsiyalar qanday qo'llanadi?

Alohida buyruq shart emas — API'ning Dockerfile'i ishga tushganda
`prisma migrate deploy` ni avtomatik bajaradi va jadvallarni Supabase bazasida
yaratadi. Ya'ni `fly deploy` (API) o'zi bazani tayyorlaydi.

Deploydan keyin Supabase → **Table Editor**'da jadvallar (User, Agent, ...)
paydo bo'lganini ko'rasiz.

---

## Supabase bepul-reja eslatmalari

- Bepul rejada baza **1 hafta faoliyatsiz tursa "pauza"** qilinadi — brauzerdan
  bir tugma bilan qayta yoqiladi. Faol loyiha uchun muammo emas.
- Bepul: 500MB baza + 5GB trafik/oy — launch uchun yetarli.
- ⚠️ Database Password'ni yo'qotmang — Supabase uni qayta ko'rsatmaydi (faqat
  reset qilib yangisini olasiz).
