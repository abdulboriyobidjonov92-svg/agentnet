# ADR-017 — Configuration

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-017) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** `validateEnv()` bor, lekin tiplanmagan; env kalitlari kod bo'ylab `process.env` orqali o'qiladi.

**Decision:** `ConfigModule` + **zod sxemasi** bilan tiplangan config; `process.env` to'g'ridan-to'g'ri o'qish taqiqlanadi (ESLint); har env `.env.example`da hujjatlashadi.

**Alternatives:** (a) hozirgicha, (b) `@nestjs/config` `Joi` bilan.

**Why rejected:** (a) noto'g'ri env prod'da jim xatoga aylanadi. (b) zod TS-tiplarni tabiiy beradi.

**Long-term impact:** yangi muhit (staging) qo'shish xavfsiz.
