---
doc: METRICS
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# METRICS — baseline, ta'riflar va calibration protokoli

**Sana:** 2026-08-14 · **Versiya:** 1.0 · **Holat:** ACTIVE
**Bog'liq:** [`MASTER_ROADMAP_V3.md`](MASTER_ROADMAP_V3.md) · [`PRICING_ARCHITECTURE.md`](PRICING_ARCHITECTURE.md) · [`../status/current-state-2026-08-13.md`](../status/current-state-2026-08-13.md)
**Contract:** §12 (Success Metrics) — bu hujjat uni **almashtirmaydi**, biznes
o'lchovlari bilan **to'ldiradi**.

---

## 1. BASELINE — 2026-08-14, commit `5659a78`

Har qator uchun aynan qaysi buyruq ishlatilgani ko'rsatilgan.
`NOT VERIFIED` = ishga tushirilmadi, taxmin qilinmadi.

| Metrika | Qiymat | Manba |
|---|---|---|
| HEAD | `5659a78`, working tree toza | `[MEASURED]` |
| Commit / 30 kun | **105** | `[MEASURED]` |
| API unit testlari | **72 suite / 968 test** (961 pass, 7 skip), exit 0, ~700s | `[MEASURED]` |
| API lint | 0 error / 8 warning, exit 0 | `[MEASURED]` |
| Web typecheck | exit 0 | `[MEASURED]` |
| API typecheck (alohida) | NOT VERIFIED | — |
| Engine ruff/mypy/pytest | NOT VERIFIED | — |
| Xabar narxi | flat **50 000 tiyin** (~500 so'm) | `[MEASURED]` |
| **Token metering** | **YO'Q** — `Message.tokensIn` kodda 0 marta yoziladi | `[MEASURED]` |
| **Gross margin** | **NOMA'LUM** — o'lchash mexanizmi mavjud emas | `[MEASURED]` |
| Cron ishlari | 8 | `[MEASURED]` |
| Taqsimlangan lock fayllari | 7 | `[MEASURED]` |
| `findMany` | 113 (50 fayl) | `[MEASURED]` |
| `"use client"` | 90 fayl | `[MEASURED]` |
| Web sahifalari (`page.tsx`) | 30 | `[MEASURED]` |
| Konnektorlar | 17 | `[MEASURED]` |
| pgvector/embedding | 5 eslatma, implementatsiya yo'q | `[MEASURED]` |
| Prisma model / enum / migratsiya | 44 / 15 / 34 | `[MEASURED]` |
| i18n kalitlari | 860 × 3 (uz/ru/en) | `[MEASURED]` |
| Engine route'lari | 40 | `[MEASURED]` |
| `apps/` servislari | 4 (`browser-worker` YO'Q) | `[MEASURED]` |
| **Faol foydalanuvchi soni** | NOT VERIFIED — jonli DB'ga kirish yo'q | — |
| **To'lovchi mijoz soni** | NOT VERIFIED | — |
| **Time-to-Value** | NOT VERIFIED — o'lchov yo'q | — |
| **Agent success rate** | NOT VERIFIED — eval yo'q | — |

**Baseline xulosasi:** muhandislik metrikalari o'lchanadi, **biznes va
sifat metrikalari umuman o'lchanmaydi**. V3-P0 aynan shu bo'shliqni yopadi.

---

## 2. Metrika ta'riflari

Har metrika uchun: **ta'rif · formula · manba (jadval/log) · qachon yoqiladi**.

### 2.1 Iqtisod

| Metrika | Ta'rif | Formula | Manba | Yoqiladi |
|---|---|---|---|---|
| **Internal cost / execution** | Bitta ijroning bizga real narxi | `Σ(token × model_rate) + infra_ulushi` | `Message.tokensIn/Out` + `ExecutionTrace` | V3-P0 |
| **Gross margin / execution** | Marja | `(user_charge − internal_cost) / user_charge` | `CreditLedger` + internal cost | V3-P0 (o'lchash), V3-P1 (maqsad >40%) |
| **Gross margin (oylik)** | Umumiy marja | `Σ(daromad) − Σ(internal_cost)` / `Σ(daromad)` | `CreditLedger`, `PaymeTransaction`, `ClickTransaction` | V3-P0 |
| **Cost per active user** | Foydalanuvchi boshiga xarajat | `Σ(internal_cost) / MAU` | yuqoridagilar | V3-P1 |
| **Cache hit ratio** | Prompt caching samarasi | `cache_read_tokens / (input_tokens + cache_read_tokens)` | engine `usage` | V3-P1 |

### 2.2 Qiymat va ishonch

| Metrika | Ta'rif | Formula | Manba | Yoqiladi |
|---|---|---|---|---|
| **Time-to-Value (TTV)** | Ro'yxatdan o'tishdan **birinchi muvaffaqiyatli natija**gacha vaqt | `t(first_successful_execution) − t(signup)`, mediana | `User.createdAt` + `ExecutionTrace` (`status=success`) | V3-P1 |
| **Activation rate** | Birinchi muvaffaqiyatli natijaga yetganlar ulushi | `users(first_success) / users(signup)`, 7 kunlik oyna | yuqoridagi | V3-P1 |
| **Agent success rate** | Ijro maqsadga erishgan ulush | `success / (success + failure)` | `ExecutionTrace.status` | V3-P1 |
| **Approval rate** | Insonning tasdiqlash ulushi | `approved / (approved + rejected)` | `ApprovalEvent` | V3-P0 |
| **Override rate** | Inson agent taklifini **tuzatgan** ulush | `modified / total_approvals` | `ApprovalEvent` | V3-P0 |
| **Reliability score (agent)** | Agentning barqarorligi | `success_rate × (1 − variance_penalty)`, formula V3-P2 da qulflanadi | eval + trace | V3-P2 |
| **Mijozga tejalgan so'm (outcome)** | O'lchangan foyda | vertikalga xos formula (retail: `oldingi_yo'qotish − hozirgi_yo'qotish`) | vertikal moduli | V3-P3 |

### 2.3 O'sish

| Metrika | Ta'rif | Formula | Manba | Yoqiladi |
|---|---|---|---|---|
| **Weekly Active Agents (WAA)** | Haftada **kamida 1 marta muvaffaqiyatli ishlagan** agentlar | `count(distinct agentId where success in 7d)` | `ExecutionTrace` | V3-P2 |
| **Free→Paid conversion** | Konversiya | `paid_users / free_users` (30 kunlik kohorta) | `User.platformPlan` | V3-P2 |
| **Retention (oylik logo)** | Saqlanish | `1 − churned/active_start` | obuna jadvallari | V3-P3 |
| **Expansion revenue** | Mavjud mijozdan qo'shimcha daromad | `Σ(upgrade + overage)` | billing | V3-P4 |
| **Referral coefficient** | Har mijozdan kelgan yangi mijoz | `referred_signups / referring_users` | `User.referredById` (`src/referral/` mavjud `[MEASURED]`) | V3-P2 |

### 2.4 Ishonchlilik va operatsiya

| Metrika | Ta'rif | Formula | Manba | Yoqiladi |
|---|---|---|---|---|
| **Incident rate** | Oyiga hodisa soni | `count(incidents)/oy` | Sentry + alertlar (`[FROM-AUDIT]`) | V3-P0 |
| **Cron reliability** | Cron ishlarining muvaffaqiyati | `successful_runs / expected_runs` | cron leader jurnali (`cron-leader.service.ts` `[MEASURED]`) | V3-P0 |
| **Policy violation attempts** | Bloklangan xavfli urinishlar | `count(policy_block)` | policy engine jurnali | V3-P0 |
| **Kill switch activations** | Kill switch ishlatilgan hollar | `count` | policy jurnali | V3-P0 |
| **Connector limit hits** | Konnektor limiti urilishi | `count` per connector | connector jurnali | V3-P0 |

---

## 3. Funnel metrikalari (PRICING §4 ga mos)

| Qadam | Metrika | Yoqiladi |
|---|---|---|
| VISIT → SIGNUP | Signup conversion | V3-P1 |
| SIGNUP → FIRST AGENT | Agent creation rate | V3-P1 |
| FIRST AGENT → FIRST SUCCESS | **Activation rate** ⭐ | V3-P1 |
| FIRST SUCCESS → REPEAT | 7-kunlik qaytish | V3-P2 |
| REPEAT → LIMIT/VALUE EVENT | Limit hit rate | V3-P2 |
| LIMIT → UPGRADE | Upgrade conversion | V3-P2 |
| UPGRADE → PAID SUCCESS | To'lovdan keyingi 30-kunlik faollik | V3-P3 |
| PAID → EXPANSION | Expansion rate | V3-P4 |

---

## 4. EXIT GATE metrikalari — jamlanma

| Gate | Metrika | Maqsad | Manba |
|---|---|---|---|
| G0.1 | Metering qamrovi | ≥95% chaqiruv | `[CALIBRATE]` |
| G0.2 | Gross margin | **mavjud bo'lishi** (qiymat muhim emas) | `[CALIBRATE]` |
| G0.3 | Konnektor limitlari | 17/17 | `[MEASURED]` bazasi |
| G0.5 | HIGH-risk chetlab o'tish | 0 | — |
| G1.1 | Gross margin | >40% | `[FROM-RESEARCH]` R1 |
| G1.2 | Eval to'plami | ≥50 vazifa | `[CALIBRATE]` |
| G2.1 | Agent success rate | ≥70% | `[FROM-RESEARCH]` R7 |
| G2.5 | Time-to-Value | <10 daqiqa | `[FROM-RESEARCH]` R3 |
| G3.1 | To'lovchi pilot | 10–20 | `[CALIBRATE]` |
| G3.4 | Pilot→to'lov konversiya | ≥40% | `[CALIBRATE]` |
| G4.1 | Free→Paid | ≥6% | `[FROM-RESEARCH]` R2 |
| G4.2 | Gross margin | >60% | `[FROM-RESEARCH]` R1 |

---

## 5. `[CALIBRATE]` raqamlar ro'yxati

Bu hujjatlar to'plamida **hali noma'lum** bo'lgan hamma narsa:

| # | Nima | Qachon ma'lum bo'ladi | Qanday ma'lumot asosida |
|---|---|---|---|
| 1 | Real token/chaqiruv taqsimoti (p50/p90/p99) | V3-P0 + 14 kun | metering |
| 2 | Real gross margin (bugungi flat narxda) | V3-P0 + 14 kun | metering |
| 3 | Free/Pro/Max limit raqamlari | V3-P1 | p90 foydalanish |
| 4 | Pro/Max/Business so'mdagi narxi | V3-P1 | marja maqsadidan teskari hisob |
| 5 | Free tier kunlik cost cap | V3-P1 | abuse modellashtirish |
| 6 | Eval to'plami hajmi (≥50 boshlang'ich) | V3-P1 | P0 failure korpusi |
| 7 | Retail outcome formulasi koeffitsiyentlari | V3-P3 | pilot ma'lumoti |
| 8 | Pilot→to'lov konversiya maqsadi | V3-P3 | birinchi 5 pilot |
| 9 | Retention maqsadi | V3-P3 | birinchi kohorta |
| 10 | Demand gate signallari (Agent World, multi-agent, wallet) | V3-P4 | so'rovlar hisobi |
| 11 | 90 kunlik mijoz maqsadi (10–20) | Business trek boshlangach | kanal testi |
| 12 | Oylik infra byudjeti (~$150) | V3-P0 dan keyin | real Render/Vercel/LLM hisob-fakturasi |
| 13 | Outcome pricing ulushi va shifti | V3-P3 | pilot |
| 14 | MCP foydalanish hajmi | V3-P2 | server telemetriyasi |
| 15 | Solo founder chegara signallari (25 mijoz, 4 incident…) | V3-P4 | real yuk |

---

## 6. Calibration protokoli

**Qoida 1.** `[CALIBRATE]` raqam **hech qachon** taxminiy qiymat bilan
almashtirilmaydi. U yo o'lchanadi, yo `[CALIBRATE]` bo'lib qoladi.

**Qoida 2.** Har `[CALIBRATE]` uchun **kim**, **qachon** va **qaysi
ma'lumotdan** to'ldirishi §5 jadvalida yozilgan. Yozilmagan `[CALIBRATE]` —
xato.

**Qoida 3.** Raqam to'ldirilganda:
- belgisi `[CALIBRATE]` → `[MEASURED]` ga o'zgaradi,
- o'lchov sanasi va manbasi (jadval/so'rov) yoziladi,
- eski qiymat o'chirilmaydi — jadvalga "oldingi qiymat" ustuni qo'shiladi.

**Qoida 4.** Marja va narx raqamlari **har chorak** qayta ko'riladi
(provayder narxlari o'zgaradi).

**Qoida 5.** `[FROM-RESEARCH]` raqam **hech qachon** `[MEASURED]` ga
aylanmaydi — u tashqi manba bo'lib qoladi. Bizning o'lchovimiz undan
farq qilsa, **bizning o'lchovimiz ustun**.

---

## 7. Contract §12 bilan munosabat

Contract §12 da 30+ muhandislik KPI'si bor (test coverage, CI, latency,
xavfsizlik, ishonchlilik). **Ular kuchda qoladi va o'zgarmaydi.**

Bu hujjat ularning ustiga **biznes/iqtisod/qiymat** qatlamini qo'shadi.
Ikkalasi bitta panelda ko'rinadi (Contract §6.4 `Ops` moduli + V3 Admin
Control Plane `Economy`/`Data` domenlari).

| Qatlam | Manba | Egasi |
|---|---|---|
| Muhandislik KPI | Contract §12 | Product/Engineering trek |
| Iqtisod / qiymat / o'sish | Bu hujjat | Business trek |
| Xavfsizlik hodisalari | Bu hujjat §2.4 + Contract §12 | Safety trek |
