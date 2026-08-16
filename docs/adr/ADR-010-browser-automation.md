# ADR-010 — Browser Automation

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-010) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED (KUCHDA)
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Chromium API jarayonida; konkurentlik cheklovisiz; headful login prod'da ishlamaydi.

**Decision:** Alohida `browser-worker` servisi (BullMQ consumer, `MAX_CONCURRENT_RUNS=2`); headful `LoginCapture` olib tashlanadi; har run uchun **domen allowlist** majburiy.

**Alternatives:** (a) Browserless/Browserbase, (b) API'da semaphore, (c) hozirgicha.

**Why rejected:** (a) foydalanuvchi sessiya cookie'lari uchinchi tomon infratuzilmasiga chiqadi — bizning eng maxfiy aktivimiz; qabul qilinmaydi. (b) API OOM'i butun platformani o'ldiradi. (c) prod'da ishlamaydi.

**Long-term impact:** brauzer yuki API SLO'siga ta'sir qilmaydi; worker'lar arzon spot instanslarda ishlaydi.

> ⚠️ **V3 tangligi:** `ADR-026` managed brauzerni qayta ko'radi. **Bu ADR
> KUCHDA QOLADI** va ADR-026 `PROPOSED` holatida — u faqat "sessiya holati
> vendorga hech qachon yuborilmaydi" sharti bajarilganda ko'riladi.
> Batafsil: `ENGINEERING_CONTRACT_ADDENDUM_V3.md` §3.2.
