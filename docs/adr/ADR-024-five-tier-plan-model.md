# ADR-024 — Besh tierlik tarif modeli (Free · Pro · Max · Business · Enterprise)

**Sana:** 2026-08-14 · **Holat:** ACCEPTED
**Supersedes:** yo'q. **Kengaytiradi:** Contract A28 (ikki billing o'qi).
**Bog'liq:** ADR-023, [`../strategy/PRICING_ARCHITECTURE.md`](../strategy/PRICING_ARCHITECTURE.md)
**Ta'sir qiladi:** `User.platformPlan`, `PlatformBillingService`, pricing sahifasi

## Problem

Bugungi platforma tarif tuzilishi tarixiy tarzda o'sgan: `free`/`pro`
(per-agent kunlik kvota) + `platformPlan` — self-serve tariflar
`PLATFORM_PLANS = ['pro','max','max200']`
(`platform-billing.service.ts:25` `[MEASURED]`). Tierlar orasidagi
**ajratish tamoyili yozilmagan** — ya'ni "yangi imkoniyat qaysi tierga tushadi?" savoliga
qoidaviy javob yo'q.

Qoidasiz tarif tuzilishi bir necha oy ichida muqarrar ravishda buziladi:
har yangi feature "eng qimmat tarifga" qo'shiladi, natijada Pro qiymati
tushadi va Free→Pro konversiyasi (asosiy o'sish dvigateli) zaiflashadi.

## Decision

**Besh tier va ular orasidagi ajratish tamoyili muhrlanadi:**

| Tier | Nima o'zgaradi | Nima o'zgarmaydi |
|---|---|---|
| **Free** | Cheklangan **capability** | — |
| **Pro** | **Capability ochiladi** (premium model, browser, vision, memory, ko'proq konnektor) | — |
| **Max** | **Faqat hajm/tezlik/parallel execution** | **Capability Pro bilan AYNAN bir xil** |
| **Business** | **Jamoa qatlami** (rollar, shared agents, org billing, approval flows, audit) | — |
| **Enterprise** | **Xavfsizlik/compliance qatlami** (SSO, SCIM, audit export, data residency, custom limits, SLA) | — |

**Asosiy qoida — Max capability QO'SHMAYDI.** Model, feature, imkoniyat
Pro bilan bir xil; faqat hajm ×N.

Yangi imkoniyat qo'shilganda ruxsat etilgan yagona savol:
*"bu Free/Pro chegarasidami yoki Business/Enterprise chegarasida?"*
**"Max'ga qo'shamiz" javobi mavjud emas.**

Foydalanuvchi tushunishi kerak bo'lgan model:
- Free → Pro = *"ko'proq NARSA qila olaman"*
- Pro → Max = *"ko'proq/tezroq qila olaman"*
- → Business / Enterprise = *"boshqa muammo hal bo'ladi"*

**Contract A28 saqlanadi:** per-agent wallet va platforma obunasi — ikki
alohida o'q. Bu ADR faqat platforma obunasi o'qini aniqlashtiradi.

**Barcha aniq raqamlar `[CALIBRATE]`** — ADR-023 metering ma'lumotidan
keyin (`PRICING_ARCHITECTURE.md` §8).

## Alternatives

- **(a)** Uch tier (Free/Pro/Enterprise).
- **(b)** To'rt tier (Max'siz).
- **(c)** Max'ga eksklyuziv imkoniyatlar qo'shish (bugungi amaliyot yo'nalishi).
- **(d)** Faqat usage-based (tiersiz).
- **(e)** Per-seat narxlash (Business/Enterprise uchun ham hajm emas, seat).

## Why rejected

- **(a)** Pro va Enterprise orasida juda katta sakrash. Og'ir individual
  foydalanuvchi (Max segmenti) yo Pro'da zarar keltiradi, yo umuman ketadi.
- **(b)** Ayni sabab — Max aynan "og'ir, lekin jamoasiz" segmentni ushlaydi;
  bu segment AI mahsulotlarida katta.
- **(c)** **Eng xavfli variant.** Max'ga capability qo'shilishi Pro'ni
  "chala mahsulot"ga aylantiradi va Free→Pro konversiyasini buzadi. Claude.ai
  modeli aynan bunday qilmaydi: *"Max gives you 5x or 20x more usage per
  session than Pro"* — model va feature bir xil.
- **(d)** Bashorat qilinmaydigan hisob-faktura UZ SME bozorida qabul
  qilinmaydi (to'lov intizomi va byudjet aniqligi muhim). Hybrid
  (obuna + overage) — kompromis.
- **(e)** Seat modeli Business/Enterprise uchun **qo'shimcha** o'lchov
  sifatida qoladi, lekin yagona o'lchov bo'la olmaydi: agent ijrosi
  seat soniga proporsional emas (bitta odam 50 agent ishlatishi mumkin).

## Long-term impact

**Ijobiy:**
- Tarif jadvalining o'zi shartnomaga aylanadi: `Max` ustunida `❌`→`✅`
  o'zgarishi yo'q — bu regressiya testi kabi tekshiriladigan qoida.
- Yangi imkoniyatni joylashtirish qarori mexanik bo'ladi (bahs qisqaradi).
- Business tier org/RBAC infratuzilmasini (Contract §6.1, `Org` modeli
  mavjud) monetizatsiya qiladi — yangi kod emas, mavjud qatlamni sotish.
- Enterprise tier compliance ishini (SSO, audit export, residency) **daromad
  bilan bog'laydi** — ya'ni u "kelajakdagi xarajat" emas, sotiladigan qiymat.

**Narxi / qarzi:**
- Bugungi `platformPlan` qiymatlari (`max200`, `team`) yangi modelga
  ko'chirilishi kerak — migratsiya + mavjud obunachilarga xabar.
- Beshta tierni bir vaqtda **sotib bo'lmaydi**: V3-P1 da Free/Pro/Max,
  Business V3-P4 da, Enterprise talab kelganda. Tier mavjudligi ≠ sotuvda.
