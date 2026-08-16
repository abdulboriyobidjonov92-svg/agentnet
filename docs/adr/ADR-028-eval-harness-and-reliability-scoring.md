# ADR-028 — Eval harness va reliability scoring

**Sana:** 2026-08-14 · **Holat:** ACCEPTED
**Supersedes:** yo'q. **Kengaytiradi:** Contract A35 / ADR-018 (test strategiyasi).
**Bog'liq:** ADR-023 (metering), [`../strategy/METRICS.md`](../strategy/METRICS.md)
**Ta'sir qiladi:** CI, `apps/agent-engine`, agent trust UI

## Problem

Kod testlari yaxshi holatda: **72 suite / 968 test** `[MEASURED]`. Lekin
ular **kod to'g'riligini** tekshiradi, **model sifatini** emas.

Bugun quyidagi savollarga javob yo'q:
- Arzon modelga o'tsak sifat qanchaga tushadi?
- Prompt o'zgarishi qaysi vazifalarni buzdi?
- Qaysi agent ishonchli, qaysi biri emas?
- Halal filtr false-positive darajasi qancha?

**Bu bo'shliq model routing'ni xavfli qiladi:** arzon modelga o'tish
marjani yaxshilaydi, lekin sifatni jimgina buzsa — buni faqat mijoz
ketganda bilamiz.

Kontekst: OSWorld'da eng yaxshi natija **~72.5%**, inson bazasi
**~72.35%** `[FROM-RESEARCH]` — ya'ni agentlar sanoat miqyosida
**ishonchsiz**. Ishonchsizlikni **o'lchamasdan** sotish mumkin emas.

## Decision

**O'z eval harness'imiz quriladi (sotib olinmaydi).**

**1. Oltin to'plam (golden set).** Kamida **50 vazifa** (V3-P1 gate G1.2),
manbasi — V3-P0 da yig'ilgan **real failure korpusi** (sun'iy vazifalar
emas). Har vazifa: kirish, kutilgan natija sinfi, baholash usuli.

**2. Baholash usullari (aralash):**

| Usul | Qachon |
|---|---|
| Deterministik tekshiruv (formatlar, raqamlar, JSON sxema) | Iloji bo'lsa doim — eng arzon va barqaror |
| Qoidaviy (kalit fakt bor/yo'q) | Strukturaviy javoblar |
| LLM-judge | Faqat yuqoridagilar imkonsiz bo'lganda |
| Inson tekshiruvi | Yangi vazifa sinfini kalibrlashda |

**3. Qachon ishlaydi:** har reliz oldidan (CI), model/prompt o'zgarganda
majburiy, haftalik to'liq to'plam.

**4. Model routing evalga bog'lanadi.** Arzon modelga o'tish **faqat**
eval bali **≥95%** saqlanganda ruxsat etiladi (V3-P1 gate G1.3). Bu —
qattiq darvoza, tavsiya emas.

**5. Reliability score (agent darajasida)** V3-P2 da: eval natijasi +
jonli `ExecutionTrace` muvaffaqiyat statistikasi. Formulani V3-P2 da
qulflaymiz — bugun uni belgilash **soxta aniqlik** bo'lardi.

**6. Failure taksonomiyasi** — har yiqilish sinflanadi (model xatosi ·
tool xatosi · konnektor uzilishi · policy blok · foydalanuvchi kiritishi ·
timeout). Bu taksonomiya moat (§2 M5) ning yadrosi.

**7. Contract A35 buzilmaydi:** eval — **to'rtinchi qatlam**, mavjud uch
qatlam (unit / integratsiya / E2E) ustiga qo'shiladi va ularni
almashtirmaydi.

## Alternatives

- **(a)** Tashqi eval platformasi (Braintrust, LangSmith, Langfuse va sh.k.).
- **(b)** Faqat jonli metrikaga tayanish (foydalanuvchi shikoyati).
- **(c)** Faqat LLM-judge (deterministik tekshiruvsiz).
- **(d)** Evalni V3-P2/P3 ga kechiktirish.
- **(e)** Umumiy ochiq benchmark'larga tayanish (OSWorld, SWE-bench va sh.k.).

## Why rejected

- **(a)** Eval ma'lumoti — **moat** (§2 M5): u real UZ biznes-jarayonlari,
  soliq/Didox oqimlari va uz/ru tildagi javoblardan iborat. Uni tashqi
  platformaga yuklash (1) data residency savolini ochadi, (2) eng qimmatli
  aktivimizni vendor bazasiga ko'chiradi. Bundan tashqari harness'ning
  o'zi murakkab emas — qiymat **ma'lumotda**, vositada emas.
- **(b)** Foydalanuvchi shikoyati — **eng kech va eng qimmat** signal.
  U kelganda mijoz allaqachon ketgan.
- **(c)** LLM-judge sekin, qimmat va **o'zi ham noaniq**. U regressiyani
  ba'zan o'zi yaratadi (judge modeli yangilanganda ballar siljiydi).
  Deterministik tekshiruv — birinchi tanlov.
- **(d)** Model routing (V3-P1) evalsiz **xavfli**: bu aynan "arzonlashtir,
  keyin sifat tushganini bilma" ssenariysi. Eval routing'dan **oldin**
  kelishi shart.
- **(e)** Global benchmark'lar o'zbek soliq hisobotini, Didox e-invoice
  oqimini yoki halal filtr aniqligini o'lchamaydi. Ular kontekst beradi
  (R7 `[FROM-RESEARCH]`), lekin bizning sifatimizni o'lchay olmaydi.

## Long-term impact

**Ijobiy:**
- Model routing xavfsiz bo'ladi → marja o'sadi (ADR-023 bilan birga).
- "Bu agent 87% ishonchli" — sotuvda ishlatiladigan **isbotlangan** da'vo.
- Prompt/model yangilanishi regressiyasiz bo'ladi (bugun: umuman
  tekshirilmaydi).
- Failure taksonomiyasi mahsulot ustuvorligini belgilaydi (eng ko'p
  yiqiladigan sinf — keyingi ish).

**Narxi / qarzi:**
- Har eval yurishi LLM xarajati — CI'da to'liq to'plam qimmat bo'lishi
  mumkin; shuning uchun relizda **qisqartirilgan**, haftada **to'liq**.
- Oltin to'plamni saqlash — doimiy ish (vazifalar eskiradi).
- LLM-judge ishlatilgan joyda ballar **mutlaq emas, nisbiy** — buni
  hujjatlashtirish shart, aks holda soxta aniqlik tug'iladi.
