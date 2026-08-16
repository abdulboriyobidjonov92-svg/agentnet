# ADR-011 — Companion Apps

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-011) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Pairing autentifikatsiyasiz; Android papkasi bo'sh; companion yo'li kvota/billing'siz.

**Decision:** Desktop companion saqlanadi va mustahkamlanadi (pairing TTL 10 daq, 5 urinish, throttle, token rotatsiyasi 30 kun, `x-companion-version` tekshiruvi, har amal kvota+billing orqali). Android papkasi olib tashlanadi.

**Alternatives:** (a) companion'ni butunlay olib tashlash, (b) hozirgicha, (c) tayyor RMM/RPA vositasini integratsiya qilish.

**Why rejected:** (a) "qurilma boshqaruvi" — mahsulotning eng kuchli differensiatori. (b) ekspluatatsiya qilinadigan. (c) halal/lokal kontekstga mos emas, narx.

**Long-term impact:** qurilma qatlami xavfsiz asosda kengayadi (Android keyin real kod bilan qaytadi).
