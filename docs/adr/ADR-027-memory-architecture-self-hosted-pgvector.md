# ADR-027 — Xotira arxitekturasi: self-hosted pgvector

**Sana:** 2026-08-14 · **Holat:** ACCEPTED
**Supersedes:** yo'q. **Mos:** Contract A10 (Postgres yagona manba).
**Bog'liq:** ADR-030 (data residency), [`../strategy/BUILD_VS_BUY.md`](../strategy/BUILD_VS_BUY.md)
**Ta'sir qiladi:** `apps/api/prisma/schema.prisma`, `apps/agent-engine`, memory yo'li

## Problem

Agent xotirasi bugun **mavjud emas**: `pgvector`/`embedding` so'zlari butun
kod-bazada **5 marta, 2 faylda** (`agent_engine.py`, `halal_filter.py`)
uchraydi — **implementatsiya yo'q** `[MEASURED]`. `docker-compose.yml`
`pgvector/pgvector:pg16` image'idan foydalanadi, ya'ni infratuzilma tayyor,
foydalanish yo'q.

Ikki xavf:

1. **Kech qo'yish narxi.** Xotira — kesib o'tuvchi (cross-cutting) qatlam:
   u chat, agent, konnektor, trace yo'llariga tegadi. Uni V3-P4 da qo'shish
   arxitekturani qayta yozish demak.
2. **Foydalanuvchi kutishi.** 2030 foydalanuvchisi eslab qoladigan agent
   kutadi. "Har suhbatda nolga qaytadigan" agent — 2023 mahsuloti.

Uchinchi savol: **sotib olinsinmi?** (Mem0, Zep va shu kabi memory-as-a-service).

## Decision

**Xotira o'zimizda quriladi: Postgres + `pgvector`.**

1. **Tashqi memory SaaS RAD ETILADI.** Mem0/Zep — AQSh SaaS'lari;
   foydalanuvchi va biznes xotirasini ularga jo'natish O'zbekiston
   data-residency masalasini **uchinchi tomon orqali qayta tiklaydi**
   (ADR-030 §Q4). Naqshini o'rgan, **ma'lumotni o'zingda saqla**.

2. **Contract A10 buzilmaydi:** pgvector — Postgres kengaytmasi, **ikkinchi
   tranzaksion DB emas**. Bu qaror A10 ("Ikkinchi tranzaksion DB
   kiritilmaydi") ga zid emas.

3. **Bosqichma-bosqich:**
   - **V3-P1 — foundation:** sxema (`MemoryItem`: `userId`, `agentId?`,
     `kind`, `content`, `embedding vector`, `sourceRef`, `createdAt`,
     `expiresAt?`), yozish yo'li, indeks. O'qish hali kontekstga
     in'ektsiya qilinmaydi.
   - **V3-P2 — o'qish:** kontekstga in'ektsiya, relevantlik chegarasi,
     eval bilan o'lchash (ADR-028).
   - **V3-P4 — to'liq:** org-darajasidagi shared memory (Business tier).

4. **Maxfiylik qoidalari (majburiy):**
   - Xotira **ijara-scoped** (Contract Konstitutsiya #3) — `userId` shart.
   - Foydalanuvchi xotirani **ko'ra oladi va o'chira oladi** (GDPR eksport/
     o'chirish yo'llariga qo'shiladi — `GET /users/me/export` + `DELETE /users/me` mavjud `[MEASURED]`).
   - Nozik toifalar (sog'liq, moliya tafsilotlari) uchun `kind` bo'yicha
     saqlash siyosati va `expiresAt`.
   - Embedding **shifrlanmaydi** (vektor qidiruvi buni imkonsiz qiladi),
     lekin **xom matn** `CryptoService` orqali shifrlanadi
     (Konstitutsiya #8). Bu — ataylab qilingan kelishuv va u ADR-030
     savollariga kiritilgan.

5. **Model:** embedding provayderi almashtiriladigan bo'lishi shart
   (`embeddingModel` ustuni saqlanadi; model o'zgarsa qayta
   indekslanadi).

## Alternatives

- **(a)** Mem0 / Zep / boshqa memory-as-a-service.
- **(b)** Qdrant / Pinecone (alohida vektor DB).
- **(c)** Xotirasiz davom etish (har suhbat mustaqil).
- **(d)** Xotirani faqat `Message` tarixi sifatida (vektor qidiruvsiz).
- **(e)** V3-P4 ga kechiktirish (V2 tartibi).

## Why rejected

- **(a)** Data residency muammosini uchinchi tomon orqali qayta tiklaydi.
  Bundan tashqari xotira — **foydalanuvchi haqidagi eng nozik ma'lumot**;
  uni tashqi SaaS'ga berish halal/ishonch pozitsiyasi (Contract "hech qachon
  o'zgarmaydi" #7) bilan ziddiyatda. Vendor narxi ham foydalanuvchi soniga
  proporsional o'sadi.
- **(b)** Ikkinchi ma'lumot tizimi = ikkinchi backup, ikkinchi migratsiya,
  ikkinchi uzilish nuqtasi. Contract A10 va §8 (100k gacha Postgres yetadi)
  ruhi. pgvector bizning hajmimizda yetarli; Contract §8 da alohida vektor
  DB'ga ko'chirish yo'li 1M bosqichida ochiq qoladi.
- **(c)** Mahsulot kutishidan orqada qolish; personalizatsiya —
  retention'ning asosiy dvigateli.
- **(d)** Matn qidiruvi semantik yaqinlikni bermaydi; "o'tgan oy qaysi
  yetkazib beruvchi kechikkan edi?" savoli `ILIKE` bilan ishlamaydi.
- **(e)** Kech qo'yish = arxitektura qayta yozish (§Problem 1). V3 aynan
  shu sababli uni P4 dan P1/P2 ga ko'chirdi.

## Long-term impact

**Ijobiy:**
- Xotira **moat**ga aylanadi: u execution data bilan bir bazada yashaydi,
  ya'ni "agent sizning biznesingizni biladi" da'vosi texnik jihatdan real.
- Data residency savoli **bitta joyda** hal bo'ladi (bizning Postgres),
  N ta vendorda emas.
- Business tier uchun shared memory tabiiy kengaytma.

**Narxi / qarzi:**
- Embedding chaqiruvlari xarajat qo'shadi — ADR-023 metering'iga kiradi
  (`U9 storage`, embedding tokenlari `U1`).
- pgvector indeksi (HNSW/IVFFlat) Postgres RAM'ini iste'mol qiladi —
  Contract §8 100k bosqichida `pro` planga o'tish sababi kuchayadi.
- Embedding modeli o'zgarganda qayta indekslash — rejalashtirilgan
  migratsiya ishi (Konstitutsiya #27: orqaga qaytarish rejasi bilan).
