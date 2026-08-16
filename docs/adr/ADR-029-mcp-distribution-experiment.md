# ADR-029 — MCP server: distribution eksperimenti

**Sana:** 2026-08-14 · **Holat:** ACCEPTED (eksperiment sifatida)
**Supersedes:** yo'q. **Bog'liq:** ADR-025 (konnektorlar), Contract A33 (API versiyalash), SEC-10, Konstitutsiya #5/#6
**Ta'sir qiladi:** yangi tashqi interfeys yuzasi
**Kill criteria:** [`../strategy/KILL_CRITERIA.md`](../strategy/KILL_CRITERIA.md) §2

## Problem

Distribution — solo founder uchun eng qimmat muammo. Reklama byudjeti yo'q,
sotuv jamoasi yo'q.

Ayni paytda **MCP (Model Context Protocol)** de-fakto standartga aylandi:
**10 000+ faol server**, **~97M oylik SDK yuklab olish**, Linux
Foundation'ga topshirilgan `[FROM-RESEARCH]`.

Bu shuni anglatadi: Claude, Cursor va boshqa MCP-klientlarning
foydalanuvchilari **bizni o'z muhitida chaqira olishi mumkin** — ya'ni
foydalanuvchi bizning saytimizga kelishi shart emas.

Bizda esa global bozorda **noyob** narsa bor: 17 mahalliy konnektor
`[MEASURED]` (Payme, Click, Didox, soliq.uz, my.gov.uz, Eskiz, Uzum) —
ular MCP ekotizimida **umuman mavjud emas**.

## Decision

**MCP server eksperiment sifatida quriladi — V3-P2 boshida.**

**Qamrov (birinchi to'lqin): aynan 5 ta mahalliy konnektor**, faqat
**o'qish/past-risk** amallar bilan:

| # | Tool | Risk tier |
|---|---|---|
| 1 | Soliq/hisobot ma'lumotini o'qish | LOW |
| 2 | Didox hujjat holatini tekshirish | LOW |
| 3 | Uzum Market mahsulot/narx ma'lumoti | LOW |
| 4 | Valyuta/tarif ma'lumoti | LOW |
| 5 | Yetkazib berish holati (AfterShip) | LOW |

**Majburiy chegaralar:**

1. **Faqat `LOW` risk amallar.** SMS yuborish, to'lov, davlat hujjatini
   topshirish — MCP orqali **umuman ochilmaydi**
   ([`SAFETY_POLICY_LAYER.md`](../strategy/SAFETY_POLICY_LAYER.md) §3.2).
2. **Auth majburiy** — foydalanuvchi tokeni; anonim kirish yo'q.
   Konstitutsiya #1/#2 (dekoratorsiz endpoint = MEMBER) MCP tool'lariga
   ham qo'llanadi.
3. **Kvota va rate limit** — mavjud `LlmQuotaGuard`/throttler yo'lidan
   o'tadi; MCP alohida bepul kanal **emas**.
4. **Metering** — ADR-023 o'lchamlari MCP chaqiruvlariga ham yoziladi.
5. **Engine ommaviy emas** (Konstitutsiya #5) — MCP server API qatlamida
   turadi, engine'ga to'g'ridan-to'g'ri yo'l ochmaydi.
6. **Audit** — har MCP chaqiruvi `AuditLog`ga (ADR-008).

**Kill criteria:** 90 kunda **≥5 tool ishlaydi** va **≥1 tashqi klientdan
real chaqiruv** bo'lmasa → `ARCHIVE`.

## Alternatives

- **(a)** MCP'ni umuman qurmaslik (faqat o'z UI).
- **(b)** To'liq MCP yuzasi (barcha 17 konnektor + yozish amallari).
- **(c)** Faqat MCP **klient** bo'lish (tashqi MCP serverlarni iste'mol qilish).
- **(d)** Kutish — standart barqarorlashguncha.
- **(e)** Ochiq API (REST) e'lon qilish, MCP o'rniga.

## Why rejected

- **(a)** Eng arzon distribution kanalini o'tkazib yuborish. Bizning
  mahalliy konnektorlarimiz MCP ekotizimida yo'q — bu **bo'sh nisha**.
- **(b)** Yozish amallarini tashqi klientga ochish = "lethal trifecta"
  yuzasini uchinchi tomon promptiga ochish. Prompt injection MCP klienti
  tomonida sodir bo'lsa, biz uni ko'rmaymiz ham. Bu — qabul qilinmas
  darajadagi risk.
- **(c)** **Rad etilmagan, lekin boshqa masala.** MCP klient bo'lish —
  integratsiya (ADR-025 qamrovi). Bu ADR **server** tomoni, ya'ni
  distribution. Ular parallel yo'llar.
- **(d)** Standart allaqachon barqaror (Linux Foundation, 97M yuklab
  olish `[FROM-RESEARCH]`). Kutish — kech qolish.
- **(e)** Ochiq REST API distribution bermaydi: uni kimdir topib,
  o'qib, integratsiya yozishi kerak. MCP'da klient **avtomatik** kashf
  qiladi. Bundan tashqari Contract A33 (`/api/v1`) baribir Phase 9 da
  keladi — bu ADR unga zid emas.

## Long-term impact

**Ijobiy:**
- Nol reklama byudjeti bilan yangi foydalanuvchi kanali.
- MCP tool sifati bizning konnektor sifatimizni tashqi dunyoga ko'rsatadi —
  marketing emas, isbot.
- MCP interfeysi API shartnomasini toza saqlashga majbur qiladi (yaxshi
  yon ta'sir).

**Narxi / qarzi:**
- **Yangi tashqi hujum yuzasi.** Har MCP tool — auth, kvota, audit,
  risk tier bilan kelishi shart; "tez qo'shamiz" yondashuvi bu yerda
  taqiqlanadi.
- MCP spetsifikatsiyasi rivojlanmoqda — versiya qarzi bo'lishi mumkin.
- Agar eksperiment yiqilsa, olib tashlash arzon (alohida modul) —
  bu ataylab shunday loyihalangan.
