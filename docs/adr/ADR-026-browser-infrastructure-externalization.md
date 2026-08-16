# ADR-026 — Brauzer infratuzilmasini tashqariga chiqarish (shartli)

**Sana:** 2026-08-14 · **Holat:** **PROPOSED** (qabul qilinmagan — §Decision dagi shart bajarilmaguncha)
**Supersedes:** yo'q. ⚠️ **ADR-010 bilan tanglikda** — ADR-010 KUCHDA QOLADI.
**Bog'liq:** Contract A21, SEC-07, [`../strategy/BUILD_VS_BUY.md`](../strategy/BUILD_VS_BUY.md) §2
**Ta'sir qiladi:** brauzer-avtomatlashtirish yo'li (`browser-bridge`, `automation`)

## Problem

Uch fakt bir vaqtda to'g'ri:

1. **Chromium hamon NestJS API jarayonining ichida** — `playwright`
   `apps/api/package.json:37` `[MEASURED]`. API OOM = butun platforma
   uzilishi. Contract §9 buni **High qarz, 75% bug ehtimoli** deb baholaydi.
2. **`apps/browser-worker` mavjud emas** `[MEASURED]` — Contract A21/ADR-010
   ning yechimi (o'z worker'imiz, 8 ED) hali bajarilmagan va Contract
   Phase 6-C sifatida ochiq turibdi.
3. **ADR-010 managed brauzerni ANIQ RAD ETGAN:** *"Browserless/Browserbase —
   foydalanuvchi sessiya cookie'lari uchinchi tomon infratuzilmasiga chiqadi
   — bizning eng maxfiy aktivimiz; qabul qilinmaydi."*

Savol: bugungi Critical xavfni tezroq yopish uchun managed infratuzilma
qabul qilinishi mumkinmi?

## Decision

**Contract USTUN. ADR-010 kuchda qoladi. Bu ADR `PROPOSED` holatida.**

Managed brauzer infratuzilmasi (Browserbase, Steel.dev) **faqat va faqat**
quyidagi shart texnik jihatdan ta'minlangan holda qabul qilinishi mumkin:

> **SHART (buzilmas):** foydalanuvchi sessiya holati (`storageState`,
> cookie'lar, login tokenlari) **hech qachon** vendor infratuzilmasiga
> yuborilmaydi. Vendor faqat **anonim (sessiyasiz)** brauzer ishlari uchun
> ishlatiladi.

Shundan kelib chiqadigan **ikki yo'lli arxitektura**:

| Ish turi | Qayerda bajariladi | Sabab |
|---|---|---|
| **Anonim** (ommaviy sayt o'qish, narx tekshirish, katalog skreyping) | Managed vendor | Sessiya yo'q — sir chiqmaydi |
| **Sessiyali** (foydalanuvchi login qilgan kabinet, bank, davlat portali) | **O'z worker'imiz** (Contract A21) | ADR-010 sharti |

**Agar shart ta'minlanmasa** (masalan vendor sessiyasiz rejimni
qo'llamasa yoki narx bunday bo'linishni oqlamasa) — **sotib olish rad
etiladi** va Contract A21 yo'li (`apps/browser-worker`, 8 ED) to'liq
bajariladi.

**Har ikki holatda ham majburiy:** SEC-07 domain allowlist
([`SAFETY_POLICY_LAYER.md`](../strategy/SAFETY_POLICY_LAYER.md) §7).

**Qaror sanasi:** V3-P2 (P2.7). Undan oldin bu ADR `PROPOSED` bo'lib
qoladi va **hech qanday kod yozilmaydi**.

## Alternatives

- **(a)** ADR-010 ni to'liq bajarish — faqat o'z `browser-worker`.
- **(b)** Managed vendorga to'liq o'tish (sessiyalar bilan birga).
- **(c)** Hozirgicha qoldirish (Chromium API ichida).
- **(d)** Brauzer avtomatlashtirishni butunlay olib tashlash.
- **(e)** Foydalanuvchi mashinasida ishlatish (companion / brauzer kengaytmasi).

## Why rejected

- **(a)** **Rad etilmagan** — bu asosiy (fallback) yo'l va shart
  bajarilmasa aynan shu bajariladi. Yagona kamchiligi: 8 ED va
  operatsion yuk (worker parki, Chromium yangilanishi, OOM boshqaruvi).
- **(b)** ADR-010 ni va Konstitutsiya #7/#8 (sir hech qachon tashqariga)
  ruhini buzadi. Sessiya cookie'lari — konnektor sirlaridan ham nozikroq:
  ular bank va davlat kabinetlariga kirish beradi.
- **(c)** Contract §9 da **High qarz, 75%** — API OOM butun platformani
  o'ldiradi. Bu variant vaqt o'tishi bilan yomonlashadi.
- **(d)** Brauzer avtomatlashtirish retail wedge va mahalliy portallar
  uchun zarur (ko'p UZ tizimida API yo'q, faqat web-kabinet).
- **(e)** Contract A22 buni allaqachon ko'rgan: headful login-capture
  prod'da ishlamaydi; companion yo'li mavjud (`apps/companion-desktop`
  `[MEASURED]`), lekin u **foydalanuvchi mashinasi yoqiq bo'lishini** talab
  qiladi — serverdagi avtonom ish uchun yaramaydi.

## Long-term impact

**Agar shart bajarilsa (vendor qabul qilinsa):**
- Chromium API jarayonidan **tezroq** chiqadi (Critical xavf yopiladi).
- Anonim ishlar uchun infra yuki nolga tushadi.
- Ikki yo'l — ikki xil xato manbai; monitoring ikkilanadi.
- Vendor narxi marja hisobiga kiradi (ADR-023 `U5 browser second`).

**Agar shart bajarilmasa (A21 yo'li):**
- 8 ED sarf + doimiy operatsion yuk.
- To'liq nazorat, nol tashqi sir oqimi.
- Contract o'zgarmaydi — bu ADR `REJECTED` deb yopiladi.

**Har ikki holatda:** SEC-07 allowlist bajarilishi shart — u
vendor tanlovidan mustaqil.
