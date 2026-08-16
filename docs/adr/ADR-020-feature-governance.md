# ADR-020 — Feature Governance

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-020) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** 20 dashboard sahifa, 44 engine endpoint, 1 muhandis; qo'llab-quvvatlash qarzi o'sadi.

**Decision:** **Feature freeze** P0–P4 davomida; keyin har yangi vertikal uchun kill-criteria (30 kun / X faol foydalanuvchi); har chorakda foydalanilmagan sahifalar arxivlanadi.

**Alternatives:** (a) freeze'siz davom etish, (b) hozir mavjud yarmini o'chirish.

**Why rejected:** (a) qarz yig'iladi va poydevor ishi hech qachon boshlanmaydi. (b) qaysi feature qiymatli ekani hali o'lchanmagan (Phase 5 dan keyin ma'lum bo'ladi).

**Long-term impact:** kod-baza kattaligi qiymat bilan bog'lanadi.

> **V3 eslatmasi:** bu ADR talab qilgan **kill-criteria hech qachon
> yozilmagan edi**. `ADR-032` + [`../strategy/KILL_CRITERIA.md`](../strategy/KILL_CRITERIA.md)
> uni bajaradi. Raqamlar eskirgan: 2026-08-14 o'lchovi **30 web sahifa /
> 40 engine route** `[MEASURED]`.
