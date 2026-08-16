# ADR-004 — AI Engine

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-004) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Engine ommaviy servis sifatida deploy qilinadi (`type: web`), ichki token bilan himoyalangan.

**Decision:** Engine Render **private service** (`pserv`) ga o'tadi; ichki token **qoladi** (ikki qatlam); barcha LLM chaqiruvlari engine orqali — NestJS to'g'ridan-to'g'ri Anthropic'ga bormaydi.

**Alternatives:** (a) engine'ni NestJS ichiga ko'chirish, (b) LLM chaqiruvlarini API'dan qilish, (c) hozirgicha ommaviy qoldirish.

**Why rejected:** (a) Python AI ekotizimi yo'qoladi. (b) prompt/tool mantiqi ikki tilda ikkilanadi. (c) tarmoq darajasidagi himoya token'dan kuchliroq — bepul yutuq.

**Long-term impact:** engine'ni GPU instansga ko'chirish yoki mintaqaviy replikalash mumkin bo'ladi.
