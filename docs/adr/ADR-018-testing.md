# ADR-018 — Testing

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-018) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** 253 unit test mock-Prisma bilan; DB/guard/scoping xatolari testlanmaydi; device-control 0 test.

**Decision:** Uch qatlam (unit / Testcontainers-integratsiya / E2E). **Har yangi endpoint uchun majburiy: 1 auth testi + 1 scoping testi.** O'zgargan satrlar coverage ≥80%.

**Alternatives:** (a) faqat unit, (b) faqat E2E, (c) global 80% coverage.

**Why rejected:** (a) eng qimmat xatolar (scoping, migratsiya) unit'da ko'rinmaydi. (b) sekin va mo'rt. (c) mavjud kodni qoplash uchun sun'iy testlar yoziladi — qiymatsiz.

**Long-term impact:** refaktor qilish xavfsiz bo'ladi; bu — miqyoslash uchun asosiy shart.

> **V3 eslatmasi:** `ADR-028` **to'rtinchi qatlam** qo'shadi — **eval
> harness** (model sifati). U bu uch qatlamni almashtirmaydi.
> Raqam eskirgan: 2026-08-14 o'lchovi **72 suite / 968 test** `[MEASURED]`.
