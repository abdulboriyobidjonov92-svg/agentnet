# ADR-030 — Data residency va compliance treki

**Sana:** 2026-08-14 · **Holat:** ACCEPTED (**jarayon qarori** — huquqiy xulosa EMAS)
**Supersedes:** yo'q. **Bog'liq:** ADR-027 (memory), ADR-025 (konnektorlar), Contract A25/ADR-007 (storage), A37/ADR-016 (sirlar)
**Ta'sir qiladi:** arxitektura qarorlari tartibi (kod emas)

> ⚠️ **BU ADR HUQUQIY XULOSA CHIQARMAYDI.** U faqat **jarayonni** qaror
> qiladi: qaysi savollar, qachon, kimdan so'raladi va javob kelmaguncha
> nima qilinmaydi. Quyidagi hech bir band "shunday qilish mumkin" yoki
> "mumkin emas" deb o'qilmasligi kerak.

## Problem

Uch fakt:

1. **Ma'lumot bir necha yurisdiksiyada.** Foydalanuvchi ma'lumoti Supabase
   Postgres'da (tashqi provayder `[MEASURED]`, `render.yaml` izohi), LLM
   chaqiruvlari Anthropic/OpenRouter orqali (AQSh), fayllar R2'da
   (Contract ADR-007), frontend Vercel `fra1` (Frankfurt `[MEASURED]`).
2. **Retail wedge kamera bilan keladi.** V3-P3 do'kon kamerasini o'z
   ichiga oladi. Kamera oqimi yuz qayta ishlasa — **alohida toifadagi
   ma'lumot** masalasi ochiladi. `[FROM-RESEARCH]`: 2026-mart qonuni
   bilan data localization umumiy holda yumshatildi, lekin **biometrik
   ma'lumot mahalliy qolishi shart**.
3. **Bugungi hujjatlarda huquqiy xulosalar tarqoq.** `texnik-strategiya.md`
   §6.6 da qonun tahlili bor va u o'zi ham *"bu — yuridik maslahatchi
   bilan tasdiqlanishi shart bo'lgan band; ushbu hujjat huquqiy xulosa
   emas"* deb yozadi. Ya'ni **hech kim tasdiqlamagan taxminlar** ustida
   arxitektura qurilmoqda.

**Eng qimmat xato:** kamera/vision arxitekturasini qurib bo'lgach,
biometrik talab tufayli uni qayta yozish.

## Decision

**1. Compliance — alohida trek** (Product trekiga bog'liq emas,
[`../strategy/MASTER_ROADMAP_V3.md`](../strategy/MASTER_ROADMAP_V3.md) §4).

**2. Savollar ro'yxati muhrlanadi** (MASTER_ROADMAP_V3 §9): 10 ta umumiy
savol (Q1–Q10) + 6 ta biometrik savol (B1–B6). Ular yuristga **yozma**
beriladi va javoblar **yozma** olinadi.

**3. Bloklovchi qoida:**

> **B1–B4 savollariga yozma javob kelmaguncha, kamera/vision yo'lida
> yuzga oid hech qanday saqlash arxitekturasi qurilmaydi.**

V3-P3 gacha vision **faqat** "odam bor/yo'q", "javon bo'sh/to'la" kabi
**shaxsni aniqlamaydigan** hodisalar bilan cheklanadi.
[`KILL_CRITERIA.md`](../strategy/KILL_CRITERIA.md) da Camera/CV holati:
javobsiz bo'lsa — **BLOCKED**, kill emas.

**4. Arxitektura ustuvorligi:** agar "yuzni umuman saqlamaslik"
(B4) talabni yopsa — **shu yo'l tanlanadi**. Eng arzon compliance —
ma'lumotni umuman yaratmaslik.

**5. Ma'lumot inventarizatsiyasi** (V3-P0 vazifasi): qaysi ma'lumot
toifasi qayerda saqlanadi va qayerga uzatiladi — bitta jadval. Bu jadval
Q1–Q10 savollariga javob berish uchun **old shart** (yurist bizning
tizimimizni bilmaydi).

**6. Enterprise data residency** (ADR-024 dagi Enterprise tier) V3-P4 da
arxitektura masalasi sifatida ochiladi: Contract §8 (10M bosqich)
"mintaqaviy hujayralar" modeli bunga tayyor zamin beradi.

**7. Xotira ma'lumoti o'zimizda** (ADR-027) — bu qaror aynan shu ADR
sabablari bilan mustahkamlangan.

## Alternatives

- **(a)** Compliance'ni V3-P4 ga kechiktirish.
- **(b)** Huquqiy xulosani hujjatlarda o'zimiz chiqarish (bugungi holat).
- **(c)** Barcha ma'lumotni darhol mahalliy provayderga ko'chirish.
- **(d)** Kamerani butunlay tashlab yuborish.
- **(e)** Compliance'ni faqat enterprise mijoz so'raganda ko'rish.

## Why rejected

- **(a)** V3-P3 (retail wedge) kamera bilan keladi — ya'ni savol P3 da
  **majburan** ochiladi. Javobni P3 da kutish = wedge to'xtab qolishi.
  Savollar **bepul va parallel** — kechiktirish uchun sabab yo'q.
- **(b)** **Eng xavfli variant.** Muhandis huquqiy xulosa chiqarsa, u
  xulosa hech kimni himoya qilmaydi, lekin qaror asosi bo'lib qoladi.
  Shu sababli V3 hujjatlarida huquqiy xulosa **taqiqlangan** — faqat
  savollar.
- **(c)** Katta migratsiya (Supabase → mahalliy), yuqori narx va
  operatsion yuk — **tasdiqlanmagan talab uchun**. Avval savol, keyin
  migratsiya.
- **(d)** Kamera — retail wedge ning differensiatoridir (inventar +
  kamera fuziyasi mavjud — `retail.service.ts:273 ingestVisionEvent` `[MEASURED]`). Uni tashlash — wedge qiymatini
  jiddiy kamaytiradi.
- **(e)** Enterprise mijoz so'raganda javob berishga **oylar** kerak
  bo'ladi — bitim shu vaqtda o'ladi. Bundan tashqari SME mijoz ham
  (do'kon egasi) mijozlarining ma'lumoti uchun javobgar.

## Long-term impact

**Ijobiy:**
- Arxitektura qarorlari **javob olingandan keyin** qabul qilinadi —
  qayta yozish riski keskin kamayadi.
- Ma'lumot inventarizatsiyasi enterprise savol-javob (RFP, security
  questionnaire) uchun tayyor artefakt.
- "Ma'lumot o'zimizda" pozitsiyasi (ADR-027) marketingda emas,
  arxitekturada isbotlangan bo'ladi.

**Narxi / qarzi:**
- Yurist xarajati `[CALIBRATE]`.
- Vision qamrovi V3-P3 gacha **ataylab tor** — ba'zi demo ssenariylar
  ko'rsatilmaydi. Bu — halol chegaralanish, marketing yo'qotishi emas.
- Ma'lumot inventarizatsiyasi doimiy saqlanishi kerak (yangi vendor
  qo'shilganda yangilanadi) — bu BUILD_VS_BUY §0 savol-4 ning bir qismi.
