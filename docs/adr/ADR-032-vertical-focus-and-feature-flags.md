# ADR-032 — Vertikal fokus va feature-flag taksonomiyasi

**Sana:** 2026-08-14 · **Holat:** ACCEPTED
**Supersedes:** yo'q. **Kengaytiradi:** ADR-020 (Feature Governance), Contract A39.
**Bog'liq:** [`../strategy/KILL_CRITERIA.md`](../strategy/KILL_CRITERIA.md), [`../strategy/MASTER_ROADMAP_V3.md`](../strategy/MASTER_ROADMAP_V3.md) §12
**Ta'sir qiladi:** vertikal modullar, dashboard sahifalar

## Problem

Bugungi yuza: **30 web sahifa**, **33 API modul katalogi**, **40 engine
route** `[MEASURED]`, 6+ vertikal (Retail, Operations, Trade, GovTech,
AgentOS, Life Twin/Goals/Fusion/Knowledge) — **bitta muhandis** bilan.

Contract ADR-020 buni allaqachon ko'rgan va **feature freeze** joriy qilgan
(A39: Phase 0–4 gacha yangi vertikal yo'q) hamda kill-criteria talab
qilgan (*"30 kun / X faol foydalanuvchi"*).

**Lekin:** kill-criteria **hech qachon yozilmagan**. Ya'ni ADR-020 ning
yarmi bajarilmagan: freeze ishlaydi, **arxivlash mexanizmi ishlamaydi**.

Natijada har vertikal **noaniq muddatga** yashaydi: hech kim uni
o'chirmaydi, chunki mezon yo'q; hech kim uni chuqurlashtirmaydi, chunki
fokus yo'q. Bu — eng yomon holat: **keng va sayoz**.

Kontekst: vertikal agentlar g'olib bo'lmoqda — Sierra $15.8B, Harvey $11B,
Decagon $4.5B `[FROM-RESEARCH]`. Ularning umumiy xususiyati: **bitta
vertikalda juda chuqur**, ko'p vertikalda sayoz emas.

## Decision

**1. Bitta flagship wedge: Retail** (do'kon + inventar + kamera).
V3-P3 unga bag'ishlanadi. Qolgan vertikallar shu davrda **chuqurlashmaydi**.

**2. Har vertikal va katta feature aynan bitta holatga tegishli:**

| Holat | Ma'nosi |
|---|---|
| **KEEP** | Yadro; to'xtatilmaydi (mezon — sifat) |
| **EXPERIMENT** | Isbot kutmoqda; raqamli mezon + sana bor |
| **FEATURE FLAG** | Kodda bor, cheklangan/yopiq |
| **KILL** | Kod o'chiriladi |
| **ARCHIVE** | Kod git tarixida qoladi, UI'dan olib tashlanadi |

**3. Har `EXPERIMENT` uchun majburiy:** raqamli mezon, qayta ko'rish
sanasi, qaror egasi. To'liq jadval: `KILL_CRITERIA.md`.

**4. Avtomatik arxivlash qoidasi:** qayta ko'rish sanasida mezon
bajarilmagan bo'lsa — **avtomatik `ARCHIVE`**, muhokamasiz. Metrika
o'lchanmagan bo'lsa ham — `ARCHIVE` ("o'lchay olmadim" davom etish sababi
emas).

**5. Yangi vertikal qo'shish sharti:** mavjud vertikallardan **kamida
bittasi** V3-P3 gate'idan o'tgan bo'lishi shart. Contract A39 freeze'i
V3 kontekstida shunday davom etadi.

**6. `ARCHIVE` ≠ `KILL`.** Arxivlangan modul kodi darhol o'chirilmaydi
(git tarixi bor, lekin qayta tiklash narxi ham bor) — u UI'dan olinadi,
route yopiladi, yangi ish qilinmaydi. **Kod o'chirish** keyingi tozalash
sikliga qoldiriladi. Bu Konstitutsiya #38 ("o'lik kod darhol o'chiriladi")
bilan tanglikda — §Why rejected (e) ga qarang.

## Alternatives

- **(a)** Hamma vertikalni teng rivojlantirish (bugungi holat).
- **(b)** Darhol 4–5 vertikalni o'chirish.
- **(c)** Vertikallarni feature-flag ortiga olib, hech qachon qayta ko'rmaslik.
- **(d)** Foydalanuvchi so'raganini rivojlantirish (reaktiv).
- **(e)** `ARCHIVE` o'rniga darhol `KILL` (Konstitutsiya #38 ga qat'iy amal).

## Why rejected

- **(a)** Solo founder × 6 vertikal = har birida sayozlik. `[FROM-RESEARCH]`
  R9: g'olib mahsulotlar bitta vertikalda chuqur.
- **(b)** Qaysi vertikal qiymatli ekani **hali o'lchanmagan** — Contract
  ADR-020 aynan shu sababdan darhol o'chirishni rad etgan. O'lchovsiz
  o'chirish = tasodifiy qaror.
- **(c)** Flag ortida yashaydigan feature — qarzning eng yashirin turi
  (Konstitutsiya #39: flag umri maks. 2 sprint). Qayta ko'rish sanasi
  majburiy.
- **(d)** Reaktiv rivojlanish fokusni butunlay yo'q qiladi: har mijoz
  boshqa narsa so'raydi va solo founder hammasiga "ha" deydi. Bu — bugungi
  30 sahifaning kelib chiqishi.
- **(e)** Konstitutsiya #38 **yangi yozilgan o'lik kod** haqida ("keyin
  kerak bo'ladi" taqiqi). Bu yerda gap **jonli, ishlaydigan, testlar bilan
  qoplangan** modullarni to'xtatish haqida. Ularni bir kunda o'chirish
  (1) regressiya riski, (2) foydalanuvchiga to'satdan yo'qotish,
  (3) qayta tiklash narxi. `ARCHIVE` → keyin `KILL` — bosqichma-bosqich
  va xavfsizroq. Bu tangliK Addendum'da ochiq qayd etilgan.

## Long-term impact

**Ijobiy:**
- Fokus paydo bo'ladi: bitta vertikalda isbot → takrorlanadigan shablon.
- Har feature **qiymat bilan bog'lanadi** (ADR-020 ning asosiy maqsadi).
- Kod-baza o'sishi qiymat o'sishiga bog'lanadi.
- Qayta ko'rish sanalari kalendarga tushadi — unutilmaydi.

**Narxi / qarzi:**
- Arxivlangan vertikal foydalanuvchilari (agar bor bo'lsa) yo'qotiladi —
  ularni oldindan xabardor qilish shart.
- `ARCHIVE` holatidagi kod saqlash yuki (dependency, test, migratsiya)
  darhol yo'qolmaydi.
- Fokus qarori **noto'g'ri vertikalga** tushishi mumkin — shuning uchun
  V3-P3 gate'lari (10–20 to'lovchi, tejamkorlik ≥3×) qattiq: noto'g'ri
  tanlov 6 hafta ichida ko'rinadi, 6 oyda emas.
