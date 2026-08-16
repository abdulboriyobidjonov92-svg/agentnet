---
doc: CURRENT_STATE_2026_08_13
version: 1.0
status: ARCHIVED
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# AgentNet — hozirgi holat snapshot (2026-08-13 audit doirasi)

**Sana:** 2026-08-13 (audit doirasi) · **O'lchov sanasi:** 2026-08-14
**Commit SHA:** `5659a78049e28c597dc68d5ce3a4585339e52a5c` (`master`, working tree TOZA)
**Turi:** **read-only audit** — bu hujjat qurish jarayonida hech narsa
o'zgartirmagan (kod, migratsiya, dependency, konfiguratsiya — nol o'zgarish).

> **Header'dagi `status: ARCHIVED` haqida:** bu "bekor qilingan" degani
> emas — bu **joriy haqiqat sifatida ishlatilmaydi** degani
> ([`../process/SPEC_SYSTEM.md`](../process/SPEC_SYSTEM.md) §5.2). Snapshot
> tarix sifatida o'qiladi va ataylab hech qachon yangilanmaydi.

> ⚠️ **TARIXIY SNAPSHOT — YANGILANMAYDI.**
> Bu fayl 2026-08-13/14 holatini muzlatib qo'yadi. Keyingi holat o'zgarishlari
> yangi `docs/status/*.md` fayllarida qayd etiladi. Bu yerdagi raqamlar
> vaqt o'tishi bilan eskiradi va **eskirgan holicha qoladi** — bu ataylab.

> ⚠️ **MANBA ANIQLIGI.** Repozitoriyda `2026-08-13` sanali ALOHIDA audit
> artefakti YO'Q (`docs/status/` dagi eng yangi audit — `ci-red-2026-08-12.md`
> va `phase5-observability-audit.md`, ikkalasi 2026-08-12). Shu sababli bu
> snapshot **ikki manbadan** yig'ilgan va har qatorda manba belgisi bor:
> (a) shu sessiyada haqiqatan ishga tushirilgan buyruqlar — `[MEASURED]`,
> (b) repozitoriydagi mavjud audit hujjatlari — `[FROM-AUDIT]`.
> Belgisiz raqam bu hujjatda yo'q.

**Bog'liq hujjatlar:**
[`../ENGINEERING_CONTRACT.md`](../ENGINEERING_CONTRACT.md) (FROZEN) ·
[`../strategy/MASTER_ROADMAP_V3.md`](../strategy/MASTER_ROADMAP_V3.md) ·
[`../strategy/METRICS.md`](../strategy/METRICS.md) ·
[`../ENGINEERING_CONTRACT_ADDENDUM_V3.md`](../ENGINEERING_CONTRACT_ADDENDUM_V3.md)

---

## 1. BASELINE — o'lchangan raqamlar

Har qator uchun aynan qaysi buyruq ishlatilgani ko'rsatilgan. Ishga tushirib
bo'lmagan narsa `NOT VERIFIED` deb belgilangan — taxmin qilinmagan.

| Metrika | Qiymat | Manba | Buyruq / dalil |
|---|---|---|---|
| HEAD commit | `5659a78` | `[MEASURED]` | `git rev-parse HEAD` |
| Working tree | toza (0 o'zgarish) | `[MEASURED]` | `git status --porcelain` (bo'sh) |
| Commit / 30 kun | **105** | `[MEASURED]` | `git log --since="30 days ago" --oneline \| wc -l` |
| API unit testlari | **72 suite / 968 test** (961 pass, 7 skip), exit 0, 700s | `[MEASURED]` | `cd apps/api && npx jest --silent` |
| API lint | **0 error / 8 warning**, exit 0 | `[MEASURED]` | `cd apps/api && npx eslint src` |
| Web typecheck | **exit 0** | `[MEASURED]` | `cd apps/web && npx tsc --noEmit` |
| API typecheck | NOT VERIFIED | — | shu sessiyada alohida ishga tushirilmadi (jest `ts-jest` orqali bilvosita kompilyatsiya qildi) |
| Engine ruff / mypy / pytest | NOT VERIFIED | — | Python muhitini shu sessiyada faollashtirmadim |
| Xabar narxi (flat) | `BILLING_PRICE_PER_MESSAGE_TIYIN` default **50 000 tiyin** (~500 so'm/xabar) | `[MEASURED]` | `billing.service.ts:45` |
| Cron ishlari | **8 ta** (8 faylda) | `[MEASURED]` | `@Cron` grep |
| Taqsimlangan lock ishlatuvchi fayllar | **7** (3 service + 3 spec + `cron-leader.service.ts`) | `[MEASURED]` | `runExclusive` grep |
| `findMany` chaqiruvlari | **113** (50 faylda) | `[MEASURED]` | `findMany` grep |
| `"use client"` fayllari | **90** | `[MEASURED]` | `use client` grep (`apps/web/src`) |
| Web `page.tsx` sahifalari | **30** | `[MEASURED]` | `find apps/web/src/app -name page.tsx` |
| Konnektorlar | **17** | `[MEASURED]` | `ls apps/api/src/connectors/connectors/` |
| pgvector / embedding | **5 ta matn-eslatma, 2 faylda** (`agent_engine.py`, `halal_filter.py`) — **implementatsiya YO'Q** | `[MEASURED]` | `pgvector\|embedding` grep (`apps/`) |
| Prisma modellari | **44** | `[MEASURED]` | `grep -c "^model "` |
| Prisma enum'lari | **15** | `[MEASURED]` | `grep -c "^enum "` |
| `BigInt` ustunlari | **17 ta e'lon** | `[MEASURED]` | `grep -c BigInt` |
| Migratsiyalar | **34** | `[MEASURED]` | `ls apps/api/prisma/migrations \| wc -l` |
| `Message` jadvali | mavjud (`schema.prisma:600`), `tokensIn`/`tokensOut` ustunlari bilan | `[MEASURED]` | schema grep |
| **`tokensIn` yozuvi kodda** | **0 joy** — ustunlar bor, hech qachon to'ldirilmaydi | `[MEASURED]` | `input_tokens\|inputTokens\|tokensIn` grep → faqat `schema.prisma`, `redaction.ts`, `scrub.ts` |
| i18n kalitlari | **860 × 3** (uz/ru/en), parity saqlangan | `[MEASURED]` | regex hisob, `locales/*.ts` |
| `apps/` servislari | `web`, `api`, `agent-engine`, `companion-desktop` — **`browser-worker` YO'Q** | `[MEASURED]` | `ls apps` |
| Engine HTTP route'lari | **40** (`@app.get/post`, `main.py`) | `[MEASURED]` | grep |
| `.env.example` kalitlari | **88** | `[MEASURED]` | grep |
| API modul kataloglari | **33** | `[MEASURED]` | `ls apps/api/src` |
| Deploy topologiyasi | web → Vercel (`fra1`), api → Render `free`, engine → Render `pserv/starter`, DB → Supabase (qo'lda `DATABASE_URL`) | `[MEASURED]` | `render.yaml`, `apps/web/vercel.json` |

---

## 2. Contract fazalari — bajarilish holati

Manba: repozitoriydagi audit hujjatlari `[FROM-AUDIT]` + shu sessiyadagi
struktura o'lchovlari `[MEASURED]`.

| Faza | Contract §3 | Holat | Dalil |
|---|---|---|---|
| P0 Repo Integrity | CI `master`da, `CLAUDE.md` | **BAJARILDI** | `CLAUDE.md` mavjud `[MEASURED]`; `ci-red-2026-08-12.md` `[FROM-AUDIT]` |
| P1 Security Containment | SEC-01…SEC-04, SEC-08…SEC-10 | **BAJARILDI** | `sec11–sec15` audit zanjiri `[FROM-AUDIT]` |
| P2 Authorization Core | RolesGuard, UserRole enum, AdminQueryService | **BAJARILDI** | `admin/admin-query.service.ts`, `UserRole` enum schema'da `[MEASURED]` |
| P3 Data Access Contract | pagination, enum, BigInt, `Message` | **BAJARILDI** | `common/pagination/paginate.ts`, 15 enum, 17 BigInt, `Message` model `[MEASURED]`; `phase3-final-audit.md` `[FROM-AUDIT]` |
| P4 Admin Panel | AdminModule, dangerous, impersonation | **BAJARILDI** | `admin/dangerous/`, `admin/impersonation/`, `(admin)` route guruhi `[MEASURED]`; `sec11/sec12-audit.md` `[FROM-AUDIT]` |
| P5 Observability | Sentry×3, pino, request-id, alertlar | **BAJARILDI (lokal)** — 2 ta tashqi tasdiq bloklangan | `observability/` moduli `[MEASURED]`; `phase5-observability-audit.md` §14 `[FROM-AUDIT]` |
| P6 Runtime Decoupling | Redis, lock, BullMQ, `browser-worker` | **QISMAN** — A/B bajarildi (Redis qatlami, throttler store, cron leader-lock), **C bajarilmadi**: `apps/browser-worker` mavjud emas, BullMQ yo'q | `redis/cron-leader.service.ts` bor, `apps/` da worker yo'q `[MEASURED]`; commit `88b554f`, `aa6a41b` `[MEASURED]` |
| P7 Billing Correctness | token-asosli `hold → reconcile` | **BOSHLANMAGAN** | flat 50 000 tiyin default; `tokensIn` hech qayerda yozilmaydi `[MEASURED]` |
| P8 Performance & Frontend | RSC, bundle, kesh | **BOSHLANMAGAN** | 90 ta `"use client"` `[MEASURED]` |
| P9 DX & Contracts | OpenAPI codegen, `/api/v1` | **BOSHLANMAGAN** | `packages/` da `api-client` yo'q `[MEASURED]` |

---

## 3. Ochiq qarz va nomuvofiqliklar (o'lchangan)

1. **Token metering yo'q, lekin ustunlar bor.** `Message.tokensIn/tokensOut`
   sxemada mavjud, kodda **hech qachon yozilmaydi** `[MEASURED]`. Ya'ni
   bugungi zarar hajmi (flat 500 so'm/xabar vs real LLM xarajati) **umuman
   o'lchanmayapti** — bu V3 dagi P0 metering vazifasining bevosita asosi.
2. **`browser-worker` yo'q** `[MEASURED]`. Chromium hamon API jarayonida
   (`playwright` `apps/api/package.json:37` da). Contract A21/ADR-010 hali
   bajarilmagan.
3. **pgvector deklarativ, implementatsiyasiz** `[MEASURED]`. Xotira
   arxitekturasi (V3 P1/P2) nol holatdan boshlanadi.
4. **README eskirgan** `[MEASURED]`: "Clerk Auth" texnologiya jadvalida
   turibdi (SEC-09 bilan Clerk OLIB TASHLANGAN), `docs/status/` tavsifi
   ham eskirgan. Contract §9 "hujjatlar tozalash" qarzi ochiq.
5. **`docs/status/roadmap.md` (2026-07-03) V3 bilan bir xil hujjat emas.**
   U "wow imkoniyatlar backlog'i" — feature ro'yxati, bosqich rejasi emas.
   V3 uni **almashtirmaydi**, lekin ustuvorlikni
   [`MASTER_ROADMAP_V3.md`](../strategy/MASTER_ROADMAP_V3.md) belgilaydi.
6. **API va web Render'da hamon `plan: free`** `[MEASURED]` (`render.yaml`) —
   spin-down, cron o'tkazib yuborilishi mumkin.
7. **8 ta cron ishi, 7 fayl lock ishlatadi** `[MEASURED]` — nomutanosiblik
   ataylabmi yoki qarzmi, alohida tekshiruv talab qiladi (bu hujjat buni
   hal qilmaydi, faqat qayd etadi).

---

## 4. Bu snapshot NIMA QILMAYDI

- Hech qanday qaror qabul qilmaydi (qarorlar — Contract va V3 hujjatlarida).
- Hech qanday raqamni "yaxshi/yomon" deb baholamaydi.
- Huquqiy xulosa chiqarmaydi.
- Kelajakda yangilanmaydi.
