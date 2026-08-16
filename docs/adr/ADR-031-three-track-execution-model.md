# ADR-031 — Uch trekli ijro modeli (Product · Business · Safety)

**Sana:** 2026-08-14 · **Holat:** ACCEPTED
**Supersedes:** yo'q. **Kengaytiradi:** Contract §3 (Critical Path), §10 (Sprint Plan).
**Bog'liq:** [`../strategy/MASTER_ROADMAP_V3.md`](../strategy/MASTER_ROADMAP_V3.md) §4, [`../strategy/BUSINESS_TRACK.md`](../strategy/BUSINESS_TRACK.md), [`../strategy/SAFETY_POLICY_LAYER.md`](../strategy/SAFETY_POLICY_LAYER.md)
**Ta'sir qiladi:** ish tartibi (kod emas)

## Problem

Contract §3 **bitta chiziqli ketma-ketlik** beradi: `P0 → P1 → … → P9`,
va §3 boshida aniq yozadi: *"fazalar qayta tartiblanmaydi"*.

Bu qoida **muhandislik ishi uchun to'g'ri** — har faza keyingisining
oldindan sharti. Lekin u bilvosita bir noto'g'ri xulosaga olib keladi:
*"Payme merchant onboarding'i Phase 6 tugagach boshlanadi"*.

Bu xulosa xato, chunki:
- Payme onboarding **kod bilan bloklanmagan** (kod tayyor `[FROM-AUDIT]`),
- yurist savollari kod bilan bloklanmagan,
- IT Park rezidentligi kod bilan bloklanmagan,
- pilot mijoz suhbatlari kod bilan bloklanmagan.

Natijada: chiziqli o'qish **oylab bepul progressni yo'qotadi**. Solo
founder uchun bu — eng qimmat yo'qotish turi (chunki bu ishlar **vaqt
talab qiladi, lekin muhandislik vaqti emas**: kutish, ariza, uchrashuv).

## Decision

**Ijro uch parallel trekka bo'linadi:**

| Trek | Nima | Bloklanishi |
|---|---|---|
| **Product / Engineering** | Kod, arxitektura, migratsiya | Contract §3 ketma-ketligi bilan bog'liq |
| **Business** | Merchant onboarding, huquqiy hujjatlar, IT Park, kanal testlari, pilot | **Contract fazalariga bog'liq EMAS** |
| **Safety / Compliance** | Risk tierlari, limitlar, approval siyosati, yurist savollari, data residency | **Contract fazalariga bog'liq EMAS** |

**Muhim aniqlik — Contract §3 buzilmaydi:**

> Contract §3 ning "fazalar qayta tartiblanmaydi" qoidasi **Product/
> Engineering trekiga** tegishli va u **o'z ichida to'liq kuchda qoladi**.
> Uch trek modeli fazalarni qayta tartiblamaydi — u **kod bilan
> bloklanmagan ishlarni** muhandislik navbatidan chiqaradi.

**Qoidalar:**

1. **Har vazifa aynan bitta trekka tegishli.** Ikki trekka tegishli
   ko'ringan vazifa — noto'g'ri bo'lingan, ikkiga ajratiladi.
2. **Business va Safety treklari Product trekining tugashini kutmaydi.**
3. **Safety trek hech qachon to'xtatilmaydi** — u doimiy qatlam
   (SAFETY_POLICY_LAYER §0).
4. Vazifalar **BLOCKER / PARALLEL / DEFERRED** deb belgilanadi
   (BUSINESS_TRACK §1).
5. **Trek ichida** ustuvorlik bor, treklar **orasida** yo'q — ular
   raqobatlashmaydi, ular boshqa resurs turini (muhandislik vaqti /
   muloqot vaqti / o'qish-yozish vaqti) iste'mol qiladi.

## Alternatives

- **(a)** Contract §3 ni yagona chiziq sifatida saqlash (bugungi o'qish).
- **(b)** Ikki trek (Product + "boshqa hammasi").
- **(c)** To'rt+ trek (Product / Business / Safety / Growth / Support).
- **(d)** Trekni odamga bog'lash (har trekka bitta kishi) — solo'da imkonsiz.
- **(e)** Kanban — treksiz, bitta oqim, ustuvorlik bo'yicha.

## Why rejected

- **(a)** §Problem da tavsiflangan yo'qotish. Bundan tashqari Contract
  §13.2 ning o'zi *"Asosiy xavf — texnik emas, **taqsimot va
  birlik-iqtisod**"* deydi — ya'ni Contract ham business ishining
  kritikligini tan oladi, lekin unga trek bermaydi.
- **(b)** Safety'ni "boshqa hammasi"ga qo'shish uni **ustuvorlik bo'yicha
  yo'qotadi**: xavfsizlik ishi har doim shoshilinch business ishidan
  keyin qoladi. Uni alohida trek qilish — himoya mexanizmi.
- **(c)** Solo founder uchun 4+ trek — kognitiv yuk va soxta tashkiliylik.
  Growth va Support bu bosqichda Business trekining qismi.
- **(d)** Solo founder — bitta odam. Trek **ish turini** ajratadi, odamni
  emas. Ikkinchi odam qo'shilganda bu qaror qayta ko'riladi.
- **(e)** Bitta oqim yana chiziqli tartibga qaytaradi — muhandislik
  vazifasi har doim "aniqroq va bajariladigan" ko'ringani uchun
  yuristga yozish yoki merchant arizasi doim pastga tushadi. Bu —
  kuzatilgan xulq, gipoteza emas.

## Long-term impact

**Ijobiy:**
- Kod bilan bloklanmagan ish **kutmaydi** — merchant onboarding, huquqiy
  hujjatlar va pilot suhbatlari muhandislik bilan parallel yuradi.
- Safety qatlami tizimli himoya oladi (alohida trek = alohida ustuvorlik).
- V3-P3 (wedge) ga kelganda business tayyorgarligi allaqachon bo'ladi.

**Narxi / qarzi:**
- Kontekst almashish narxi: bir kunda kod + yurist + merchant — bu
  **real charchoq**. Yumshatish: haftalik ritm (masalan business/safety
  ishlari uchun belgilangan kun).
- Uch trekni bitta odam yuritishi — MASTER_ROADMAP_V3 §12 resurs
  chegarasi signallarining tezroq kelishiga olib keladi. Bu **kutilgan**
  natija: signal kelishi — muvaffaqiyat belgisi, muammo emas.
