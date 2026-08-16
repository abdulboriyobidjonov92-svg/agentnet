# ADR-012 — Billing

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-012) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Flat 500 so'm/xabar — token sarfidan mustaqil.

**Decision:** `hold → reconcile` token-asosli hisob; engine `usage` qaytaradi; narx jadvali env'da; foydalanuvchiga har javob narxi ko'rsatiladi.

**Alternatives:** (a) flat narx, (b) faqat obuna, (c) post-paid hisob-faktura.

**Why rejected:** (a) og'ir agent zarar keltiradi — birlik-iqtisod salbiy. (b) foydalanish farqi 100× — bir tarif ikkala segmentni ham yo'qotadi. (c) undirish riski va UZ bozorida to'lov intizomi.

**Long-term impact:** marja har chaqiruvda kafolatlanadi; enterprise uchun hajmli chegirma qo'shish oson.

> **V3 eslatmasi:** `ADR-023` bu qarorni **kengaytiradi** (internal cost ≠
> user price ajratilishi) va uning **metering qismini** Contract Phase 7 dan
> V3-P0 ga ko'chiradi. Qaror mazmuni o'zgarmaydi.
