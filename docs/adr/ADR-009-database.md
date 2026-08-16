# ADR-009 — Database

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-009) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** String-enum'lar, `Int` pul, JSON suhbatlar, ishlatilmaydigan soft-delete.

**Decision:** Prisma enum'lar; `BigInt` pul; `Message` jadvali; `deletedAt` olib tashlanadi; har ro'yxat so'rovi uchun kompozit indeks majburiy.

**Alternatives:** (a) hozirgicha qoldirish, (b) JSONB + GIN, (c) alohida analitik DB.

**Why rejected:** (a) admin filtrlari va analitika ishonchsiz bo'ladi. (b) yozish baribir O(n). (c) hozircha erta — Postgres yetadi.

**Long-term impact:** admin, analitika va billing hisobotlari bitta ishonchli sxemadan o'qiydi.
