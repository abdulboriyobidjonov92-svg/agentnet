# ADR-019 — Deployment Platform

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-019) · **Sana:** 2026-08-02
**Holat:** ACCEPTED — **qisman SUPERSEDED** by [`0021-deployment-topology-vercel-frontend-render-backend.md`](0021-deployment-topology-vercel-frontend-render-backend.md)
(faqat "Vercel + Railway aralashmasi rad etiladi" qismi).
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Render free plan, spin-down, bitta instans.

**Decision:** Render **KEEP**; API+web `starter`, engine `pserv`, worker yangi servis, DB `starter`→`standard` (100k foydalanuvchida). Kubernetes 1M gacha kiritilmaydi.

**Alternatives:** (a) AWS ECS/EKS, (b) Fly.io, (c) Vercel + Railway.

**Why rejected:** (a) operatsion yuk 1 muhandisga nomutanosib. (b) migratsiya foydasi marginal. (c) ikki panel, ikki hisob-faktura.

**Long-term impact:** 1M dan keyin ECS/EKS'ga ko'chish rejasi §8'da.
