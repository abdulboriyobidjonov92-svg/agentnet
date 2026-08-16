# ADR-016 — Secrets

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-016) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi. Ziddiyat bo'lsa — Contract ustun.

**Problem:** Sirlar Render env'da; rotatsiya protsedurasi yo'q.

**Decision:** Render env-group **KEEP**; `ENCRYPTION_KEY` uchun `v2:` versiyali rotatsiya skripti; sir rotatsiyasi runbook'i; hech qanday sir kodda/logda/testda bo'lmaydi (CI'da `gitleaks`).

**Alternatives:** (a) Vault/Doppler, (b) AWS Secrets Manager, (c) hozirgicha.

**Why rejected:** (a/b) qo'shimcha narx va integratsiya; Render env-group yetarli. (c) rotatsiyasiz sir — muddatsiz risk.

**Long-term impact:** compliance (SOC2/ISO) so'rovlariga tayyor javob.
