# ADR-023 — Usage metering va pricing arxitekturasi

**Sana:** 2026-08-14 · **Holat:** ACCEPTED
**Supersedes:** yo'q. **Kengaytiradi:** ADR-012 (Billing), Contract A27.
**Bog'liq:** [`../strategy/PRICING_ARCHITECTURE.md`](../strategy/PRICING_ARCHITECTURE.md), [`../strategy/MASTER_ROADMAP_V3.md`](../strategy/MASTER_ROADMAP_V3.md) V3-P0
**Ta'sir qiladi:** `apps/agent-engine` (usage qaytarish), `apps/api/src/billing`, `Message`, `ExecutionTrace`

## Problem

Bugungi billing **flat 500 so'm/xabar** (`BILLING_PRICE_PER_MESSAGE_TIYIN`
default `50_000` tiyin, `billing.service.ts:45` `[MEASURED]`). Bir xabar
200 token ham, 40 000 token + 8 tool call ham bo'lishi mumkin — narx bir xil.

Bundan **jiddiyroq muammo:** platforma har chaqiruvda qancha
yo'qotayotganini **umuman bilmaydi**. `Message` jadvalida
`tokensIn`/`tokensOut` ustunlari mavjud (`schema.prisma:600`), lekin ular
kodda **hech qayerda yozilmaydi** (`tokensIn` grep → faqat `schema.prisma`
va PII-redaksiya fayllari `[MEASURED]`).

Ya'ni: **zararni to'xtatishdan oldin zararni o'lchash imkoni yo'q.**

ADR-012 token-asosli billing'ni allaqachon qaror qilgan, lekin Contract §3
uni **Phase 7** ga qo'ygan — ya'ni Phase 6 (runtime decoupling) dan keyin.
Phase 6-C hali bajarilmagan (`apps/browser-worker` mavjud emas `[MEASURED]`),
demak metering noaniq muddatga surilgan.

## Decision

**1. Metering bajarilishi Phase 7 dan V3-P0 ga ko'chiriladi.** Metering —
narxlashdan **mustaqil**: u faqat o'lchaydi. O'lchov birinchi kunidan
qiymat beradi, narx o'zgarishisiz ham.

**2. Engine har javobda `usage` qaytaradi:**
`{input_tokens, output_tokens, cache_read_tokens, model}`.

**3. Quyidagi o'lchamlar yoziladi (narxlanishi shart emas):**
LLM input/output token · model · tool call soni · browser second · vision
operation · connector call · execution time · storage · cache-read token.

**4. `Internal cost` va `User price` — ikki alohida hisob:**

```
RAW PROVIDER COST → INTERNAL COST (+infra) → PRICING ENGINE → USER CHARGE
                          │                                        │
                          └──────────── GROSS MARGIN ──────────────┘
```

Ular **hech qachon bitta kod yo'lida** hisoblanmaydi. Aks holda marjani
o'lchab bo'lmaydi.

**5. `hold → reconcile`** (ADR-012 dagi model) **o'zgarishsiz qoladi** va
V3-P1 da yoqiladi. V3-P0 da metering **shadow rejimda** ishlaydi: yoziladi,
lekin foydalanuvchi hisobiga ta'sir qilmaydi.

**6. Execution trace** — har agent ishi uchun qadam-jurnal (tool call,
natija, davomiylik, xato). Bu billing uchun ham, eval (ADR-028) va trust UI
uchun ham yagona manba.

**7. Narxlar `[CALIBRATE]`** — hech qanday raqam bu ADR bilan e'lon
qilinmaydi. Calibration protokoli: `PRICING_ARCHITECTURE.md` §8.

## Alternatives

- **(a)** Contract §3 tartibini saqlash — metering Phase 7 da.
- **(b)** Flat narxni oshirish (500 → 1500 so'm) va meteringsiz davom etish.
- **(c)** Faqat obuna (metered qism umuman yo'q).
- **(d)** Uchinchi tomon metering/billing SaaS (Orb, Metronome, Lago).
- **(e)** Metering va narxlashni bir vaqtda yoqish.

## Why rejected

- **(a)** Phase 7 Phase 6-C ga bog'langan, Phase 6-C esa bajarilmagan
  `[MEASURED]`. Ya'ni bu — noaniq muddatga kechiktirish. Metering
  browser-worker'ga **texnik jihatdan bog'liq emas**: engine `usage`
  qaytarishi va API uni yozishi mustaqil ish.
- **(b)** Narxni o'lchovsiz oshirish — ikki tomonlama xato: og'ir
  foydalanuvchida hamon zarar, yengil foydalanuvchida esa asossiz qimmat
  (konversiya tushadi). Qaysi biri ekanini bilish uchun ham metering kerak.
- **(c)** Foydalanish farqi 100× (ADR-012 asosi). Bitta obuna narxi ikkala
  segmentni ham yo'qotadi.
- **(d)** Bu — pul yo'li. Foydalanish ma'lumoti (kim, qaysi agent, qancha)
  uchinchi tomonga chiqadi va **data residency savolini** (§9) qayta
  ochadi. Bundan tashqari Konstitutsiya #17 (har pul o'zgarishi
  `CreditLedger`ga) ichki ledger'ni majburiy qiladi — tashqi SaaS uni
  almashtira olmaydi, faqat dublikat qiladi.
- **(e)** Narxlash o'zgarishi — mijoz bilan muloqot, migratsiya, huquqiy
  matn. Uni o'lchovsiz qilish riskli. Shadow metering **nol mijoz riski**
  bilan real ma'lumot beradi. Narx keyin, ma'lumot bilan o'zgaradi.

## Long-term impact

**Ijobiy:**
- Gross margin **o'lchanadigan** miqdorga aylanadi (bugun: noma'lum `[MEASURED]`).
- Model routing (ADR-028 evallari bilan) iqtisodiy asosga ega bo'ladi.
- Prompt caching samarasi ko'rinadi (cache-read ~90% arzon `[FROM-RESEARCH]`).
- Besh tier limitlari (ADR-024) taxminan emas, p90 foydalanishga qarab
  belgilanadi.
- Enterprise suhbatida "sizga qancha turadi" savoliga raqam bilan javob.

**Narxi / qarzi:**
- Har javobga yozish yuki (`Message` yangilanishi + trace) — Postgres yozish
  hajmi oshadi. Contract §8 (100k foydalanuvchi) allaqachon `Message`
  partitioning'ni ko'zda tutgan.
- Engine javob shakli o'zgaradi — barcha chaqiruv nuqtalari yangilanadi.
- Shadow rejim davrida ikki xil "narx" tushunchasi kod-bazada birga yashaydi
  (Konstitutsiya #39: feature-flag umri maks. 2 sprint — shadow rejim shu
  chegara ostida yopiladi).
