# ADR-005 — Queues

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-005) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Uzoq ishlar (brauzer-run 12 qadam, vision loop 15 iteratsiya, oylik billing) HTTP so'rovi ichida bajariladi.

**Decision:** BullMQ (Redis) joriy etiladi; uzoq/qayta-urinadigan har ish navbatga o'tadi; SSE faqat progress uzatadi.

**Alternatives:** (a) pg-boss, (b) Cloud Tasks/SQS, (c) Temporal, (d) navbatsiz qolish.

**Why rejected:** (a) Postgres allaqachon eng qimmat resurs; navbat yuki uni yanada yuklaydi. (b) vendor lock + lokal dev murakkabligi. (c) Temporal 1 muhandisga operatsion jihatdan og'ir. (d) HTTP timeout va qayta urinishsiz pul yo'qotish.

**Long-term impact:** worker'larni mustaqil miqyoslash; ishlar tarixi va qayta urinish siyosati markazlashadi.
