# ADR-008 — Audit

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-008) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Hash-zanjir global advisory lock bilan seriyalashtirilgan — yozuv hajmida bottleneck.

**Decision:** Zanjir **per-actor** bo'ladi; lock kaliti `hashtext(actorId)`; admin harakatlari uchun majburiy `actorId` + `impersonatedUserId` maydoni qo'shiladi.

**Alternatives:** (a) global zanjirni saqlash, (b) zanjirni olib tashlash, (c) tashqi append-only log (QLDB kabi).

**Why rejected:** (a) yozuv o'sishida navbat. (b) buzilmaslik isboti yo'qoladi — ishonch mahsulotning bir qismi. (c) narx va vendor lock.

**Long-term impact:** audit yozuvi cheksiz miqyoslanadi; huquqiy isbot kuchi saqlanadi.

> **V3 eslatmasi:** V3 bu zanjir ustiga **approval hodisasi modelini**
> qo'shadi (`SAFETY_POLICY_LAYER.md` §8) — audit yozuvi bor edi, lekin
> tasdiq/rad/tuzatish alohida hodisa sifatida modellashtirilmagan edi.
