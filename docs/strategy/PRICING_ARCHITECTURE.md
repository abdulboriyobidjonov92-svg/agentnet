---
doc: PRICING_ARCHITECTURE
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# PRICING ARCHITECTURE — tarif arxitekturasi

**Sana:** 2026-08-14 · **Versiya:** 1.0 · **Holat:** ACTIVE
**Bog'liq:** [`MASTER_ROADMAP_V3.md`](MASTER_ROADMAP_V3.md) · [`METRICS.md`](METRICS.md) · ADR-023 · ADR-024
**Contract:** A27 (billing metrikasi), A28 (ikki billing o'qi), ADR-012, Konstitutsiya #15–21

> ⚠️ **BARCHA ANIQ NARXLAR `[CALIBRATE]`.** Bu hujjat **arxitekturani**
> muhrlaydi, raqamlarni emas. Raqamlar V3-P0 metering ma'lumotidan keyin
> to'ldiriladi (§8 calibration protokoli). Bugungi holat: flat
> `BILLING_PRICE_PER_MESSAGE_TIYIN = 50 000` (~500 so'm/xabar) `[MEASURED]`,
> real token xarajati **umuman o'lchanmaydi** (`Message.tokensIn` kodda
> 0 marta yoziladi `[MEASURED]`).

---

## 1. Besh tier

| Tier | Nima o'zgaradi | Nima o'zgarmaydi |
|---|---|---|
| **Free** | Cheklangan **capability**: arzon model, kam agent, kam execution, asosiy konnektor | — |
| **Pro** | **Capability ochiladi**: premium model, browser automation, vision, ko'proq konnektor, memory | — |
| **Max** | **Faqat hajm / tezlik / parallel execution** ko'payadi | **Capability Pro bilan AYNAN bir xil** |
| **Business** | **Jamoa qatlami**: rollar, shared agents, org billing, approval flows, audit | — |
| **Enterprise** | **Xavfsizlik/compliance qatlami**: SSO, SCIM, audit export, data residency, custom limits, SLA | — |

### 1.1 ⚠️ ENG MUHIM QOIDA — Max capability QO'SHMAYDI

**Max = faqat hajm.** Model, feature va imkoniyatlar Pro bilan bir xil.

Bu qoida Claude.ai'ning o'z modelidan olingan: *"Max gives you 5x or 20x more
usage per session than Pro"* — model va feature bir xil, faqat hajm boshqa.

**Foydalanuvchi shuni tushunishi kerak:**

| O'tish | Foydalanuvchi nima oladi |
|---|---|
| Free → Pro | *"ko'proq NARSA qila olaman"* (yangi imkoniyatlar) |
| Pro → Max | *"ko'proq/tezroq qila olaman"* (ayni imkoniyat, ko'proq hajm) |
| → Business | *"boshqa muammo hal bo'ladi"* (jamoa) |
| → Enterprise | *"boshqa muammo hal bo'ladi"* (xavfsizlik/compliance) |

**Aralashtirish TAQIQLANADI.** Agar Max'ga capability qo'shilsa:
- Pro qiymati tushadi ("nega Pro olaman, baribir chala"),
- narx pillapoyasi tushunarsiz bo'ladi,
- Free→Pro konversiyasi (asosiy o'sish dvigateli) zaiflashadi.

Yangi imkoniyat qo'shilganda savol **bitta**: *"bu Free/Pro chegarasidami
yoki Business/Enterprise chegarasida?"* — "Max'ga qo'shamiz" javobi
**mavjud emas**.

---

## 2. Narxlash mexanikasi

### 2.1 Message-based EMAS — usage-aware

Bugungi model (flat 500 so'm/xabar `[MEASURED]`) **o'lchov birligi
noto'g'ri**: bir xabar 200 token ham, 40 000 token + 8 tool call ham
bo'lishi mumkin. Farq **100×** bo'lishi mumkin, narx esa bir xil.

**Yangi o'lchov birliklari (usage metering o'lchamlari):**

| # | O'lcham | Birlik | Manba |
|---|---|---|---|
| U1 | LLM input token | token | engine `usage` |
| U2 | LLM output token | token | engine `usage` |
| U3 | Model identifikatori | enum | engine `usage` |
| U4 | Tool call soni | dona | execution trace |
| U5 | Browser second | soniya | browser runner |
| U6 | Vision operation | dona | vision yo'li |
| U7 | Connector call | dona | `connectors.service` |
| U8 | Execution time | ms | trace |
| U9 | Storage (memory/fayl) | MB·oy | R2 + pgvector |
| U10 | Cache-read token (arzonlashtiruvchi) | token | provayder javobi |

**Barchasi V3-P0 da yoziladi**, lekin **hammasi darhol narxlanmaydi** —
avval o'lchanadi, keyin narxlanadi (§8).

### 2.2 Internal cost ≠ User price

```
   ┌──────────────────────┐
   │  RAW PROVIDER COST   │  model narxi × token (+ cache chegirmasi)
   │  (USD, provayderdan) │
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │  INTERNAL COST       │  + infra ulushi (compute, DB, storage, browser)
   │  (tiyin, ichki)      │  → GROSS MARGIN shu yerda hisoblanadi
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │  PRICING ENGINE      │  tier, ustama, chegirma, promo, free-quota
   │                      │  ← bu qatlam ADR-023 ning yadrosi
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │  USER CHARGE         │  foydalanuvchi ko'radigan so'm
   │  (tiyin, BigInt)     │  Konstitutsiya #20: BigInt tiyin, float YO'Q
   └──────────────────────┘
```

**Qoida:** internal cost va user price **hech qachon bir xil kod yo'lida
hisoblanmaydi**. Ular ikki alohida hisob; marja — ularning ayirmasi.
Agar ular bitta joyda hisoblansa, marjani o'lchash imkoni yo'qoladi.

### 2.3 Hybrid model

```
OYLIK OBUNA (tier)  +  METERED USAGE (tier limitidan yuqorisi)
```

- Obuna — bashorat qilinadigan daromad va foydalanuvchi uchun tushunarli.
- Metered — og'ir foydalanuvchida marja kafolati.
- **Outcome pricing** — V3-P3 da **bitta wedge'da pilot** (§7).

**Contract A28 saqlanadi:** ikki billing o'qi (per-agent wallet + platform
subscription) o'zgarmaydi. Bu hujjat **platforma obunasi** o'qini
aniqlashtiradi.

---

## 3. Free tier — ataylab yomon EMAS

**Tamoyil:** Free foydalanuvchi **real muvaffaqiyatli natija** ko'rishi
SHART. Ko'rmasa — konversiya funnel'i 1-qadamda o'ladi.

### 3.0 Amaldagi model (2026-08-16 dan) — nol-byudjet cheklovi

Free tier **butunlay OpenRouter'ning `:free` modellariga** tayanadi va
**prepaid balansdan ajratilgan** `[MEASURED]`. Sabab qat'iy: founder byudjeti
nol, ya'ni har bepul obunachiga pullik model chaqiruvini moliyalashtirib
bo'lmaydi.

| O'lcham | Qiymat | Manba |
|---|---|---|
| Kunlik xabar limiti | **10/kun** (`USAGE_FREE_CHAT_PER_DAY=10`) | `[MEASURED]` |
| Balansdan yechish | **YO'Q** — `chargeForMessage` free'da no-op | `[MEASURED]` |
| Model zanjiri | OpenRouter, **5 ta bepul model rotatsiyasi** | `[MEASURED]` |
| Hisob darajasidagi budjet | **45/kun** (buferli, `OPENROUTER_FREE_DAILY_CAP`) | `[MEASURED]` |
| Pullik tier | O'zgarmadi — Anthropic zanjiri | `[MEASURED]` |

**Nega balans-yechish olib tashlandi:** yangi foydalanuvchi balansi 0 (default)
va `chargeForMessage` LLM'dan OLDIN yechardi — natijada BIRINCHI xabarda 402
`insufficient_balance` `[FROM-AUDIT]`. Ya'ni free tier amalda **mavjud emas
edi**: kunlik limit (20) hech qachon ishga tushmasdan, foydalanuvchi to'lov
devoriga urilardi. Endi yagona to'siq — kunlik hisoblagich.

**OpenRouter `:free` limitlari** (hisob darajasida, foydalanuvchi darajasida
EMAS) `[FROM-RESEARCH]` (openrouter.ai/docs/api-reference/limits, 2026-08):

| Shart | Limit |
|---|---|
| Har doim | 20 so'rov/daqiqa |
| Umr bo'yi <$10 kredit sotib olingan | 50 so'rov/kun |
| Bir marta ≥$10 kredit sotib olingach (doimiy) | 1000 so'rov/kun |

Bu **butun mahsulot uchun umumiy** — bitta `OPENROUTER_API_KEY`. Shuning uchun
server tomonda buferli hisoblagich: **45/kun** (50 dan ~10% past). Kredit
sotib olingach `OPENROUTER_FREE_DAILY_CAP=900`. Bufer kerak, chunki bizning
hisobimiz va OpenRouter'niki hech qachon aynan bir xil bo'lmaydi (qayta
urinishlar, `llm_json` yo'lidagi chaqiruvlar, soat mintaqasi farqi).

**Model zanjiri** (`openrouter_client.DEFAULT_FREE_MODELS`, `GET /api/v1/models`
dan 2026-08-16 da tekshirilgan `[MEASURED]`) — hammasi tool-calling'ni
qo'llab-quvvatlaydi, aks holda konnektor chaqirish ishlamaydi:

1. `nvidia/nemotron-3-ultra-550b-a55b:free`
2. `google/gemma-4-31b-it:free`
3. `nvidia/nemotron-3.5-lightning:free`
4. `google/gemma-4-26b-a4b-it:free`
5. `cohere/north-mini-code:free`

Bittasi 429 (chegara) yoki 5xx qaytarsa keyingisiga o'tiladi; hammasi tugasa
foydalanuvchi **aniq holat** ko'radi ("Bepul rejim hozir band"), demo-javob
EMAS. Ro'yxat `OPENROUTER_FREE_MODELS` env orqali deploy'siz almashadi —
OpenRouter katalogi tez-tez o'zgaradi `[FROM-RESEARCH]`.

### 3.1 Abuse himoyasi — MAJBURIY

| # | Himoya | Bugungi holat |
|---|---|---|
| A1 | Kunlik chat rate limit | Mavjud (`USAGE_FREE_CHAT_PER_DAY=10` `[MEASURED]`) |
| A2 | **Kunlik cost cap** (tiyinda, tokenga asoslangan) | **Free uchun KERAK EMAS** — bepul modellarda marjinal xarajat ~0; o'rniga so'rov-soni budjeti (A8). Pullik tier uchun hali **YO'Q**, V3-P1 |
| A3 | Agent soni limiti | Mavjud (`USAGE_FREE_AGENTS_MAX=5` `[MEASURED]`) |
| A4 | Execution soni limiti | **YO'Q** — V3-P1 |
| A5 | Konnektor soni limiti | **YO'Q** — V3-P1 |
| A6 | Global LLM cap | Mavjud (`USAGE_GLOBAL_LLM_PER_DAY=2000` `[MEASURED]`) |
| A7 | Ro'yxatdan o'tish abuse (bir odam N ta akkaunt) | **Strukturaviy** — `User.email` va `User.phone` `@unique`, ya'ni bitta identifikator = bitta akkaunt `[MEASURED]`; OTP endpointlari 5/daq (request) va 10/daq (verify) throttle `[MEASURED]`; referral cap ham mavjud `[FROM-AUDIT]` |
| A8 | **OpenRouter hisob budjeti** (buferli, kunlik) | **Mavjud** — `OPENROUTER_FREE_DAILY_CAP=45` `[MEASURED]`, 80% da `free_tier_budget` alerti |

**Qoida (yangilandi):** A2 endi **pullik** tier muammosi. Free tier'da
xarajat yuzasi so'rov-soni bilan chegaralangan (A1 + A8), pul bilan emas —
chunki `:free` modellarda to'lov yo'q. Budjet tugasa yangi ro'yxatdan
o'tishlar **to'xtatilmaydi** (funnel o'ldirilmaydi), faqat signal beriladi.

---

## 4. Free → Paid funnel

```
VISIT
  ▼
SIGNUP
  ▼
FIRST AGENT
  ▼
FIRST SUCCESSFUL OUTCOME     ← ⭐ eng muhim qadam (Time-to-Value <10 daq [FROM-RESEARCH])
  ▼
REPEAT USAGE
  ▼
LIMIT / VALUE EVENT          ← foydalanuvchi chegaraga yoki qiymatga uriladi
  ▼
UPGRADE
  ▼
PAID SUCCESS                 ← to'lagandan keyin ham natija olishi SHART
  ▼
EXPANSION                    (Max / Business / qo'shimcha usage)
```

**Har qadam uchun metrika:** [`METRICS.md`](METRICS.md) §3.

**Eng ko'p yo'qotiladigan qadam** (gipoteza, `[CALIBRATE]`):
`FIRST AGENT → FIRST SUCCESSFUL OUTCOME`. MIT NANDA: korporativ AI
pilotlarining **95%** o'lchanadigan ta'sir bermadi `[FROM-RESEARCH]` — ya'ni
"agent yaratildi" bilan "natija olindi" o'rtasidagi tafovut sanoat
miqyosidagi muammo.

---

## 5. Upgrade UX tamoyili — limit bilan emas, QIYMAT bilan sotish

| ❌ Noto'g'ri | ✅ To'g'ri |
|---|---|
| "Limitingiz tugadi. Pro oling." | "Bu agent shu oy 2.4 mln so'm tejadi. Pro bilan u brauzerda ham ishlay oladi." |
| "Bu funksiya Pro'da." (qulf ikonkasi) | "Bu vazifani bajarish uchun brauzer kerak — Pro'da ochiladi. Ko'rish uchun demo." |
| Ishni to'xtatuvchi modal | Ish tugagandan **keyin**, natija ko'rsatilgan holda taklif |

**Qoida:** upgrade taklifi **har doim** foydalanuvchi allaqachon ko'rgan
qiymatga ishora qilishi kerak. Qiymat ko'rsatilmagan joyda upgrade taklifi
qilinmaydi.

---

## 6. Tier chegaralari matritsasi (struktura — raqamlar `[CALIBRATE]`)

| O'lcham | Free | Pro | Max | Business | Enterprise |
|---|---|---|---|---|---|
| Model sinfi | arzon | premium | **Pro bilan bir xil** | Pro bilan bir xil | custom |
| Kunlik execution | `[CALIBRATE]` | `[CALIBRATE]` | **×N** (5×/20×) | seat-based | custom |
| Parallel execution | 1 | `[CALIBRATE]` | **×N** | pool | custom |
| Agent soni | 5 `[MEASURED]` | `[CALIBRATE]` | `[CALIBRATE]` | org-level | custom |
| Konnektorlar | asosiy | to'liq | to'liq | to'liq | to'liq + custom |
| Browser automation | ❌ | ✅ | ✅ | ✅ | ✅ |
| Vision | ❌ | ✅ | ✅ | ✅ | ✅ |
| Memory | qisqa | to'liq | to'liq | shared | to'liq + residency |
| Rollar / shared agents | ❌ | ❌ | ❌ | ✅ | ✅ |
| Approval flows | asosiy | asosiy | asosiy | **jamoa oqimi** | custom |
| Audit export | ❌ | ❌ | ❌ | ✅ | ✅ + SIEM |
| SSO / SCIM | ❌ | ❌ | ❌ | ❌ | ✅ |
| Data residency | ❌ | ❌ | ❌ | ❌ | ✅ |
| SLA | ❌ | ❌ | ❌ | ❌ | ✅ |

**Jadvalning o'zi shartnoma:** `Max` ustunida `❌`→`✅` o'zgarishi **yo'q**
(faqat ×N raqamlar). Agar kelajakda Max ustunida yangi `✅` paydo bo'lsa —
bu §1.1 buzilishi.

---

## 7. Outcome pricing

**Qachon:** V3-P3 (retail wedge), **faqat bitta vertikalda**, **pilot**
sifatida.

**Nega u yerda:** outcome pricing uchun **outcome o'lchanishi** shart
(tejalgan so'm). Bu o'lchov faqat V3-P3 da paydo bo'ladi. Undan oldin
outcome pricing — o'lchanmagan va'da.

**Pilot shakli (taklif, `[CALIBRATE]`):**
- Bazaviy obuna + o'lchangan tejamkorlikning belgilangan ulushi.
- Ulush va shift `[CALIBRATE]`.
- Mijoz o'lchov metodologiyasiga **yozma rozilik** beradi (aks holda
  hisob-kitob bahsi muqarrar).

---

## 8. Calibration protokoli — `[CALIBRATE]` qachon to'ldiriladi

| Qadam | Shart | Natija |
|---|---|---|
| C1 | V3-P0 metering yoqiladi | Har chaqiruv uchun real token + model |
| C2 | **≥14 kun** uzluksiz ma'lumot | Foydalanish taqsimoti (p50/p90/p99 token/chaqiruv) |
| C3 | Internal cost / execution hisoblanadi | Bugungi flat narx bilan solishtiriladi → **real marja** |
| C4 | Tier limitlari p90 foydalanishga qarab belgilanadi | Free/Pro/Max chegaralari |
| C5 | Narx marja maqsadidan (>60% `[FROM-RESEARCH]`) teskari hisoblanadi | So'mdagi narxlar |
| C6 | 30 kun kuzatuv, keyin qayta kalibrlash | Barqaror tarif |

**Qoida:** C3 dan oldin bironta narx e'lon qilinmaydi.

Bugungi kod defaultlari (`platform-billing.service.ts:72–75` `[MEASURED]`):
`pro` = 14 900 000 tiyin (~149 000 so'm) · `max` = 126 000 000 tiyin
(~1 260 000 so'm) · `max200` = 252 000 000 tiyin (~2 520 000 so'm).
Ular **boshlang'ich taxmin** sifatida yozilgan (marja hisobisiz) va C3 dan
keyin qayta ko'riladi.

⚠️ Eslatma: bugungi kodda tier nomlari `pro`/`max`/`max200` — ADR-024
modelida esa `Pro`/`Max`/`Business`/`Enterprise`. Migratsiya V3-P1 ishi.

---

## 9. Contract bilan bog'lanish

| Bu hujjat | Contract | Munosabat |
|---|---|---|
| Token-asosli metering | A27, ADR-012 | **Ayni qaror** — faqat tartibi ilgarilatildi (V3-P0) |
| `hold → reconcile` | A27 | O'zgarishsiz |
| BigInt tiyin, float yo'q | Konstitutsiya #20 | O'zgarishsiz |
| Prepaid printsipi | Konstitutsiya #15 | O'zgarishsiz |
| Ikki billing o'qi | A28 | O'zgarishsiz |
| Besh tier | — | **YANGI** — ADR-024 |
| Pricing engine (internal ≠ user) | — | **YANGI** — ADR-023 |
| Outcome pricing | — | **YANGI**, demand/pilot ortida |
