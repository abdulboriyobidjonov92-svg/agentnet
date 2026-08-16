---
doc: KILL_CRITERIA
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# KILL CRITERIA — to'xtatish mezonlari

**Sana:** 2026-08-14 · **Versiya:** 1.0 · **Holat:** ACTIVE
**Bog'liq:** [`MASTER_ROADMAP_V3.md`](MASTER_ROADMAP_V3.md) §12 · Contract A39 / ADR-020
**Qaror egasi (barcha qatorlar):** founder (solo). Ikkinchi qaror egasi
paydo bo'lganda bu ustun yangilanadi.

---

## 0. Taksonomiya

Har element **aynan bittasiga** tegishli:

| Holat | Ma'nosi |
|---|---|
| **KEEP** | Yadro. To'xtatilmaydi. Mezon — sifat, mavjudlik emas |
| **EXPERIMENT** | Isbot kutmoqda. Raqamli mezon + sana bor. Bajarilmasa → `ARCHIVE` |
| **FEATURE FLAG** | Kodda bor, yoqilmagan yoki cheklangan auditoriyada |
| **KILL** | Olib tashlanadi (kod o'chiriladi) |
| **ARCHIVE** | Kod git tarixida qoladi, UI'dan olib tashlanadi, yangi ish qilinmaydi |

**Qoida:** mezon bajarilmasa qaror **avtomatik** — muhokama emas. Qayta
ko'rish faqat yangi ma'lumot kelganda (va u yozib qoldiriladi).

**Contract bog'lanishi:** ADR-020 "har yangi vertikal uchun kill-criteria
(30 kun / X faol foydalanuvchi)" deydi. Bu hujjat — uning ijro mexanizmi.
Contract A39 (feature freeze) buzilmaydi: bu yerda **yangi** narsa
qo'shilmagan, mavjudlar tasniflangan.

---

## 1. Vertikallar

| Element | Holat | Raqamli mezon | Qayta ko'rish sanasi | Izoh |
|---|---|---|---|---|
| **Retail** (do'kon, inventar, kamera fuziyasi) | **KEEP** — flagship wedge | V3-P3 gate'lari: 10–20 to'lovchi pilot, ≥50% mijozda tejamkorlik ≥3× obuna | V3-P3 oxiri | Wedge qarori (§16 default) |
| **Operations** (biznes-operatsiyalar) | **EXPERIMENT** | 60 kunda **≥10 faol foydalanuvchi** (haftada ≥1 muvaffaqiyatli ijro) | V3-P2 oxiri | `[CALIBRATE]` — bugungi foydalanish o'lchanmagan |
| **Trade** (tashqi savdo, bojxona) | **EXPERIMENT** | 60 kunda **≥5 faol foydalanuvchi** | V3-P2 oxiri | Nisha tor, lekin qiymat yuqori bo'lishi mumkin |
| **GovTech** (my.gov.uz, davlat xizmatlari) | **FEATURE FLAG** | Yurist javobi (§9 Q5) + **≥5 so'rov** | V3-P1 oxiri | ⚠️ `CRITICAL` risk tier — huquqiy javobgarlik aniqlanmaguncha keng ochilmaydi |
| **AgentOS** (enterprise command center) | **EXPERIMENT** | **≥1 to'lovchi Business/Enterprise mijoz** | V3-P4 boshi | Bugun demo-og'ir; enterprise talab kelmasa `ARCHIVE` |
| **Life Twin / Qaror simulyatori** | **EXPERIMENT** | 60 kunda **≥15 faol foydalanuvchi** | V3-P2 oxiri | B2C xususiyati — B2B North Star bilan tanglik |
| **Autonomous Goals** | **EXPERIMENT** | 60 kunda **≥10 faol foydalanuvchi** VA kunlik LLM xarajati **< $2** | V3-P1 oxiri | ⚠️ Cron avtonom LLM sarflaydi (`goals.service.ts` `@Cron` `[MEASURED]`) — metering yoqilgach xarajat aniq bo'ladi |
| **Agent Fusion / Chuqur tahlil** | **EXPERIMENT** | 60 kunda **≥10 faol foydalanuvchi** | V3-P2 oxiri | — |
| **Knowledge Sync** | **EXPERIMENT** | 60 kunda **≥10 faol foydalanuvchi** | V3-P2 oxiri | Memory (V3-P1/P2) bilan birlashtirilishi mumkin — birlashsa alohida element sifatida `ARCHIVE` |
| **Ethical Decision Engine** | **KEEP** (halal filtr qismi) | Sifat mezoni: false-positive **<5%** | V3-P2 | Contract "hech qachon o'zgarmaydi" #7 — halal filtr yadro |

---

## 2. Platforma imkoniyatlari

| Element | Holat | Raqamli mezon | Qayta ko'rish sanasi | Izoh |
|---|---|---|---|---|
| **Marketplace** (agent katalogi) | **KEEP** | O'rnatishlar: oyiga **≥20** | V3-P4 | Distribution qatlami |
| **Marketplace creator payouts** | **FEATURE FLAG** (blocked-stub) | Demand gate: **≥10 kreator** va jami **≥$500 ekv.** balans | V3-P4 | Contract A29 — kod yozilmaydi |
| **Device control / Companion desktop** | **EXPERIMENT** | 90 kunda **≥5 faol qurilma** | V3-P2 oxiri | Xavfsizlik yuzasi katta (Contract A23/ADR-011); foydalanish bo'lmasa `ARCHIVE` |
| **Browser automation** | **KEEP** | Success rate **≥60%** (ADR-026 qaroridan keyin) | V3-P2 | Wedge uchun kerak; lekin bugun API jarayonida `[MEASURED]` — Critical qarz |
| **Camera / CV (vision)** | **EXPERIMENT** | Retail pilotida **≥3 do'konda** real kamera ishlaydi VA false-positive **<10%** | V3-P3 | ⚠️ Biometrik savollar (§9 B1–B6) javobsiz bo'lsa — **BLOCKED**, kill emas |
| **Halal semantic layer** | **KEEP** | False-positive **<5%**, ishlash **<300ms** qo'shimcha latency | V3-P2 | Moat (§2 M7) |
| **MCP server** | **EXPERIMENT** | 90 kunda **≥5 tool** + **≥1 tashqi klient** chaqiruvi | V3-P2 oxiri | ADR-029 |
| **Memory (pgvector)** | **KEEP** (V3-P1 dan) | Chat sifatiga o'lchangan ta'sir: eval bali **≥+5%** | V3-P2 | ADR-027 |
| **Eval harness** | **KEEP** | ≥50 vazifa, har relizda ishlaydi | V3-P1 | Moat (§2 M5) |
| **Referral dasturi** | **EXPERIMENT** | Referral koeffitsiyenti **≥0.1** | V3-P2 | Mavjud (`src/referral/` moduli `[MEASURED]`) |
| **Briefing (haftalik Telegram)** | **EXPERIMENT** | Ochilish/reaksiya **≥30%** | V3-P2 | Mavjud (`src/briefing/` + `@Cron` `[MEASURED]`) |
| **Share / public natija sahifasi** | **EXPERIMENT** | Oyiga **≥10 ulashish** va **≥2 signup** | V3-P2 | Mavjud (`src/share/` moduli `[MEASURED]`) |
| **3D landing / Cinematic hero** | **KEEP** | Bundle byudjeti: dashboard bundle'ga **0 KB** qo'shmaydi (faqat landing) | V3-P4 | Contract A30 — dizayn tizimi mahsulot identifikatori |
| **Product tour / onboarding** | **KEEP** | Activation rate'ga ta'sir o'lchanadi | V3-P1 | — |

---

## 3. Agent economy elementlari (demand gate ortida)

| Element | Holat | Demand gate | Qayta ko'rish sanasi |
|---|---|---|---|
| **Agent World** | **ARCHIVE** (g'oya sifatida saqlanadi) | `[CALIBRATE]` — V3-P4 da belgilanadi | V3-P4 |
| **Multi-agent orkestratsiya (foydalanuvchi ko'radigan)** | **FEATURE FLAG** | **≥20%** qo'llab-quvvatlash so'rovlari bitta agent bilan hal bo'lmaydi | V3-P4 |
| **Agent wallet** | **ARCHIVE** | **≥5 mustaqil foydalanuvchi so'rovi** | V3-P4 |
| **Agent-to-agent commerce** | **ARCHIVE** (faqat schema) | **≥3 tashqi platforma** so'rovi | V3-P5 |
| **Creator economy 2.0** (agent trening + kurs sotish) | **ARCHIVE** | Marketplace payout gate'i ochilgach | V3-P4 |

---

## 4. Roadmap backlog elementlari (`docs/status/roadmap.md` dan)

`docs/status/roadmap.md` (2026-07-03) da 13 ta "wow" imkoniyat bor. V3
kontekstida ularning holati:

| Element | Holat | Mezon / sabab |
|---|---|---|
| Predictive Future Simulation | **ARCHIVE** | Life Twin `EXPERIMENT` gate'idan o'tmaguncha kengaytirilmaydi |
| Agent Cloning | **FEATURE FLAG** | Arzon, lekin V3-P4 (platform expansion) elementi |
| Collaborative Multi-User Agents | **FEATURE FLAG** | = Business tier; V3-P4 |
| Mental Health Co-Pilot | **ARCHIVE** | B2C; North Star (SME execution) dan tashqarida; klinik protokol talab qiladi |
| Crisis & Emergency Mode | **ARCHIVE** | Ayni sabab |
| Voice + Vision + Action multimodal | **EXPERIMENT** (faqat vision qismi, retail ichida) | §2 Camera/CV qatori |
| Anonymous Expert Network | **ARCHIVE** | Operatsion (ekspert bazasi) — solo founder chegarasidan tashqarida |
| Multi-Device Swarm | **ARCHIVE** | Mobil ilova demand gate ortida |
| AR Mode | **KILL** | Hech qanday gate'ga bog'lanmagan; qiymat gipotezasi yo'q |
| National Impact Mode | **ARCHIVE** | GovTech `FEATURE FLAG` gate'i ochilgandan keyin qayta ko'riladi |
| Anonymous Community Intelligence | **ARCHIVE** | Foydalanuvchi soni yetarli emas |
| Legacy / Memory Inheritance | **ARCHIVE** | Axloqiy-huquqiy ish hajmi katta, B2C |
| Creator Economy 2.0 | **ARCHIVE** | §3 |

---

## 5. Qayta ko'rish jarayoni

| Qadam | Kim | Qachon |
|---|---|---|
| 1. Har `EXPERIMENT` elementning metrikasi o'qiladi | founder | Qayta ko'rish sanasida |
| 2. Mezon bajarildimi — **ha/yo'q** (oraliq javob yo'q) | founder | shu kuni |
| 3. `yo'q` → `ARCHIVE` (UI'dan olib tashlash rejasi bilan) | founder | 7 kun ichida |
| 4. `ha` → `KEEP` yoki yangi mezon bilan `EXPERIMENT` | founder | shu kuni |
| 5. Qaror bu hujjatga yoziladi (eski qator o'chirilmaydi) | founder | shu kuni |

**Qoida:** qayta ko'rish sanasi kelganda metrika **o'lchanmagan** bo'lsa —
element avtomatik `ARCHIVE`. "O'lchay olmadim" — davom etish sababi emas;
o'lchanmaydigan feature qiymatini isbotlay olmaydi.

---

## 6. Contract bilan munosabat

| Bu hujjat | Contract | Munosabat |
|---|---|---|
| Kill criteria mexanizmi | ADR-020 | **Ijro** — ADR-020 talab qilgan narsa |
| Feature freeze | A39 | **Buzilmaydi** — yangi element qo'shilmagan |
| Vertikallar tasnifi | §2 A39 | Contract "har chorakda foydalanilmagan sahifalar arxivlanadi" deydi — bu jadval shuning ro'yxati |
| `AR Mode` = KILL | — | Roadmap backlog elementi; Contract'da yo'q |
