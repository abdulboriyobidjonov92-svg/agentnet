---
doc: MASTER_ROADMAP_V3
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# AgentNet — MASTER ROADMAP V3

**Sana:** 2026-08-14 · **Versiya:** 3.0 · **Holat:** ACTIVE
**Bazaviy commit:** `5659a78` · **Baseline:** [`../status/current-state-2026-08-13.md`](../status/current-state-2026-08-13.md)
**Ustun hujjat:** [`../ENGINEERING_CONTRACT.md`](../ENGINEERING_CONTRACT.md) — **FROZEN**.
Bu hujjat bilan Contract ziddiyatga kelsa — **Contract yutadi**; ziddiyat
[`../ENGINEERING_CONTRACT_ADDENDUM_V3.md`](../ENGINEERING_CONTRACT_ADDENDUM_V3.md) da ochiq yozilgan.

---

## 0. Bu hujjatni o'qish qoidalari

### 0.1 Manba belgilari — majburiy

Har raqam yonida belgi bor. **Belgisiz raqam bu hujjatda yo'q.**

| Belgi | Ma'nosi |
|---|---|
| `[MEASURED]` | 2026-08-14 da shu repozitoriyda haqiqatan o'lchandi |
| `[FROM-AUDIT]` | repozitoriydagi mavjud audit hujjatlaridan (`docs/status/*`) |
| `[FROM-RESEARCH]` | tashqi tadqiqot raqami (§14 da manbasi bilan) |
| `[CALIBRATE]` | hali noma'lum — V3-P0 instrumentatsiyasidan keyin to'ldiriladi |

### 0.2 Nomlash — ⚠️ ikki xil "Phase" bor

Contract §3 da **Phase 0–9** bor (muhandislik fazalari). Bu hujjatda
**V3-P0 … V3-P5+** bor (strategik bosqichlar). **Ular bir xil narsa EMAS.**

- `Contract Phase 6` — Runtime Decoupling (muhandislik ishi).
- `V3-P0` — Production Foundation + Metering + Minimal Policy (strategik bosqich).

Bu hujjatda **har doim prefiks bilan** yoziladi: `V3-P2`, `Contract Phase 4`.
Prefikssiz "P3" yozish taqiqlanadi.

### 0.3 Bu hujjat NIMA QILMAYDI

- Contract'ni o'zgartirmaydi (u FROZEN; faqat yangi ADR o'zgartiradi).
- Yangi feature o'ylab topmaydi — faqat mavjud qarorlarni tartibga soladi.
- Huquqiy xulosa chiqarmaydi (§10 — faqat savollar ro'yxati).
- Kod yozmaydi.

---

## 1. North Star va strategik tezis

### 1.1 North Star

> **AgentNet — AI agent builder EMAS.**
> Bu Markaziy Osiyo SME'lari uchun **execution + trust + economy +
> infrastructure** qatlami. Agent real ish bajaradi, natija **so'mda**
> o'lchanadi.

"Agent yaratdim" — natija emas. Natija: *"agent shu oy do'konimga 3.2 mln so'm
tejadi"* yoki *"soliq hisobotini 40 daqiqada emas, 4 daqiqada topshirdim"*.
Platformaning har bir qatlami shu jumlani isbotlashga xizmat qiladi.

### 1.2 Uzoq muddatli yo'l

```
FOUNDATION  →  PLATFORM  →  ECOSYSTEM
(V3-P0..P1)   (V3-P2..P4)   (V3-P5+)
```

Agent Economy — **maqsad**, lekin **hozirgi ish emas**. Ekotizim demand gate
ortida turadi (§13).

### 1.3 Strategik doimiylar (o'zgarmaydi)

1. **Strategiya o'zgarmaydi, qurish tartibi o'zgaradi.** Hamma imkoniyat —
   ha; hammasini bir vaqtda — yo'q.
2. **Moat kombinatsiyasi:** local rails (Payme/Click/Uzum/Didox/soliq/Eskiz/
   Telegram) + execution data + evals/reliability + outcome measurement +
   uz/ru til.
3. **Optimallashtiriladigan narsa feature soni EMAS:** value density,
   reliability, margin, time-to-value, activation, retention, Free→Paid
   conversion, outcome, trust.

### 1.4 Nima uchun tartib o'zgardi (V2 → V3 ning bir jumlali sababi)

V2 tartibi **imkoniyatlarni** ketma-ket qo'yardi. V3 tartibi **zararni
o'lchash → zararni to'xtatish → ishonchni o'lchash → ishonchni sotish**
mantig'iga qurilgan. Bugun platforma har xabarda qancha yo'qotayotganini
**umuman bilmaydi** (`Message.tokensIn` sxemada bor, kodda 0 marta
yoziladi `[MEASURED]`) — shuning uchun metering V3-P0 ga ko'chdi.

---

## 2. Moat tahlili

Har moat uchun uch savol: **nima ko'chirilmaydi · nega · qaysi raqib buni
qila oladi.**

| # | Moat | Nima ko'chirilmaydi | Nega ko'chirilmaydi | Kim qila oladi |
|---|---|---|---|---|
| M1 | **Local rails** — 17 konnektor `[MEASURED]`: Payme, Click, Uzum, Didox, soliq.uz, my.gov.uz, Eskiz, PlayMobile, Telegram, AmoCRM, Bitrix24… | Integratsiyaning o'zi emas — **merchant shartnomalari, sandbox kalitlari, davlat portallari bilan real ish tajribasi** | Kod 2 haftada yoziladi; Payme merchant onboarding, Didox shartnomasi, soliq portali xulqi — oylar va mahalliy huquqiy shaxs talab qiladi | Mahalliy raqib (Uzum, Click ekotizimi, mahalliy integrator) — **HA**. Global AI platforma (OpenAI/Anthropic/Zapier/Lindy) — **YO'Q** (bozor hajmi ularning e'tibor chegarasidan past) |
| M2 | **Execution data** — agent real bajargan ishlar jurnali | Bizning bazamizdagi real UZ biznes-jarayonlari ketma-ketligi | Bu ma'lumot faqat ijro paytida tug'iladi; sotib olib bo'lmaydi | Faqat bizdan oldin ishga tushgan mahalliy raqib. Bugun mavjud emas |
| M3 | **Human approval data** — inson qaysi amalni tasdiqladi/rad etdi | Insonning "yo'q, bunday qilma" qarorlari korpusi | **Bugun yig'ilmasa hech qachon olinmaydi** — retroaktiv qayta tiklab bo'lmaydi. ENG NODIR | Hech kim — agar biz bugun yig'a boshlasak. Agar boshlamasak — hamma |
| M4 | **Outcome data** (so'mda o'lchangan natija) | "Bu agent shu do'konga X so'm tejadi" isboti | Isbot uchun POS/inventar/hisobot ma'lumotiga ulanish kerak — ya'ni M1 ustiga quriladi | M1 ni takrorlagan raqib, 12+ oy kechikish bilan |
| M5 | **Evals / reliability scoring** | UZ kontekstidagi vazifalar uchun sifat baholari | Global eval to'plamlari o'zbek soliq hisobotini yoki Didox e-invoice oqimini o'lchamaydi | Har kim — lekin M2 siz eval qurish uchun ma'lumot yo'q |
| M6 | **uz/ru til qatlami** — 860×3 kalit `[MEASURED]` | Terminologiya, ohang, biznes-jargon | LLM o'zbekchani biladi, lekin **mahsulot terminologiyasi va huquqiy tili** — qo'lda ish | Mahalliy raqib — HA (arzon). Global — qiladi, lekin sifatsiz |
| M7 | **Halal filtr yadro qatlami** (Contract "hech qachon o'zgarmaydi" #7) | Ishonch pozitsiyasi | Texnik jihatdan takrorlanadi; **brend va jamoat ishonchi** takrorlanmaydi | Mahalliy/MENA raqib — HA |
| M8 | Workflow / agent behavior / tool-use data | — | **NUSXALANADI.** Bu moat emas, aktiv | Har kim |

**Moat xulosasi:** M1+M3+M4 kombinatsiyasi haqiqiy himoya. M8 ni moat deb
hisoblash — xato. M5 va M2 M1 dan kelib chiqadi. Shuning uchun **konnektor
strategiyasi = moat strategiyasi** (qarang: [`BUILD_VS_BUY.md`](BUILD_VS_BUY.md)).

---

## 3. Data Flywheel

```
            ┌──────────────────────────────────────────────────┐
            │                                                  │
            ▼                                                  │
   ┌─────────────────┐                                         │
   │ EXECUTION DATA  │  agent real ish bajaradi                │
   │  (V3-P0)        │  · trace · tool call · natija · xato    │
   └────────┬────────┘                                         │
            │                                                  │
            ▼                                                  │
   ┌─────────────────┐                                         │
   │ HUMAN APPROVAL  │  inson tasdiqladi / rad etdi / tuzatdi  │
   │  (V3-P0)        │  ← ENG NODIR BO'G'IN                    │
   └────────┬────────┘                                         │
            │                                                  │
            ▼                                                  │
   ┌─────────────────┐                                         │
   │ EVALUATION      │  nima ishladi, nima yiqildi             │
   │  (V3-P1)        │  · failure taksonomiyasi                │
   └────────┬────────┘                                         │
            │                                                  │
            ▼                                                  │
   ┌─────────────────┐                                         │
   │ RELIABILITY     │  agent ishonchlilik balli               │
   │  (V3-P2)        │                                         │
   └────────┬────────┘                                         │
            │                                                  │
            ▼                                                  │
   ┌─────────────────┐                                         │
   │ MODEL ROUTING   │  oddiy vazifa → arzon model             │
   │  (V3-P1 → P2)   │  (evalsiz QILINMAYDI)                   │
   └────────┬────────┘                                         │
            │                                                  │
            ▼                                                  │
   ┌─────────────────┐      ┌──────────────────┐               │
   │ LOWER COST      │─────▶│ BETTER MARGIN    │               │
   │  (V3-P1)        │      │ (PRICING ENGINE) │               │
   └────────┬────────┘      └──────────────────┘               │
            │                                                  │
            ▼                                                  │
   ┌─────────────────┐                                         │
   │ BETTER OUTCOME  │  so'mda o'lchangan natija               │
   │  (V3-P3)        │                                         │
   └────────┬────────┘                                         │
            │                                                  │
            ▼                                                  │
   ┌─────────────────┐                                         │
   │ MORE USERS      │  outcome → ishonch → tavsiya            │
   │  (V3-P3 → P4)   │                                         │
   └────────┬────────┘                                         │
            │                                                  │
            └──────────────────────────────────────────────────┘
                     (yana ko'proq execution data)
```

**Har bo'g'in qaysi bosqichda ochiladi:**

| Bo'g'in | Ochiladi | Ochilmasa nima bo'ladi |
|---|---|---|
| Execution data | V3-P0 | Qolgan butun flywheel mavjud emas |
| Human approval data | V3-P0 | **Qaytarilmas yo'qotish** — retroaktiv yig'ib bo'lmaydi |
| Evaluation | V3-P1 | Model routing ko'r-ko'rona bo'ladi (sifat jimgina tushadi) |
| Reliability score | V3-P2 | Foydalanuvchi qaysi agentga ishonishni bilmaydi |
| Model routing | V3-P1 boshlanadi, V3-P2 da to'liq | Marja tokenlar bilan yeyiladi |
| Outcome measurement | V3-P3 | Sotuv "his-tuyg'u" bilan qilinadi, isbot bilan emas |
| Growth loop | V3-P3→P4 | O'sish faqat pullik kanaldan keladi |

---

## 4. Uch trek — parallel ijro

Uchala trek **bir vaqtda** yuradi. Business va Safety treklari Product
trekining tugashini **kutmaydi**.

| Trek | Egasi | V3-P0 | V3-P1 | V3-P2 | V3-P3 | V3-P4 | V3-P5+ |
|---|---|---|---|---|---|---|---|
| **Product / Engineering** | founder | Metering, trace, minimal policy, kill switch | Pricing engine, eval harness, memory foundation (pgvector) | Trust UI, execution surface, MCP eksperiment | Retail wedge chuqurlashtirish | Marketplace, workflows, teams, to'liq memory | Agent economy schema |
| **Business** | founder | Payme/Click merchant onboarding, Privacy/Terms, IT Park | Pilot 3-5 mijoz, kanal testi | Pilot → to'lovchi konversiya | Retail vertikalida referens mijoz | Partner/kanal dasturi | Creator/partner iqtisodiyoti |
| **Safety / Compliance** | founder | Risk tierlari, konnektor limitlari, audit trace | Approval logging siyosati, incident protokoli | Domain allowlist (SEC-07), blast radius | Biometrik ma'lumot savollari (retail vision) | Data residency arxitekturasi, SSO/audit export | Sertifikatsiya (agar talab bo'lsa) |

**Nega uch trek:** Product trekining eng uzun elementi (masalan memory
arxitekturasi) 6 hafta bo'lsa, Payme merchant onboarding'i o'sha 6 haftani
kutib turishi uchun **hech qanday texnik sabab yo'q**. Kutish — sof
yo'qotish. Batafsil: [`BUSINESS_TRACK.md`](BUSINESS_TRACK.md).

---

## 5. Master sequence — V3-P0 → V3-P5+

> **Qoida:** bosqich EXIT GATE'i bajarilmaguncha keyingi bosqich
> boshlanmaydi. Gate raqamli va manba belgili.

---

### V3-P0 — Production Foundation + Metering + Minimal Policy

**Maqsad (bitta jumla):** Platforma yiqilmaydi va har chaqiruvda qancha
yo'qotayotganini raqam bilan biladi.

**Ish elementlari:**

| # | Ish | Contract bog'lanishi | Holat |
|---|---|---|---|
| P0.1 | Engine har javobda `usage {input_tokens, output_tokens, model}` qaytaradi | Contract A27 / ADR-012 / Contract Phase 7 (1-qism) — **V3 da ilgarilatildi** | Yangi |
| P0.2 | `Message.tokensIn/tokensOut` **haqiqatan to'ldiriladi** (bugun 0 joy `[MEASURED]`) | Contract A12 (jadval mavjud) | Yangi |
| P0.3 | Internal cost hisoblagichi: model × token → tiyin (foydalanuvchiga hali ko'rsatilmaydi) | Contract A27 | Yangi — ADR-023 |
| P0.4 | Execution trace: har agent ishi uchun qadam-jurnal (tool call, natija, davomiylik) | Contract A36 (observability) ustiga | Yangi — ADR-023 |
| P0.5 | **Human approval logging** — tasdiq/rad **hodisa sifatida** yoziladi | Contract §6.5 / ADR-008 ustiga | Yangi — ADR-023 |
| P0.6 | Minimal policy engine: `LOW`/`HIGH` ikki tier + har agent uchun kill switch | Contract §7 SEC-07 ruhida, ADR-031 doirasida | Yangi — [`SAFETY_POLICY_LAYER.md`](SAFETY_POLICY_LAYER.md) |
| P0.7 | Har konnektorga sarf limiti + rate limit (bugun 17 tasida hech biri yo'q — `rateLimit\|spendCap\|dailyLimit\|@Throttle` grep `connectors/` da **0 moslik** `[MEASURED]`) | Contract A19/A20 (Redis throttler mavjud) | Yangi |
| P0.8 | Render `plan` qarori: api/web `free` → `starter` (bugun `free` `[MEASURED]`) | Contract A38 / ADR-019 | Ochiq — egalik qarori |
| P0.9 | i18n arxitektura tayyorligini tekshirish: 4-til qo'shish **faqat tarjima ishi** bo'lishi | Contract A13 / ADR-013 | Tekshiruv vazifasi |
| P0.10 | Contract Phase 6-C yakuni: `apps/browser-worker` (bugun yo'q `[MEASURED]`) | Contract A21 / ADR-010 | Ochiq |

**EXIT GATE (hammasi bajarilishi shart):**

| Gate | Shart | Manba |
|---|---|---|
| G0.1 | Oxirgi 7 kunlik chaqiruvlarning **≥95%** ida `tokensIn`+`tokensOut` yozilgan | `[CALIBRATE]` bazasi yo'q — o'lchov P0 dan keyin boshlanadi |
| G0.2 | **Real gross margin raqami mavjud** (bugun: noma'lum `[MEASURED]`) — qiymati qanday bo'lishidan qat'i nazar | `[CALIBRATE]` |
| G0.3 | Har 17 konnektorda sarf limiti **va** rate limit sozlangan: **17/17** | `[MEASURED]` bazasi: 17 konnektor |
| G0.4 | Har agentda kill switch: **100%** agentlar uchun ishlaydi (E2E test bilan) | — |
| G0.5 | HIGH-risk amal inson tasdig'isiz bajarilmaydi: **0 ta chetlab o'tish** (test) | — |
| G0.6 | Approval hodisalari jurnalda: **≥1 hafta uzluksiz** yozuv | — |
| G0.7 | Cron ishlari: 2 instansda **1 marta** ishlaydi (Contract A24 bajarilgan `[MEASURED]`, regressiya testi qo'shiladi) | — |

**Dependency:** Contract Phase 0–5 (bajarilgan `[FROM-AUDIT]`), Contract
Phase 6 A/B (bajarilgan `[MEASURED]`).

**Bu bosqich ochadigan imkoniyatlar:** pricing engine (V3-P1) uchun real
xarajat ma'lumoti; eval harness uchun failure korpusi; trust UI uchun trace.

---

### V3-P1 — Economic Engine + Evals + Memory Foundation

**Maqsad:** Har chaqiruvda marja kafolatlanadi va sifat o'lchanadi.

**Ish elementlari:**

| # | Ish | Contract bog'lanishi |
|---|---|---|
| P1.1 | Pricing engine: internal cost ≠ user price ajratilishi | Contract A27 / ADR-012 → **ADR-023** kengaytiradi |
| P1.2 | `hold → reconcile` token billing (Contract Phase 7 ning yadrosi) | Contract A27, Konstitutsiya #15–21 |
| P1.3 | Besh tier plan modeli implementatsiyasi | **ADR-024**, [`PRICING_ARCHITECTURE.md`](PRICING_ARCHITECTURE.md) |
| P1.4 | Free tier abuse himoyasi (rate limit, cost cap, agent/execution/connector limitlari) | Contract A19 |
| P1.5 | **Minimal eval harness** — oltin to'plam + regressiya bali | **ADR-028** |
| P1.6 | Model routing qoidalari (evalga bog'langan) | Contract §8 (1M bosqich) — **ilgarilatildi** |
| P1.7 | Prompt caching yoqish | `[FROM-RESEARCH]`: Anthropic cache-read ~90% arzon |
| P1.8 | **Memory foundation**: pgvector sxemasi + yozish yo'li (bugun implementatsiya YO'Q `[MEASURED]`) | **ADR-027** |

**EXIT GATE:**

| Gate | Shart | Manba |
|---|---|---|
| G1.1 | Gross margin (LLM'dan keyin) **> 40%** | Contract §12 3-oy maqsadi; sanoat mediani ~52% `[FROM-RESEARCH]` |
| G1.2 | Eval to'plami: **≥50 vazifa**, har reliz oldidan avtomatik ishlaydi | `[CALIBRATE]` — vazifa soni P0 failure korpusidan chiqadi |
| G1.3 | Model routing arzon modelga o'tganda eval bali **≥95%** saqlanadi | — |
| G1.4 | Free tier'da bitta foydalanuvchining kunlik maksimal xarajati **cap bilan chegaralangan** (cheksiz sarf 0 ta hodisa) | — |
| G1.5 | Memory: kamida bitta jonli oqimda (chat) o'qish+yozish ishlaydi | — |
| G1.6 | Har javob narxi foydalanuvchiga ko'rinadi (Contract Phase 7 AC) | — |

**Dependency:** V3-P0 (metering ma'lumotisiz pricing engine — taxmin).

**Ochadigan imkoniyatlar:** ishonchli tarif e'loni, trust UI da "bu agent X%
ishonchli" ko'rsatkichi, xarajat bo'yicha xavfsiz o'sish.

---

### V3-P2 — Trust + Execution Surface + MCP eksperiment

**Maqsad:** Agent ishonchli ko'rinadi va foydalanuvchi turgan joydan topiladi.

**Ish elementlari:**

| # | Ish | Contract bog'lanishi |
|---|---|---|
| P2.1 | Reliability scoring UI (agent kartasida) | Contract A39 doirasida — yangi sahifa emas, mavjud sahifaga qatlam |
| P2.2 | Execution trace foydalanuvchiga ko'rinadigan shaklda ("agent nima qildi") | Contract §6.4 Audit modul naqshi |
| P2.3 | Approval flow UI (MEDIUM/HIGH tier) | [`SAFETY_POLICY_LAYER.md`](SAFETY_POLICY_LAYER.md) |
| P2.4 | **SEC-07 browser domain allowlist** | Contract §7 SEC-07 — **hali ochiq** |
| P2.5 | Memory to'liq o'qish yo'li (kontekstga in'ektsiya) | **ADR-027** |
| P2.6 | **MCP server eksperimenti**: 5 ta UZ konnektor MCP orqali | **ADR-029** |
| P2.7 | Browser infratuzilmasini tashqi provayderga chiqarish qarori | **ADR-026** |

**EXIT GATE:**

| Gate | Shart | Manba |
|---|---|---|
| G2.1 | Agent success rate o'lchanadi va **≥70%** (kritik oqimlarda) | OSWorld eng yaxshi natija ~72.5%, inson bazasi ~72.35% `[FROM-RESEARCH]` — shuning uchun 70% real chegara, 95% emas |
| G2.2 | HIGH-risk amallarning **100%** ida inson tasdig'i bor | — |
| G2.3 | Domain allowlist: ruxsatsiz domenga navigatsiya **0 ta muvaffaqiyatli** | Contract SEC-07 DoD |
| G2.4 | MCP server: **≥5 tool** ishlaydi va kamida **1 tashqi klientdan** chaqirilgan | `[CALIBRATE]` — foydalanish hajmi noma'lum |
| G2.5 | Time-to-value: yangi foydalanuvchi birinchi muvaffaqiyatli natijaga **<10 daqiqada** yetadi | `[FROM-RESEARCH]` maqsad |

**Dependency:** V3-P1 (eval bo'lmasa reliability score — soxta raqam).

**Ochadigan imkoniyatlar:** distribution (MCP), enterprise suhbati (trace +
approval), wedge uchun ishonch poydevori.

---

### V3-P3 — Flagship Retail Wedge

**Maqsad:** Bitta vertikalda (retail) natija so'mda isbotlanadi.

**Ish elementlari:**

| # | Ish | Contract bog'lanishi |
|---|---|---|
| P3.1 | Retail agent: inventar + POS + kamera fuziyasi (mavjud `retail` moduli chuqurlashtiriladi) | Contract A39 — yangi vertikal EMAS, mavjudini chuqurlashtirish |
| P3.2 | Outcome measurement: "tejalgan so'm" formulasi va uni ko'rsatuvchi panel | [`METRICS.md`](METRICS.md) |
| P3.3 | Pilot dasturi ijrosi (Business trek) | [`BUSINESS_TRACK.md`](BUSINESS_TRACK.md) |
| P3.4 | Biometrik ma'lumot savollari yuristga (kamera + yuz) | §10 |

**EXIT GATE:**

| Gate | Shart | Manba |
|---|---|---|
| G3.1 | **10–20 to'lovchi pilot mijoz** | `[CALIBRATE]` — 90 kunlik default maqsad (§0.1 default qarorlar) |
| G3.2 | Pilot mijozlarning **≥50%** ida oyiga o'lchangan tejamkorlik obuna narxidan **≥3×** katta | `[CALIBRATE]` |
| G3.3 | Retail agent success rate **≥80%** | `[CALIBRATE]` — G2.1 dan keyin qayta baholanadi |
| G3.4 | Pilotdan to'lovchiga konversiya **≥40%** | `[CALIBRATE]` |
| G3.5 | Retail vertikalida oylik retention **≥80%** | `[CALIBRATE]` |

**Dependency:** V3-P2 (ishonchsiz agentni do'kon egasiga sotib bo'lmaydi).

**Ochadigan imkoniyatlar:** referens mijoz, case study, kanal hamkorlari
bilan suhbat, ikkinchi vertikal uchun shablon.

---

### V3-P4 — Platform Expansion

**Maqsad:** Bir vertikaldagi isbot ko'pchilikka takrorlanadigan platformaga
aylanadi.

**Ish elementlari:** marketplace (mavjud modul kengaytiriladi), workflows,
teams/org qatlami (Business tier), to'liq memory, ikkinchi vertikal.

**EXIT GATE:**

| Gate | Shart | Manba |
|---|---|---|
| G4.1 | Free→Paid konversiya **≥6%** | `[FROM-RESEARCH]` median ~6.2%; AI-native GOOD 6–8% |
| G4.2 | Gross margin **>60%** | `[FROM-RESEARCH]` maqsad diapazoni 60–65% |
| G4.3 | Ikkinchi vertikal V3-P3 gate'larini **mustaqil** o'tadi | — |
| G4.4 | Weekly Active Agents o'sishi **≥3 oy ketma-ket** ijobiy | `[CALIBRATE]` |
| G4.5 | Solo founder chegarasi tekshiruvi (§12) o'tkazilgan va qaror yozilgan | — |

**Dependency:** V3-P3.

---

### V3-P5+ — Agent Economy (demand gate ortida)

**Maqsad:** Ekotizim iqtisodiyoti — **faqat talab o'lchangandan keyin**.

**Ish elementlari:** creator payouts (Contract A29 — bugun halol blocked-stub,
**shu holatda qoladi**), agent-to-agent commerce (faqat **schema**, build
emas), agent wallet, Agent World.

**EXIT GATE (kirish gate'i — bu bosqichga KIRISH shartlari):** §13 Demand
gates jadvalidagi signallar.

---

## 6. V2 → V3 o'zgarishlar jadvali

| Element | V2 | V3 | Sabab |
|---|---|---|---|
| Token/usage metering | P1 | **V3-P0** | Flat 500 so'm/xabar `[MEASURED]` hozir zarar keltiryapti; **metersiz zarar hajmi ham noma'lum** (`tokensIn` 0 joyda yoziladi `[MEASURED]`) |
| Minimal policy engine (low/high) + kill switch | P2 | **V3-P0** | "Lethal trifecta" himoyasi: agent SMS yuboradi, pul sarflaydi, davlat hujjati topshiradi — uchalasi bugun mavjud `[MEASURED]` |
| Execution trace + human approval logging | P2 | **V3-P0** | Human approval data — eng nodir moat (§2 M3); **bugun yig'ilmasa hech qachon olinmaydi** |
| Minimal eval harness | P2 | **V3-P1** | Model routing evalsiz xavfli — arzon model sifatni buzsa bilmay qolasan |
| pgvector + memory foundation | P4 | **V3-P1/P2** | 2030 foydalanuvchisi eslab qoladigan agent kutadi; kech qo'yish = arxitektura qayta yozish |
| MCP server (5 UZ konnektor) | P2 oxiri | **V3-P2 boshi** | MCP de-fakto standart bo'ldi (10 000+ faol server `[FROM-RESEARCH]`); eng arzon distribution kanali |
| Creator payouts | P4 | **V3-P4, demand gate ortida** | GPT Store misoli creator economy hali ishlamasligini ko'rsatdi |
| Agent-to-agent commerce | P5 | **V3-P5, demand gate + faqat schema** | Real iqtisodiyot hali mitti; build emas, architect |

---

## 7. Metrics spine — qaysi bosqichda qaysi metrika yoqiladi

Ta'riflar va formulalar: [`METRICS.md`](METRICS.md).

| Metrika | Yoqiladi | Nega aynan shu bosqichda |
|---|---|---|
| Cost per execution (internal) | V3-P0 | Metering yoqilishi bilan |
| Gross margin / execution | V3-P0 (o'lchash), V3-P1 (maqsad) | Avval bilish, keyin optimallashtirish |
| Approval rate / override rate | V3-P0 | Policy engine yoqilishi bilan |
| Incident rate, cron reliability | V3-P0 | Contract Phase 5 alertlari ustiga |
| Agent success rate | V3-P1 | Eval harness bilan |
| Time-to-Value | V3-P1 | Onboarding o'lchovi |
| Activation rate | V3-P1 | — |
| Weekly Active Agents | V3-P2 | Ishonch qatlamidan keyin foydalanish real bo'ladi |
| Free→Paid conversion | V3-P2 | Tarif tiers jonli bo'lgach |
| Mijozga tejalgan so'm (outcome) | V3-P3 | Wedge ichida o'lchanadi |
| Retention (oylik) | V3-P3 | — |
| Expansion revenue | V3-P4 | — |

---

## 8. Safety & Policy layer (doimiy qatlam — bosqich emas)

To'liq spetsifikatsiya: [`SAFETY_POLICY_LAYER.md`](SAFETY_POLICY_LAYER.md).
Qisqacha:

- **Risk tierlari:** `LOW` → avtomatik · `MEDIUM` → confirmation · `HIGH` →
  explicit approval · `CRITICAL` → dual approval yoki blocked.
- **Har konnektorga** sarf limiti va rate limit (bugun 17/17 da yo'q `[MEASURED]`).
- **Har agentda** kill switch.
- **Reversibility/compensation:** har action sinfi uchun "undo" nima degani
  oldindan yozilgan bo'lishi shart.
- **Blast radius izolyatsiyasi.**
- **Browser domain allowlist** (Contract SEC-07) — "lethal trifecta" himoyasi.

Bu qatlam **hech qachon "keyingi bosqichga" ko'chirilmaydi**. U V3-P0 da
minimal shaklda yoqiladi va har bosqichda chuqurlashadi.

---

## 9. Compliance & Data Residency treki

> ⚠️ **BU BO'LIMDA HUQUQIY XULOSA YO'Q.** Faqat yurist bilan aniqlanishi
> kerak bo'lgan savollar ro'yxati. Hech bir band "shunday qilish mumkin"
> yoki "shunday qilish mumkin emas" deb o'qilmasligi kerak.

### 9.1 Yuristga savollar — umumiy

| # | Savol | Qachon kerak |
|---|---|---|
| Q1 | AgentNet qaysi yuridik shaxs sifatida shaxsiy ma'lumotlarni qayta ishlaydi va operator sifatida ro'yxatdan o'tishi kerakmi? | V3-P0 |
| Q2 | Foydalanuvchi roziligi qanday shaklda olinishi kerak (matn, saqlash muddati, qaytarib olish)? | V3-P0 |
| Q3 | Chat/execution trace ichidagi shaxsiy ma'lumot qancha muddat saqlanishi mumkin? | V3-P0 |
| Q4 | LLM provayderi (Anthropic/OpenRouter) chet elda joylashgan — bu "chegaralararo uzatish" sifatida qanday rasmiylashtiriladi? | V3-P0 |
| Q5 | Agent foydalanuvchi nomidan davlat portaliga hujjat topshirsa (soliq, Didox), huquqiy javobgarlik kimda? | V3-P1 |
| Q6 | Agent SMS/xabar yuborsa — reklama qonunchiligi va spam talablari qanday qo'llanadi? | V3-P1 |
| Q7 | To'lov ma'lumotlari (Payme/Click) uchun qanday saqlash/audit talablari bor? | V3-P0 |
| Q8 | Marketplace creator to'lovlari uchun soliq/agentlik munosabati qanday rasmiylashtiriladi? | V3-P4 |
| Q9 | Enterprise mijoz data residency talab qilsa, shartnomada nima yozilishi kerak? | V3-P4 |
| Q10 | IT Park rezidentligi ma'lumot saqlash rejimiga qanday ta'sir qiladi? | V3-P0 |

### 9.2 ⚠️ Biometrik ma'lumot — alohida band

Retail wedge (V3-P3) do'kon kamerasini o'z ichiga oladi. Kamera oqimi yuz
qayta ishlasa, bu **alohida toifadagi ma'lumot** masalasini ochadi.

| # | Savol |
|---|---|
| B1 | Kamera oqimidan yuz **belgilari/vektorlari** hosil bo'lishi biometrik qayta ishlash hisoblanadimi? |
| B2 | Agar hisoblansa — saqlash joyi bo'yicha qanday talab qo'llanadi? |
| B3 | Do'kon **mijozlari** (xodim emas) uchun rozilik qanday olinadi? |
| B4 | Yuzni umuman saqlamaydigan arxitektura (faqat "odam bor/yo'q" hodisasi) talabni butunlay chetlab o'tadimi? |
| B5 | Video/kadr saqlash muddati bo'yicha cheklov bormi? |
| B6 | Do'kon egasi va AgentNet o'rtasida operator/qayta-ishlovchi rollari qanday taqsimlanadi? |

**Muhandislik eslatmasi (huquqiy xulosa emas):** B4 savolining javobi
arxitekturani belgilaydi. Agar "yuz saqlamaslik" talabni yopsa, bu
**eng arzon yo'l** — va uni V3-P3 boshlanishidan oldin bilish kerak, keyin
emas. Qarang: **ADR-030**.

---

## 10. Admin Control Plane — olti domen

Admin Panel **CRUD dashboard emas** — bu Control Plane. Oqim:

```
SIGNAL → INVESTIGATION → DECISION → ACTION → AUDIT
```

| Domen | Nimani boshqaradi |
|---|---|
| **System** | health, jobs, queues, workers, incidents, deployment |
| **Business** | users, orgs, subscriptions, revenue, conversion, churn, pilots |
| **Agents** | agents, executions, templates, reliability, failures |
| **Safety** | policies, approvals, kill switches, dangerous actions, connector limits, audit |
| **Economy** | token usage, model cost, gross margin, credits, billing, refunds, creator payouts |
| **Data** | metrics, evaluations, experiments, execution traces |

**Contract bilan bog'lanish:** Contract §6.2–6.4 da olti **modul** bor
(Users, Billing, Agents, Audit, Feedback, Ops). V3 ning olti **domeni** —
ular ustidagi tashkiliy qatlam, almashtiruvchi emas. Contract §6 route'lari
o'zgarmaydi.

---

## 11. UX operating model — 10 bosqichli skelet

```
DISCOVER → CREATE → CONFIGURE → EXECUTE → APPROVE → OBSERVE → VERIFY → MEASURE → IMPROVE → MONETIZE
```

| Bosqich | Foydalanuvchi savoli | Qaysi V3 bosqichida to'liq bo'ladi |
|---|---|---|
| Discover | "Menga qanday agent kerak?" | V3-P2 (marketplace/MCP) |
| Create | "Uni qanday yarataman?" | Mavjud (composer + shablonlar) |
| Configure | "Nimaga ruxsat beraman?" | V3-P0 (policy tierlari) |
| Execute | "U ishlayaptimi?" | Mavjud |
| Approve | "Bu amalni tasdiqlaymanmi?" | V3-P0 (minimal), V3-P2 (to'liq UI) |
| Observe | "U nima qildi?" | V3-P0 (trace), V3-P2 (UI) |
| Verify | "To'g'ri qildimi?" | V3-P1 (eval), V3-P2 (reliability) |
| Measure | "Menga qancha foyda berdi?" | V3-P3 (outcome) |
| Improve | "Qanday yaxshilanadi?" | V3-P4 |
| Monetize | "Men ham sota olamanmi?" | V3-P4/P5 (demand gate) |

**Qoida:** yangi UI ishi shu skeletning qaysi bosqichini kuchaytirishi
aniq aytilmasa — qurilmaydi.

---

## 12. Kill criteria

To'liq jadval: [`KILL_CRITERIA.md`](KILL_CRITERIA.md). Bu yerda faqat
tamoyil:

- Har vertikal va har katta feature **KEEP · EXPERIMENT · FEATURE FLAG ·
  KILL · ARCHIVE** taksonomiyasidan aynan bittasiga tegishli.
- Har `EXPERIMENT` uchun **raqamli mezon** va **qayta ko'rish sanasi** bor.
- Mezon bajarilmasa — avtomatik `ARCHIVE` (muhokama emas, qoida).
- Contract ADR-020 ni buzmaydi: bu uning ijro mexanizmi.

---

## 13. Resurs chegarasi — solo founder qachon yetmay qoladi

| Signal | Chegara | O'lchov manbai | Signal kelganda qaror |
|---|---|---|---|
| To'lovchi mijoz soni | **>25** | Business trek | Support/onboarding uchun 1 kishi (part-time) |
| Oylik incident soni | **>4** | Contract §12 alertlari | On-call yuki bir kishiga sig'maydi — 2-muhandis yoki feature to'xtatish |
| Pilot suhbatlari / hafta | **>6** | Kalendar | Sotuv/BD roli ajratiladi |
| Kod-review kutish vaqti | — (solo'da mavjud emas) | — | 2-muhandis kelganda Contract §12 "PR yashash vaqti" yoqiladi |
| Enterprise so'rovlar (SSO/SOC2) | **≥3 mustaqil so'rov** | Business trek | Compliance ishi alohida odam/konsultant talab qiladi |
| Haftalik ishlagan soat | **>60, 4 hafta ketma-ket** | Founder o'zi | Bu **eng ishonchli** signal — qolgan hammasi kechroq keladi |

**Qoida:** signal kelganda qaror **kechiktirilmaydi**. "Yana bir oy o'zim
tortaman" — bu ijro halokatining eng keng tarqalgan boshlanishi.

---

## 14. Demand gates

Quyidagi elementlar **qurilmaydi** — signal kelguncha. Signal raqamli va
o'lchanadigan.

| Element | Demand gate signali | Qiymat | Manba |
|---|---|---|---|
| **Agent World** (ijtimoiy/ekotizim qatlami) | Marketplace'da faol kreator soni | `[CALIBRATE]` — V3-P4 boshida belgilanadi | — |
| **Multi-agent orkestratsiya** (foydalanuvchi ko'radigan) | Bitta agent bilan hal bo'lmaydigan vazifa so'rovlari | **≥20% qo'llab-quvvatlash so'rovlari** | `[CALIBRATE]` |
| **Creator payouts** | Payout so'ragan kreator soni **va** ularning jami balansi | **≥10 kreator** va jami **≥$500 ekvivalenti** | `[CALIBRATE]` |
| **Agent wallet** (agent o'z pulini boshqaradi) | Foydalanuvchi so'rovi | **≥5 mustaqil so'rov** | `[CALIBRATE]` |
| **Agent-to-agent commerce** | Tashqi agent bizning agentni chaqirish so'rovi | **≥3 tashqi platforma** | `[CALIBRATE]` |
| **Mobil ilova** | Mobil brauzerdan foydalanish ulushi | **>50% sessiya** | `[CALIBRATE]` |

**Nega gate:** GPT Store misoli creator economy hali ishlamasligini
ko'rsatdi `[FROM-RESEARCH]`. Talab yo'q joyda qurilgan ekotizim — sof qarz.

---

## 15. Tashqi tadqiqot raqamlari — `[FROM-RESEARCH]`

Bu raqamlar V3 ning qaror asoslarida ishlatiladi. **Ular shu repozitoriyda
o'lchanmagan** — tashqi manbalardan.

| # | Raqam | Qayerda ishlatiladi |
|---|---|---|
| R1 | Gross margin: AI-native median **~52%** (ICONIQ); maqsad **>60–65%** | G1.1, G4.2 |
| R2 | Freemium konvertatsiya: median **~6.2%**; AI-native GOOD **6–8%**, GREAT **15–20%** | G4.1 |
| R3 | Time-to-value maqsad: **<10 daqiqa** | G2.5 |
| R4 | Prompt caching: Anthropic cache-read **~90% arzon**, OpenAI **~50%**, Batch API **+50%** tejam | P1.7 |
| R5 | Gartner: **2027 oxiriga agentic loyihalarning 40%+ bekor qilinadi** — sabab: xarajat, noaniq qiymat, yetarsiz risk nazorati | V3 tartibining asosi |
| R6 | MIT NANDA: korporativ AI pilotlarining **95%** o'lchanadigan P&L ta'siri bermadi | V3-P3 outcome talabi |
| R7 | OSWorld: eng yaxshi natija **~72.5%**, inson bazasi **~72.35%** — computer-use hali ishonchsiz → **HITL majburiy** | G2.1, Safety layer |
| R8 | MCP: **10 000+ faol server**, **~97M oylik SDK yuklab olish**, Linux Foundation'ga topshirilgan | ADR-029 |
| R9 | Vertikal agentlar g'olib: Sierra **$15.8B**, Harvey **$11B**, Decagon **$4.5B** | V3-P3 wedge strategiyasi |
| R10 | O'zbekiston: 2026-mart qonuni bilan data localization yumshatildi, lekin **biometrik ma'lumot mahalliy qolishi shart** | §9.2 |
| R11 | IT Park: **2040 gacha** soliq imtiyozlari, **0% dividend solig'i** | Business trek |
| R12 | Bozor: **~1.2 mln** faol kichik biznes | TAM asosi |
| R13 | Composio **1000+ toolkit / 20 000+ tool**; Pipedream **2 500–3 000+ ilova** | ADR-025 |
| R14 | Pipedream'ni **Workday sotib oldi** — mustaqil agent-builder yo'nalishi noaniq | ADR-025 |

---

## 16. Default qarorlar

Bular founder qarorlari. O'zgarsa — **bu hujjat yangilanadi**.

| Qaror | Qiymat | Manba |
|---|---|---|
| 90 kunlik maqsad | **10–20 to'lovchi pilot mijoz** | `[CALIBRATE]` |
| Wedge | **Retail** (do'kon + kamera + inventar) | Qaror |
| Oylik infratuzilma byudjeti | **~$150** | `[CALIBRATE]` |

---

## 17. ENGINEERING_CONTRACT bilan bog'lanish xaritasi

| V3 elementi | Contract bandi | Munosabat |
|---|---|---|
| V3-P0 metering | A27, ADR-012, Contract Phase 7 | **Tartib o'zgardi** (P7 → V3-P0), qaror mazmuni o'zgarmadi |
| V3-P0 policy/kill switch | SEC-07, §6.5, Konstitutsiya #9 | Kengaytirish — Contract'da agent-darajasidagi kill switch yo'q edi |
| V3-P0 approval logging | ADR-008 (audit), §6.5 | Kengaytirish: audit yozuvi bor, **approval hodisasi sifatida** modellashtirilmagan edi |
| V3-P0 `browser-worker` | A21, ADR-010, Contract Phase 6 | **O'zgarishsiz** — Contract'ning bajarilmagan bandi |
| V3-P1 pricing engine | A27, Konstitutsiya #15–21 | Kengaytirish: internal cost / user price ajratilishi Contract'da aniq emas |
| V3-P1 besh tier | — | **YANGI** — ADR-024 |
| V3-P1 eval harness | A35 (test strategiyasi) | **YANGI qatlam** — A35 kod testlari haqida, eval — model sifati haqida |
| V3-P1/P2 memory (pgvector) | A10 (Postgres yagona manba) | **Mos** — pgvector Postgres ichida, ikkinchi DB emas |
| V3-P2 MCP | A33 (API versiyalash) ruhida | **YANGI** — ADR-029 |
| V3-P2 browser externalization | A21, ADR-010 | ⚠️ **QARAMA-QARSHILIK** — ADR-010 Browserbase'ni RAD ETGAN. ADR-026 buni qayta ochadi. **Contract ustun** — Addendum §3 ga qarang |
| V3-P3 retail wedge | A39 (feature freeze) | **Mos** — yangi vertikal emas, mavjudini chuqurlashtirish |
| V3-P4 creator payouts | A29 | **O'zgarishsiz** — blocked-stub holatida qoladi |
| Admin Control Plane | §6 | Ustki qatlam, almashtirmaydi |
| Kill criteria | ADR-020 | Ijro mexanizmi |
| Uch trek modeli | — | **YANGI** — ADR-031 |

---

## 18. Nima qurilmaydi

> ⚠️ **Manba eslatmasi:** brifda "Contract §30 ro'yxati" ga havola qilingan.
> Contract'da **§30 bo'limi yo'q** (u 13 bo'limdan iborat; #30 — Konstitutsiya
> qoidasi, `onDelete: Cascade` haqida). Quyidagi ro'yxat Contract'ning
> **haqiqiy** "rad etilgan" qarorlaridan (§2 "Rad etildi" qatorlari, §5 ADR
> "Why rejected", A39/ADR-020) yig'ilgan. Nomuvofiqlik Addendum §3 da qayd
> etilgan.

| Qurilmaydi | Contract manbai | V3 konteksti |
|---|---|---|
| Mikroservislarga bo'lish | A3 | 1M foydalanuvchigacha monolit yetadi |
| Ikkinchi tranzaksion DB (Mongo/Dynamo) | A10 | pgvector Postgres ichida — bu istisno emas |
| Repository/UnitOfWork qatlami | A11 | — |
| Kubernetes | A38 | 1M gacha |
| Stripe (UZ bozori uchun) | A26/ADR-003 | Global ekspansiyagacha |
| Clerk/Auth0'ga qaytish | A6/ADR-001 | — |
| CASL / OPA policy engine | A8/ADR-002 | V3 policy engine — **risk tier**, RBAC emas; ziddiyat yo'q |
| Offset pagination | A18 | — |
| Soft-delete (`deletedAt`) | A15 | — |
| Redis'ni kesh sifatida (alohida ADR'siz) | A19/ADR-006 | V3 kesh qo'shmaydi |
| Temporal / Kafka (bu bosqichda) | ADR-005 | — |
| Headful login-capture | A22 | — |
| `apps/companion-android` | A23 | Bo'sh papka — va'da bermaslik |
| Yangi vertikal/dashboard sahifa (freeze davrida) | A39/ADR-020 | V3-P3 gacha yangi vertikal yo'q |
| Xotira/ma'lumotni tashqi SaaS'ga (Mem0/Zep) berish | — (V3 qarori) | ADR-027 — data residency sababi |
| Creator payout kodini yozish | A29 | Demand gate ortida |
| Agent-to-agent commerce implementatsiyasi | — (V3 qarori) | Faqat schema, build emas |

---

## 19. Hujjatlar xaritasi

| Hujjat | Nima uchun |
|---|---|
| [`../ENGINEERING_CONTRACT.md`](../ENGINEERING_CONTRACT.md) | **FROZEN** — arxitektura qarorlari yagona manbai |
| [`../ENGINEERING_CONTRACT_ADDENDUM_V3.md`](../ENGINEERING_CONTRACT_ADDENDUM_V3.md) | V3 nima o'zgartirdi / nima o'zgartirmadi / ziddiyatlar |
| [`../status/current-state-2026-08-13.md`](../status/current-state-2026-08-13.md) | Baseline snapshot (muzlatilgan) |
| [`BUILD_VS_BUY.md`](BUILD_VS_BUY.md) | Sotib olish / qurish qoidasi va jadvali |
| [`PRICING_ARCHITECTURE.md`](PRICING_ARCHITECTURE.md) | Besh tier, metering o'lchamlari, funnel |
| [`METRICS.md`](METRICS.md) | Baseline + metrika ta'riflari + calibration protokoli |
| [`BUSINESS_TRACK.md`](BUSINESS_TRACK.md) | Kod bilan bloklanmagan ishlar |
| [`SAFETY_POLICY_LAYER.md`](SAFETY_POLICY_LAYER.md) | Doimiy xavfsizlik qatlami spetsifikatsiyasi |
| [`KILL_CRITERIA.md`](KILL_CRITERIA.md) | Har feature/vertikal uchun to'xtatish mezoni |
| `../adr/ADR-023 … ADR-032` | V3 ning arxitektura qarorlari |
