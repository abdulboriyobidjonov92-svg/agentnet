# ADR-025 — Konnektor strategiyasi: mahalliyni qur, kengni sotib ol

**Sana:** 2026-08-14 · **Holat:** ACCEPTED
**Supersedes:** yo'q. **Kengaytiradi:** Contract A11/A40, `docs/guides/connector-sdk.md`
**Bog'liq:** [`../strategy/BUILD_VS_BUY.md`](../strategy/BUILD_VS_BUY.md)
**Ta'sir qiladi:** `apps/api/src/connectors/`

## Problem

Bugun 17 ta konnektor bor `[MEASURED]`, ularning yadrosi mahalliy:
Payme, Click, Uzum Market, Didox, soliq.uz, my.gov.uz, Eskiz, PlayMobile,
Telegram + umumiy (Google Sheets, Shopify, WooCommerce, AmoCRM, Bitrix24,
WhatsApp, SMTP, AfterShip).

Ikki teskari xavf bor:

1. **17 ta bilan cheklanish** — foydalanuvchi "mening vositam bilan
   ishlamaydi" deb ketadi. Agent qiymati u tegib turgan tizimlar soniga
   proporsional.
2. **1000 tasini o'zi yozish** — solo founder uchun **ijro halokati**:
   poydevor ishi (metering, safety, evals) hech qachon boshlanmaydi.
   Taqqoslash uchun: Composio 1000+ toolkit / 20 000+ tool,
   Pipedream 2 500–3 000+ ilova `[FROM-RESEARCH]`.

## Decision

**Ikki qatlamli konnektor strategiyasi:**

| Qatlam | Qaror | Nima kiradi |
|---|---|---|
| **Mahalliy chuqur** | ✅ **QUR** (o'zimiz) | Payme, Click, Uzum, Didox, soliq.uz, my.gov.uz, Eskiz, PlayMobile — **proprietary moat** |
| **Keng umumiy** | ✅ **SOTIB OL** (agregator) | Global SaaS'lar (Slack, Notion, HubSpot, Jira, Gmail, …) |

**Ustuvor vendor:** **Composio**. Muqobil: **Merge Agent Handler**.

**Pipedream ustuvor EMAS:** uni **Workday sotib oldi** `[FROM-RESEARCH]` —
mustaqil agent-builder yo'nalishining kelajagi noaniq.

**Arxitektura sharti (majburiy):**

1. Agregator **adapter ortida** turadi. Mavjud `connectors.registry.ts`
   naqshi (17 konnektor bir interfeys ostida `[MEASURED]`) kengaytiriladi —
   agregator **18-chi provayder** sifatida qo'shiladi, parallel tizim
   sifatida emas.
2. **Mahalliy 17 konnektor hech qachon agregator orqali ketmaydi** — hatto
   agregator ularni qo'llasa ham. Sabab: moat va sirlar nazorati.
3. Konnektor sirlari `CryptoService` orqali shifrlanadi (Contract A24,
   Konstitutsiya #8) — agregator ishlatilganda ham foydalanuvchi
   kredensiallari bizning nazoratimizda qoladi yoki OAuth delegatsiya
   modelida bo'ladi; xom sir agregatorga **berilmaydi**.
4. Har konnektor (mahalliy va agregator orqali kelgani ham) **risk tier +
   sarf limiti + rate limit** bilan keladi
   ([`SAFETY_POLICY_LAYER.md`](../strategy/SAFETY_POLICY_LAYER.md) §3).

**Qachon qayta ko'riladi:** V3-P2 oxirida — agregator orqali kelgan
konnektorlarning real foydalanish hajmi bilan.

## Alternatives

- **(a)** Hammasini o'zi yozish (bugungi yo'l).
- **(b)** Hammasini agregatorga berish (mahalliylarni ham).
- **(c)** Pipedream'ni tanlash.
- **(d)** MCP ekotizimiga to'liq tayanish (ADR-029) — alohida agregator olmaslik.
- **(e)** Konnektorlarni umuman kengaytirmaslik, faqat vertikal chuqurlik.

## Why rejected

- **(a)** Har konnektor ~1–3 ED + doimiy saqlash yuki. 100 konnektor =
  butun yilning ishi, nol poydevor progressi. Contract §13.3 dagi
  "feature'lar poydevordan oldin qurilgan" xatosining aynan takrori.
- **(b)** Payme/Didox/soliq — **moat** (§2 M1). Ularni agregatorga berish:
  (1) agregatorda ular yo'q va bo'lmaydi, (2) bo'lganda ham raqib uchun
  ko'chirish narxi nolga tushadi.
- **(c)** Workday sotib olgani mustaqillik va narx siyosati bo'yicha
  noaniqlik yaratadi. Agregator — **almashtiriladigan** qaror bo'lishi
  kerak; kelajagi noaniq vendorni birinchi tanlash bu tamoyilga zid.
- **(d)** MCP — **distribution** kanali (bizni tashqi klientlar chaqiradi),
  agregator esa **integration** qatlami (biz tashqi tizimlarni chaqiramiz).
  Ular bir-birini almashtirmaydi. MCP serverlarining sifati va xavfsizligi
  ham juda notekis.
- **(e)** Agentning qiymati u tegib turgan tizimlar soniga bog'liq. Faqat
  chuqurlik — bitta mijoz segmentida yaxshi, lekin platforma bo'lolmaydi.

## Long-term impact

**Ijobiy:**
- Qamrov (1000+) va moat (17 mahalliy) bir vaqtda saqlanadi.
- Ijro yuki chegaralanadi — solo founder poydevor ishini davom ettira oladi.
- Agregator almashtiriladi (adapter tufayli) — vendor lock-in cheklangan.

**Narxi / qarzi:**
- Agregator oylik to'lovi `[CALIBRATE]` — marja hisobiga kiradi (ADR-023).
- Ikki xil konnektor sifat darajasi (bizniki chuqur, agregatorniki umumiy) —
  foydalanuvchiga buni **halol ko'rsatish** kerak, aks holda kutish buziladi.
- Agregator uzilishi → o'sha konnektorlar ishlamaydi. Mahalliy yadro
  (pul, davlat, SMS) **ta'sirlanmaydi** — bu ataylab shunday.
