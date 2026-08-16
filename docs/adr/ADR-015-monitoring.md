# ADR-015 — Monitoring

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-015) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Xato kuzatuvi va biznes-alertlar yo'q.

**Decision:** Sentry (3 servis) + 4 biznes-alert + `/api/health` chuqur tekshiruv (DB, engine, redis) + haftalik SLO hisoboti.

**Alternatives:** (a) Datadog/New Relic, (b) o'z Prometheus stack'i, (c) faqat Render loglari.

**Why rejected:** (a) narx bu bosqichda oqlanmaydi. (b) operatsion yuk. (c) hodisani foydalanuvchi aytguncha bilmaslik.

**Long-term impact:** OTel keyin Sentry ustiga qo'shiladi (ikkalasi mos).
