# ADR-007 — Storage

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-007) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Qo'ng'iroq yozuvlari base64 sifatida Postgres ustunida.

**Decision:** Cloudflare R2 + envelope shifrlash; DB'da `objectKey` + shifrlangan data-key; hayot-sikli siyosati (90 kun default).

**Alternatives:** (a) DB'da qoldirish, (b) Render disk, (c) S3.

**Why rejected:** (a) backup hajmi va TOAST jarimasi; 1 soatlik audio ≈ 30MB base64 → 40MB satr. (b) instansga bog'lanadi, worker'lar ko'ra olmaydi. (c) R2 — chiqish trafigi bepul, narx afzalligi.

**Long-term impact:** media (skrinshot, kamera kadrlar, eksportlar) uchun tayyor yo'l.
