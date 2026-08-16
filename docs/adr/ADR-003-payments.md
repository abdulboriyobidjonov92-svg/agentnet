# ADR-003 — Payments

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-003) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** UZ bozorida karta-token avtomatik yechim yo'q; ikkita provayder qo'llab-quvvatlanadi.

**Decision:** Payme + Click **KEEP**; `PaymentProviderService` interfeysi yagona kengaytma nuqtasi; global provayder (Stripe) **qo'shilmaydi** to global ekspansiyagacha.

**Alternatives:** (a) Stripe'ni hozir qo'shish, (b) bitta provayderga qisqartirish, (c) to'lov agregatori.

**Why rejected:** (a) UZ kartalari Stripe'da ishlamaydi — nol qiymat. (b) provayder uzilishida to'lov butunlay to'xtaydi. (c) agregator komissiyasi marjani yeydi.

**Long-term impact:** yangi bozorga chiqishda faqat yangi provayder klassi yoziladi.
