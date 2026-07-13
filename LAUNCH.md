# AgentNet — Internetga chiqarish checklist'i

Kod tomondan barcha audit-topilmalari (C1–C3, H1–H4, M5–M9, L10–L13) yopilgan va
observability + config-validatsiya qo'shilgan. Quyidagilar — **faqat siz bajara
oladigan** operatsion qadamlar (real kalitlar, pul, biznes-onboarding). Kod bilan
avtomatlashtirib bo'lmaydi.

---

## 1. Render'da sirlarni to'ldirish (MAJBURIY — aks holda boot to'xtaydi)

`render.yaml`da avtomatik generatsiya bo'ladiganlar (`generateValue`):
`ENCRYPTION_KEY`, `AUTH_JWT_SECRET`, `INTERNAL_API_TOKEN` — **qo'lda kiritish shart emas**.

Qo'lda kiritilishi kerak (Render → servis → Environment):

| Kalit | Servis | Nima uchun | Bo'lmasa |
|---|---|---|---|
| `RESEND_API_KEY` | api | email-OTP (login) | email-login o'chadi (boot **qulamaydi** endi — telefon ishlasa) |
| `ANTHROPIC_API_KEY` | api + engine | real Claude javoblari | demo/heuristik rejim |
| `PAYME_MERCHANT_ID` / `PAYME_SECRET_KEY` | api | balans to'ldirish | to'lov o'chadi |
| `CLICK_SERVICE_ID` / `CLICK_SECRET_KEY` / `CLICK_MERCHANT_ID` | api | Click to'lov | Click o'chadi |
| `ESKIZ_EMAIL` / `ESKIZ_PASSWORD` | api | telefon-OTP (SMS) | telefon-login o'chadi |
| `TELEGRAM_BOT_TOKEN` | api | Telegram bot + brifing | bot o'chadi |

> **Muhim:** kamida BITTA login-kanali kerak — `RESEND_API_KEY` (email) YOKI
> `ESKIZ_EMAIL`+`ESKIZ_PASSWORD` (telefon). Ikkalasi ham yo'q bo'lsa API prod'da
> aniq xabar bilan boot'da to'xtaydi (`validateEnv`).

Boot'dan keyin loglarda `validateEnv` yetishmayotgan narsalarni ro'yxat qilib beradi.

## 2. Infra plan qarori (H4 — sizning pulingiz)

Hozir hamma servis `plan: free`:
- **Free Postgres ~90 kunda O'CHIRILADI** → jonli foydalanuvchidan oldin `render.yaml`da
  `databases[].plan: free` → `starter` (yoki backup rejasi).
- Web servislar spin-down (30-60s sovuq start) → kerak bo'lsa `plan: starter`.
- Engine og'ir CV-kutubxonalari bazadan chiqarilgan (M5/H4) — free 512MB'ga sig'adi.

## 3. Deploy'dan keyin smoke-test (2 daqiqa)

```bash
API_URL=https://<api>.onrender.com \
ENGINE_URL=https://<engine>.onrender.com \
INTERNAL_API_TOKEN=<render'dagi qiymat> \
node scripts/smoke-test.mjs
```
Uchala servis tirikligini + engine ichki-auth (C1) + Swagger prod-gate (M7) tekshiradi.

## 4. Qo'lda to'liq end-to-end (real kalitlar bilan, BIR MARTA)

Bu haqiqiy oqim — avtomatlashtirib bo'lmaydi (real LLM + real to'lov):
1. Ro'yxatdan o'tish → email/telefon OTP keldi va kirish ishladi.
2. Agent yaratish (compose yoki qo'lda).
3. Chat → **haqiqiy Claude javobi** keldi (demo emas), balansdan 500 so'm yechildi.
4. Balans to'ldirish → Payme **test** kvitansiyasi → webhook → balans oshdi.
5. `/api/billing/me` — ledgerda charge + topup ko'rinadi.

## 5. Biznes/tashqi (kod emas)

- [ ] **Payme/Click merchant onboarding** tugagan (real to'lov uchun) + marketplace
      kreator payout rails (hozir "kanal ulanmagan, balans saqlanadi" deb halol).
- [ ] **Halal filtr** — Shariah kengashi toifalar/chegaralarni tasdiqlagan (kodda eslatma bor).
- [ ] Maxfiylik siyosati / Foydalanish shartlari sahifalari (GDPR export/delete allaqachon bor).
- [ ] (ixtiyoriy) **Sentry** — `AllExceptionsFilter` allaqachon strukturaviy loglaydi; DSN
      qo'shsangiz filter ichidan yuborishni ulash mumkin.

---

**Xulosa:** kod tayyor. Yuqoridagi 1–4 bajarilib, smoke-test + bitta qo'lda e2e o'tsa —
ehtiyotkor (beta) launch uchun tayyor. 5-bo'lim biznes jarayoni.
