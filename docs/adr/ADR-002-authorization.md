# ADR-002 — Authorization

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-002) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** RBAC faqat DB maydoni; bitta inline `if`.

**Decision:** Global `RolesGuard` + `@Roles()` dekoratori + `PolicyService`; ierarxiya `OWNER > ADMIN > SUPPORT > MEMBER > VIEWER`; dekoratorsiz endpoint default `MEMBER`; cross-tenant o'qish faqat `AdminQueryService` orqali.

**Alternatives:** (a) CASL/ability-based, (b) OPA/Rego, (c) qo'lda if'lar.

**Why rejected:** (a) 5 rol va ~40 endpoint uchun ability-DSL ortiqcha kognitiv narx. (b) tashqi policy engine — 1 muhandis uchun operatsion aql-bovar qilmas. (c) bugungi holat, statistik jihatdan unutiladi.

**Long-term impact:** admin/support/enterprise-org rollarini qo'shish arzonlashadi; auditor uchun avtorizatsiya bitta faylda ko'rinadi.

> **V3 eslatmasi:** bu ADR **avtorizatsiya** (kim nima qila oladi) haqida.
> V3 dagi "policy engine" — **risk tier** (amal qanchalik xavfli) haqida,
> ya'ni boshqa qatlam. Batafsil: `ENGINEERING_CONTRACT_ADDENDUM_V3.md` §3.4.
