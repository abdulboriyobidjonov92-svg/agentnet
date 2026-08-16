# ADR-006 — Redis

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-006) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Throttler in-memory, cron leader'siz, navbat yo'q — uchalasi "bitta instans" farazini yaratadi.

**Decision:** Redis qaytariladi, **faqat**: throttler store, taqsimlangan lock, BullMQ backend. Kesh sifatida ishlatish alohida ADR talab qiladi.

**Alternatives:** (a) Postgres advisory lock + jadval-navbat, (b) stateless qolish, (c) Redis'ni hamma narsa uchun (kesh, sessiya).

**Why rejected:** (a) DB yagona bottleneck'ka aylanadi. (b) gorizontal miqyoslash mumkin emas. (c) keshning invalidatsiyasi noto'g'ri qilinsa — jim ma'lumot buzilishi; ataylab kechiktiriladi.

**Long-term impact:** aniq chegaralangan Redis — migratsiya va debug oson.
