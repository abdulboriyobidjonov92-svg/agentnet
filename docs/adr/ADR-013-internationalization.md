# ADR-013 — Internationalization

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-013) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** O'z i18n yechimi, 789 kalit × 3 til, qo'lda sinxronizatsiya.

**Decision:** Yechim **KEEP**; CI'da **kalit-tenglik testi** qo'shiladi (uz/ru/en kalitlari aynan bir xil bo'lishi shart); kod izohlari o'zbekcha qoladi, lekin **yangi public API/DTO nomlari inglizcha**.

**Alternatives:** (a) next-intl/i18next, (b) tarjima SaaS (Crowdin), (c) faqat inglizcha.

**Why rejected:** (a) migratsiya narxi, mavjud yechim ishlaydi. (b) 3 til uchun erta. (c) bozor talabi — uz/ru majburiy.

**Long-term impact:** 4-til (qozoq/tojik) qo'shish mexanik ish bo'ladi.

> **Eslatma (raqam eskirgan):** Contract'dagi "789 kalit" — 2026-08-02
> holati. 2026-08-14 o'lchovi: **860 × 3** `[MEASURED]`, parity saqlangan.
> Contract o'zgartirilmaydi; farq `ENGINEERING_CONTRACT_ADDENDUM_V3.md` §3.8 da qayd etilgan.
