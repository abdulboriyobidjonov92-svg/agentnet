# ADR-014 — Logging

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-014) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Nest default logger, strukturasiz matn.

**Decision:** `pino` JSON loglari; majburiy maydonlar: `ts, level, reqId, userId?, module, msg, durationMs?`; PII **hech qachon** logga tushmaydi (telefon/email/token/sir maskalanadi).

**Alternatives:** (a) Winston, (b) console, (c) Nest default.

**Why rejected:** (a) pino tezroq va JSON-birinchi. (b/c) qidiruv va alert qurish mumkin emas.

**Long-term impact:** log agregatori (Loki/Datadog) qo'shilganda o'zgarish kerak bo'lmaydi.
