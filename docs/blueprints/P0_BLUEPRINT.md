---
doc: P0_BLUEPRINT
version: 1.0
status: ACTIVE
created: 2026-08-16
last_verified: 2026-08-16
supersedes: —
superseded_by: —
---

# V3-P0 BLUEPRINT — ijro rejasi (MUZLATILADI)

**Sana:** 2026-08-16 · **Versiya:** 1.0 · **Holat:** ACTIVE
**Bazaviy commit:** `ed06764` (`master`, working tree TOZA)
**Qavat:** [`../process/SPEC_SYSTEM.md`](../process/SPEC_SYSTEM.md) ② — "Bu bosqichni QANDAY quramiz?"

**Ustun hujjatlar (ziddiyatda ular yutadi, shu tartibda):**
1. [`../ENGINEERING_CONTRACT.md`](../ENGINEERING_CONTRACT.md) — **FROZEN**
2. [`../ENGINEERING_CONTRACT_ADDENDUM_V3.md`](../ENGINEERING_CONTRACT_ADDENDUM_V3.md)
3. [`../strategy/MASTER_ROADMAP_V3.md`](../strategy/MASTER_ROADMAP_V3.md)
4. Bu hujjat

**Bog'liq:** [`../strategy/SAFETY_POLICY_LAYER.md`](../strategy/SAFETY_POLICY_LAYER.md) ·
[`../strategy/PRICING_ARCHITECTURE.md`](../strategy/PRICING_ARCHITECTURE.md) ·
[`../strategy/BUILD_VS_BUY.md`](../strategy/BUILD_VS_BUY.md) ·
[`../strategy/METRICS.md`](../strategy/METRICS.md) ·
[`../strategy/KILL_CRITERIA.md`](../strategy/KILL_CRITERIA.md) ·
ADR-010, ADR-023, ADR-026, ADR-029

---

## 0. Bu hujjatni o'qish qoidalari

### 0.1 Manba belgilari

| Belgi | Ma'nosi |
|---|---|
| `[MEASURED 2026-08-16]` | Shu sessiyada, shu repozitoriyda buyruq bilan o'lchandi |
| `[FROM-AUDIT]` | `docs/status/*` yoki `docs/strategy/*` dagi oldingi o'lchov |
| `[FROM-RESEARCH]` | Tashqi manba (MASTER_ROADMAP_V3 §15) |
| `[CALIBRATE]` | Hali noma'lum — P0 instrumentatsiyasidan keyin to'ldiriladi |
| `[BUDGET-BLOCKED]` | Pullik infratuzilma talab qiladi — bugungi byudjet (0) da bajarilmaydi |

**Belgisiz raqam bu hujjatda yo'q.**

### 0.2 Task spec darajalari — SPEC_SYSTEM bilan ATAYLAB farq

| Qism | Daraja | Bo'limlar soni | Manba |
|---|---|---|---|
| Qism A (backend, P0-1…P0-15) | **TIER A** | **16** | Bu blueprint |
| Qism B (UI, UI-1…UI-11) | **TIER B** | **10** + majburiy holatlar jadvali | SPEC_SYSTEM §3 ("UI ekran → TIER B") |

> ⚠️ **Ochiq farq.** [`SPEC_SYSTEM.md`](../process/SPEC_SYSTEM.md) §3 TIER A uchun
> **20** bo'lim sanaydi. Bu blueprint **16** bo'lim ishlatadi — tushib qolganlari:
> `User problem`, `Business value`, `UX/UI talablari`, `Cost ta'siri`.
>
> **Sabab:** birinchi uchtasi V3 strategiya hujjatlarida allaqachon yozilgan
> (takrorlash — SPEC_SYSTEM §10 ogohlantirgan "hujjat fabrikasi"); UX talablari
> Qism B ga ko'chirilgan. **Cost ta'siri esa yo'qolmagan** — u
> `[BUDGET-BLOCKED]` belgisi va §8 jadvalidagi ustun sifatida saqlangan, chunki
> nol byudjet sharoitida xarajat — *scope* qarori, alohida bo'lim emas.
>
> Bu farq **DECISION_LOG.md** ga yozilishi kerak (§9 tekshiruvi).

### 0.3 Bu hujjat NIMA QILMAYDI

- Contract'ni o'zgartirmaydi va yangi arxitektura qarori qabul qilmaydi
  (yangi qaror kerak bo'lsa — ADR yoziladi, blueprint emas).
- Narx e'lon qilmaydi (PRICING_ARCHITECTURE §8 C3 qoidasi).
- Huquqiy xulosa chiqarmaydi.
- Kod yozmaydi. Har task uchun alohida `docs/blueprints/P0/<task>.md` yoziladi
  (SPEC_SYSTEM ③ qavat) — bu hujjat ularning skeleti.

### 0.4 Byudjet doimiysi

**Oylik infratuzilma byudjeti bugun = qo'shimcha $0.** Mavjud sarf o'zgarmaydi
(`render.yaml` `[MEASURED 2026-08-16]`: Postgres `starter`, engine `starter`,
api va web `free`). Har yangi pullik servis `[BUDGET-BLOCKED]` deb belgilanadi
va **founder qaroriga chiqariladi** — jimgina qo'shilmaydi.

### 0.5 Muddat doimiysi

Mukofot taqdimotiga **~1 oy**. Shuning uchun har taskda `Demo-critical?`
ustuni bor va §8 da **ikki yo'l** ajratilgan: *1 oylik mukofot yo'li* va
*to'liq P0 yo'li*. Ular bir xil narsa emas va aralashtirilmaydi.

---

## 1. BASELINE — qayta o'lchandi

**Metodologiya:** har qator uchun aynan bitta buyruq ishga tushirildi.
"Kutilgan" ustuni — 2026-08-14 auditidan (`docs/status/current-state-2026-08-13.md`,
`docs/strategy/METRICS.md` §1). Farq bo'lsa — pastda alohida izohlangan.

| # | Buyruq | Kutilgan `[FROM-AUDIT]` | O'lchangan `[MEASURED 2026-08-16]` | Farq |
|---|---|---|---|---|
| B1 | `grep -rn "findMany" apps/api/src \| wc -l` | ~113 | **115** (50 faylda) | **+2** |
| B2 | `grep -rn "use client" apps/web/src \| wc -l` | ~90 | **90** | 0 |
| B3 | `grep -rn "@Cron" apps/api/src \| wc -l` | 8 | **8 moslik** — lekin **7 dekorator** | ⚠️ **−1** (pastga qarang) |
| B4 | `grep -rln "runExclusive" apps/api/src` | 7 fayl | **7 fayl** | 0 (tarkib boshqa — pastga qarang) |
| B5 | `ls apps/` | `browser-worker` bormi? | **YO'Q** — `agent-engine`, `api`, `companion-desktop`, `web` | 0 |
| B6 | `grep -rn "pgvector\|vector(" apps/api/prisma/schema.prisma` | yo'q | **0 moslik** | 0 |
| B7 | `grep -rn "tokensIn\|tokensOut" apps/api/src \| grep -v spec` | to'ldiriladimi? | **1 moslik** — `observability/redaction.ts:115`, **izoh matni**. Yozuv yo'li **0** | 0 |
| B8 | `grep -rn "idempotenc" apps/api/src -i \| wc -l` | qayerda bor/yo'q | **35 moslik / 8 faylda** — hammasi `billing/` va `agents/` | — |
| B9 | `grep -rn "Queue\|Worker" apps/api/src --include=*.ts \| grep -i bullmq` | — | **0 chaqiruv**. Lekin `bullmq: ^6.1.0` **dependency sifatida bor** (`apps/api/package.json:28`) | ⚠️ |
| B10 | `ls apps/api/prisma/migrations \| grep -v migration_lock \| wc -l` | 34 | **34** | 0 |
| B11 | `ls apps/api/src/connectors/connectors/ \| wc -l` | 17 | **17** | 0 |
| B12 | `grep -rn "rateLimit\|spendCap\|dailyLimit\|@Throttle" apps/api/src/connectors/ \| wc -l` | 0 | **0** | 0 |
| B13 | `find apps/web/src/app -name page.tsx \| wc -l` | 30 | **30** | 0 |
| B14 | `grep -c "^model " apps/api/prisma/schema.prisma` / `^enum ` | 44 / 15 | **44 / 15** | 0 |
| B15 | `git status --porcelain` | toza | **toza**, HEAD = `ed06764` | — |

### 1.1 ⚠️ FARQ B3 — cron soni 8 emas, 7

Oldingi auditlar (`current-state-2026-08-13.md` §1, `METRICS.md` §1) **8 ta cron**
deb yozgan. Qayta o'lchov ko'rsatdi: `grep "@Cron"` 8 moslik beradi, lekin
sakkizinchisi — **hujjat izohi**, dekorator emas:

```
apps/api/src/redis/cron-leader.service.ts:8:
 * MUAMMO: API bir nechta instansda ishlaganda `@Cron` HAR BIR instansda
```

Qat'iy o'lchov (`grep -rn '^\s*@Cron(' apps/api/src --include=*.ts | grep -v spec`)
→ **7 dekorator**:

| # | Fayl:qator | Jadval | Taqsimlangan qulf? |
|---|---|---|---|
| 1 | `admin/impersonation/impersonation-admin.service.ts:225` | har 5 daq | ❌ **YO'Q** |
| 2 | `agents/agent-billing.service.ts:51` | har kuni 09:00 | ✅ `runExclusive` (`:53`) |
| 3 | `billing/platform-billing.service.ts:160` | har kuni 10:00 | ✅ `runExclusive` (`:162`) |
| 4 | `briefing/briefing.service.ts:91` | dush 09:00 | ❌ **YO'Q** |
| 5 | `goals/goals.service.ts:150` | har kuni 07:00 | ❌ **YO'Q** ⚠️ LLM sarflaydi |
| 6 | `observability/alerts/alert-evaluator.service.ts:63` | har 5 daq | ❌ **YO'Q** |
| 7 | `retail/competitor-price.service.ts:131` | har kuni 06:00 | ❌ **YO'Q** |

**Ta'siri:** P0-4 ning qamrovi **6 emas, 5 cron**. Bu — kichik, lekin
`METRICS.md` §1 va `current-state-2026-08-13.md` jadvallari **haqiqatga zid**.
SPEC_SYSTEM §5.3 (oltin qoida) bo'yicha bu farq `DECISION_LOG.md` ga yoziladi.
`current-state-2026-08-13.md` ATAYLAB yangilanmaydi (u muzlatilgan snapshot,
o'z header'ida shunday yozilgan) — tuzatish **shu blueprint** va DECISION_LOG'da
yashaydi.

### 1.2 ⚠️ FARQ B4 — `runExclusive` 7 fayl, lekin 2 real chaqiruv nuqtasi

7 fayl quyidagicha taqsimlanadi:

| Tur | Fayllar |
|---|---|
| Implementatsiya (qulfni **ishlatadi**) | `agents/agent-billing.service.ts`, `billing/platform-billing.service.ts` |
| Qulfning o'zi | `redis/cron-leader.service.ts` |
| Spec (mock) | `agent-billing.service.spec.ts`, `platform-billing.service.spec.ts`, `cron-leader.spec.ts`, **`marketplace/marketplace.service.spec.ts`** |

`marketplace.service.spec.ts:166` `runExclusive` ni **mock qiladi**, lekin
`marketplace.service.ts` uni **chaqirmaydi** — u `AgentBillingService` ni
konstruktor orqali quradi. Ya'ni "7 fayl" raqami qamrovni **oshirib ko'rsatadi**:
haqiqiy qamrov — **2/7 cron**.

### 1.3 ⚠️ FARQ B9 — BullMQ o'rnatilgan, lekin ishlatilmaydi

`bullmq: ^6.1.0` `apps/api/package.json:28` da **bor**, kodda **0 chaqiruv**.
Bu — Konstitutsiya #38 ("o'lik kod / ishlatilmaydigan bog'liqlik") chegarasida
turgan holat. P0-1 uni **yo ishlatadi, yo o'chiradi** — uchinchi variant yo'q.

### 1.4 Tasdiqlangan holat (o'zgarmagan — faqat tasdiq)

| Band | Tasdiq |
|---|---|
| `ConnectorConfig.agentId` mavjud | ✅ `apps/api/prisma/schema.prisma:932` — `agentId String?` + `Agent?` relation, `onDelete: Cascade` |
| Konnektor→agent biriktirish backend'da ishlaydi | ✅ `connectors.service.ts:80` (`agentId?` parametri), `:85` egalik tekshiruvi, `:115` `toolSpecsForAgent`, `:120` `OR: [{agentId: null}, {agentId}]` |
| `_INFO_TOOLS` cheklovi olib tashlangan | ✅ grep bo'yicha `apps/` da moslik yo'q |
| LangGraph haqiqiy tool-calling | ✅ `agent_engine.py:232` `StateGraph`, `:256` `compile()`; testlar: `test_engine.py:448`, `:486` |
| Free tier ishlaydi | ✅ `OPENROUTER_FREE_MODELS` (`.env.example:79`), `USAGE_FREE_CHAT_PER_DAY=10` (`:170`), `OPENROUTER_FREE_DAILY_CAP=45` (`:181`), `USAGE_GLOBAL_LLM_PER_DAY=2000` (`:185`) |
| `{type:"rate_limit"}` SSE | ✅ `apps/web/src/app/api/chat/stream/route.ts:119` → `components/chat/chat-interface.tsx:128` |
| Konnektorda limit yo'q | ✅ B12 — 0 moslik |
| Redis qatlami mavjud | ✅ `apps/api/src/redis/` — `redis.service.ts`, `lock.service.ts`, `cron-leader.service.ts` |
| Redaction qatlami mavjud | ✅ `apps/api/src/observability/redaction.ts` — **278 qator** |

### 1.5 Yangi o'lchangan — oldingi auditda YO'Q edi

Bular P0 rejasiga bevosita ta'sir qiladi:

| # | Fakt | Dalil `[MEASURED 2026-08-16]` |
|---|---|---|
| N1 | **LangGraph grafi checkpointer'SIZ compile qilinadi** | `agent_engine.py:256` — `workflow.compile()`, argumentsiz. `MemorySaver`/`PostgresSaver` grep → 0. Ya'ni **resume, HITL pauza va debug uchun holat yo'q** → P0-8 asosi |
| N2 | **`Agent` modelida kill switch YO'Q** | `schema.prisma:482–559`. Bor: `frozen`/`frozenReason` — bu **billing** muzlatishi (`AgentFrozenReason`), xavfsizlik to'xtatuvi emas. P0-6 yangi maydon talab qiladi |
| N3 | **SEC-07 allowlist yo'q, lekin `context.route()` ILGAGI BOR** | `automation/browser-bridge.ts:118` — hozir faqat SSRF (ichki IP) bloklaydi (`urlBlockedReason`, `:121`, `:144`). Domain allowlist **shu ilgaga qo'shiladi** — yangi mexanizm qurish shart emas |
| N4 | **`mergeStorageStates` filtrsiz** | `browser-bridge.ts:18` — foydalanuvchining **BARCHA** sessiyalarini bitta kontekstga qo'shadi. Bu — SEC-07 ning "faqat allowlist domenlari cookie'si in'ektsiya qilinadi" talabining buzilishi |
| N5 | **Device companion HTTP qatlami TO'LIQ, UI chaqiruvi NOL** | `device-control.controller.ts:281` (`companion/register`), `:310` (`companion/pair`), `:326` (`poll`), `:334` (`result`); `device-companion.service.ts:71` (kod generatsiyasi), `:152` (`pair`). `apps/web/src/app/(dashboard)/device-control/page.tsx` da `pair\|register\|companion` → **0 moslik** |
| N6 | **Konnektorni agentga biriktirish UI'si NOL** | `apps/web/src/app/(dashboard)/connectors/page.tsx` da `agentId` → **0 moslik**; `agents/[agentId]/settings/page.tsx` (84 qator) da `connector` → **0 moslik** |
| N7 | **Web'da og'ir vizual bog'liqliklar** | `apps/web/package.json`: `@react-three/drei:26`, `@react-three/fiber:27`, `framer-motion:32`, `gsap:34`, `lottie-react:35`, `three:44` |
| N8 | **Dizayn tizimi mavjud va dark-only** | `apps/web/src/app/globals.css` — **470 qator**, "LIQUID OBSIDIAN v4"; `--vein-cyan`, `--vein-violet`, `--cta-gold` tokenlari; light rejim ataylab bekor qilingan |
| N9 | **i18n 861 kalit (uz)** | `apps/web/src/lib/i18n/locales/uz.ts` — parity `en`/`ru` bilan qo'lda saqlanadi (CLAUDE.md) |
| N10 | **Redis — Upstash** (tashqi, bepul qatlam) | `.env.example:16` — `rediss://…upstash.io:6379`. ⚠️ BullMQ blocking-pop buyruqlari bepul kvotani yeyishi mumkin — P0-1 xavfi |

---

## 2. KESIB O'TUVCHI BO'LIMLAR

> Bular alohida task **EMAS**. Bular P0 ning har bir taskiga qo'llanadigan
> qoidalar. Har task spec'i bu bo'limlarga havola qiladi va ularni
> **qayta yozmaydi**.

### 2.1 THREAT MODEL

**Qamrov:** agent platformasi. Har band uchun: hujumchi imkoniyati → ta'sir →
yumshatish → **P0 da nimasi yopiladi, nimasi P1 ga qoladi, qoldiq xavf**.

| # | Tahdid | Hujumchi imkoniyati | Ta'sir | P0 yumshatishi | P1+ ga qoladi | **Qoldiq xavf (ochiq)** |
|---|---|---|---|---|---|---|
| T1 | **Prompt injection → brauzer → istalgan domen** | Agent o'qiydigan sahifaga yashirin ko'rsatma joylash | Foydalanuvchi sessiyasi bilan uchinchi saytda amal | **P0-3** (domain allowlist + per-domain storageState), **P0-2** (izolyatsiya) | Kontent-darajasidagi injection detektsiyasi | Allowlist ichidagi domenda injection **ishlaydi**. Allowlist domen sonini kamaytiradi, injection'ni yo'q qilmaydi |
| T2 | **"Lethal trifecta"** — shaxsiy data + ishonchsiz kontent + tashqi kommunikatsiya bitta sessiyada | Agent inbox o'qiydi → injection → SMS/Telegram orqali eksfiltratsiya | Ma'lumot chiqib ketishi | **P0-6** (HIGH tier → inson tasdig'i barcha tashqi-yuboruvchi tool'larda), **P0-3** | Sessiya-darajasidagi "taint tracking" (ishonchsiz kontent tegdimi?) | Tasdiq oynasida foydalanuvchi **ko'r-ko'rona "ha"** bosishi mumkin. P0 buni faqat "aniq nima yuboriladi" ko'rsatish bilan kamaytiradi |
| T3 | **Tool misuse / excessive agency** | Model ruxsatidan ortiq tool zanjiri quradi | Kutilmagan yon ta'sir, xarajat | **P0-6** (risk tier + per-agent kill switch), **P0-10** (verification), ijro budjeti (§2.5) | Tool-zanjiri anomaliya detektsiyasi | Agent LOW tool'larni ko'p marta chaqirib zarar keltirishi mumkin (masalan 500 ta o'qish). P0 buni ijro budjeti bilan cheklaydi, semantik jihatdan emas |
| T4 | **Identity / privilege abuse** — agent boshqa tenant ma'lumotiga kirishi | Tool argumentida boshqa `userId` | Tenant chegarasi buzilishi | **Mavjud** — ESLint `local/require-tenant-scope` + `AdminQueryService` (CLAUDE.md). P0-7 trace'da `tenantId` majburiy | Org-darajasidagi ko'p-tenant modeli | `@admin-scope`/`@system-scope` izohli 115 `findMany` dan qaysi biri noto'g'ri belgilangani **avtomatik tekshirilmaydi** |
| T5 | **Memory / trace poisoning** | Ishonchsiz kontent trace yoki checkpoint'ga tushadi, keyingi ijroga ta'sir qiladi | Zanjirli buzilish | **P0-8** (checkpoint faqat ichki holat, xom tashqi kontent emas), **P0-7** (trace **o'qish uchun**, modelga qayta uzatilmaydi) | pgvector xotira (V3-P1) — poisoning yuzasi asosan **o'sha yerda** ochiladi | P0 da xotira yo'q, shuning uchun yuza kichik. V3-P1 da bu **qayta baholanishi shart** |
| T6 | **Credential exfiltration** — sir model kontekstiga tushishi | Konnektor konfiguratsiyasi promptga qo'shilsa | Token/parol chiqib ketishi | **P0-9** (secret broker: model **hech qachon** xom sirni ko'rmaydi), **P0-7** (redaction trace'da) | Sir-skanerlash (chiqish oqimida) | Xom sir konnektor **HTTP so'rovida** baribir bo'ladi — broker uni modeldan yashiradi, tarmoqdan emas |
| T7 | **Retry orqali dublikat yon ta'sir** | Queue retry qiladi | Ikki marta SMS / ikki marta pul | **§2.2 idempotency** (P0-1 da o'rnatiladi) | — | Kalitsiz tool retry **qilinmaydi** — bu "muvaffaqiyatsizlik" ga aylanadi, dublikatga emas. Bu ataylab |
| T8 | **Free-tier abuse** | Ko'p akkaunt / ko'p so'rov | OpenRouter kvotasi tugaydi | Mavjud (`USAGE_FREE_CHAT_PER_DAY`, `OPENROUTER_FREE_DAILY_CAP`, `User.email/phone @unique`) | Execution/konnektor soni limitlari (V3-P1) | Kvota tugasa **butun free tier** to'xtaydi (hisob darajasidagi limit) — funnel zarari |

**Qoida:** yangi tool yoki konnektor qo'shilganda bu jadval **qayta ko'riladi**.
Jadvalga tegmasdan yangi tashqi-ta'sirli tool qo'shish taqiqlanadi.

### 2.2 IDEMPOTENCY QOIDASI ⚠️ KRITIK

> **Asosiy qoida:** har **yon-ta'sirli** (side-effectful) tool chaqiruvi
> idempotency kaliti bilan yoziladi. **Kalit yo'q bo'lsa — tool retry
> QILINMAYDI**; xato qaytariladi va ijro to'xtaydi.

BullMQ (P0-1) retry qiladi. Retry dublikat harakat yaratmasligi shart.

| Harakat toifasi | Idempotency kaliti | Takror aniqlanganda | Saqlash joyi |
|---|---|---|---|
| **Konnektor invoke** (SMS, Telegram, email, CRM yozuv) | `runId + stepId + toolCallId` | Oldingi natija qaytariladi, **qayta yuborilmaydi** | `ToolCall.idempotencyKey @unique` (P0-7 data model) |
| **To'lov / balans o'zgarishi** | Mavjud `idempotencyKey` (bugun **faqat refund** yo'lida `[MEASURED 2026-08-16]`: `billing.service.ts`, `agent-billing.service.ts`) → **BARCHA pul yo'llariga kengaytiriladi** | Oldingi ledger yozuvi qaytariladi, ikkinchi yechim yo'q | `CreditLedger` / `CreatorLedger` |
| **Brauzer harakati** | `runId + stepIndex` | Qadam o'tkazib yuboriladi, holat trace'dan tiklanadi | `BrowserStep` (P0-2/P0-7) |
| **Fayl yozish** | Kontent `checksum` (SHA-256) | Bir xil checksum → no-op | Fayl metadata |
| **LLM chaqiruvi** | `runId + stepId` | ⚠️ **Kalit yo'q → retry mumkin** (LLM yon-ta'sirsiz), lekin **metering ikki marta yozilmaydi** (P0-5 `UsageEvent` unique) | `UsageEvent.idempotencyKey @unique` |
| **Davlat hujjati topshirish** (soliq, Didox, my.gov.uz) | `runId + stepId + toolCallId` | ❌ **RETRY UMUMAN YO'Q** — `CRITICAL` tier, faqat inson qayta boshlaydi | — |
| **O'qish amallari** | kerak emas | erkin retry | — |

**Implementatsiya invarianti (P0-1 da o'rnatiladi va P0-10 da tekshiriladi):**

```
Har BullMQ job payload'ida majburiy: { runId, stepId, attemptNumber }
Har yon-ta'sirli tool adapter'i majburiy: idempotencyKey(runId, stepId, toolCallId)
Kalitsiz adapter ro'yxatdan o'tmaydi → ilova ishga tushmaydi (fail-fast)
```

Oxirgi qator ataylab qattiq: "keyin qo'shamiz" — aynan shu qoida buziladigan joy.

### 2.3 CANONICAL EVENT SCHEMA

UI, trace, admin panel va analytics **bitta** event modelidan o'qiydi.
Ikkinchi model yozilmaydi (P0-13 ning butun mazmuni shu).

**Hodisa turlari (yopiq ro'yxat — yangisi ADR bilan qo'shiladi):**

```
RUN_STARTED · MODEL_STARTED · MODEL_COMPLETED
TOOL_SELECTED · POLICY_CHECK · APPROVAL_REQUIRED · APPROVAL_GRANTED · APPROVAL_DENIED
TOOL_STARTED · TOOL_RESULT · TOOL_FAILED · RETRY_STARTED
CHECKPOINT_SAVED · RUN_COMPLETED · RUN_FAILED · RUN_CANCELLED
```

**Har hodisaning majburiy konverti:**

| Maydon | Tip | Izoh |
|---|---|---|
| `eventId` | `String @id` | cuid |
| `runId` | `String` | ijro identifikatori |
| `stepId` | `String?` | run-ichi qadam (`RUN_*` da null) |
| `seq` | `Int` | run ichida **monotonik** — `timestamp` teng bo'lib qolishi mumkin, `seq` hech qachon |
| `type` | `ExecutionEventType` (enum) | yuqoridagi ro'yxat |
| `timestamp` | `DateTime` | server vaqti (UTC) |
| `actor` | `EventActor` (enum) | `system` \| `agent` \| `user` \| `admin` |
| `agentId` | `String` | — |
| `tenantId` | `String` | = `userId` (bugungi tenant modeli); `orgId` bo'lsa u ham yoziladi |
| `payload` | `Json` | **redaksiya qilingan** — §2.3.1 |
| `costTiyin` | `BigInt?` | Konstitutsiya #20 — float YO'Q |
| `latencyMs` | `Int?` | — |

#### 2.3.1 Payload redaksiyasi — majburiy

Xom sensitive ma'lumot event'ga **hech qachon** yozilmaydi. Mavjud
`apps/api/src/observability/redaction.ts` (**278 qator** `[MEASURED 2026-08-16]`)
kengaytiriladi — **yangi redaksiya qatlami yozilmaydi**.

| Ma'lumot turi | Event'da nima yoziladi |
|---|---|
| Tool argumentlari | Sxema + **hash** (`sha256`) + qisqartirilgan preview (redaction filtridan o'tgan) |
| Tool natijasi | Metadata (hajm, status, sxema) + redaksiyalangan preview |
| Konnektor siri | **Hech narsa** — faqat `secretRef` (P0-9) |
| Foydalanuvchi xabari | Redaksiyalangan preview (mavjud filtr) |
| Brauzer sahifasi | URL (**query'siz**) + sarlavha; DOM matni **yo'q** |

**Qoida:** event'ga yozishdan oldin `redact()` **majburiy** o'tadi. Bu
xususiyat testda tekshiriladi (P0-13 DoD).

#### 2.3.2 Kim yozadi, kim o'qiydi

```
             ┌──────────────────────┐
  yozuvchi:  │  ExecutionEventBus   │  ← P0-13 (yagona yozuv nuqtasi)
             └──────────┬───────────┘
                        │  (bitta append-only jadval)
      ┌─────────────────┼─────────────────┬──────────────────┐
      ▼                 ▼                 ▼                  ▼
  UI (UI-4)      Trace API (P0-7)   Admin (UI-7/8)    Metrics (P0-5)
```

Hech bir iste'molchi o'z jadvalini yaratmaydi. `AuditLog` (hash-zanjirli,
`schema.prisma:676`) **o'z vazifasida qoladi** — u *kim nima qildi* auditi;
event bus esa *agent qanday ishladi* jurnali. Ular birlashtirilmaydi
(hash-zanjir formatini o'zgartirish — ADR-008 buzilishi).

### 2.4 VERIFICATION POLICY

> "Hammasini tekshir" — yaroqsiz siyosat. Tekshirish **toifaga** qarab ajratiladi.

| Tool toifasi | Kutilgan dalil | Tekshirish usuli | Retry siyosati |
|---|---|---|---|
| `browser.click` / `browser.navigate` | DOM/URL o'zgarishi | Amal oldi/keyin holat farqi (`page.url()`, `title`) + skrinshot havolasi | ✅ Xavfsiz — retry mumkin (`runId+stepIndex` kaliti bilan) |
| `browser.fill` / forma topshirish | Tasdiq elementi yoki URL o'zgarishi | Kutilgan selektor paydo bo'lishi | ⚠️ Faqat idempotency kaliti bilan; topshirish — `HIGH` |
| `telegram.send` / SMS (Eskiz, PlayMobile) | API javobi + **message ID** | ID mavjudligi va bo'sh emasligi | ⚠️ **Kalitsiz retry YO'Q** — dublikat SMS = pul + qonuniy javobgarlik |
| Email (SMTP) | SMTP `250` + message-id | Header tekshiruvi | ⚠️ Kalit bilan |
| To'lov (Payme, Click, Uzum) | **Server tomonidagi tranzaksiya holati** | Provayderdan holat so'rovi (javobga ishonilmaydi) | ⚠️ Faqat idempotency bilan; `CRITICAL` |
| Davlat (soliq, Didox, my.gov.uz) | Topshiruv raqami / hujjat holati | Holat so'rovi | ❌ **Retry YO'Q** — inson qayta boshlaydi |
| CRM/marketplace yozuv | Yaratilgan yozuv ID | ID bilan qayta o'qish | ⚠️ Kalit bilan |
| `file.write` | Mavjudlik + `checksum` | Checksum solishtirish | ✅ Retry mumkin |
| O'qish amallari (inbox, sheet, katalog) | Javob **sxemasi** | Sxema validatsiyasi (zod/pydantic) | ✅ Erkin retry (eksponensial backoff) |

#### 2.4.1 Qaytarib bo'lmaydigan amallar qoidasi

> Irreversible harakat (pul, SMS, hujjat topshirish, o'chirish) **faqat**
> quyidagi ikkalasi bajarilganda ijro etiladi:
> **(a)** idempotency kaliti mavjud va yozilgan,
> **(b)** policy tasdig'idan o'tgan (P0-6) — `HIGH`/`CRITICAL` da inson tasdig'i bilan.
>
> Bittasi yetishmasa — tool **bajarilmaydi**, `TOOL_FAILED` + sabab yoziladi.

Reversibility jadvali: [`SAFETY_POLICY_LAYER.md`](../strategy/SAFETY_POLICY_LAYER.md) §5.
U yerda "undo" yozilmagan amal **`CRITICAL`** sifatida qaraladi — bu qoida
P0-6 da kod bilan majburlanadi (default tier = `HIGH`, reversibility yozilmagan
tool = `CRITICAL`).

#### 2.4.2 Retry mexanikasi

| Parametr | Qiymat |
|---|---|
| Maks urinish (retry mumkin bo'lgan tool) | **3** |
| Backoff | eksponensial, 1s → 4s → 16s, ±20% jitter |
| Retry qilinmaydigan xatolar | `4xx` (429 dan tashqari), policy rad etishi, validatsiya xatosi |
| Har urinish | `RETRY_STARTED` event + `attemptNumber` |
| Maks urinishdan keyin | `TOOL_FAILED` → run `RUN_FAILED` yoki agent qayta rejalashtiradi (P0-10 qarori) |

### 2.5 SLO — har kritik task uchun

Raqamlar `[CALIBRATE]` bo'lishi mumkin, lekin **maydon bo'sh qolmaydi**.

| Task | Tool success rate | p95 latency | Crash'dan keyin recovery | Queue depth chegarasi |
|---|---|---|---|---|
| P0-1 Queue | job muvaffaqiyati ≥ **99%** (infra xatosi bo'yicha) | job olish < **2 s** | Qayta ishga tushgach **0 job yo'qolmaydi** | **> 100** → `warn`, **> 500** → `critical` alert |
| P0-2 Browser worker | brauzer ishi ≥ **60%** (KILL_CRITERIA §2 mezoni) | run boshlanishi < **10 s** | Worker o'lsa job **stalled → qayta olinadi** < 60 s | worker boshiga **2** parallel run (ADR-010 `MAX_CONCURRENT_RUNS=2`) |
| P0-3 Allowlist | — | qo'shimcha latency < **5 ms/so'rov** | — | — |
| P0-4 Cron lock | cron reliability ≥ **99%** | qulf olish < **200 ms** | Qulf TTL tugagach avtomat bo'shaydi | — |
| P0-5 Metering | metering qamrovi ≥ **95%** (G0.1) | yozuv < **50 ms** (asinxron) | Yozuv yiqilsa **LLM javobi buzilmaydi** (fire-and-forget + DLQ) | — |
| P0-6 Policy | policy qarori **100%** tool chaqiruvida | qaror < **20 ms** (DB'siz, keshli) | Fail-**closed**: policy o'qib bo'lmasa tool bloklanadi | — |
| P0-7 Trace | event yo'qotish < **1%** | yozuv < **50 ms** | Yozilmagan event **DLQ** ga | — |
| P0-8 Checkpoint | resume muvaffaqiyati ≥ **95%** | checkpoint yozish < **200 ms** | Run **oxirgi checkpoint'dan** davom etadi | — |
| P0-9 Secret broker | — | sir olish < **50 ms** (keshli) | Broker o'chsa tool **ishlamaydi** (fail-closed) | — |
| P0-12 Device layer | buyruq yetkazish ≥ **95%** | poll → buyruq < **5 s** | Companion qaytsa navbat saqlanadi | qurilma boshiga **20** kutayotgan buyruq |
| **Kill switch** (P0-6) | — | **< 5 s** (SAFETY_POLICY_LAYER §4) | — | — |

### 2.6 GRACEFUL DEGRADATION

Har tashqi bog'liqlik uchun: **o'chsa nima bo'ladi?**

| Bog'liqlik | O'chsa | Foydalanuvchi ko'radigan narsa | Demo-mode? |
|---|---|---|---|
| **LLM — Free tier** (OpenRouter) | Model 429/5xx → ro'yxatdagi keyingi model (5 ta rotatsiya `[MEASURED 2026-08-16]`) → hammasi tugasa **to'xtaydi** | "Bepul rejim hozir band. Ertaga qayta urining yoki Pro'ga o'ting." | ❌ **YO'Q** — demo-javob taqiqlanadi |
| **LLM — Pullik tier** (Anthropic) | Anthropic → (fallback provayder, agar sozlangan bo'lsa) → **aniq xato** | "Model provayderi javob bermayapti. Pul yechilmadi." + refund | ❌ **YO'Q** |
| **Redis** (Upstash) | Free-tier hisoblagichi `UsageCounter` (Postgres) ga tushadi; rate limit **per-instance** bo'ladi; **cron leader-lock ishlamaydi** | Ko'rinmas (degradatsiya jimgina) | — |
| ⚠️ **Redis + P0-1** | Queue **umuman ishlamaydi** → yangi ijro **navbatga tushmaydi** | "Ijro navbati vaqtincha mavjud emas" | ❌ |
| **Konnektor tashqi API** | Timeout (**30 s**) → `TOOL_FAILED` + aniq xato. Agent **qotib qolmaydi** | "Telegram javob bermadi — qayta urinaymi?" | ❌ |
| **Browser worker** | Job **queue'da qoladi** (yo'qolmaydi); worker qaytgach davom etadi. `stalled` timeout 60 s | "Brauzer ishi navbatda" | ❌ |
| **Postgres** | Hech narsa ishlamaydi (yagona haqiqat manbai, A10) | Health endpoint `503` | ❌ |
| **Sentry** | Kod xulqi **o'zgarmaydi** (DSN bo'sh → no-op, `[FROM-AUDIT]`) | Ko'rinmas | — |

> ⚠️ **`Redis o'chsa rate limit per-instance'ga tushadi`** — bu **ochiq qabul
> qilingan degradatsiya**, xato emas. Bugungi holatda API bitta instansda
> ishlaydi (`render.yaml` `free`), shuning uchun ta'siri nol. Ko'p instansga
> o'tilganda bu **qayta ko'riladi**.

### 2.7 FEATURE FLAGS (minimal)

**Qamrov:** faqat xavfli imkoniyatlar. Murakkab A/B tizim — **V3-P1**
(§7 kechiktirilganlar).

| Flag | Nimani boshqaradi | Manba | Default |
|---|---|---|---|
| `FF_BROWSER_AUTOMATION` | Brauzer tool'lari umuman ochiqmi | env | `off` (prod'da P0-3 bajarilgunicha) |
| `FF_HIGH_RISK_ACTIONS` | `HIGH` tier amallar bajarilishi mumkinmi | env | `on` (approval bilan) |
| `FF_DEVICE_CONTROL` | Qurilma boshqaruvi yuzasi | env | `off` |
| `FF_METERING_SHADOW` | P0-5 shadow rejimi | env | `on` |
| `AGENT_ALLOWLIST_USER_IDS` | Xavfli imkoniyat qaysi foydalanuvchilarga ochiq | env (vergul bilan) | bo'sh = hamma |

**Implementatsiya:** env o'zgaruvchi + bitta `FeatureFlagService`. DB jadvali
**hozir qo'shilmaydi** (Konstitutsiya #38 — foydalanish nuqtasi yo'q).

⚠️ **Konstitutsiya #39 (feature-flag umri maks. 2 sprint)** shu flaglarga ham
qo'llanadi. `FF_METERING_SHADOW` — ADR-023 da allaqachon shu chegara ostida
yopilishi yozilgan.

### 2.8 SAFE DEMO PATH ⚠️ MUKOFOT UCHUN KRITIK

> **Maqsad:** taqdimotda hech qachon **real zarar** yetkazilmaydi va
> **kafolatlangan** ssenariy ishlaydi.

| # | Shart | Aniq qiymat |
|---|---|---|
| D1 | **Faqat o'qish ruxsatli konnektorlar** | Demo hisobida faqat `LOW` tier konnektor sozlangan: Google Sheets (o'qish), AfterShip, valyuta/narx. SMS/to'lov/davlat konnektorlari **sozlanmagan** |
| D2 | **Qattiq domain allowlist** | Aynan **3 domen**, oldindan tasdiqlangan va sinovdan o'tgan. `AGENT_DOMAIN_ALLOWLIST` env orqali (P0-3) |
| D3 | **Pul yo'llari o'chirilgan** | Demo foydalanuvchi Free tier'da; `chargeForMessage` free'da no-op `[MEASURED 2026-08-16]`. To'lov konnektorlari yo'q |
| D4 | **Kill switch ko'rsatiladi** | Taqdimotning **bir qismi** — "STOP" bosiladi va agent < 5 s da to'xtaydi (P0-6). Bu — xato emas, **xususiyat namoyishi** |
| D5 | **Oldindan sinovdan o'tgan ssenariy** | Bitta uchdan-uchgacha oqim, **kamida 5 marta ketma-ket** muvaffaqiyatli takrorlangan. Yozma skript bilan |
| D6 | **Zaxira reja — internet/API o'chsa** | (a) Oldindan yozib olingan **ekran-yozuv** (video) tayyor; (b) trace sahifasi **oldingi muvaffaqiyatli ijrodan** ko'rsatiladi (P0-7 ma'lumoti real, jonli chaqiruvsiz). ⚠️ Zaxira **soxta ma'lumot emas** — real, oldin bajarilgan ijro |
| D7 | **Free tier kvotasi** | Taqdimot kunida `OPENROUTER_FREE_DAILY_CAP` **taqdimotdan oldin tekshiriladi**. Demo hisobiga alohida kvota ajratiladi |
| D8 | **Global kill** | Founder telefonida global kill switch (OWNER) ochiq turadi |

**Bog'lanish:** D2 → **P0-3**, D4 → **P0-6**, D6 → **P0-7 + UI-4**,
D5 → **UI-2** (kafolatlangan happy path).

**Qoida:** demo ssenariysida ishlatilmaydigan hech bir imkoniyat taqdimotda
**ochiq qoldirilmaydi** (feature flag bilan yopiladi, §2.7).

### 2.9 MCP CHEGARA SHARTI

**P0 da MCP implement QILINMAYDI** (u V3-P2, ADR-029). Lekin P0 arxitekturasi
MCP qo'shishga to'sqinlik qilmasligi shart.

| # | Shart | Amaliy ma'no | Qaysi task bajaradi |
|---|---|---|---|
| M1 | Tool registri **statik ro'yxatga qattiq bog'lanmasin** | `connectors.registry.ts` naqshi saqlanadi, lekin tool ro'yxati **runtime'da yig'iladi** (`ToolProvider` interfeysi). Dinamik discovery keyin **qo'shiladigan** bo'lsin | P0-6 (tool registri policy bilan birga qayta ko'riladi) |
| M2 | Tool sxemasi **MCP tool sxemasiga o'girilishi mumkin** bo'lsin | Har tool: `name` · `description` · `inputSchema` (JSON Schema) · `riskTier` · `reversible`. Bu — MCP `tools/list` javobining nadmajmuasi | P0-6 |
| M3 | MCP 2026-07-28 reviziyasi **stateless** | Tool ijrosi **sessiya holatiga bog'liq bo'lmasin** — har chaqiruv `runId` bilan mustaqil. Bu P0-1 (queue) va P0-8 (checkpoint) dizayniga ta'sir qiladi: holat **runId ga bog'langan**, ulanishga emas | P0-1, P0-8 |
| M4 | Auth **tool qatlamida**, transport qatlamida emas | Har tool chaqiruvi `User` kontekstini talab qiladi (Konstitutsiya #1/#2) | P0-6, P0-9 |
| M5 | Engine ommaviy emas (Konstitutsiya #5) | MCP server **API qatlamida** turadi — bu P0 da hech narsani o'zgartirmaydi, faqat **buzilmasligi** kerak | — (invariant) |

**Nima QILINMAYDI:** MCP transport, `tools/list`, `tools/call`, SSE server,
MCP auth oqimi — **hech biri P0 da yozilmaydi** (Konstitutsiya #38: o'lik kod).

---

## 3. QISM A — BACKEND VAZIFALARI

**Har task TIER A, 16 bo'lim** (§0.2). Bo'limlar tartibi har taskda **bir xil**:

`1 Purpose · 2 Scope · 3 Non-goals · 4 User flow · 5 Architecture · 6 Data model ·
7 API contract · 8 Security · 9 Permissions · 10 Failure modes · 11 Edge cases ·
12 Observability · 13 Performance · 14 Tests · 15 Rollback · 16 DoD`

**DoD qoidasi:** har band — **buyruq + kutilgan natija** (§6). Nasr taqiqlanadi.

---

### P0-1 — BullMQ queue ishga tushirish

**Bog'liq:** ADR-005 (Temporal/Kafka rad etilgan) · Contract Phase 6-C · §2.2 · §2.5
**Demo-critical:** ❌ (bilvosita — P0-2 ga kerak) · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** Uzoq davom etadigan agent ijrosini HTTP so'rov umridan ajratish
va **idempotent retry** poydevorini o'rnatish.

**2. Scope.** `BullMQ` ni real ishlatish: `ExecutionQueue` (agent run),
`BrowserQueue` (P0-2 uchun tayyor, hozir bo'sh), **in-process worker**
(alohida servis emas), job payload shartnomasi (`runId`, `stepId`,
`attemptNumber`, `tenantId`), retry siyosati (§2.4.2), DLQ, queue depth
metrikasi, graceful shutdown.

**3. Non-goals.** Alohida worker servisi (→ P0-2). Temporal/Kafka (ADR-005 rad
etgan). Job prioritetlash. Cron'ni BullMQ repeatable job'ga ko'chirish
(→ P0-4 boshqa yo'l tanlaydi). Multi-queue orkestratsiya.

**4. User flow.** Foydalanuvchi agentga vazifa beradi → API `RUN_STARTED`
yozadi va job'ni navbatga qo'yadi → darhol `runId` qaytadi → UI SSE orqali
event'larni kuzatadi (P0-13) → worker ijro qiladi.

**5. Architecture.**

```
API (NestJS)                        Redis (Upstash)          Worker (P0-1: SHU JARAYONDA)
  ├─ ExecutionQueue.add(job) ──────▶ bull:execution ────────▶ ExecutionProcessor
  │    { runId, stepId, attempt }                              ├─ IdempotencyGuard (§2.2)
  │                                                            ├─ ExecutionEventBus (P0-13)
  └─ QueueHealthService ◀──────────  depth/stalled            └─ retry / DLQ
```

- ⚠️ **Worker P0-1 da alohida servis EMAS** — `apps/api` ichida
  `WORKER_ENABLED=true` bayrog'i bilan. Sabab: alohida Render servisi
  `[BUDGET-BLOCKED]`. Ajratish — P0-2 (faqat brauzer uchun, u yerda majburiy).
- `bullmq: ^6.1.0` allaqachon o'rnatilgan (`apps/api/package.json:28`
  `[MEASURED 2026-08-16]`) — yangi dependency qo'shilmaydi.
- Redis ulanishi mavjud `RedisService` dan olinadi (yangi client emas).

**6. Data model.** Yangi Prisma modeli **yo'q** (job holati Redis'da).
`ExecutionEvent` (P0-13) — yagona doimiy iz.
Kod-darajasidagi tip: `JobPayload { runId: string; stepId: string; tenantId: string; agentId: string; attemptNumber: number }`.

**7. API contract.** Yangi ommaviy endpoint yo'q. Ichki:

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| `GET` | `/health/queue` | `@Public()` + `InternalTokenGuard` | `{ queues: [{name, waiting, active, failed, delayed}] }`, `200` / `503` (depth > critical) |

**8. Security.** Job payload'da **xom sir yo'q** — faqat `secretRef` (P0-9).
Payload `tenantId` bilan keladi va worker uni **majburiy** ishlatadi (T4).
Redis TLS (`rediss://` `[MEASURED 2026-08-16]`).

**9. Permissions.** Job faqat uni yaratgan `tenantId` doirasida ishlaydi.
Worker `PrismaService` chaqiruvlarida `userId` scope majburiy (ESLint
`local/require-tenant-scope` kuchda).

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Redis o'chdi | Queue ishlamaydi → API `503` + aniq xabar (§2.6). Yangi run qabul qilinmaydi |
| Worker o'ldi | Job `stalled` → 60 s dan keyin qayta olinadi |
| Job 3 marta yiqildi | DLQ (`bull:execution:failed`) + `RUN_FAILED` event + alert |
| Redis kvotasi tugadi (Upstash bepul) | ⚠️ N10 xavfi — `[CALIBRATE]`: blocking-pop chastotasi o'lchanadi; oshsa polling intervalini oshirish |

**11. Edge cases.** Bir xil `runId` ikki marta navbatga qo'yilishi (→ job ID =
`runId`, BullMQ dublikatni rad etadi). Deploy paytida ishlab turgan job
(→ graceful shutdown, `SIGTERM` da yangi job olinmaydi, joriysi tugatiladi,
maks 30 s). Soat siljishi (job kechikishi) — ta'sirsiz, TTL yo'q.

**12. Observability.** Log: `queue.job.started/completed/failed` (pino, `runId`
bilan). Metrika: `queue_depth`, `queue_stalled`, `job_duration_ms`.
Alert: `queue_depth > 500` → `critical` (mavjud `alert-rules.ts` qatoriga
qo'shiladi).

**13. Performance.** Job olish p95 < 2 s. Worker bir vaqtda **5** ijro
(`WORKER_CONCURRENCY=5`, `[CALIBRATE]` — Render free 512 MB RAM chegarasi
bilan). Queue depth chegarasi §2.5.

**14. Tests.** Unit: idempotency guard dublikatni tutadi; payload validatsiyasi
rad etadi (`tenantId` yo'q → throw). Integration: `ioredis-mock` yoki lokal
Redis bilan job → processor → event. Regressiya: `SIGTERM` da job yo'qolmaydi.

**15. Rollback.** `WORKER_ENABLED=false` + `QUEUE_ENABLED=false` → API eski
sinxron yo'lga qaytadi (eski yo'l **P0-1 da o'chirilmaydi**, faqat flag ortiga
olinadi). Migratsiya yo'q → DB rollback kerak emas.

**16. Definition of Done.**

- [ ] `cd apps/api && npx tsc --noEmit -p tsconfig.json` → exit 0
- [ ] `cd apps/api && npx eslint src` → 0 error
- [ ] `cd apps/api && npx jest src/queue` → 0 fail
- [ ] `grep -rn "Queue\|Worker" apps/api/src --include=*.ts | grep -ic bullmq` → **≥ 5** (bugun 0)
- [ ] `curl -H "x-internal-token: $INTERNAL_API_TOKEN" localhost:3001/health/queue` → `200`, JSON'da `execution` navbati bor
- [ ] Bir xil `runId` bilan 2 marta `add()` → `getJobCounts().waiting` = **1**
- [ ] 10 ta job qo'shilib, worker o'chirilib-yoqilgach → **10/10** bajarilgan (0 yo'qolgan)
- [ ] Idempotency: `tenantId` siz payload → `add()` **throw** qiladi (test)
- [ ] `MANUAL:` Upstash panelida 1 soatlik buyruq soni yozib olindi (N10 xavfi uchun `[CALIBRATE]` bazasi)

---

### P0-2 — Browser worker ajratish

**Bog'liq:** ADR-010 (**ACCEPTED, KUCHDA**) · ADR-026 (**PROPOSED — kod yozilmaydi**) · Contract A21 · §2.6
**Demo-critical:** ⚠️ shartli (§8.2) · **[BUDGET-BLOCKED]:** ✅ **HA**

> ⚠️ **Browserbase / Steel.dev ISHLATILMAYDI.** ADR-010 ularni ANIQ RAD ETGAN
> ("foydalanuvchi sessiya cookie'lari uchinchi tomon infratuzilmasiga chiqadi —
> qabul qilinmaydi"). ADR-026 `PROPOSED` va **V3-P2 qarori** — undan oldin
> **hech qanday kod yozilmaydi** (ADR-026 §Decision).

**1. Purpose.** Chromium'ni NestJS API jarayonidan chiqarish — API OOM butun
platformani o'ldirmasin (Contract §9: **High qarz, 75% bug ehtimoli**).

**2. Scope.** Yangi `apps/browser-worker` (BullMQ consumer, `MAX_CONCURRENT_RUNS=2`),
`browser-bridge.ts` mantig'ining **ko'chirilishi** (qayta yozilishi emas),
`BrowserRunner` interfeysi (API tomonda), Docker izolyatsiyasi + network policy,
sessiya holatini **shifrlangan** uzatish, worker health/heartbeat.

**3. Non-goals.** Managed vendor (ADR-010/026). Headful `LoginCapture`
(Contract A22 — rad etilgan). Brauzer imkoniyatlarini kengaytirish (yangi amal
turlari). Ko'p-worker parki / autoscaling. **Domain allowlist** → P0-3
(alohida task, chunki u P0-2 dan **oldin** ham bajarilishi mumkin).

**4. User flow.** O'zgarmaydi — foydalanuvchi uchun ko'rinmas. Farq: brauzer
ishi boshlanishi ~2 s kechikadi (queue), lekin API javob bermay qolishi
**to'xtaydi**.

**5. Architecture.**

```
apps/api                                 apps/browser-worker (YANGI)
  BrowserRunner (interfeys)                 BrowserQueue consumer
    └─ QueueBrowserRunner ──▶ bull:browser ──▶ PlaywrightRunner
                                                 ├─ chromium (izolyatsiya)
                                                 ├─ DomainAllowlist (P0-3)
                                                 └─ event → ExecutionEventBus (HTTP, InternalToken)
```

- `playwright` `apps/api/package.json:37` dan **olib tashlanadi**
  (`apps/browser-worker` ga ko'chadi) — bu taskning eng ko'rinadigan dalili.
- Docker: `--cap-drop=ALL`, `--read-only` root fs, `/tmp` tmpfs, chiquvchi
  tarmoq **allowlist ortida** (P0-3 ilovasi).
- `mergeStorageStates` (`browser-bridge.ts:18`) worker'ga ko'chadi va **P0-3
  filtri bilan** ishlatiladi.

**6. Data model.** Yangi model yo'q. Mavjud `BrowserSession` (`schema.prisma`)
o'zgarmaydi. Ijro izi — `ExecutionEvent` (P0-13).

**7. API contract.** Worker **ommaviy endpoint ochmaydi**. Ichki:

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| `GET` | `/health` (worker) | ichki tarmoq | `{status, activeRuns, chromiumVersion}` |
| `POST` | `/internal/events` (API'da) | `InternalTokenGuard` | worker → API event uzatishi |

**8. Security.**
- Sessiya holati (`storageState`) worker'ga **shifrlangan** yetkaziladi
  (mavjud `CryptoService`, AES-256-GCM naqshi) va **diskka yozilmaydi**.
- Worker `INTERNAL_API_TOKEN` bilan API ga murojaat qiladi (mavjud naqsh,
  `render.yaml` `envVarGroups`).
- Worker **Postgres'ga to'g'ridan-to'g'ri kirmaydi** — faqat API orqali
  (blast radius, Konstitutsiya #5 ruhi).
- Chromium sandbox **o'chirilmaydi** (`--no-sandbox` taqiqlanadi).

**9. Permissions.** Worker'ning API ga kirishi `InternalTokenGuard` bilan.
Foydalanuvchi ma'lumoti job payload'idagi `tenantId` bilan cheklanadi.

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Worker o'ldi (OOM) | Job `stalled` → qayta olinadi. **API ta'sirlanmaydi** — bu taskning butun maqsadi |
| Chromium ishga tushmadi | Aniq xato (mavjud matn `browser-bridge.ts:98`), `TOOL_FAILED` |
| Worker deploy paytida o'chdi | Job navbatda qoladi (§2.6) |
| `storageState` deshifrlanmadi | Run **boshlanmaydi**, `RUN_FAILED` + alert (sir buzilgan bo'lishi mumkin) |

**11. Edge cases.** Bitta foydalanuvchining 3-chi parallel brauzer ishi
(→ `MAX_CONCURRENT_RUNS=2` sababli navbatda kutadi). Chromium versiyasi
API va worker'da farq qilishi (→ worker yagona manba, API'da Playwright yo'q).
Uzoq davom etgan run (> 5 daq) → majburiy timeout + `RUN_FAILED`.

**12. Observability.** Log: `browser.run.started/completed`, `chromium.launch.failed`.
Metrika: `browser_active_runs`, `browser_run_duration_ms`, `worker_heartbeat_age_s`.
Alert: heartbeat > 120 s → `critical`.

**13. Performance.** Run boshlanishi p95 < 10 s. Worker RAM chegarasi
`[CALIBRATE]` — Chromium bitta konteksti ~150–300 MB, `MAX_CONCURRENT_RUNS=2`
bilan **≥ 1 GB** instans kerak → bu aynan `[BUDGET-BLOCKED]` sababi.

**14. Tests.** Unit: `QueueBrowserRunner` job qo'yadi va `runId` qaytaradi.
Integration: worker job olib, `navigate` bajaradi (lokal test sahifasi).
Regressiya: `apps/api` da `playwright` import **qolmagan** (grep testi).

**15. Rollback.** `BROWSER_RUNNER=inprocess` env → API eski `browser-bridge.ts`
yo'liga qaytadi. ⚠️ Shu sababli `browser-bridge.ts` **P0-2 da o'chirilmaydi** —
u 1 sprint saqlanadi (Konstitutsiya #39 chegarasida), keyin o'chiriladi.

**16. Definition of Done.**

- [ ] `ls apps/` → `browser-worker` **bor** (bugun yo'q)
- [ ] `grep -c "playwright" apps/api/package.json` → **0** (bugun 1, `:37`)
- [ ] `grep -rn "playwright" apps/api/src | wc -l` → **0** (bugun 1 fayl: `automation/browser-bridge.ts`)
- [ ] `cd apps/browser-worker && npx tsc --noEmit` → exit 0
- [ ] `cd apps/browser-worker && npx jest` → 0 fail
- [ ] `docker run` bilan worker ko'tarilib, `GET /health` → `200` + `chromiumVersion` bo'sh emas
- [ ] Test run: API `navigate` job qo'yadi → worker bajaradi → `TOOL_RESULT` event API'da ko'rinadi
- [ ] Worker `kill -9` qilinganda API `GET /health` → hamon `200` (izolyatsiya isboti)
- [ ] `MANUAL:` `[BUDGET-BLOCKED]` — founder pullik instans qaroriga imzo qo'ydi (yoki task kechiktirildi)

---

### P0-3 — SEC-07 domain allowlist

**Bog'liq:** Contract SEC-07 (**yagona yopilmagan Critical**) · SAFETY_POLICY_LAYER §7 · §2.1 T1/T2
**Demo-critical:** ✅ **HA** (§2.8 D2) · **[BUDGET-BLOCKED]:** ❌

> ⚠️ **Bu task P0-2 ni KUTMAYDI.** `browser-bridge.ts:118` da `context.route()`
> ilgagi **allaqachon bor** (`[MEASURED 2026-08-16]`, N3) — allowlist shu yerga
> qo'shiladi va P0-2 da worker'ga **ko'chadi**. Ketma-ketlikni teskari qilish
> eng muhim xavfsizlik bandini kechiktiradi.

**1. Purpose.** Prompt injection bilan agentni boshqa domenga olib ketish
imkonini yopish (T1) va foydalanuvchi cookie'larining noto'g'ri domenga
in'ektsiyasini to'xtatish (N4).

**2. Scope.** (a) Har run boshida ruxsat etilgan domenlar ro'yxati (**maks 5**);
(b) `context.route()` da allowlist tekshiruvi (navigatsiya + hujjat so'rovlari);
(c) **`mergeStorageStates` filtrlash** — faqat allowlist domenlarining cookie'lari;
(d) blok hodisasi `DeviceActionLog` ga `status: 'blocked'` + `ExecutionEvent`
`POLICY_CHECK`; (e) allowlist manbai: agent konfiguratsiyasi + global env.

**3. Non-goals.** Kontent-darajasidagi injection detektsiyasi. Subresurs
(rasm/CSS/JS) filtrlash — mavjud izoh (`browser-bridge.ts:115`) buni ataylab
tashlab ketgan, o'zgarmaydi. Foydalanuvchiga allowlist tahrirlash UI'si
(→ V3-P2). Wildcard/regex qoidalari (faqat aniq host + subdomain).

**4. User flow.** Agent yaratilganda/tahrirlanganda ruxsat etilgan domenlar
belgilanadi (P0 da: env + agent `toolsConfig`). Agent boshqa domenga urinsa →
amal bloklanadi → foydalanuvchi trace'da **"Bloklandi: example.com ruxsat
etilmagan"** ko'radi (UI-4).

**5. Architecture.**

```
DomainAllowlistService
  ├─ resolve(agentId, runId) → string[]   (maks 5; env ∪ agent config)
  ├─ isAllowed(url) → boolean             (host aniq mos yoki *.host subdomain)
  └─ filterStorageState(state, domains)   ← N4 tuzatishi

browser-bridge/PlaywrightRunner:
  open()  → mergeStorageStates(...) → filterStorageState(...)
  route() → urlBlockedReason(url) (SSRF, mavjud) ∪ !isAllowed(url) → abort
```

Fail-**closed**: allowlist bo'sh yoki o'qib bo'lmasa → **hech qayerga
navigatsiya yo'q** (nol domen), xato aniq.

**6. Data model.**

| Joy | O'zgarish |
|---|---|
| `DeviceActionLog` (mavjud, `schema.prisma:836`) | `status: 'blocked'` qiymati ishlatiladi — **sxema o'zgarmaydi** |
| env | `AGENT_DOMAIN_ALLOWLIST` (global, vergul bilan), `AGENT_DOMAIN_ALLOWLIST_ENFORCE` |
| ~~`Agent.toolsConfig`~~ | ⚠️ **TUZATILDI — pastga qarang** |

⚠️ **Migratsiya yo'q** — bu ataylab: SEC-07 ni tezroq yopish uchun sxema
o'zgarishi to'sqinlik qilmasin.

> ### ⚠️ TUZATISH (2026-08-17, implementatsiya paytida aniqlandi)
>
> Bu bo'lim dastlab shunday deb yozgan edi:
> *"`Agent.toolsConfig` (`Json?`, mavjud) → `{ browser: { allowedDomains: string[] } }`"*.
> **Bu noto'g'ri.** Ikki fakt `[MEASURED 2026-08-17]`:
>
> 1. `Agent.toolsConfig` — **obyekt emas, MASSIV**:
>    `schema.prisma:490` izohi *"JSON array of ToolSpec: `[{ tool_id, config }]`"*,
>    DTO esa `CreateAgentDto.toolsConfig?: ToolSpecDto[]`
>    (`agents/dto/create-agent.dto.ts`). Ya'ni `toolsConfig.browser` yo'li
>    **mavjud emas**.
> 2. Brauzer-avtomatlashtirish yo'li **agentga umuman bog'lanmagan**:
>    `AutomationService.run(user, goal, startUrl, language)` da `agentId`
>    **yo'q** — u foydalanuvchi darajasidagi oqim.
>
> **Natijada P0-3 da bajarilgani:** allowlist manbai — **faqat deploy env**
> (`AGENT_DOMAIN_ALLOWLIST`). Bu §2.8 D2 (safe demo path) uchun yetarli va
> Contract SEC-07 AC ni to'liq qoplaydi.
>
> **Bajarilmagani:** agent-darajasidagi allowlist va uning validatsiyasi
> ("6 domen → `400`"). `resolveAllowlist({ env, agent })` interfeys darajasida
> **tayyor** — agent-scoped brauzer oqimi paydo bo'lganda bir qator bilan
> ulanadi. U vaqtda qaror kerak: `toolsConfig` massiviga `tool_id: "browser"`
> yozuvi sifatida joylashtirish (migratsiyasiz) **yoki** `Agent` ga alohida
> ustun (migratsiya bilan). Bu — ADR emas, task spec qarori.

**7. API contract.** Yangi ommaviy endpoint yo'q va **P0-3 da qo'shilmadi**.

⚠️ Dastlab bu yerda *"mavjud agent yangilash endpoint'i
`toolsConfig.browser.allowedDomains` ni qabul qiladi"* deb yozilgan edi —
yuqoridagi tuzatish sababli **bekor**. Agent-darajasidagi allowlist
qo'shilganda validatsiya (massiv, ≤ 5 element, har biri to'g'ri host,
aks holda `400`) o'sha taskda keladi.

**8. Security.** Bu — taskning butun mazmuni. Qo'shimcha:
- Redirect zanjiri **har qadamda** tekshiriladi (`isNavigationRequest()` allaqachon
  redirect'ni qamraydi — `browser-bridge.ts:113` izohi).
- `filterStorageState` **bo'sh natija bersa ham** run davom etadi (login'siz),
  bloklanmaydi — foydalanuvchi buni trace'da ko'radi.
- Allowlist **agent egasidan** keladi, modeldan **emas** — model allowlist'ni
  o'zgartira olmaydi (bu injection'ning eng aniq chetlab o'tish yo'li).

**9. Permissions.** `allowedDomains` ni faqat agent egasi (`userId`) yoki
`OWNER`/`ADMIN` o'zgartiradi. Global env — faqat deploy.

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Allowlist bo'sh | **Hech qayerga navigatsiya yo'q** (fail-closed), aniq xato |
| 5 dan ortiq domen sozlandi | Yaratishda `400`; mavjud yozuvda — birinchi 5 tasi + `warn` log |
| Allowlist ichidagi domen redirect qiladi tashqariga | Redirect **bloklanadi** (route ilgagi) |
| `storageState` filtridan keyin bo'sh | Run davom etadi, login'siz; trace'da qayd |

**11. Edge cases.** `about:blank`, `data:` URL (→ ruxsat, navigatsiya emas).
IDN/punycode domenlar (→ normalizatsiya qilinadi, aks holda `xn--` bilan
chetlab o'tish mumkin). Port bilan host (`example.com:8443` → host solishtiriladi,
port emas). `localhost`/ichki IP → mavjud SSRF filtri (`urlBlockedReason`)
**ustun** va allowlist uni **bekor qilmaydi**.

**12. Observability.** Log: `browser.domain.blocked` (`{runId, agentId, url_host}`
— **to'liq URL yo'q**, §2.3.1). Metrika: `policy_violation_attempts` (METRICS §2.4).
Alert: bir run'da > 5 blok → `warn` (injection belgisi).

**13. Performance.** Qo'shimcha latency < 5 ms/so'rov (allowlist `Set` da,
run boshida bir marta yechiladi).

**14. Tests.**
- Unit: `isAllowed` — aniq mos, subdomain, punycode, port, katta-kichik harf.
- Unit: `filterStorageState` — 3 domenli holatdan 1 tasi qoladi.
- Integration: ruxsatsiz domenga `navigate` → `ERROR` + `DeviceActionLog.status='blocked'`.
- **Regressiya (SEC-07 DoD):** ruxsatsiz domenga **muvaffaqiyatli** navigatsiya = **0**.
- Redirect testi: allowlist domenidan tashqariga 302 → bloklanadi.

**15. Rollback.** `AGENT_DOMAIN_ALLOWLIST_ENFORCE=false` → domen tekshiruvi
va sessiya filtri butunlay o'tkazib yuboriladi. ⚠️ Bu flag **prod'da `true`**
bo'lib qoladi; o'chirish faqat lokal debug uchun va 1 sprintdan ortiq
yashamaydi (#39).

⚠️ **Tuzatish (2026-08-17):** dastlab bu yerda *"faqat log yoziladi,
bloklanmaydi (shadow rejim)"* deb yozilgan edi. Implementatsiyada
`enforceDomainAllowlist: false` **tekshiruvni umuman bajarmaydi** (log ham
yo'q) — sabab: bo'sh allowlist (`domains: []`, fail-closed = "hech narsaga
ruxsat yo'q") va majburlashning o'chirilishi ("tekshirma") **ikki xil holat**;
ularni bitta bayroqqa siqish birinchisini ikkinchisiga aylantirib yuborardi.

**16. Definition of Done** — *holat: 2026-08-17 implementatsiyasidan keyin*

- [x] `cd apps/api && npx jest src/automation` → **0 fail** (80 test / 3 suite)
- [x] `cd apps/api && npx eslint src` → **0 error** (8 warning — baseline bilan bir xil)
- [x] `cd apps/api && npx tsc --noEmit -p tsconfig.json` → **exit 0**
- [x] Test: allowlist `["example.com"]`, `navigate("https://evil.com")` → natija `ERROR:` bilan boshlanadi, `page.url()` **o'zgarmagan**
- [x] Test: `DeviceActionLog` yozuvi `status='blocked'`, `action='sec07.domain_blocked.<manba>'` (`automation.service.spec.ts`)
- [x] Test: `filterStorageState` — 5 cookie'dan allowlist'ga mos **3** tasi qoladi; Gmail va suffiks-hujum cookie'lari **olib tashlanadi**
- [x] Test: allowlist bo'sh → `navigate` **har qanday** URL uchun `ERROR` (fail-closed)
- [x] Test: `https://example.com` → `302` → `https://evil.com` → **bloklandi** (`route()` ilgagi, `abort('blockedbyclient')`)
- [x] Test: SSRF filtri SEC-07 dan **oldin** ishlaydi va allowlist uni **bekor qilmaydi**
- [x] Test: blok hodisasida to'liq URL yo'q — query'dagi sir hodisaga tushmaydi
- [x] `grep -rn "allowedDomains" apps/api/src | wc -l` → **25** (talab: ≥ 3)
- [ ] ~~Test: 6 domen bilan agent yaratish → `400`~~ — ⚠️ **BAJARILMADI**, sabab §6 tuzatishida (agent-darajasidagi allowlist ulanmagan)
- [x] `MANUAL:` Contract SEC-07 AC to'rt bandi: (1) run boshida ro'yxat, maks 5 ✅ · (2) `route()` boshqa domenni bloklaydi ✅ · (3) faqat shu domenlar cookie'si in'ektsiya qilinadi ✅ · (4) blok `DeviceActionLog`ga `status: blocked` ✅

**Qolgan qarz:** agent-darajasidagi allowlist (§6 tuzatishiga qarang) —
alohida task sifatida V3-P0 ichida qoladi, chunki u brauzer oqimini agentga
bog'lashni talab qiladi.
- [ ] `MANUAL:` Contract SEC-07 AC ning 4 bandi (ro'yxat / route blok / cookie filtr / `blocked` log) qatorma-qator belgilandi

---

### P0-4 — Qolgan cron'larga taqsimlangan lock

**Bog'liq:** Konstitutsiya #50 · Contract A24 · V3-P0 gate **G0.7**
**Demo-critical:** ❌ · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** API ko'p instansda ishlaganda cron'ning **ikki marta**
bajarilishini to'xtatish (bugun 5/7 cron himoyasiz — §1.1).

**2. Scope.** `impersonation-admin.service.ts:225`, `briefing.service.ts:91`,
`goals.service.ts:150`, `alert-evaluator.service.ts:63`,
`competitor-price.service.ts:131` → `cronLeader.runExclusive(...)` ga
o'raladi. Har biri uchun **TTL** ijro davomiyligiga qarab belgilanadi.
Regressiya testi (G0.7): 2 "instans" bir vaqtda ishga tushsa — **1 ijro**.

**3. Non-goals.** Cron'ni BullMQ repeatable job'ga ko'chirish. Cron
jadvallarini o'zgartirish. `marketplace.service.ts` ga qulf qo'shish (u cron
emas — §1.2). Cron natijalarini saqlash jadvali.

**4. User flow.** Ko'rinmas. Bilvosita: foydalanuvchi **ikki marta brifing**
yoki **ikki marta bildirishnoma** olmaydi.

**5. Architecture.** Mavjud naqsh **aynan** takrorlanadi
(`agent-billing.service.ts:51–54`):

```ts
@Cron(...)
async X() { return this.cronLeader.runExclusive('<modul>.<metod>', () => this.XInner(), TTL); }
```

Ichki mantiq `XInner()` ga ko'chiriladi — **mantiq o'zgarmaydi**, faqat o'ram
qo'shiladi. Bu — TIER C ga yaqin mexanik ish, lekin **pul/bildirishnoma
yo'llariga tegadi**, shuning uchun TIER A.

**6. Data model.** O'zgarish yo'q. Qulf — Redis'da (`cron-leader.service.ts`).

**7. API contract.** O'zgarish yo'q.

**8. Security.** Qulf nomi **statik** (foydalanuvchi kiritmaydi) — injection
yuzasi yo'q. Qulf o'g'irlanishi mumkin emas (Redis ichki).

**9. Permissions.** O'zgarish yo'q — cron'lar `@system-scope`.

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Redis o'chdi | ⚠️ `runExclusive` xulqi **aniq belgilanishi shart**: pul yo'lida **ijro etilmaydi** (fail-closed), pulsiz yo'lda (brifing, alert) **ijro etiladi** (fail-open). Bu qaror har cron uchun jadvalda yoziladi |
| Ijro TTL dan uzun cho'zildi | Qulf avtomat uzaytiriladi (mavjud xulq, `agent-billing.service.ts:49` izohi) |
| Ikkinchi instans qulfni ololmadi | Jimgina o'tkazib yuboradi + `debug` log |

**Fail-open / fail-closed jadvali (majburiy):**

| Cron | Redis yo'q bo'lsa | Sabab |
|---|---|---|
| `impersonation.expireDueSessions` | **fail-open** (ijro etiladi) | Sessiya muddatini uzaytirmaslik — xavfsizroq |
| `briefing.sendWeeklyBriefings` | **fail-closed** | Dublikat xabar yuboriladi (tashqi ta'sir) |
| `goals.advanceAllActive` | **fail-closed** | ⚠️ LLM sarflaydi — dublikat = ikki barobar xarajat |
| `alert-evaluator.runScheduled` | **fail-open** | Dublikat alert — zararsiz, alert yo'qligi zararli |
| `competitor-price.dailyCheckAll` | **fail-closed** | Tashqi sayt so'rovlari (rate limit) |

**11. Edge cases.** Deploy paytida ikkala instans ham yangi kod bilan
ko'tarilishi (→ qulf baribir bitta). Qulf TTL tugagach ikkinchi instans
boshlab yuborishi (→ TTL ijro davomiyligidan **≥ 3×** katta olinadi).

**12. Observability.** Log: `cron.lock.acquired/skipped/expired`.
Metrika: `cron_reliability` (METRICS §2.4 — `successful_runs / expected_runs`).
Alert: cron **kutilgan vaqtda ishlamadi** → `warn` (bugun yo'q, qo'shiladi).

**13. Performance.** Qulf olish < 200 ms. Cron ijro vaqtiga ta'sir ~0.

**14. Tests.** Har cron uchun: `runExclusive` **chaqirilishi** (mock bilan) —
5 ta test. Integration (G0.7): ikki `CronLeaderService` bir Redis'da →
`Inner` **1 marta** chaqiriladi. Fail-open/closed xulqi testi (Redis xatosi
simulyatsiyasi) — 5 ta test.

**15. Rollback.** O'ram olib tashlanadi (bitta qator har faylda). Xavfsiz —
eski xulq = bugungi xulq.

**16. Definition of Done.**

- [ ] `grep -rn '^\s*@Cron(' apps/api/src --include=*.ts | grep -v spec | wc -l` → **7**
- [ ] Har 7 cron faylida `runExclusive` bor: `for f in $(grep -rl '^\s*@Cron(' apps/api/src --include=*.ts | grep -v spec); do grep -L runExclusive $f; done` → **bo'sh chiqish**
- [ ] `cd apps/api && npx jest src/redis src/briefing src/goals src/retail src/admin src/observability` → 0 fail
- [ ] G0.7 regressiya testi mavjud va o'tadi: ikki leader → `Inner` **1 marta**
- [ ] Fail-open/closed: Redis xatosi simulyatsiyasida `goals` **ishlamaydi**, `alert-evaluator` **ishlaydi** (2 test)
- [ ] `cd apps/api && npx eslint src` → 0 error

---

### P0-5 — Universal usage metering

**Bog'liq:** ADR-023 (**ACCEPTED**) · PRICING_ARCHITECTURE §2.1 (U1–U10) · Gate **G0.1, G0.2**
**Demo-critical:** ⚠️ bilvosita (UI-8) · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** Platforma har chaqiruvda qancha yo'qotayotganini **raqam bilan**
bilsin (bugun: **umuman noma'lum** — `tokensIn` kodda 0 marta yoziladi,
B7 `[MEASURED 2026-08-16]`).

**2. Scope.** (a) Engine har javobda `usage {input_tokens, output_tokens,
cache_read_tokens, model}` qaytaradi; (b) API `Message.tokensIn/tokensOut` ni
**haqiqatan to'ldiradi**; (c) yangi `UsageEvent` — U1–U10 o'lchamlari;
(d) internal cost hisoblagichi (model × token → tiyin), **foydalanuvchiga
ko'rsatilmaydi**; (e) **shadow rejim** — hech kimning balansiga ta'sir qilmaydi;
(f) free-tier metering'ni pullik yo'lga umumlashtirish.

**3. Non-goals.** Narx o'zgarishi (PRICING §8 C3: **C3 dan oldin bironta narx
e'lon qilinmaydi**). `hold → reconcile` (→ V3-P1). Foydalanuvchiga narx
ko'rsatish (→ V3-P1 G1.6). Besh tier migratsiyasi (→ V3-P1). Prompt caching
yoqish (→ V3-P1 P1.7) — lekin `cache_read_tokens` **bugundan o'lchanadi**.

**4. User flow.** Ko'rinmas (shadow). Admin (UI-8) `Economy` domenida real
xarajat va marjani ko'radi.

**5. Architecture.**

```
agent-engine (streaming.py, llm_utils.py, openrouter_client.py)
   └─ javobga `usage` qo'shadi ──▶ apps/api
                                     ├─ MeteringService.record(...)   (asinxron)
                                     │    ├─ UsageEvent (yangi jadval)
                                     │    ├─ Message.tokensIn/Out yangilash
                                     │    └─ InternalCostCalculator → costTiyin
                                     └─ ExecutionEventBus: MODEL_COMPLETED (cost bilan)
```

**Qat'iy ajratish (ADR-023 §4):** `InternalCostCalculator` (bizga qancha turadi)
va `PricingEngine` (foydalanuvchidan qancha olinadi) **hech qachon bitta kod
yo'lida** hisoblanmaydi. P0 da `PricingEngine` **yo'q** — faqat mavjud flat
narx (`BILLING_PRICE_PER_MESSAGE_TIYIN`) o'z joyida qoladi.

**6. Data model.** ⚠️ **Migratsiya kerak.**

```prisma
model UsageEvent {
  id             String   @id @default(cuid())
  idempotencyKey String   @unique         // runId+stepId — §2.2
  userId         String
  agentId        String?
  runId          String?
  conversationId String?
  kind           UsageKind                 // enum
  model          String?
  inputTokens    Int      @default(0)      // U1
  outputTokens   Int      @default(0)      // U2
  cacheReadTokens Int     @default(0)      // U10
  toolCalls      Int      @default(0)      // U4
  browserMs      Int      @default(0)      // U5
  visionOps      Int      @default(0)      // U6
  connectorCalls Int      @default(0)      // U7
  executionMs    Int      @default(0)      // U8
  storageBytes   BigInt   @default(0)      // U9
  internalCostTiyin BigInt @default(0)     // Konstitutsiya #20 — BigInt
  createdAt      DateTime @default(now())
  @@index([userId, createdAt])
  @@index([agentId, createdAt])
  @@index([runId])
}

enum UsageKind { LLM TOOL BROWSER VISION CONNECTOR STORAGE }
```

`Message.tokensIn/tokensOut` — **mavjud ustunlar**, migratsiya kerak emas,
faqat yozish yo'li qo'shiladi.

⚠️ **Migratsiya eslatmasi (repo qarzi):** generatsiya qilingan migratsiyadan
fantom `AuditLogHashBackup DROP` qatori **olib tashlanadi**; yangi enum
qiymatlari `ADD VALUE IF NOT EXISTS` bilan yoziladi.

**7. API contract.**

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| `GET` | `/usage/summary?from&to` | `AuthGuard` (o'z ma'lumoti) | `{ tokensIn, tokensOut, executions, internalCostTiyin? }` — ⚠️ `internalCostTiyin` **faqat admin uchun** |
| `GET` | `/admin/economy/margin?from&to` | `@Roles(OWNER, ADMIN)` | `{ revenueTiyin, internalCostTiyin, marginPct }` |

Engine javob shakli (o'zgaradi — **barcha chaqiruv nuqtalari yangilanadi**):
`{ ..., usage: { input_tokens: int, output_tokens: int, cache_read_tokens: int, model: str } }`

**8. Security.** `internalCostTiyin` — **ichki ma'lumot**, oddiy foydalanuvchiga
**hech qachon** qaytarilmaydi (marja raqami tijorat siri). Metering yozuvi
promptni saqlamaydi — faqat token **soni**.

**9. Permissions.** `/usage/summary` — o'z `userId`. `/admin/economy/*` —
`@Roles(OWNER, ADMIN)` + `twoFactorEnabled` (SEC-11, avtomatik).
`UsageEvent` o'qishlari tenant-scoped (`userId`); admin yig'masi
`@admin-scope` izohi bilan.

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Engine `usage` qaytarmadi (eski versiya) | `UsageEvent` **yoziladi**, tokenlar `0` + `metering_missing` flag → G0.1 qamrovi tushadi, alert |
| Metering yozuvi yiqildi | ⚠️ **LLM javobi buzilmaydi** — fire-and-forget + DLQ. Foydalanuvchi ta'sirlanmaydi |
| Model narxi jadvalida yo'q | `internalCostTiyin = 0` + `unknown_model` alerti (jim 0 emas — **alert**) |
| Dublikat yozuv (retry) | `idempotencyKey @unique` → no-op |

**11. Edge cases.** Streaming javob uzilib qolishi (→ qisman `usage`, `partial`
flag). OpenRouter modeli rotatsiyada o'zgarishi (→ **haqiqatda ishlatilgan**
model yoziladi, so'ralgani emas). Tool call'lar LLM chaqiruvidan ko'p bo'lishi
(→ alohida `UsageEvent` `kind=TOOL`). Free tier (`chargeForMessage` no-op) —
metering **baribir yoziladi** (bu taskning butun mazmuni).

**12. Observability.** Log: `metering.recorded`, `metering.missing`,
`metering.unknown_model`. Metrika: `metering_coverage_pct` (G0.1 ning bevosita
o'lchovi), `internal_cost_tiyin_total`, `cache_hit_ratio`.
Alert: `metering_coverage_pct < 95` → `warn`.

**13. Performance.** Yozuv asinxron, < 50 ms. `UsageEvent` yozish hajmi:
har chaqiruvga 1–3 qator. Contract §8 `Message` partitioning'ni allaqachon
ko'zda tutgan — `UsageEvent` uchun ham **shu yo'l** (P0 da partitioning
qilinmaydi, lekin indekslar unga tayyor).

**14. Tests.**
- Unit: `InternalCostCalculator` — Anthropic va OpenRouter modellari, cache
  chegirmasi bilan; `BigInt` tiyin, **float yo'q**.
- Unit: idempotency — bir xil kalit 2 marta → 1 yozuv.
- Integration: 10 ta chat chaqiruvi → `UsageEvent` count = **10**, har birida
  `inputTokens > 0`.
- Integration: `Message.tokensIn` `NULL` **emas**.
- Regressiya: shadow rejim — `CreditLedger` yozuvlari soni **o'zgarmaydi**.
- Engine (pytest): `usage` maydoni javobda mavjud.

**15. Rollback.** `FF_METERING_SHADOW=false` → yozuv to'xtaydi (o'qish yo'llari
bo'sh qaytaradi). Migratsiya **qaytarilmaydi** (jadval qoladi, zararsiz).
Engine javob shakli **qo'shimcha** maydon — eski API uni e'tiborsiz qoldiradi
(orqaga moslik).

> ### ⚠️ TUZATISH — `Message.tokensIn/tokensOut` SXEMADA YO'Q EDI
>
> §1 B7, ADR-023 va METRICS §1 uchalasi ham *"`Message` jadvalida
> `tokensIn`/`tokensOut` ustunlari MAVJUD (`schema.prisma:600`), lekin
> kodda hech qayerda yozilmaydi"* deydi. **Bu noto'g'ri** — ustunlar
> umuman yo'q, va bu **ataylab** qilingan (`schema.prisma:694` izohi):
>
> > *"Contract A12 ro'yxatidagi `tokensIn/tokensOut` ATAYLAB YO'Q: token
> > ma'lumoti bugun hech qayerda mavjud emas… Bo'sh ustun qo'shish =
> > o'lik sxema; Phase 7 ularni o'z migratsiyasi bilan qo'shadi."*
>
> **Qaror:** ular BARIBIR qo'shilmadi. Sabab — o'sha izohning mantig'i
> davomi: endi ma'lumot bor, lekin uni `UsageEvent` **va** `Message` da
> saqlash **ikkita haqiqat manbai** yaratardi. `UsageEvent` da
> `conversationId` bor, ya'ni suhbat bo'yicha token yig'indisi shundan
> olinadi. DoD'ning `Message.tokensIn IS NULL → 0` bandi shu sababdan
> bekor.

**16. Definition of Done** — *holat: 2026-08-17 implementatsiyasidan keyin*

- [x] `cd apps/api && npx prisma validate` → **valid**; `migrate status` → **38 migratsiya, up to date**
- [x] `cd apps/api && npx tsc --noEmit` → **exit 0**; `npx eslint src` → **0 error**
- [x] `cd apps/api && npx jest src` → **87 suite / 1224 test, 0 fail** (0 regressiya)
- [x] `cd apps/api && npx jest src/metering` → **18/18**
- [x] `cd apps/agent-engine && pytest -q` → **89/89**; `ruff check .` → toza
- [x] **Engine `usage` qaytaradi:** Anthropic (`final.usage`) va OpenRouter
  (`data.usage`) — ikkalasi ham. Oqim oxirida BITTA `{type:"usage"}` hodisasi
- [x] **⚠️ Tool-loop aylanishlari QO'SHILADI**, almashtirilmaydi — faqat
  oxirgisini olish real sarfni quyi baholardi (jonli tekshiruv: 2 aylanish →
  1234+1234 = **2468** token)
- [x] `UsageEvent.idempotencyKey` **unique**; dublikat (retry) ikkinchi marta yozilmaydi
- [x] **Fail-open:** DB yiqilsa `recordLlm` throw **qilmaydi** — LLM javobi buzilmaydi
- [x] **⚠️ Noma'lum model → `costUnknown: true`**, jim 0 EMAS (aks holda marja
  soxta yaxshi ko'rinardi); marja javobida `costUnknownCalls` ochiq sanaladi
- [x] **Bepul tier ham o'lchanadi** (G0.1 qamrovi) — `:free` modellarda
  marjinal xarajat 0, lekin HAJM yoziladi
- [x] `cache-read` token input'dan **arzon** hisoblanadi (`[FROM-RESEARCH]` R4)
- [x] **G0.2:** `GET /admin/economy/margin` — marja hisoblanadi; daromad nol
  bo'lsa `marginPct: null` (soxta raqam emas)
- [x] **`GET /usage/summary` `internalCostTiyin` QAYTARMAYDI** (test bilan) —
  marja tijorat siri
- [x] `@Roles(OWNER, ADMIN)` admin yo'lida → SEC-11 avtomatik 2FA talab qiladi
- [ ] ~~`SELECT ... FROM "Message" WHERE "tokensIn" IS NULL`~~ — ⚠️ **BEKOR**,
  yuqoridagi tuzatishga qarang
- [ ] `MANUAL:` 10 ta jonli chaqiruvdan keyin `UsageEvent` count = 10 —
  kirish sessiyasi talab qiladi

**⚠️ Qolgan qarz:** o'lchov **chat oqimidan** keladi (`execution-trace-tap`).
`AutomationService` (brauzer) va konnektor chaqiruvlari hali `UsageEvent`
yozmaydi — U5 (browser second), U7 (connector call) o'lchamlari bo'sh.
G0.1 qamrovi shu sababdan LLM yo'li bilan cheklangan.

---

### P0-6 — Policy engine + kill switch

**Bog'liq:** SAFETY_POLICY_LAYER §2/§3/§4 · Contract §7 SEC-07 ruhi · ADR-031 · Gate **G0.3, G0.4, G0.5**
**Demo-critical:** ✅ **HA** (§2.8 D4) · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** Agent qaytarib bo'lmaydigan amalni **inson tasdig'isiz**
bajarmasin, va har agent **< 5 s** ichida to'xtatilishi mumkin bo'lsin.

**2. Scope.**
(a) **8 o'lchovli qaror kirishi** (pastda);
(b) risk tier `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` (P0 da **`LOW`/`HIGH`
   majburlanadi**, `MEDIUM`/`CRITICAL` **e'lon qilinadi va yoziladi** —
   SAFETY_POLICY_LAYER §2.2);
(c) **har agentda kill switch** + global kill (OWNER);
(d) 17 konnektorga `rateLimit` + `dailySpendCap` + `riskTier` + `killable` +
   `reversible` (bugun **0/17** `[MEASURED 2026-08-16]`);
(e) fail-closed: policy o'qib bo'lmasa tool **bloklanadi**.

**3. Non-goals.** CASL/OPA (Contract A8/ADR-002 rad etgan). RBAC o'zgarishi
(bu — **risk tier**, rol emas). Approval **UI** (→ UI-4/V3-P2; P0 da minimal
tasdiq oynasi). Tierni foydalanuvchi tomonidan pasaytirish (SAFETY §2.1.3 —
ADR talab qiladi). Org-darajasidagi approval oqimi (→ V3-P4).

**4. User flow.**

```
Agent tool tanlaydi
   ▼ POLICY_CHECK  (8 o'lchov)
LOW  ──▶ avtomatik bajariladi, log
HIGH ──▶ APPROVAL_REQUIRED ──▶ foydalanuvchi ko'radi: AYNAN nima yuboriladi
                                 ├─ tasdiqlash  → APPROVAL_GRANTED → bajariladi
                                 ├─ rad etish   → APPROVAL_DENIED  → to'xtaydi
                                 └─ tuzatish    → APPROVAL_GRANTED (modified) ⭐
Har vaqt: STOP tugmasi ──▶ kill switch ──▶ < 5 s da to'xtaydi
```

**5. Architecture — qaror kirishlari (8 o'lchov, majburiy).**

| # | O'lcham | Misol | Nega |
|---|---|---|---|
| 1 | **actor** | `user` \| `agent` \| `admin` \| `system` | Kim boshladi |
| 2 | **agent** | `agentId`, vertikal, egasi | Agent konfiguratsiyasi tierga ta'sir qiladi |
| 3 | **tool** | `telegram.send` | Bazaviy tier manbai |
| 4 | **target** | `@customer_group` (500 a'zo) vs `@self` | ⚠️ **Yagona eng muhim o'lcham** |
| 5 | **data** | shaxsiy ma'lumot bormi, tashqi/ishonchsiz manbadan kelganmi | "Lethal trifecta" (T2) |
| 6 | **action** | `read` \| `write` \| `send` \| `delete` \| `pay` | — |
| 7 | **context** | run tarixida ishonchsiz kontent bo'lganmi, nechanchi qadam, jami xarajat | Injection zanjiri |
| 8 | **scope/hajm** | 1 ta qabul qiluvchi vs 500 ta | Blast radius |

> **Kirish jadvalining amaliy isboti:** `gmail.read` va
> `gmail.send(10 ta tashqi manzil)` **bir xil risk EMAS** — birinchisi
> o'lchov 6 `read` + o'lcham 8 = 0; ikkinchisi `send` + 10 tashqi qabul
> qiluvchi + o'lcham 5 (shaxsiy ma'lumot). Faqat `tool` nomiga qarab tier
> belgilash — bu farqni **ko'rmaydi**, shuning uchun taqiqlanadi.

```
PolicyEngine.evaluate(input: PolicyInput) → PolicyDecision
  PolicyDecision = { tier, allow, requiresApproval, reasons[], appliedRules[] }
```

Qoidalar **kodda** (deklarativ jadval), DB'da emas — P0 da o'zgaruvchan
qoida tahriri kerak emas (Konstitutsiya #38).

**6. Data model.** ⚠️ **Migratsiya kerak.**

```prisma
// Agent kill switch — `frozen` (billing) dan ATAYLAB ALOHIDA
model Agent {
  // ... mavjud maydonlar
  killedAt     DateTime?
  killedById   String?
  killReason   String?
}

model ApprovalEvent {                 // SAFETY_POLICY_LAYER §8 — MOAT
  id             String   @id @default(cuid())
  runId          String
  stepId         String
  actionId       String
  agentId        String
  userId         String
  riskTier       RiskTier
  proposedAction Json                  // redaksiyalangan (§2.3.1)
  decision       ApprovalDecision      // APPROVED | REJECTED | MODIFIED
  modifiedAction Json?                 // ⭐ ENG QIMMATLI MAYDON
  latencyMs      Int
  reason         String?
  createdAt      DateTime @default(now())
  @@index([userId, createdAt])
  @@index([agentId, createdAt])
}

enum RiskTier          { LOW MEDIUM HIGH CRITICAL }
enum ApprovalDecision  { APPROVED REJECTED MODIFIED }
```

> ⚠️ `decision` **`boolean` emas**. "Rad etdi" va "tuzatib tasdiqladi" —
> butunlay boshqa signal; ularni bitta `boolean` ga siqish **moatni yo'q qiladi**
> (SAFETY_POLICY_LAYER §8).

Konnektor limitlari: `connector.types.ts` da **kod-darajasidagi**
konfiguratsiya (`rateLimit`, `dailySpendCap`, `riskTier`, `killable`,
`reversible`) — 17/17 to'ldiriladi. Ishlatilgan hajm — Redis hisoblagichi
(mavjud throttler naqshi).

**7. API contract.**

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| `POST` | `/agents/:id/kill` | egasi yoki `@Roles(OWNER, ADMIN)` | `204`; faol ijrolar to'xtaydi |
| `POST` | `/agents/:id/resume` | ayni | `204`; ⚠️ **avtomatik tiklanish yo'q** |
| `POST` | `/admin/kill-switch/global` | `@Roles(OWNER)` + dual confirmation | `204` |
| `POST` | `/approvals/:id/decide` | approval egasi | `{ decision, modifiedAction? }` → `204` |
| `GET` | `/approvals?status=pending` | o'z ma'lumoti | ro'yxat |

**8. Security.**
- **Fail-closed:** policy xizmati javob bermasa → tool **bajarilmaydi**.
- Tier **model tomonidan o'zgartirilmaydi** — model faqat tool **taklif qiladi**.
- Kill switch **avtomatik o'chmaydi** (SAFETY §4) — qo'lda yoqiladi.
- Global kill — `@Roles(OWNER)` + Contract §6.5 xavfli-amal oqimi
  (⚠️ CLAUDE.md: §6.5 oqimi **hali yozilmagan**; global kill uni **talab
  qiladi** → §7 ga qarang).
- Har kill/approval `AuditLog` ga (ADR-008).

**9. Permissions.** Agent kill — egasi (`userId`) yoki `OWNER`/`ADMIN`.
Global kill — faqat `OWNER` (+ `twoFactorEnabled`, SEC-11 avtomatik).
`ApprovalEvent` o'qish — tenant-scoped.

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Policy engine yiqildi | Tool **bloklanadi** (fail-closed), `POLICY_CHECK` xato bilan |
| Foydalanuvchi tasdiqlashga javob bermadi | Timeout **15 daq** `[CALIBRATE]` → `RUN_CANCELLED`, resurs bo'shatiladi |
| Kill switch bosildi, ijro tugab bo'lgan | No-op, `204` (idempotent) |
| Konnektor limiti urildi | `TOOL_FAILED` + aniq xabar; **boshqa konnektor bloklanmaydi** (blast radius, SAFETY §6) |
| Redis yo'q (limit hisoblagichi) | Limit **fail-closed** `HIGH`+ konnektorlarda, fail-open `LOW` da |

**11. Edge cases.** Agent kill qilingan paytda queue'da 5 job (→ hammasi
`RUN_CANCELLED`). Kill vaqtida yarim bajarilgan yon-ta'sirli amal (→ amal
**tugatiladi**, keyingi qadam boshlanmaydi — yarim SMS yubormaslik uchun).
Tier belgilanmagan yangi tool (→ **default `HIGH`**, SAFETY §2.1.1).
`reversible` yozilmagan tool (→ **`CRITICAL`**, §2.4.1).

**12. Observability.** Log: `policy.decision`, `policy.blocked`, `killswitch.activated`.
Metrika: `policy_violation_attempts`, `kill_switch_activations`,
`approval_rate`, `override_rate` (= `modified/total` — METRICS §2.2),
`connector_limit_hits` (per connector).
Alert: bir agentda 1 soatda > 10 `policy_blocked` → `warn`.

**13. Performance.** Qaror < 20 ms (qoidalar xotirada, DB'siz).
Kill switch **< 5 s** (SAFETY §4) — queue'dagi job'lar bekor qilinadi +
faol worker `AbortSignal` oladi.

**14. Tests.**
- Unit: 8 o'lchovli matritsa — kamida **12 kombinatsiya**, jumladan
  `gmail.read` (LOW) vs `gmail.send`×10 (HIGH) farqi.
- Unit: tier belgilanmagan tool → `HIGH`; `reversible` yo'q → `CRITICAL`.
- Unit: fail-closed — policy xatosi → `allow: false`.
- Integration (**G0.5**): `HIGH` amal tasdiqsiz → **0 ta chetlab o'tish**.
- Integration (**G0.4**): kill switch E2E — 100% agentda ishlaydi, < 5 s.
- Integration (**G0.3**): 17/17 konnektorda `rateLimit` **va** `dailySpendCap`
  sozlangan (registry bo'ylab tekshiruvchi test).
- `ApprovalEvent.modifiedAction` `MODIFIED` holatida **saqlanadi**.

**15. Rollback.** `FF_HIGH_RISK_ACTIONS=off` → barcha `HIGH`+ amallar
**bloklanadi** (xavfsiz tomon). Policy engine'ni butunlay o'chirish
**mumkin emas** — bu fail-open bo'lardi. Migratsiya qaytarilmaydi
(`killedAt` nullable, zararsiz).

**16. Definition of Done** — *holat: 2026-08-17 implementatsiyasidan keyin*

- [x] `cd apps/api && npx prisma validate` → **valid**; `migrate status` → **36 migratsiya, DB sinxron**
- [x] `cd apps/api && npx tsc --noEmit` → **exit 0**
- [x] `cd apps/api && npx eslint src` → **0 error** (8 warning — baseline)
- [x] `cd apps/api && npx jest src/policy src/events src/connectors src/agents src/app.module.spec.ts`
  → **13 suite / 147 test, 0 fail** (0 regressiya)
- [x] **`npx jest src/policy` → 44/44** (policy-engine 23 · high-risk-bypass 7 · kill-switch 14)
- [x] Test: **12 policy kombinatsiyasi** → kutilgan tier (jadval bilan)
- [x] **⚠️ G0.3:** `node scripts/check-connector-limits.mjs` → **`17/17 OK`, exit 0**
- [x] **⚠️ G0.5:** `npx jest src/policy/high-risk-bypass.spec` → **0 fail**.
  SMS · to'lov · davlat hujjati · to'xtatilgan agent — hammasida konnektorning
  `execute()` metodi **chaqirilmaydi** (spy bilan tasdiqlangan); LOW amal esa
  o'tadi. **Chetlab o'tish yuzasi ham qulflandi:** butun `src/` bo'ylab
  `def.execute(...)` faqat `connectors.service.ts` da — boshqa fayl chaqirsa test yiqiladi
- [x] **G0.4:** `npx jest src/policy/kill-switch.spec` → **0 fail**. Qamrov, faol
  ijrolarning bekor qilinishi (+ har biriga `RUN_CANCELLED` izi), OWNER/ADMIN
  huquqi, begona foydalanuvchi → **404**, idempotentlik, audit, qo'lda tiklash
- [x] Global kill: ADMIN chaqira olmaydi · noto'g'ri tasdiqlash iborasi ishlamaydi ·
  sabab < 20 belgi bo'lsa ishlamaydi (§6.5 ruhi)
- [x] `ApprovalEvent`: `MODIFIED` uchun `modifiedAction` **majburiy** (servis `400` tashlaydi) —
  ya'ni `decision='MODIFIED' AND modifiedAction IS NULL` holati **yozilishi mumkin emas**
- [x] `POST /agents/:id/kill` begona agentda → **404** (403 emas: mavjudlik fakti ham ma'lumot)
- [x] `grep -rn "riskTier" apps/api/src/connectors | wc -l` → **≥ 17**

**⚠️ Blueprint misolidan chetlashish:** DoD `gmail.read` vs `gmail.send`×10
misolini talab qilgan, lekin **`gmail` registrda YO'Q** (17 konnektor
ro'yxatida u yo'q). Tamoyil o'zgarmadi, misol haqiqiy konnektorlarga
ko'chirildi: `google-sheets.read_range` → **LOW** vs
`telegram-bot.send_message` (10 tashqi qabul qiluvchi) → **CRITICAL**, va
alohida test ikkalasi **bir xil emasligini** qulflaydi.

> ### ✅ "TASDIQLAB DAVOM ETISH" — YOPILDI (2026-08-17)
>
> Dastlab bu yerda ochiq cheklov turgan edi: policy `HIGH`+ amalni bloklardi
> va `ApprovalEvent` yozardi, lekin tasdiqdan keyin amal **bajarilmasdi** —
> tasdiq tugmasi amalda hech narsa qilmasdi.
>
> **Yopildi**, va LangGraph checkpoint'siz: to'liq graf holatini tiklash
> shart emas edi — kerak bo'lgani **tasdiqlangan amalni bajarish**.
> `ApprovalService.decide()` endi `APPROVED`/`MODIFIED` da
> `ConnectorsService.invokeApproved()` ni chaqiradi va trace zanjirini
> yozadi (`APPROVAL_GRANTED` → `TOOL_STARTED` → `TOOL_RESULT`/`TOOL_FAILED`).
>
> **⚠️ IMTIYOZ OSHIRISH YUZASI YOPILGAN:** tahrirlashda foydalanuvchi
> **faqat parametrlarni** o'zgartira oladi — `connector` va `action`
> QULFLANGAN (`approved-action.ts`). Aks holda tasdiq oynasida ko'rilgan
> `google-sheets.read` ni `payme.create_invoice` ga almashtirib yuborish
> mumkin bo'lardi, ya'ni policy qarori BOSHQA amalga ko'chirilardi.
>
> **Kill switch tasdiqdan USTUN:** `invokeApproved` amalni bajarishdan
> oldin `Agent.killedAt` ni tekshiradi — tasdiq berilgandan keyin agent
> to'xtatilgan bo'lsa amal BAJARILMAYDI (SAFETY §4).
>
> Qolgan (kichikroq) qarz: chat oqimi grafdan o'tmagani uchun **agentning
> o'z ijro halqasi** tasdiqdan keyin davom etmaydi — tasdiqlangan amal
> bajariladi va natijasi trace'da ko'rinadi, lekin model keyingi qadamni
> avtomatik qo'ymaydi. Bu — streaming yo'lini grafga ko'chirish taski
> (alohida, o'z blueprint bandini talab qiladi).

---

### P0-7 — Execution trace + human approval logging

**Bog'liq:** ADR-023 §6 · ADR-008 (audit) · SAFETY_POLICY_LAYER §8 · Gate **G0.6** · §2.3
**Demo-critical:** ✅ **HA** (§2.8 D6, UI-4) · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** Har agent ijrosining to'liq, o'qiladigan izini saqlash — bu
bir vaqtda **billing manbai**, **eval korpusi** (ADR-028) va **trust UI**
poydevori. Human approval — **eng nodir moat** (§2 M3): bugun yig'ilmasa
hech qachon olinmaydi.

**2. Scope.** §2.3 event sxemasi asosida to'liq iz:
`run → step → model call → tool call → input hash → output metadata →
policy decision → approval → evidence → retry → cost → latency → outcome`.
Trace o'qish API. **Redaksiya majburiy** — mavjud `redaction.ts` (278 qator)
kengaytiriladi.

**3. Non-goals.** Trace **UI** (→ UI-4). Eval harness (→ V3-P1, ADR-028).
`AuditLog` bilan birlashtirish (**taqiqlanadi** — hash-zanjir formati
o'zgarmaydi, ADR-008). Trace eksporti (→ V3-P4). Uzoq muddatli arxiv
(→ P0-15 retention).

**4. User flow.** Foydalanuvchi ijro tugagach "Agent nima qildi?" ni ochadi →
qadamlar ro'yxati: qaysi tool, nima kirdi (redaksiyalangan), nima chiqdi,
qancha turdi, qancha vaqt oldi, tasdiq bo'ldimi.

**5. Architecture.** Yagona yozuv nuqtasi — `ExecutionEventBus` (P0-13).
P0-7 uning **doimiy qatlami** va **o'qish API'si**:

```
ExecutionEventBus (P0-13)  ──▶  ExecutionEvent (append-only jadval)
                                       │
                    ┌──────────────────┼───────────────────┐
                    ▼                  ▼                   ▼
             TraceReadService    ApprovalEvent (P0-6)   MeteringService (P0-5)
```

**Append-only:** event **hech qachon** yangilanmaydi/o'chirilmaydi. Yakuniy
holat — `RUN_COMPLETED`/`RUN_FAILED` event'i, `UPDATE` emas.

**6. Data model.** ⚠️ **Migratsiya kerak.**

```prisma
model ExecutionRun {
  id          String   @id @default(cuid())
  userId      String
  agentId     String
  conversationId String?
  status      RunStatus            // RUNNING | COMPLETED | FAILED | CANCELLED
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  totalCostTiyin BigInt @default(0)
  stepCount   Int      @default(0)
  @@index([userId, startedAt])
  @@index([agentId, startedAt])
}

model ExecutionEvent {              // §2.3 konverti
  id         String   @id @default(cuid())
  runId      String
  run        ExecutionRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  stepId     String?
  seq        Int                    // run ichida monotonik
  type       ExecutionEventType
  actor      EventActor
  agentId    String
  tenantId   String
  payload    Json                   // REDAKSIYALANGAN — §2.3.1
  costTiyin  BigInt?
  latencyMs  Int?
  createdAt  DateTime @default(now())
  @@unique([runId, seq])
  @@index([runId, seq])
  @@index([tenantId, createdAt])
}
```

`onDelete: Cascade` — Konstitutsiya #30. `@@unique([runId, seq])` — dublikat
event (retry) yozilmaydi.

**7. API contract.**

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| `GET` | `/runs?cursor&limit` | `AuthGuard`, o'z ma'lumoti | Kursorli ro'yxat (Contract A18 — offset **YO'Q**) |
| `GET` | `/runs/:runId` | egasi | `{ run, steps: [...] }` |
| `GET` | `/runs/:runId/events?after=<seq>` | egasi | Event'lar (UI-4 uchun) |
| `GET` | `/admin/runs?userId&status` | `@Roles(OWNER, ADMIN)` | `@admin-scope` |

**8. Security.**
- ⚠️ **Xom sensitive data trace'ga yozilmaydi.** `redact()` — yozish yo'lida
  **majburiy**, kesib o'tib bo'lmaydigan (bitta `writeEvent()` funksiyasi).
- Konnektor siri → faqat `secretRef` (P0-9).
- Brauzer: URL **query'siz**, DOM matni **yo'q** (§2.3.1).
- Tool argumentlari: sxema + `sha256` hash + redaksiyalangan preview.

**9. Permissions.** Trace o'qish — `userId` scope (ESLint majburlaydi).
Admin o'qish — `@Roles` + `@admin-scope` izohi. Impersonation ostida
o'qilsa — `AuditLog.impersonatedUserId` yoziladi (SEC-12 naqshi).

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Event yozish yiqildi | ⚠️ **Ijro to'xtamaydi** — DLQ ga qo'yiladi + `warn`. Trace to'liqligi < 99% bo'lsa alert |
| `seq` to'qnashuvi | `@@unique` → retry `seq+1` bilan |
| Payload juda katta (> 64 KB) | Kesiladi + `truncated: true` flag |
| Redaksiya funksiyasi xato berdi | **Event yozilmaydi** (fail-closed — sir chiqarishdan ko'ra yo'qotgan yaxshi) + `critical` alert |

**11. Edge cases.** Run 1000+ qadam (→ event soni cheklanmaydi, lekin ijro
budjeti to'xtatadi). Bir vaqtda ikki worker bir `runId` ga yozishi (→
`@@unique([runId, seq])` bittasini rad etadi). Run yarim qolgan (worker o'ldi)
→ `stalled` detektori `RUN_FAILED` yozadi.

**12. Observability.** Log: `trace.event.written/dropped`.
Metrika: `trace_event_loss_pct` (maqsad < 1%), `trace_write_latency_ms`,
`approval_rate`, `override_rate`.
Alert: `trace_event_loss_pct > 1` → `warn`; redaksiya xatosi → `critical`.

**13. Performance.** Yozuv < 50 ms (asinxron). O'qish: kursorli, kompozit
indeks (`runId, seq`) bilan p95 < 200 ms. ⚠️ Yozuv hajmi — bu taskning
asosiy narxi: ijro boshiga ~10–40 qator. `[CALIBRATE]` — 14 kundan keyin
o'lchanadi va partitioning qarori shundan keyin qabul qilinadi.

**14. Tests.**
- Unit: `writeEvent()` redaksiyasiz payloadni **rad etadi**.
- Unit: sir naqshi (token, parol, cookie) payloadga tushsa — redaksiyalanadi
  (mavjud `redaction.spec.ts` kengaytiriladi).
- Integration: 1 chat ijrosi → `RUN_STARTED` … `RUN_COMPLETED` **to'liq zanjir**,
  `seq` uzluksiz.
- Integration: `ApprovalEvent` `MODIFIED` bilan → trace'da `APPROVAL_GRANTED`.
- **G0.6:** approval hodisalari **≥ 1 hafta uzluksiz** — bu `MANUAL:`
  (vaqt talab qiladi), lekin mexanik qismi: kunlik yozuv soni 0 bo'lgan kun **yo'q**.
- Scoping: boshqa foydalanuvchi run'ini o'qish → `404`.

**15. Rollback.** `FF_TRACE=off` → event yozilmaydi (ijro ishlaydi).
Migratsiya qaytarilmaydi. O'qish endpointlari bo'sh ro'yxat qaytaradi.

**16. Definition of Done.**

- [ ] `cd apps/api && npx prisma validate` → exit 0
- [ ] `cd apps/api && npx jest src/trace src/observability` → 0 fail
- [ ] `cd apps/api && npx eslint src` → 0 error
- [ ] 1 ijrodan keyin: `SELECT count(*) FROM "ExecutionEvent" WHERE "runId"=$1` → **≥ 6** (RUN_STARTED, MODEL_*, TOOL_*, RUN_COMPLETED)
- [ ] `SELECT count(*) FROM "ExecutionEvent" WHERE seq IS NULL` → **0**
- [ ] `\d "ExecutionEvent"` da `runId, seq` **unique** ko'rinadi
- [ ] Redaksiya testi: `writeEvent({payload: {token: "sk-live-..."}})` → saqlangan payloadda `sk-live` **yo'q** (grep testi)
- [ ] `GET /runs/:id` boshqa foydalanuvchida → `404`
- [ ] `GET /runs` **kursorli** (javobda `nextCursor`, `offset` **yo'q**)
- [ ] `MANUAL:` G0.6 — 7 kun ketma-ket har kunda `ApprovalEvent` count > 0

---

### P0-8 — LangGraph checkpoint / state recovery

**Bog'liq:** ADR-004 (AI engine) · §2.9 M3 · N1
**Demo-critical:** ❌ · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** Ijroni **to'xtatib, keyin davom ettirish** imkonini berish —
bu HITL (P0-6 approval), crash recovery va debugging'ning **umumiy poydevori**.
Bugun umuman yo'q: `agent_engine.py:256` `workflow.compile()` **argumentsiz**
(`[MEASURED 2026-08-16]`, N1).

**2. Scope.** LangGraph checkpointer ulash (`compile(checkpointer=...)`),
`thread_id = runId` (§2.9 M3: holat **runId ga bog'langan**, ulanishga emas),
checkpoint saqlash joyi, `resume(runId)` yo'li, `CHECKPOINT_SAVED` event,
approval pauzasi (`interrupt`) → tasdiqdan keyin davom.

**3. Non-goals.** Time-travel / tarixiy checkpoint'ga qaytish. Ko'p-thread
orkestratsiya. Checkpoint'dan eval qayta ijrosi (→ V3-P1). Xotira/pgvector
(→ V3-P1, ADR-027) — checkpoint **qisqa muddatli ijro holati**, xotira emas.

**4. User flow.** (a) `HIGH` amalda agent **to'xtaydi**, foydalanuvchi
tasdiqlaydi, agent **shu joydan** davom etadi (qaytadan boshlamaydi —
bu takroriy LLM xarajati va takroriy yon ta'sir demak);
(b) worker qulasa, ijro oxirgi checkpoint'dan davom etadi.

**5. Architecture.**

```
apps/agent-engine
  StateGraph(AgentState)
    .compile(checkpointer=PostgresSaver(...))     ← N1 tuzatishi
        thread_id = runId                          ← §2.9 M3

  /agents/resume  { runId } → graph.invoke(None, config={"configurable": {"thread_id": runId}})
```

**Saqlash joyi qarori:** `langgraph-checkpoint-postgres` → **mavjud Postgres**
(Contract A10: ikkinchi tranzaksion DB yo'q; ADR-027 ham pgvector uchun
aynan shu mantiqni ishlatgan). ⚠️ LangGraph checkpoint jadvallari **o'z
migratsiyasini** yaratadi — bu Prisma sxemasidan **tashqarida** bo'ladi;
qaror va sabab task spec'da yoziladi va `prisma migrate status` ni
buzmasligi tekshiriladi.

**6. Data model.** Prisma sxemasida o'zgarish **yo'q**.
LangGraph o'z jadvallarini yaratadi (`checkpoints`, `checkpoint_writes`,
`checkpoint_blobs` — kutubxona nomlari, `[CALIBRATE]` versiyaga qarab).
`ExecutionEvent` da `CHECKPOINT_SAVED` yoziladi (P0-7).

**7. API contract.**

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| `POST` | `/agents/resume` (engine) | `InternalTokenGuard` | `{ runId, status }` |
| `GET` | `/agents/state/:runId` (engine) | `InternalTokenGuard` | Joriy holat (debug) — ⚠️ **prod'da o'chiriladi yoki admin-only** |

**8. Security.** Checkpoint'da **xom sir yo'q** — `secretRef` (P0-9).
Checkpoint `runId` bilan indekslanadi va **tenant tekshiruvi API qatlamida**
(engine ommaviy emas, Konstitutsiya #5). ⚠️ **T5 (trace poisoning):**
checkpoint'ga faqat **ichki holat** yoziladi; xom tashqi kontent (brauzer
DOM, inbox matni) **saqlanmaydi** — u keyingi ijroga qayta in'ektsiya
qilinmasin.

**9. Permissions.** `resume` — faqat run egasi (API tekshiradi, engine emas).
Debug endpoint — `@Roles(OWNER, ADMIN)`.

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Checkpoint yozilmadi | Ijro **davom etadi** (fail-open) + `warn`; resume imkoni yo'qoladi |
| Checkpoint deserializatsiya xatosi (kutubxona yangilandi) | Resume **rad etiladi**, aniq xato, run qaytadan boshlanishi mumkin (foydalanuvchi qaroriga) |
| Postgres ulanishi yo'q | Engine ishlamaydi (allaqachon shunday) |
| Resume ikki marta chaqirildi | `runId` bo'yicha qulf (P0-1 job ID) → bitta ijro |

**11. Edge cases.** Checkpoint hajmi katta (uzun suhbat) → `[CALIBRATE]`
chegara + eski checkpoint'lar tozalanishi (P0-15 retention). Kutubxona
MAJOR sakrashi — mavjud `test_engine.py:505` (serializatsiya round-trip)
va `:524` (versiya qulfi) testlari **shu xavfni allaqachon qamraydi**,
kengaytiriladi. Approval timeout'dan keyin checkpoint — `RUN_CANCELLED`,
checkpoint saqlanadi (debug uchun), keyin retention bo'yicha tozalanadi.

**12. Observability.** Log: `checkpoint.saved/restored/failed`.
Metrika: `checkpoint_write_ms`, `resume_success_rate` (SLO ≥ 95%),
`checkpoint_size_bytes`.
Alert: `resume_success_rate < 90%` → `warn`.

**13. Performance.** Checkpoint yozish < 200 ms. Har **qadamda** yoziladi
(LangGraph default) — Postgres yozuv hajmi oshadi; `[CALIBRATE]` o'lchanadi
va kerak bo'lsa faqat `interrupt` nuqtalarida yozishga o'tiladi.

**14. Tests.**
- pytest: graf `checkpointer` bilan compile bo'ladi (N1 regressiyasi).
- pytest: `thread_id=runId` bilan 3 qadam → to'xtatish → resume → **4-qadamdan**
  davom (qaytadan **boshlamaydi**).
- pytest: mavjud `test_checkpoint_serializatsiyasi_round_trip` kengaytiriladi.
- pytest: checkpoint'da sir naqshi **yo'q** (grep testi).
- Integration: worker o'ldirilib qayta ko'tarilgach ijro davom etadi.

**15. Rollback.** `LANGGRAPH_CHECKPOINTER=none` → `compile()` argumentsiz
(bugungi xulq). Resume endpoint `501` qaytaradi. LangGraph jadvallari qoladi
(zararsiz).

> ### ⚠️ TUZATISH — SAQLASH JOYI QARORI O'ZGARDI
>
> Bu bo'lim (§5) *"`langgraph-checkpoint-postgres` → **mavjud Postgres**"*
> deb yozgan edi. Implementatsiya paytida aniqlandi:
>
> **`apps/agent-engine` da DB kutubxonasi UMUMAN yo'q** va u Postgres'ga
> ulanmaydi — `requirements.txt` da `psycopg`/`sqlalchemy`/`asyncpg` yo'q,
> `render.yaml` da engine'ga `DATABASE_URL` berilmagan. Engine API bilan
> faqat HTTP orqali gaplashadi.
>
> Ya'ni blueprint qarori "checkpointer qo'shish" emas, **engine'ga DB
> kirishini berish** bo'lardi — arxitektura chegarasini ochish (engine
> buzilsa hujumchi to'g'ridan-to'g'ri bazaga chiqadi) va ikkita yangi
> tashqi bog'liqlik (Konstitutsiya #40 → ADR talab qiladi).
>
> **Yangi qaror (founder: "eng kerakli joyda saqla"):** holat AYNAN kerakli
> joyda — **Postgres'da** (Contract A10, yagona haqiqat manbai) — lekin
> unga yozish **API orqali**. Engine tomonda `ApiCheckpointSaver`
> (`BaseCheckpointSaver` implementatsiyasi) `/api/internal/checkpoints`
> endpointlariga boradi (`x-internal-token`).
>
> **Yutuq:** yangi Python bog'liqligi **0** · engine DB'ga tegmaydi ·
> holat baribir Postgres'da va restart'dan omon qoladi.

**16. Definition of Done** — *holat: 2026-08-17 implementatsiyasidan keyin*

- [x] `cd apps/agent-engine && ./.venv/Scripts/python.exe -m pytest -q` → **89/89 pass** (73 mavjud + 16 yangi)
- [x] `cd apps/agent-engine && ./.venv/Scripts/python.exe -m ruff check .` → **All checks passed**
- [x] `grep -n "compile(" apps/agent-engine/agent_engine.py` → **`compile(checkpointer=self.checkpointer)`**
- [x] `grep -rn "checkpointer" apps/agent-engine/*.py | wc -l` → **≥ 3** (bugun 0 edi)
- [x] **Yangi Python bog'liqligi 0** — `langgraph-checkpoint` (allaqachon o'rnatilgan)
  ning `BaseCheckpointSaver` va `JsonPlusSerializer` idan foydalanildi
- [x] `cd apps/api && npx prisma migrate status` → **37 migratsiya, up to date**
- [x] `cd apps/api && npx jest src/events` → **54/54 pass** (18 yangi checkpoint testi)
- [x] **Round-trip:** yozilgan checkpoint aynan o'sha holda qaytadi
  (serializatsiya + base64 + `pending_writes` tartibi)
- [x] **LangGraph semantikasi:** `checkpointId`siz → **eng oxirgisi** (resume yo'li);
  `before` → undan oldingilari; `limit` 100 dan oshmaydi
- [x] **Idempotentlik:** bir xil checkpoint ikki marta kelsa dublikat **yaratilmaydi**
- [x] **FAIL-OPEN:** API yiqilsa/tarmoq uzilsa `put` throw **qilmaydi**,
  `get_tuple` **`None`** qaytaradi — checkpoint qulaylik qatlami, ijroni to'xtatmaydi
- [x] `thread_id` = `ExecutionRun.id` (blueprint §2.9 M3); `run(run_id=...)` va
  yangi **`resume(run_id)`** metodi (`ainvoke(None, ...)` — o'sha joydan davom)
- [x] `AGENT_CHECKPOINTS=off` → checkpointer **`None`** (rollback yo'li, testda qoplangan)
- [ ] ~~Test: 3 qadamdan keyin resume → LLM chaqiruvlari jami 4~~ — ⚠️ **BAJARILMADI**,
  pastga qarang
- [ ] `MANUAL:` checkpoint blob'ida sir naqshlari 0 — jonli ijro talab qiladi
  (birlik testi soxta holat bilan tekshiradi, real prompt bilan emas)

**Qolgan qarz — "tasdiqlab davom etish" zanjiri hali TO'LIQ emas:**

1. `resume(run_id)` metodi **bor**, lekin uni chaqiradigan HTTP endpoint
   (`POST /agents/resume`) hali yozilmagan.
2. Chat oqimi (`/agents/stream`) `run_id` ni engine'ga **uzatmaydi** — u
   `AgentEngine.run()` (blokli yo'l) uchun qo'shilgan. Streaming yo'li
   LangGraph grafidan **o'tmaydi** (u alohida `streaming.py` yo'li), ya'ni
   chat uchun checkpoint hozircha qo'llanmaydi.
3. "3 qadam → resume → 4 chaqiruv" testi shu sababdan yozilmadi: u yuqoridagi
   ikki bo'g'insiz sun'iy bo'lardi.

Ya'ni **P0-8 ning infratuzilmasi tayyor** (saqlash, semantika, fail-open,
rollback), lekin **oqimga ulanishi** alohida task. Bu — P0-6 dagi
"tasdiqlab davom etish yo'q" cheklovining ayni ildizi.

---

### P0-9 — Secret broker

**Bog'liq:** ADR-016 (secrets) · Konstitutsiya #7/#8 · §2.1 T6
**Demo-critical:** ❌ · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** **Model hech qachon xom sirni ko'rmaydi.** Konnektor
tokenlari/parollari model kontekstiga, trace'ga va log'ga tushmasin (T6).

**2. Scope.** `SecretBroker` xizmati: (a) sir o'rniga **`secretRef`**
(opaque identifikator) beriladi; (b) haqiqiy sir faqat **tool adapter'ining
HTTP chaqiruv qatlamida** yechiladi; (c) ref majburiy atributlari: **short
TTL · audience · agentId · runId · tool scope · connector scope · tenant
scope**; (d) **revocation** (ref bekor qilinadi) va **rotation** (sir
almashtirilganda ref'lar avtomatik eskiradi); (e) mavjud `CryptoService`
(AES-256-GCM, `ConnectorConfig.config`) ustiga quriladi — **yangi shifrlash
yozilmaydi**.

**3. Non-goals.** Tashqi KMS/Vault (`[BUDGET-BLOCKED]` bo'lardi; mavjud
at-rest shifrlash yetarli — ADR-016). Foydalanuvchi sirlarini UI'da
ko'rsatish/tahrirlash oqimi (mavjud connectors UI qoladi). API kalitlarini
almashtirish avtomatikasi (rotation **mexanizmi** quriladi, jadval —
operatsion ish).

**4. User flow.** Ko'rinmas. Bilvosita: foydalanuvchi siri hech qachon chat
matnida yoki trace'da paydo bo'lmaydi.

**5. Architecture.**

```
LLM kontekst:            tool spec ichida: { connector: "telegram-bot", secretRef: "sref_ab12..." }
                                                    │  (model faqat shu ID ni ko'radi)
Tool adapter (API):      SecretBroker.resolve(secretRef, { runId, agentId, toolId, tenantId })
                            ├─ TTL tekshiruvi (default 10 daq [CALIBRATE])
                            ├─ scope tekshiruvi (5 o'lchov mos kelmasa — RAD)
                            └─ CryptoService.decrypt(ConnectorConfig.config)
                                     │
HTTP chaqiruvi:          Authorization: Bearer <xom sir>   ← FAQAT SHU QATLAMDA
```

`secretRef` — Redis'da qisqa muddatli yozuv (`sref:<id>` → scope JSON),
sirning o'zi **emas** (sir Postgres'da shifrlangan holicha qoladi).

**6. Data model.** Prisma o'zgarishi **yo'q** (sir manbai —
`ConnectorConfig.config`, mavjud). Redis: `sref:<id>` TTL bilan.

**7. API contract.** Ommaviy endpoint **yo'q**. Ichki interfeys:

```ts
SecretBroker.issue(configId, scope: {runId, agentId, toolId, tenantId}, ttlMs) → secretRef
SecretBroker.resolve(secretRef, callerScope) → DecryptedConfig   // scope mos bo'lmasa throw
SecretBroker.revoke(secretRef) / revokeByRun(runId) / revokeByConnector(configId)
```

**8. Security.**
- **Xom sir hech qachon:** model kontekstida ❌ · trace'da ❌ · log'da ❌ ·
  job payload'da ❌ · checkpoint'da ❌. Bu besh joyning har biri uchun test bor.
- `resolve` scope tekshiruvi — **beshala o'lchov** mos kelishi shart
  (audience = tool adapter identifikatori).
- Kill switch (P0-6) bosilganda `revokeByRun(runId)` avtomatik chaqiriladi.
- Redis o'chsa — `resolve` ishlamaydi → tool ishlamaydi (**fail-closed**).
- Rotation: `ConnectorConfig.config` yangilanganda mavjud ref'lar
  `revokeByConnector` bilan bekor qilinadi (`updatedAt` taqqoslash).

**9. Permissions.** `issue` — faqat run kontekstidan (ichki). `revoke` —
run egasi (kill orqali) yoki `OWNER`/`ADMIN`.

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| `secretRef` TTL tugadi | `resolve` throw → `TOOL_FAILED` "sessiya eskirdi, qayta uriniladi" → yangi ref bilan **1 marta** qayta uriniladi (yon-ta'sirsiz qadam bo'lsa) |
| Scope mos emas | `resolve` throw + **`critical` alert** (bu — hujum belgisi, xato emas) |
| Redis o'chdi | Fail-closed — konnektor tool'lari ishlamaydi, aniq xabar (§2.6) |
| Sir deshifrlanmadi | `TOOL_FAILED` + `needs_credentials` holati (mavjud `ConnectorConfig.status`) |

**11. Edge cases.** Bir run ichida bir konnektor 50 marta chaqirilishi
(→ ref **qayta ishlatiladi**, TTL ichida). Run TTL'dan uzun (→ adapter
avtomatik yangi ref oladi). Ref boshqa run'da ishlatilishi (→ scope rad
etadi — aynan shu uchun `runId` scope'da).

**12. Observability.** Log: `secret.issued/resolved/revoked/scope_mismatch`
(**faqat ref ID, hech qachon sir**). Metrika: `secret_resolve_latency_ms`,
`secret_scope_mismatch_count`. Alert: scope mismatch > 0 → `critical`.

**13. Performance.** `resolve` < 50 ms (Redis + decrypt keshi run doirasida).

**14. Tests.**
- Unit: scope beshligi — har o'lchov noto'g'ri bo'lganda rad (5 test).
- Unit: TTL tugashi → throw.
- Unit: `revokeByRun` → keyingi `resolve` throw.
- **Besh-joy testi:** LLM'ga ketadigan tool spec JSON'ida, `ExecutionEvent`
  payload'ida, pino log oqimida, BullMQ job payload'ida, checkpoint blob'ida —
  `decrypt` natijasi naqshlari **0 moslik** (grep-testlar).
- Integration: telegram konnektori ref bilan ishlaydi (mock HTTP).

**15. Rollback.** `SECRET_BROKER_ENFORCE=false` → adapter to'g'ridan-to'g'ri
`CryptoService` ni chaqiradi (bugungi xulq). ⚠️ Bu flag faqat o'tish davri
uchun — 1 sprintdan keyin o'chiriladi (#39) va broker **majburiy** bo'ladi.

**16. Definition of Done.**

- [ ] `cd apps/api && npx jest src/crypto src/connectors` → 0 fail
- [ ] `cd apps/api && npx eslint src` → 0 error
- [ ] Besh-joy testi: 5/5 o'tdi (yuqorida)
- [ ] Test: scope mismatch → throw + alert hodisasi yozildi
- [ ] Test: kill switch → `revokeByRun` chaqirildi (spy)
- [ ] `grep -rn "decrypt(" apps/api/src --include=*.ts | grep -v crypto/ | grep -v spec` → faqat tool adapter qatlami fayl(lar)i (ro'yxat task spec'da qayd etiladi)
- [ ] Engine tomonda: `grep -rn "config\[.token.\]\|api_key" apps/agent-engine/tools/*.py` → tool spec'dan sir o'qiydigan yo'l **yo'q** (faqat `secretRef`)

---

### P0-10 — Self-verification + retry

**Bog'liq:** §2.4 (verification policy) · §2.2 (idempotency) · ADR-028 ruhi
**Demo-critical:** ⚠️ bilvosita (demo ishonchliligi) · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** Tool chaqiruvi "javob keldi" bilan emas, **toifasiga mos
dalil** bilan muvaffaqiyatli hisoblansin; yiqilganda esa **toifasiga mos**
retry bo'lsin. Bugun konnektorlarda retry **umuman yo'q**
(`connectors.service.ts` — bitta urinish).

**2. Scope.** (a) §2.4 jadvalini kod qiladigan `VerificationPolicy` registri —
har tool toifasi uchun `expectedEvidence` + `verify()` + `retryPolicy`;
(b) konnektor adapterlariga retry (backoff §2.4.2, **faqat kalitli**);
(c) verify natijasi `TOOL_RESULT` event'ida `evidence` sifatida;
(d) verify yiqilsa → `TOOL_FAILED` (muvaffaqiyat **da'vo qilinmaydi**).

**3. Non-goals.** Semantik verifikatsiya ("javob to'g'rimi?" — bu eval,
V3-P1 ADR-028). Brauzer skrinshot-diff. Avtomatik kompensatsiya (undo) —
reversibility jadvali faqat **hujjatlashtiriladi** (P0-6 `reversible` atributi).

**4. User flow.** Foydalanuvchi trace'da (UI-4) har qadamda ko'radi:
"✓ SMS yuborildi — message ID: 12345" yoki "✗ Tekshiruv o'tmadi — javobda
message ID yo'q, qayta yuborilmadi".

**5. Architecture.**

```
ToolExecutor (P0-6 policy'dan keyin)
  ├─ pre:  idempotencyKey bor-yo'qligi (§2.2 — yo'q bo'lsa retry o'chadi)
  ├─ exec: adapter chaqiruvi (timeout 30s)
  ├─ verify: VerificationPolicy[toolCategory].verify(request, response)
  │     PASS → TOOL_RESULT { evidence }
  │     FAIL → TOOL_FAILED { reason: "verification_failed" }
  └─ retry: RetryPolicy[toolCategory] (§2.4.2) — faqat retriable xato + kalit bor
```

Toifalar §2.4 jadvalidan **aynan** olinadi — blueprint'dagi jadval va koddagi
registr farqlansa, bu SPEC_SYSTEM §5.3 buzilishi.

**6. Data model.** Yangi jadval yo'q. `ExecutionEvent.payload.evidence` —
verify natijasi (redaksiyalangan).

**7. API contract.** O'zgarish yo'q (ichki qatlam).

**8. Security.** Verify natijasida sensitive kontent bo'lmasin —
`evidence` ham `redact()` dan o'tadi. Davlat-toifali tool'larda retry
**kod darajasida** o'chirilgan (konfiguratsiya bilan yoqib bo'lmaydi).

**9. Permissions.** O'zgarish yo'q.

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Verify funksiyasining o'zi xato berdi | `TOOL_FAILED` (fail-closed — "tekshira olmadim" ≠ "muvaffaqiyat") |
| Tashqi API 429 | Retriable → backoff bilan qayta (kalit bor bo'lsa) |
| Tashqi API 400 | **Retriable EMAS** → darhol `TOOL_FAILED` |
| Timeout (30 s) | Yon-ta'sirsiz → retry; yon-ta'sirli → ⚠️ **holat so'rovi** (agar toifada bor bo'lsa — to'lov kabi), yo'q bo'lsa `TOOL_FAILED` "holati noma'lum" bilan |

**11. Edge cases.** SMS yuborildi lekin javob timeout (→ "holati noma'lum" —
**qayta yuborilmaydi**, foydalanuvchiga ochiq aytiladi). Verify o'tdi lekin
keyin tashqi tizim rad etdi (→ P0 qamrovidan tashqari — trace'da dalil bor).
Retry orasida kill switch (→ retry bekor).

**12. Observability.** Metrika: `tool_success_rate` (toifa bo'yicha),
`tool_verification_failures`, `tool_retry_count`. Log: `tool.verify.pass/fail`.
Alert: biror toifada success rate < 50% (1 soat) → `warn`.

**13. Performance.** Verify qo'shimcha < 100 ms (holat so'rovli toifalarda
< 2 s). Retry umumiy budjeti: 1+3 urinish × 30 s timeout = maks ~2.5 daq/tool.

**14. Tests.**
- Unit: har §2.4 toifasi uchun verify PASS/FAIL juftligi (**9 toifa × 2**).
- Unit: 400 → retry yo'q; 429 → retry bor; kalitsiz → retry yo'q (3 test).
- Unit: davlat toifasida retry konfiguratsiyasi umuman o'qilmaydi.
- Integration: mock Telegram — birinchi urinish 500, ikkinchisi 200 →
  **bitta** xabar, `attemptNumber=2`.

**15. Rollback.** `VERIFICATION_ENFORCE=false` → verify faqat log yozadi,
`TOOL_RESULT` bo'lib qoladi (shadow). Retry esa **flag'siz** qoladi (u
xavfsizlik emas, ishonchlilik).

**16. Definition of Done.**

- [ ] `cd apps/api && npx jest src/connectors src/policy` → 0 fail
- [ ] 18 ta toifa-verify testi (9 × PASS/FAIL) → 0 fail
- [ ] Mock-retry testi: 500→200 da tashqi chaqiruv soni = **2**, yaratilgan xabar = **1**
- [ ] `grep -rn "retryPolicy\|maxAttempts" apps/api/src/connectors | wc -l` → **≥ 5** (bugun 0)
- [ ] Test: idempotency kalitsiz tool retry flag'i `true` bo'lsa ham → **1 urinish**
- [ ] `cd apps/api && npx eslint src` → 0 error

---

### P0-11 — Deployment reliability

**Bog'liq:** ADR-019/ADR-021 (Render+Vercel) · Contract A38 · repo qarzi (CI lokal repro)
**Demo-critical:** ⚠️ bilvosita (taqdimot kuni deploy sinmasin) · **[BUDGET-BLOCKED]:** ⚠️ qisman (staging)

**1. Purpose.** Deploy — tasodif emas, takrorlanadigan jarayon: smoke gate,
migratsiya qadami, va buzilgan deploy'ni **deploy'dan oldin** ushlash.

**2. Scope.** (a) `scripts/smoke-test.mjs` — deploy'dan keyin avtomatik:
`/health`, `/health/queue`, auth ping, engine ping; (b) migratsiya qadami:
deploy pipeline'da `prisma migrate deploy` + `prisma migrate status`
tekshiruvi; (c) CI'da migratsiya-drift tekshiruvi (`migrate diff` bo'sh);
(d) rollback tartibi hujjatlashtiriladi (runbook); (e) deploy'dan oldin
mahalliy CI repro skripti (gh CLI yo'q — CI script nomlari bilan).

**3. Non-goals.** Blue-green/canary deploy (Render free/starter'da yo'q).
Kubernetes (A38 rad etgan). To'liq staging muhiti — ⚠️ `[BUDGET-BLOCKED]`:
alohida Render servislari pul. **Bepul muqobil scope'da:** lokal
docker-compose "staging-lite" (Postgres+Redis+api+engine) smoke-test bilan.

**4. User flow.** Ko'rinmas. Bilvosita: deploy paytida foydalanuvchi xato
ko'rmaydi.

**5. Architecture.**

```
push → CI (GitHub Actions, mavjud 3 job)
         + yangi job: migration-check (prisma migrate diff → bo'sh)
       ▼ merge master
Render auto-deploy
         preDeployCommand: npx prisma migrate deploy     ← render.yaml ga
         postDeploy (qo'lda/skript): node scripts/smoke-test.mjs <base-url>
              FAIL → Render'da oldingi deploy'ga qaytish (qo'lda, runbook bo'yicha)
```

**6. Data model.** O'zgarish yo'q.

**7. API contract.** `/health` mavjud (`health/` moduli). `smoke-test.mjs`
faqat **o'qiydi**.

**8. Security.** Smoke test tokenlari — env, repo'da emas. Smoke test
prod ma'lumotini o'zgartirmaydi (faqat GET + auth ping).

**9. Permissions.** O'zgarish yo'q.

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Migratsiya deploy'da yiqildi | Render deploy **to'xtaydi** (preDeployCommand exit ≠ 0), eski versiya ishlayveradi |
| Smoke test yiqildi | Alert + runbook bo'yicha qo'lda rollback (Render free'da avtomatik yo'q) |
| Migratsiya drift (kod ≠ DB) | CI qizil — merge bloklanadi |

**11. Edge cases.** Fantom `AuditLogHashBackup DROP` (repo qarzi) —
migration-check aynan shu sinf xatoni ushlaydi. Render spin-down (free)
paytida smoke test (→ 60 s timeout, 1 qayta urinish).

**12. Observability.** Deploy hodisasi log'da (`deploy.version`).
Sentry release tagi (mavjud Sentry ulanishiga qo'shiladi).

**13. Performance.** Smoke test < 90 s (spin-down bilan).

**14. Tests.** `smoke-test.mjs` o'zi test; unga unit shart emas (TIER A ning
bu bo'limi shu yerda ataylab kichik). CI job'ning o'zi — `migrate diff` testi.

**15. Rollback.** Bu task rollback **mexanizmining o'zi**. Skript va CI job
olib tashlansa — bugungi holat.

**16. Definition of Done.**

- [ ] `node scripts/smoke-test.mjs http://localhost:3001` (lokal stack bilan) → exit 0
- [ ] `render.yaml` da api servisida `preDeployCommand` bor: `grep -n "preDeployCommand" render.yaml` → ≥ 1
- [ ] CI'da yangi job: `grep -n "migrate diff\|migration-check" .github/workflows/ci.yml` → ≥ 1
- [ ] CI lokal repro: `bash scripts/ci-local.sh` → CI'dagi 3 job buyruqlari bilan bir xil nomlar, exit 0
- [ ] `docs/runbooks/` da rollback runbook: mavjud fayl kengaytirilgan yoki yangi — `ls docs/runbooks/ | grep -i deploy` → ≥ 1
- [ ] `MANUAL:` bitta real deploy shu oqim bilan o'tkazildi va smoke test yashil

---

### P0-12 — Device abstraction layer + telefon diagnostikasi

**Bog'liq:** ADR-011 (companion) · Contract A23 (`companion-android` bo'sh papka taqiqi) · N5
**Demo-critical:** ❌ · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** Brauzer / desktop / mobil qurilma **bitta interfeys** ostida
boshqarilsin, va mavjud (lekin hech qachon chaqirilmagan) companion pairing
yo'li **HTTP darajasida ishlashi tekshirilsin** (N5).

**2. Scope.** (a) `DeviceTarget` abstraksiyasi: `browser` (P0-2 worker) ·
`desktop` (companion-desktop, mavjud) · `mobile` (kelajak — **interfeys**,
implementatsiya emas); (b) `companion/register` + `companion/pair` +
`poll` + `result` oqimini **HTTP darajasida** integration test bilan isbotlash
(bugun: endpointlar bor `device-control.controller.ts:281–334`, testdan
tashqari **hech kim chaqirmaydi**); (c) capability katalogi bilan routing
(mavjud `capability-router.service.ts` ustiga); (d) UI ulanishi → **UI-9
emas, alohida emas** — pairing UI **P0-12 DoD'ining `MANUAL` bandi emas,
UI-3 bilan bir xil sprintda** (§8 jadvalida).

**3. Non-goals.** **To'liq ADB / Android integratsiyasi → V3-P1** (real
qurilma + SDK kerak). `apps/companion-android` yaratish (Contract A23 —
bo'sh papka taqiqlangan). Yangi qurilma turlari. Call recording kengaytmasi.

**4. User flow.** Foydalanuvchi "Qurilma ulash" → 6 xonali kod (10 daq TTL,
SEC-01 `[MEASURED 2026-08-16]` `device-companion.service.ts:19`) →
companion-desktop kodni kiritadi → juftlandi → agent `DeviceTarget.desktop`
orqali buyruq yuboradi → companion poll bilan oladi → natija qaytadi →
`DeviceActionLog`.

**5. Architecture.**

```
CapabilityRouter (mavjud)
   └─ DeviceTarget interfeysi (YANGI — yupqa qatlam)
        ├─ BrowserTarget  → BrowserRunner (P0-2)
        ├─ DesktopTarget  → DeviceCompanion poll/result (mavjud)
        └─ MobileTarget   → NotImplemented (aniq xato, va'da yo'q)
```

Bu — **refactor + isbot** taski, yangi imkoniyat emas. Mavjud
`device-companion.service.ts` mantig'i o'zgarmaydi.

**6. Data model.** O'zgarish yo'q (`DeviceCompanion`, `DeviceCommand`,
`DevicePermission`, `DeviceActionLog` — barchasi mavjud).

**7. API contract.** Mavjud endpointlar o'zgarmaydi. Diagnostika:

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| `GET` | `/device-control/diagnostics` | `AuthGuard` | `{ companions: [{kind, status, lastSeenAt, queuedCommands}] }` |

**8. Security.** Mavjud SEC-01 rejimi saqlanadi (kod TTL, bir marta).
Buyruqlar `DevicePermission` bilan **fail-closed** (mavjud xulq). Poll
autentifikatsiyasi — companion o'z tokeni (mavjud).

**9. Permissions.** Hammasi `userId` scoped (mavjud).

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| Companion offline | Buyruq navbatda (maks 20/qurilma §2.5), TTL bilan eskiradi |
| Pairing kodi eskirdi | `4xx` aniq xabar (mavjud) |
| MobileTarget chaqirildi | `501` + "Mobil companion hali mavjud emas" — **jim yiqilmaydi** |

**11. Edge cases.** Bir foydalanuvchida 2 desktop companion (→ mavjud
`kind` bo'yicha cheklov saqlanadi). Poll paytida buyruq bekor qilinishi
(kill switch → navbat tozalanadi).

**12. Observability.** Metrika: `device_command_delivery_rate` (SLO ≥ 95%),
`companion_last_seen_age`. Log: mavjud `DeviceActionLog` yo'li.

**13. Performance.** Poll → buyruq yetkazish < 5 s (§2.5).

**14. Tests.**
- **Integration (taskning yadrosi):** `register → pair → poll → command →
  result` to'liq HTTP zanjiri supertest bilan — **bugun yo'q, yoziladi**.
- Unit: `DeviceTarget` routing — 3 target.
- Unit: MobileTarget → `501`.
- Regressiya: mavjud `device-companion.service.spec.ts` sinmaydi.

**15. Rollback.** `DeviceTarget` qatlami yupqa adapter — olib tashlansa
mavjud to'g'ridan-to'g'ri chaqiruvlar qoladi. Migratsiya yo'q.

**16. Definition of Done.**

- [ ] `cd apps/api && npx jest src/device-control` → 0 fail
- [ ] Integration test: to'liq pairing zanjiri → `DeviceCompanion.status='paired'` va buyruq natijasi qaytdi
- [ ] `grep -rn "class MobileTarget" apps/api/src | wc -l` → 1, va uning testi `501` tasdiqlaydi
- [ ] `GET /device-control/diagnostics` → `200`, scoping testi bilan
- [ ] `ls apps/ | grep companion-android` → **bo'sh** (A23 buzilmadi)
- [ ] `cd apps/api && npx eslint src` → 0 error

---

### P0-13 — Agent Execution Event Bus

**Bog'liq:** §2.3 (canonical schema) · P0-7 (doimiy qatlam) · UI-4/UI-7 (iste'molchilar)
**Demo-critical:** ✅ **HA** (UI-4 bunga qurilgan) · **[BUDGET-BLOCKED]:** ❌

> ⚠️ **Tartib eslatmasi:** P0-13 va P0-7 bitta juftlik — P0-13 **yozuv/tarqatish
> mexanizmi**, P0-7 **doimiy saqlash + o'qish**. Ular **birga** yoki P0-13 →
> P0-7 tartibida bajariladi (§5 grafi).

**1. Purpose.** UI, trace, admin va analytics **bitta** event manbasidan
o'qisin — hozirgi ikkilangan yo'llar (chat SSE alohida, `DeviceActionLog`
alohida, audit alohida) ustiga to'rtinchi yozilmasin.

**2. Scope.** (a) `ExecutionEventBus` — yagona `emit()` nuqtasi (§2.3
konverti + redaksiya); (b) in-process tarqatish (NestJS `EventEmitter2` yoki
oddiy observer — **yangi broker YO'Q**); (c) SSE ko'prigi: `runId` bo'yicha
jonli oqim (mavjud chat SSE naqshi — `route.ts:119` — kengaytiriladi);
(d) engine → API event yo'li (engine o'z qadamlarini `InternalTokenGuard`
endpoint orqali yuboradi); (e) iste'molchi shartnomasi: UI-4, P0-5, P0-7.

**3. Non-goals.** Kafka/RabbitMQ/tashqi broker (ADR-005 rad etgan; Redis
pub/sub ham **hozircha emas** — bitta instans, kerak emas). Event replay
mexanizmi (P0-7 jadvalidan o'qish yetarli). Webhook'lar tashqariga (→ V3-P2+).

**4. User flow.** Foydalanuvchi chat oynasida agent qadamlarini **jonli**
ko'radi: "🔍 Konnektor tanlandi: telegram-bot" → "⏸ Tasdiq kutilmoqda" →
"✓ Yuborildi". Bu — UI-4 ning ma'lumot manbai.

**5. Architecture.**

```
Emitentlar:                       ExecutionEventBus.emit(event)
  api ichidagi ijro yo'llari  ──▶    ├─ redact() (§2.3.1 — MAJBURIY, bitta joyda)
  engine (HTTP, internal)     ──▶    ├─ persist → ExecutionEvent (P0-7)
  browser-worker (P0-2, HTTP) ──▶    ├─ in-process subscribers:
                                     │     ├─ SSE registry (runId → clients)
                                     │     └─ MeteringService (P0-5)
                                     └─ (kelajak: admin live feed UI-7)
```

**Muhim tartib:** `redact()` **emit ichida**, iste'molchilarda emas — hech
bir iste'molchi xom payload ko'rmaydi.

**6. Data model.** P0-7 jadvallari (bu task ularga yozadi). Yangi jadval yo'q.

**7. API contract.**

| Metod | Yo'l | Kim | Javob |
|---|---|---|---|
| `POST` | `/internal/execution-events` | `@Public()` + `InternalTokenGuard` | engine/worker'dan event qabul qilish, `204` |
| `GET` | `/runs/:runId/stream` | egasi (BFF orqali) | SSE: `data: {type, seq, ...}` |

SSE hodisa formati chat SSE bilan **uslubdosh** (`{type: ...}` — mavjud
`rate_limit` naqshi).

**8. Security.** Ichki endpoint — `InternalTokenGuard` (mavjud naqsh).
SSE — faqat run egasi (BFF cookie auth orqali). Redaksiya emit'da (yuqorida).

**9. Permissions.** `runId` egalik tekshiruvi SSE ochilishida (`@upstream-scope`
naqshi bilan).

**10. Failure modes.**

| Rejim | Xulq |
|---|---|
| SSE mijozi uzildi | Registry tozalanadi; event'lar P0-7 da qoladi — UI qayta ulanib `?after=seq` bilan to'ldiradi |
| Persist yiqildi | §2.5 P0-7 qatori (DLQ), jonli SSE **baribir** yuboriladi |
| Engine event yubormadi | Trace qisman — `metering_missing` singari alert |
| Event bo'ron (loop bug) | Rate limit: run boshiga maks 1000 event `[CALIBRATE]` → run majburiy `RUN_FAILED` |

**11. Edge cases.** UI event'dan **oldin** ulanishi (→ `?after=0` bilan
tarixni oladi). `seq` teshigi (persist yiqilgan) → UI "ba'zi qadamlar
yozilmadi" ko'rsatadi, taxmin qilmaydi.

**12. Observability.** Metrika: `event_bus_emit_count`, `sse_active_clients`,
`event_bus_persist_failures`. Log: emit xatolari.

**13. Performance.** Emit < 5 ms (persist asinxron). SSE mijozlari:
instans boshiga maks 200 `[CALIBRATE]`.

**14. Tests.**
- Unit: emit → redact chaqirildi (spy) → persist chaqirildi.
- Unit: konvert validatsiyasi (`runId`siz event → throw).
- Integration: engine mock event `POST /internal/execution-events` → SSE
  mijozi oladi → jadvalda ham bor.
- Auth: internal endpoint tokensiz → `401`; SSE boshqa foydalanuvchi → `404`.

**15. Rollback.** SSE endpoint o'chirilsa UI polling'ga tushadi
(`GET /runs/:id/events`). Bus'ning o'zi olib tashlansa — P0-5/P0-7 ham
ishlamaydi (bus ularning yozuv yo'li) — shuning uchun rollback birligi:
**P0-13+P0-7 birga**.

**16. Definition of Done** — *holat: 2026-08-17 implementatsiyasidan keyin
(P0-13 + P0-7 birga, blueprint §5 dagi "bitta juftlik" qoidasi bo'yicha)*

- [x] `cd apps/api && npx prisma validate` → **valid**; `migrate status` → **35 migratsiya, DB sinxron**
- [x] `cd apps/api && npx tsc --noEmit -p tsconfig.json` → **exit 0**
- [x] `cd apps/api && npx eslint src` → **0 error** (8 warning — baseline)
- [x] `cd apps/api && npx jest src/events` → **28/28 pass** (2 suite)
- [x] `npx jest src/app.module.spec.ts` → pass (modul grafi `EventsModule` bilan quriladi)
- [x] **Redaksiya chetlab o'tilmaydi:** payloaddagi `Bearer sk-ant-…` va `password`
  → `[REDACTED]`; `tokensIn`/`tokensOut` **saqlanadi** (diagnostika buzilmaydi)
- [x] Redaksiya yiqilsa payload **butunlay tashlanadi** (fail-closed), hodisa baribir yoziladi
- [x] `seq` run ichida monotonik va **har run o'z hisobidan** boshlanadi; `P2002` to'qnashuvida qayta uriniladi
- [x] Yozuv xatosi ijroni **yiqitmaydi** (fail-open → `null`)
- [x] Bo'ron chegarasi: `MAX_EVENTS_PER_RUN` dan keyin oddiy hodisalar to'xtaydi, **yakuniy hodisa baribir yoziladi**
- [x] Obuna bekor qilinganda `Map` **tozalanadi** (xotira sizishi yo'q); bitta obunachining xatosi qolganlarini to'xtatmaydi
- [x] `grep -rn "ExecutionEventBus" apps/api/src | wc -l` → **≥ 4**
- [x] **Jonli tekshiruv** (API `npm run dev`, 5 route ro'yxatdan o'tdi):
  - `POST /api/internal/execution-events` tokensiz → **401**
  - `GET /api/runs` auth'siz → **401**
  - yaroqsiz `type` enum → **400** (ruxsat etilgan qiymatlar ro'yxati bilan)
  - mavjud bo'lmagan `runId` → **`{accepted:false}`**, `201` (fail-open, crash yo'q)
- [x] **Uchdan-uchgacha:** real run yaratilib 3 hodisa yozildi → `seq 1,2,3`;
  `RUN_STARTED, TOOL_STARTED, RUN_COMPLETED`; `costTiyin=4200` (BigInt);
  bazada `SUPERSECRET` va `sk-ant-` → **0 moslik**; `tokensIn=420` **saqlangan**
- [x] Konstitutsiya #14: auth testi (401 × 2) + scoping testi (begona run → 404, hodisalar **umuman so'ralmaydi**)
- [x] **P0-7 o'qish:** `GET /runs` kursorli (`skip` **ishlatilmaydi**), `/runs/:id`,
  `/runs/:id/events?after=`, `/runs/:id/stream` (SSE) — hammasi `userId` bilan scoped
- [ ] `MANUAL:` ijro yo'llarini (chat/automation) busga ULASH — **bajarilmadi**, pastga qarang

> ### ⚠️ QAMROV ESLATMASI — bus qurildi, lekin hali TO'LDIRILMAYDI
>
> Bu taskda **infratuzilma** qurildi: sxema, migratsiya, bus, o'qish API,
> SSE. Mavjud ijro yo'llari (chat streaming, `AutomationService`) hali
> `RUN_STARTED`/`TOOL_*` hodisalarini **yubormaydi** — ya'ni jadval bugun
> faqat `/internal/execution-events` orqali to'ladi (engine va worker uchun
> tayyor yo'l).
>
> Ulash ataylab alohida qoldirildi: u chat oqimining pul va halal-filter
> yo'llariga tegadi, va uni UI-4 bilan BIRGA qilish to'g'ri — aks holda
> hodisalar yoziladi, lekin ularni hech kim ko'rmaydi (o'lik yozuv,
> Konstitutsiya #38 ruhiga zid). **Keyingi task: UI-4 + ijro yo'llarini ulash.**

> ### ⚠️ MIGRATSIYA — repo qarzi aylanib o'tildi
>
> `prisma migrate dev` ishlamadi: `20260809220000_sec12_impersonation_…`
> migratsiyasi **qo'llanilgandan keyin tahrirlangan**, shuning uchun Prisma
> butun dev bazasini **reset** qilishni talab qildi. Reset QILINMADI
> (ma'lumot yo'qotish). O'rniga: `migrate diff` bilan SQL generatsiya →
> fantom `DROP TABLE "AuditLogHashBackup"` **olib tashlandi** (repo'ning
> ma'lum qarzi) → `db execute` → `migrate resolve --applied`.
>
> Natija bir xil (`migrate status` → sinxron), lekin **asosiy qarz ochiq
> qoladi**: keyingi `migrate dev` yana shu devorga uriladi. Uni yopish —
> alohida task (tahrirlangan migratsiya checksumini tiklash yoki
> `AuditLogHashBackup` ni sxemaga qaytarish/DB'dan olib tashlash).

---

### P0-14 — Agent Evaluation Gate ⚠️

**Bog'liq:** ADR-028 (to'liq harness V3-P1) · Gate G0 chiqish sharti · §2.8 D5
**Demo-critical:** ✅ **HA** (demo ssenariysi = eval ssenariylarining bittasi) · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** "Test o'tdi" ≠ "agent vazifani bajardi". P0 chiqishida
**kritik agent journey'lari** uchun minimal regression suite bo'lsin —
usiz P0-1…P0-13 o'zgarishlari agent xulqini jimgina buzgan bo'lishi mumkin.

**2. Scope.** (a) **5–8 ta oltin ssenariy** (`[CALIBRATE]` — aniq soni task
spec'da): oddiy chat javobi · konnektorli tool chaqiruvi (mock) · HIGH-risk
approval oqimi · kill switch · brauzer navigatsiya + allowlist blok ·
free-tier limit xabari · resume (P0-8 dan keyin);
(b) har ssenariy: kirish → kutilgan **xulq assertlari** (aniq matn emas —
"tool chaqirildi", "approval so'raldi" kabi strukturaviy);
(c) mock LLM rejimi (deterministik) + **haftada 1 marta real LLM bilan**
(`MANUAL`, free kvota hisobidan);
(d) suite `npm run eval:gate` bilan ishga tushadi va **P0 chiqish gate'ining
qismi**.

**3. Non-goals.** To'liq eval harness, ball tizimi, failure taksonomiyasi —
**V3-P1 (ADR-028)**. ≥50 vazifalik to'plam (G1.2). Model routing evallari.
LLM-as-judge.

**4. User flow.** Yo'q (ichki sifat darvozasi).

**5. Architecture.** `apps/api/eval/` (yoki `scripts/eval/`) — jest'dan
**alohida** (ular unit emas): supertest bilan to'liq API oqimi, engine mock
rejimda (`LLM_MOCK=true` — engine'da deterministik javob yo'li qo'shiladi).
Har ssenariy `ExecutionEvent` zanjirini tekshiradi (P0-7 dan o'qib) — ya'ni
eval **trace ustiga** quriladi, alohida instrumentatsiya emas.

**6. Data model.** O'zgarish yo'q.

**7. API contract.** O'zgarish yo'q. Engine'ga `LLM_MOCK` rejimi (faqat
test build/env'da; prod'da bu flag **rad etiladi** — fail-fast).

**8. Security.** Mock rejim prod'da yoqilmasligi: engine start'da
`ENV=production && LLM_MOCK` → **crash**. Bu demo-javob taqiqining (§2.6)
kod bilan mustahkamlanishi.

**9. Permissions.** O'zgarish yo'q.

**10. Failure modes.** Suite qizil → keyingi P0 task boshlanmaydi
(SPEC_SYSTEM §6.4 to'xtash qoidasi). Real-LLM haftalik ijro yiqilsa —
mock bilan farq tahlil qilinadi (model o'zgargan bo'lishi mumkin).

**11. Edge cases.** OpenRouter modeli katalogdan chiqib ketishi (real-LLM
rejimda) — bu **eval xatosi emas**, rotatsiya xabari; suite buni ajratadi.

**12. Observability.** Suite natijasi CI artefakti. `eval_gate_pass` —
oddiy boolean, murakkab ball **yo'q** (V3-P1).

**13. Performance.** Mock suite < 5 daq (CI'da chidash mumkin).

**14. Tests.** Bu taskning o'zi test. Meta-test: mock rejim prod'da crash
(1 pytest).

**15. Rollback.** Suite o'chirilsa — bugungi holat. Hech narsa unga runtime
bog'lanmaydi.

**16. Definition of Done.**

- [ ] `npm run eval:gate` (yoki `bash scripts/eval-gate.sh`) → exit 0, ≥ 5 ssenariy
- [ ] Har ssenariy `ExecutionEvent` zanjiri assertlari bilan (trace ustiga qurilgan) — kod ko'rigi bilan tasdiqlanadi
- [ ] Kill switch ssenariysi: STOP → `RUN_CANCELLED` < 5 s
- [ ] Allowlist ssenariysi: taqiqlangan domen → `blocked` + ijro **davom etadi yoki toza yakunlanadi** (qotib qolmaydi)
- [ ] `ENV=production LLM_MOCK=true` → engine start **yiqiladi** (test)
- [ ] CI'da `eval-gate` job mavjud: `grep -n "eval" .github/workflows/ci.yml` → ≥ 1
- [ ] `MANUAL:` real-LLM ijro 1 marta o'tkazildi, natija task spec'ga yozildi

---

### P0-15 — Data Governance (minimal)

**Bog'liq:** ADR-030 (data residency) · P0-7 (trace) · P0-8 (checkpoint) · Konstitutsiya #3/#4
**Demo-critical:** ❌ · **[BUDGET-BLOCKED]:** ❌

**1. Purpose.** P0 yaratayotgan yangi ma'lumot sinflari (trace, checkpoint,
approval, usage) **egasiz qolmasin**: har birining retention muddati,
o'chirish yo'li, tenant izolyatsiyasi va redaksiya siyosati **birinchi
kunidan** yozilgan bo'lsin.

**2. Scope.** (a) Ma'lumot sinflari jadvali (pastda) — har sinf uchun
retention/o'chirish/izolyatsiya; (b) retention cron (P0-4 qulfi bilan):
muddati o'tgan yozuvlarni o'chirish; (c) foydalanuvchi o'chirilganda kaskad
tekshiruvi (`onDelete: Cascade` — #30); (d) PII/secret redaksiya — §2.3.1
ga havola (bu yerda **qayta yozilmaydi**).

**Ma'lumot sinflari jadvali:**

| Sinf | Jadval | Retention (default, `[CALIBRATE]`) | O'chirish yo'li | Izolyatsiya |
|---|---|---|---|---|
| Execution trace | `ExecutionRun`/`ExecutionEvent` | **90 kun** | retention cron + user-delete kaskadi | `tenantId` indeksli |
| Checkpoint | LangGraph jadvallari | **7 kun** (qisqa muddatli ijro holati) | retention cron (`runId` bo'yicha) | `runId → run.userId` |
| Approval events | `ApprovalEvent` | ⚠️ **uzoq — 365 kun** (moat, M3) | user-delete kaskadi; retention'dan **chiqarilgan** | `userId` |
| Usage metering | `UsageEvent` | **365 kun** (billing/audit asosi) | user-delete'da **anonimlashtiriladi** (o'chirilmaydi — moliya izi) | `userId` |
| Konnektor sirlari | `ConnectorConfig.config` | foydalanuvchi boshqaradi | mavjud delete yo'li | mavjud |
| Device loglari | `DeviceActionLog` | **90 kun** | retention cron | mavjud |

**3. Non-goals.** GDPR/export oqimi, o'ng-unutilish avtomatikasi → **V3-P1**
(§7). Data residency arxitekturasi → ADR-030/V3-P4. Backup siyosati
(mavjud runbook). Yurist savollari (MASTER_ROADMAP §9 — Business trek).

**4. User flow.** Ko'rinmas. Foydalanuvchi hisobni o'chirsa — trace/approval
ham ketadi (kaskad), `UsageEvent` anonimlashadi.

**5. Architecture.** `DataRetentionService` + bitta cron (kunlik, P0-4
qulfi bilan, **fail-closed** — dublikat o'chirish xavfsiz emas deb emas,
faqat tartib uchun). Har sinf uchun `deleteWhere` qoidasi deklarativ jadvalda.

**6. Data model.** Yangi jadval yo'q. Yangi migratsiya ham yo'q (retention
ustunlari kerak emas — `createdAt` yetarli).

**7. API contract.** O'zgarish yo'q (admin ko'rinishi → UI-8 v keyinroq).

**8. Security.** O'chirish `deleteMany` **tranzaksiyada, partiyalab**
(bir kunda maks N qator `[CALIBRATE]` — DB'ni bosib qo'ymaslik).
Anonimlashtirish: `userId` → tutuvchi qiymat, boshqa maydonlar qoladi.

**9. Permissions.** Cron `@system-scope`. Qo'lda trigger — `@Roles(OWNER)`.

**10. Failure modes.** Cron yiqilsa — keyingi kun davom etadi (idempotent:
`createdAt <` sharti). Yarim o'chirilgan partiya — muammo emas (keyingi
ijro tugatadi).

**11. Edge cases.** Faol run'ning event'lari retention chegarasiga kirsa
(→ `RUN_COMPLETED/FAILED` bo'lmagan run'lar o'chirilmaydi). `ApprovalEvent`
foydalanuvchi o'chirilganda — kaskad bilan ketadi (moat qiymatiga qaramay:
Konstitutsiya #30 va foydalanuvchi huquqi ustun).

**12. Observability.** Log: `retention.deleted {sinf, count}`.
Metrika: `retention_deleted_rows`. Alert: bir ijroda kutilmagan katta hajm
(> 100k qator) → `warn` + to'xtash.

**13. Performance.** Partiyalab (LIMIT bilan), indeks `createdAt` bo'yicha —
P0-7 indekslari yetarli.

**14. Tests.** Unit: har sinf `deleteWhere` qoidasi (muddati o'tgan → kirdi,
o'tmagan → kirmadi). Integration: user delete → trace kaskadi, `UsageEvent`
anonim. Faol run himoyasi testi.

**15. Rollback.** Cron o'chiriladi — o'chirilgan ma'lumot **qaytmaydi**
(retention shu ma'noda qaytarilmas — shuning uchun partiya chegarasi va alert).

**16. Definition of Done.**

- [ ] `cd apps/api && npx jest src/governance` → 0 fail
- [ ] Test: 91 kunlik `ExecutionEvent` o'chdi, 89 kunlik qoldi
- [ ] Test: faol (`RUNNING`) run event'lari retention'dan **himoyalangan**
- [ ] Test: user delete → `ExecutionRun` count 0 (kaskad), `UsageEvent.userId` anonim
- [ ] Retention cron `runExclusive` bilan o'ralgan (P0-4 bilan bir xil grep testi)
- [ ] Ma'lumot sinflari jadvali task spec'da to'liq (6 sinf × 4 ustun) — kod ko'rigi
- [ ] `cd apps/api && npx eslint src` → 0 error

---

## 4. QISM B — UI/UX VAZIFALARI (A bilan parallel)

**Har task TIER B, 10 bo'lim** (SPEC_SYSTEM §3: "UI ekran → TIER B"):
`Purpose · Scope · Non-goals · User flow · Architecture · Data model (o'zgarsa) ·
Permissions · Failure modes · Tests · DoD`.

**Har UI task uchun MAJBURIY holatlar jadvali** — quyidagi 7 holat har
ekranda alohida loyihalanadi va alohida tekshiriladi:

| Holat | Talab |
|---|---|
| Loading | Skeleton/indikator — layout siljimaydi (CLS) |
| Error — network | "Ulanish yo'q. Qayta urinish" + retry tugmasi |
| Error — validation | Maydon yonida, aniq nima noto'g'ri |
| Error — server | "Xatolik yuz berdi" + request-id (mavjud `request-id.ts`) |
| Bo'sh | Harakatga chorlovchi bo'sh holat — "hali yo'q, boshlang" |
| Muvaffaqiyat | Aniq tasdiq; amal nomi tugma nomi bilan bir xil |
| Qisman muvaffaqiyat | Nima bo'ldi / nima bo'lmadi ochiq ajratiladi |

**Umumiy taqiqlar (barcha UI tasklar):** default Tailwind ko'k tugma ·
generic gradient · stok ikon to'plamini aralashtirish · "AI startup
shabloni". **Referens (nusxa emas):** Linear (zichlik/klaviatura),
Stripe (hujjat ravshanligi), Vercel (holat aniqligi).

**i18n qoidasi (CLAUDE.md):** har yangi matn **bir vaqtda**
`locales/{en,ru,uz}.ts` ga — kalit to'plami aynan teng (bugun 861×3
`[MEASURED 2026-08-16]`).

---

### UI-1 — Dizayn tili asosi

**Demo-critical:** ✅ (DEMO MODE DoD) · **Bog'liq:** yo'q (birinchi UI task)

**1. Purpose.** Mavjud "LIQUID OBSIDIAN v4" (`globals.css`, 470 qator
`[MEASURED 2026-08-16]`) ni **tizimlashtirish**: yangi P0 ekranlari (trace,
approval, admin) uchun komponent asoslari — yangi dizayn o'ylab topish EMAS.

**2. Scope.** (a) Token auditi: mavjud `--vein-cyan`/`--vein-violet`/
`--cta-gold`/`--surface-*` tokenlarini P0 ekranlariga yetarliligini
tekshirish; yetishmagan **semantik** tokenlar (masalan `--risk-low/high/critical`,
`--state-running/blocked/approved`) qo'shish; (b) 6 bazaviy komponent
holat-to'plami: tugma (5 holat) · input (4) · kartochka · jadval qatori ·
status-belgi (risk tier ranglari) · toast; (c) tipografiya shkalasi
hujjatlashtirilishi (mavjud shriftlar asosida); (d) spacing ritmi (4px asos).

**3. Non-goals.** Light rejim (ataylab bekor qilingan — `globals.css` 16-qator).
Landing sahifa qayta dizayni. Storybook (`[BUDGET-BLOCKED]` emas, lekin vaqt —
oddiy `/design-system` ichki sahifa yetarli). Rebranding.

**4. User flow.** Muhandis (Claude Code) yangi ekran qurishda `/design-system`
sahifasidan komponent holatini ko'chiradi — har ekranda yangidan o'ylamaydi.

**5. Architecture.** `apps/web/src/components/ui/` (mavjud) kengaytiriladi;
yangi semantik tokenlar `globals.css` `@layer base` ga. Ichki
`/design-system` sahifa (faqat dev — prod build'dan chiqariladi yoki
`@Roles` ekvivalenti bilan yashiriladi).

**6. Data model.** O'zgarish yo'q.

**7. Permissions.** `/design-system` — faqat dev muhitida.

**8. Failure modes.** Token yetishmasa komponent **hardcode rang ishlatmaydi** —
token qo'shiladi (lint qoidasi: hex rang komponentda taqiqlanadi, faqat
`hsl(var(--...))`).

**9. Tests.** `/design-system` sahifasida dasturiy tekshiruv (§6.2 V1–V4):
har komponentning holatlari DOM'da mavjud va hisoblangan uslub bo'yicha
farqlanadi. Lint: `grep -rn "#[0-9a-fA-F]\{6\}" apps/web/src/components/ui` →
yangi qo'shilganlarda 0.

**10. DoD** — *holat: 2026-08-17 implementatsiyasidan keyin*
- [x] `cd apps/web && npx tsc --noEmit -p tsconfig.json` → **exit 0**
- [x] `cd apps/web && npx eslint src` → **0 error** (170 warning — baseline bilan bir xil; yangi fayllarda **0**)
- [x] `/design-system` ochiladi va **11 bo'lim** render bo'ladi (V2)
- [x] Konsol xatolari → **0** (V3)
- [x] Risk tier 4 ta alohida token + ijro holati 6 ta token — `grep -c "risk-\|state-" globals.css` → ≥ 10; hammasi sahifada hisoblangan qiymat bilan tasdiqlandi (V4)
- [x] Tiriklik shkalasi ishlaydi: `low` → `boxShadow: none`, `medium` → 1px qirra, `high` → qirra + porlash, `critical` → `animationName: heartbeat`
- [x] Komponentlarda hex rang yo'q — `grep -rn "#[0-9a-fA-F]\{6\}" src/components/ui` → **0**
- [x] **Kontrast (WCAG AA, qora fonda):** 12/12 token ≥ 4.5:1 — eng past `--state-waiting` **5.7:1**, eng yuqori `--foreground` **17.62:1**; yiqilgan **0**
- [ ] `MANUAL:` founder `/design-system` ni ko'rib chiqdi — **bloklovchi emas** (§6.2)

**Holatlar jadvali:** komponent darajasida (yuqoridagi 7 holat har komponentda).

---

### UI-2 — Onboarding → birinchi agent → birinchi xabar

**Demo-critical:** ✅✅ (§2.8 D5 — kafolatlangan happy path) · **Bog'liq:** UI-1

**1. Purpose.** TTV < 10 daqiqa (`[FROM-RESEARCH]` R3): ro'yxatdan o'tishdan
**birinchi muvaffaqiyatli natijagacha** to'siqsiz yo'l. Funnel'ning eng
yo'qotuvchi qadami — `FIRST AGENT → FIRST SUCCESS` (PRICING §4).

**2. Scope.** (a) Mavjud `(dashboard)/onboarding/page.tsx` auditi va qayta
qurish: 3 qadam — til → shablon tanlash (mavjud `templates/registry`) →
birinchi xabar; (b) **kafolatlangan happy path**: birinchi agent shablondan,
birinchi vazifa oldindan sinalgan LOW-risk ssenariy (konnektorsiz ham
ishlaydigan — free tier modeli bilan javob beradigan); (c) birinchi
muvaffaqiyatdan keyin "keyingi qadam" taklifi (konnektor ulash → UI-3);
(d) progress-indikator (qaysi qadamda turibdi).

**3. Non-goals.** Email-verifikatsiya oqimini o'zgartirish. Product tour
(mavjud `product-tour.tsx` qoladi). To'lov onboarding'i. TTV **o'lchovi**
(V3-P1, METRICS) — lekin `signup→first_success` event'lari **P0-13 orqali
yoziladi** (o'lchov keyin hisoblanadi).

**4. User flow.**
`Sign-up → onboarding/1 (til) → /2 (shablon; "eng mashhur" birinchi) →
/3 (birinchi xabar — tayyor promt taklifi bilan) → javob keladi →
"✓ Birinchi natija!" → keyingi qadam kartasi`.
Har qadamda "o'tkazib yuborish" bor (majburlash konversiyani o'ldiradi).

**5. Architecture.** Mavjud sahifa qayta ishlanadi; yangi route yo'q.
Shablon ro'yxati mavjud `templates/` API'dan. Birinchi xabar — mavjud chat
SSE yo'li. Agent yaratish — mavjud endpoint (trial agent mexanizmi bor —
`isTrialAgent`, `schema.prisma`).

**6. Data model.** O'zgarish yo'q (`User.onboardingCompleted` kabi maydon
bor-yo'qligi task spec'da aniqlanadi; bo'lmasa localStorage — migratsiyasiz).

**7. Permissions.** O'z ma'lumoti.

**8. Failure modes.** Free model band (5 model rotatsiyasi tugadi) →
**onboarding'ning eng yomon nuqtasi**: aniq xabar + "keyinroq qaytib
ko'ring" + yozilgan demo-natija KO'RSATILMAYDI (§2.6 — demo-mode taqiqi).
Shablon yuklashda xato → retry. Yarim qolgan onboarding → qaytganda davom.

**9. Tests.** E2E (Playwright yoki qo'lda skript): signup→birinchi javob
to'liq oqim. i18n: 3 til kaliti tengligi. Holatlar: 7 holat × 3 qadam.

> ### ⚠️ TUZATISH — ONBOARDING YANGI FOYDALANUVCHI UCHUN YIQILARDI
>
> Implementatsiya paytida aniqlandi va founder qarori bilan tuzatildi
> (2026-08-17):
>
> **Muammo:** yangi foydalanuvchining balansi **0** (`User.balanceTiyin`
> default). Generik narxlash yaratishni bepul qiladi (`priceForAgent` →
> `creationUsd: 0`), LEKIN **shablon o'rnatish katalog narxini aniq
> uzatadi** (`createUsd: 70`) → `agents.service.ts` balans talab qiladi →
> **402 `insufficient_balance`**.
>
> Ya'ni "shablondan boshlash" — UI-2 uchun kafolatlangan zaxira yo'l
> bo'lishi kerak bo'lgan yo'l — **birinchi qadamdayoq o'lardi**. Bu
> mavjud niyat bilan ham zid edi: platforma birinchi agentni allaqachon
> **sinov** deb belgilaydi (`isTrialAgent`, 3 kun / 20 xabar), lekin
> yaratish uchun $70 talab qilardi.
>
> **Qaror (founder):** birinchi agentning **yaratish narxi kechiriladi**.
> Sinov tugagach oddiy oylik rejim ishlaydi — daromad yo'qolmaydi, kechikadi.
>
> **Ijro tafsilotlari:**
> - `isFirstAgent` endi pul yechishdan **OLDIN** hisoblanadi
> - `Agent.creationPriceTiyin` HAQIQATAN yechilgan summani saqlaydi (0)
> - `CreditLedger` ga **yozilmaydi** — pul harakati bo'lmadi; 0 summali
>   no-op qator jurnalni ifloslantirardi (Konstitutsiya #17 pul
>   O'ZGARISHLARI haqida)
> - Kechirish fakti `AuditLog` da: `creationPriceTiyin` (katalog narxi),
>   `chargedCreationTiyin` (0) va `waivedReason: 'first_agent_trial'`
> - Ikkita mavjud test yangilandi (endi IKKINCHI agentni tekshiradi) +
>   ikkita yangi test qo'shildi (kechirish bor / yo'q)

**10. DoD** — *holat: 2026-08-17 implementatsiyasidan keyin*
- [x] `cd apps/api && npx tsc --noEmit` → **exit 0**; `npx eslint src` → **0 error**
- [x] `cd apps/api && npx jest src/agents` → **53/53 pass**
- [x] **Kechirish testi:** balansi 0 bo'lgan yangi foydalanuvchi $70 lik shablon
  bilan agent yaratadi → `user.updateMany` **chaqirilmaydi**, agent yaratiladi,
  `creationPriceTiyin = 0n`, ledger yozilmaydi
- [x] **Regressiya testi:** IKKINCHI agentda kechirish **yo'q** — narx yechiladi,
  `waivedReason` yozilmaydi
- [x] `cd apps/web && npx tsc --noEmit` → **exit 0**; `eslint` → **0 error**
- [x] `cd apps/web && npx next build` → **exit 0**, 37/37 sahifa
- [x] **3 qadamli progress** (`OnboardingSteps`) — uchinchi qadam ataylab
  "Tayyor" emas, **"Birinchi natija"**
- [x] **Oqim `/dashboard` da emas, BIRINCHI XABARDA tugaydi:** install'dan keyin
  `/agents/{id}?q=<starter>&onboarding=1` ga o'tiladi (chat `?q=` ni allaqachon o'qiydi)
- [x] **Kafolatlangan zaxira yo'l:** 1-qadamda "Shablondan boshlash" — LLM
  band/yiqilgan bo'lsa ham ishlaydi (§2.8 D5)
- [x] **Keyingi qadam kartasi:** faqat onboarding'dan kelganda va faqat
  BIRINCHI muvaffaqiyatli javobdan keyin (chegara holati va halal-blok
  muvaffaqiyat hisoblanmaydi) — PRICING §5: taklif qiymat ko'rsatilgandan keyin
- [x] **i18n 3 til:** 11 yangi kalit; parity → `uz=950 en=950 ru=950`, farq **0**
- [ ] `MANUAL:` soat bilan o'lchangan to'liq oqim (yangi akkaunt) < **10 daqiqa**
- [ ] `MANUAL:` kafolatlangan ssenariy **5 marta ketma-ket** (§2.8 D5)

**Holatlar jadvali:** 1-qadam (normal/loading/xato/halal-blok) · 2-qadam
(tavsiyalar/bo'sh tanlov/o'rnatish/xato) · 3-qadam chat'da (UI-4 va UI-5
holatlariga tayanadi).

---

### UI-3 — Konnektorni agentga biriktirish

**Demo-critical:** ✅✅ · **Bog'liq:** UI-1 (backend: **tayyor**, N6)

**1. Purpose.** Backend to'liq ishlaydigan imkoniyat (`connectors.service.ts:80`
`agentId` parametri, `toolSpecsForAgent`) UI'da **umuman yo'q** — foydalanuvchi
konnektorni agentga biriktira olmaydi. Bu — demo'ning markaziy kamchiligi.

**2. Scope.** (a) `connectors/page.tsx` ga: har konnektor kartasida "Qaysi
agentlar ishlatadi" ko'rinishi + "Agentga biriktirish" amali (umumiy `null`
yoki aniq agent); (b) `agents/[agentId]/settings/page.tsx` (84 qator —
deyarli bo'sh) ga "Konnektorlar" bo'limi: shu agentga ulangan + umumiy
konnektorlar ro'yxati, ulash/uzish; (c) risk tier belgisi har konnektorda
(P0-6 `riskTier` dan — UI-1 status-belgi komponenti).

**3. Non-goals.** Yangi konnektor turi. OAuth oqimlari. Konnektor
sozlamalari formasini qayta dizayn (mavjud qoladi). Approval UI (→ UI-4).

**4. User flow.** (A) Konnektorlar sahifasi: karta → "Biriktirish" →
agent tanlash (yoki "Barcha agentlar") → tasdiq → karta yangilanadi.
(B) Agent sozlamalari: "Konnektorlar" bo'limi → mavjudlar ro'yxati →
"+ Ulash" → konnektor tanlash → sozlash (mavjud forma) → ulandi.

**5. Architecture.** Mavjud BFF→API yo'li. `ConnectorConfig.agentId`
semantikasi UI'da **aynan** aks etadi: `null` = "barcha agentlar" (sahifaning
mavjud va'dasi — `schema.prisma:926` izohi), to'la = faqat shu agent.

**6. Data model.** O'zgarish yo'q (backend tayyor).

**7. Permissions.** O'z konnektori + o'z agenti (backend `assertOwnsAgent`
allaqachon tekshiradi, `:85`).

**8. Failure modes.** Agent ro'yxati bo'sh (→ "Avval agent yarating" +
havola). Biriktirish 404 (agent o'chirilgan) → aniq xabar + ro'yxat
yangilanadi. `needs_credentials` holati → sozlash formasi ochiladi.

**9. Tests.** Komponent testi yo'q (web'da test infra yo'q — bu **qabul
qilingan** holat); xatti-harakat **backend testlari** bilan qoplangan
(`connectors.service.spec.ts` — qamrov, IDOR, audit, agent nomlari).
UI tekshiruvi — §6.2 V1–V4.

> ### ⚠️ TUZATISH (2026-08-17, implementatsiya paytida aniqlandi)
>
> Blueprint bu taskni "**backend tayyor, faqat UI kerak**" deb yozgan edi.
> Bu **to'liq to'g'ri emas** — ikki backend kamchiligi topildi:
>
> 1. **`remove()` qamrovi buzuq edi.** U
>    `deleteMany({ userId, connectorId })` qilardi, ya'ni umumiy yozuvni
>    uzish BARCHA agentga-xos sozlamalarni ham **jimgina** o'chirardi.
>    "Uzish" oqimini shu holicha UI'ga chiqarish — ma'lumot yo'qotish
>    tugmasini foydalanuvchiga berish demak edi. Tuzatildi: qamrov endi
>    `agentId ?? null` bo'yicha aniq, va `?agentId=` query parametri
>    qo'shildi. Shu yo'lda **audit yozuvi ham yo'q edi** — qo'shildi.
> 2. **Katalog agent NOMLARINI qaytarmasdi** (faqat `attachedAgentIds`).
>    UI nomlarni topish uchun kursorli sahifalangan agentlar ro'yxatini
>    alohida so'rab, klient tomonda JOIN qilishi kerak bo'lardi — ko'p
>    agentli hisobda nom topilmay qolardi. Qo'shildi: `attachedAgents`
>    (`{id, name}[]`), o'z tenanti doirasida.
>
> **Xulosa:** "backend tayyor" degan baholash **konfiguratsiya yo'li** uchun
> to'g'ri edi (`configure(agentId)` haqiqatan ishlaydi), **uzish va
> ko'rsatish** yo'li uchun emas.

**10. DoD** — *holat: 2026-08-17 implementatsiyasidan keyin*
- [x] `cd apps/api && npx tsc --noEmit -p tsconfig.json` → **exit 0**
- [x] `cd apps/api && npx eslint src/connectors` → **0 error**
- [x] `cd apps/api && npx jest src/connectors` → **9/9 pass**
- [x] **Regressiya testi:** umumiy yozuvni uzish agentga-xos sozlamalarga tegmaydi
- [x] **IDOR:** begona agentni uzish → `NotFoundException`, `deleteMany` **chaqirilmaydi**
- [x] Audit: `connector.remove` yozuvi `{connectorId, agentId, removed}` bilan
- [x] Katalog `attachedAgents` ni **o'z tenanti** doirasida qaytaradi; anonim katalogda agent so'rovi **umuman qilinmaydi**
- [x] `cd apps/web && npx tsc --noEmit -p tsconfig.json` → **exit 0**
- [x] `cd apps/web && npx eslint <o'zgargan fayllar>` → **0 error**
- [x] **i18n 3 til:** 20 yangi kalit; parity skripti → `uz=878 en=878 ru=878`, farq **0**
- [x] Konnektor kartasida: risk tier belgisi · biriktirilgan agent nomlari · bo'sh holat
- [x] Konfiguratsiya panelida agent tanlagich (`Barcha agentlar` / aniq agent) + qamrov izohi
- [x] Agent sozlamalarida "Konnektorlar" bo'limi — agentga-xos va umumiy **ajratilgan**
- [ ] `MANUAL:` to'liq oqim jonli sessiyada: konnektor ulash → agentga biriktirish →
  chat'da o'sha agent tool'ni ko'radi → boshqa agent **ko'rmaydi**
  *(kirish sessiyasi talab qiladi — bajarilmadi)*

**Qolgan qarz:** risk tier hozir **klient tomonda** hisoblanadi
(`apps/web/src/lib/connector-risk.ts`, SAFETY_POLICY_LAYER §3.2 dan
ko'chirilgan). P0-6 backend `riskTier` maydonini bergach o'sha fayl
**o'chiriladi** — `connectorRiskTier()` allaqachon backend qiymatini
ustun deb qabul qiladi.

**Holatlar jadvali:** 2 ekran × 7 holat.

---

### UI-4 — Chat + tool ijrosi ko'rinishi

**Demo-critical:** ✅✅ (§2.8 D6 — zaxira reja shu sahifada) · **Bog'liq:** UI-1, P0-13, P0-7, P0-6

**1. Purpose.** Foydalanuvchi agent **nima qilayotganini jonli** ko'rsin va
`HIGH` amalni **shu yerda** tasdiqlasин. §2.3 event'lariga bog'lanadi —
**alohida frontend mantiq yozilmaydi** (event turi → ko'rinish, xolos).

**2. Scope.** (a) Chat oqimida qadam-kartalari: `TOOL_SELECTED` → "🔧 …",
`TOOL_STARTED/RESULT/FAILED`, `POLICY_CHECK` (bloklangan bo'lsa sabab),
`RETRY_STARTED` ("2-urinish…"); (b) **approval kartasi**: `APPROVAL_REQUIRED`
→ AYNAN nima yuborilishi (qabul qiluvchi, matn preview) + Tasdiqlash /
Rad etish / **Tahrirlash** (P0-6 `modified` — moat!); (c) run yakuni:
davomiylik + qadam soni; (d) tugagan ijro uchun trace ko'rinishi
(`GET /runs/:id` — P0-7): qadamlar, dalillar (P0-10 evidence), vaqtlar;
(e) STOP tugmasi (kill switch — P0-6) chat sarlavhasida.

**3. Non-goals.** Reliability score UI (→ V3-P2 P2.1). Trace eksporti.
Admin trace ko'rinishi (→ UI-7). To'liq 4-tier approval UI (→ V3-P2 P2.3 —
P0 da `LOW`/`HIGH` yetarli).

**4. User flow.** Xabar yuboriladi → qadam-kartalari jonli paydo bo'ladi
(SSE `GET /runs/:id/stream`) → approval kerak bo'lsa oqim **to'xtaydi**,
karta chiqadi → qaror → davom → yakun kartasi → "Nima qildi?" havolasi
to'liq trace'ga.

**5. Architecture.** Mavjud `chat-interface.tsx` (SSE naqshi bor —
`rate_limit` `:128`) kengaytiriladi: yangi event turlari `switch` ga
qo'shiladi. Trace sahifa: `(dashboard)/agents/[agentId]/runs/[runId]`
(yangi route — feature freeze A39 buzilmaydi: bu **yangi vertikal emas**,
mavjud agent sahifasining qatlami, MASTER_ROADMAP §11 `Observe` bosqichi).

**6. Data model.** O'zgarish yo'q (P0-7 o'qish API).

**7. Permissions.** Run egasi (BFF orqali, P0-13 SSE auth).

**8. Failure modes.** SSE uzildi → `?after=seq` bilan qayta ulanish
(P0-13); ulanib bo'lmasa polling. `seq` teshigi → "ba'zi qadamlar
yozilmadi" belgisi (taxmin yo'q). Approval timeout (15 daq) → karta
"muddati o'tdi" holatiga.

**9. Tests.** Event→ko'rinish mapping funksiyasi sof TS — API repo'sidagi
test naqshiga ko'chirilishi mumkin bo'lgan qism minimal saqlanadi (web'da
test infra yo'q). Qo'lda: 8 event turi × ko'rinish.

**10. DoD** — *holat: 2026-08-17 implementatsiyasidan keyin*

**Bajarilgan — (a), (c), (d) + ijro yo'lini busga ULASH:**
- [x] `cd apps/api && npx tsc --noEmit` → **exit 0**; `npx eslint src` → **0 error**
- [x] `cd apps/api && npx jest src/events src/agents` → **93/93 pass** (8 suite)
- [x] `cd apps/web && npx tsc --noEmit` → **exit 0**; `eslint` → **0 error**
- [x] `cd apps/web && npx next build` → **exit 0**, `/agents/[agentId]/runs/[runId]` kompilyatsiya bo'ldi
- [x] **Engine → kanonik tarjima** (`execution-trace-tap.ts`): `tool_result`+`calling` → `TOOL_STARTED`,
  natija → `TOOL_RESULT`, `halal_block`/`halal_warning`/`replace`/`compliance_flag` → **`POLICY_CHECK`**
  (halal filtr allaqachon policy qarori), birinchi `token` → `MODEL_STARTED` (keyingilari **yo'q** — shovqin bo'lmasin)
- [x] Run yakuni: `done` → `RUN_COMPLETED`; `error` → `RUN_FAILED`;
  **`done`siz uzilish → `RUN_FAILED`**; mijoz uzilsa → `RUN_CANCELLED` (abadiy `RUNNING` qolmaydi)
- [x] **Oqim buzilmaydi:** baytlar o'zgarmasdan o'tadi (test bilan), yaroqsiz JSON va
  `bus.emit` throw'i chat'ni to'xtatmaydi
- [x] `runId` oqimning birinchi hodisasi (`{type:"run"}`); BFF `agentId` ni uzatadi; API **egalikni tekshiradi** (IDOR)
- [x] Jonli qadam-kartalari chatda (`useRunEvents` — SSE + `?after=` bilan teshik to'ldirish)
- [x] Trace sahifasi: holat · davomiylik · qadam soni · narx + **to'liq** zanjir
- [x] `seq` teshigi bo'lsa UI **ochiq aytadi** ("ba'zi qadamlar yozilmagan") — taxmin qilmaydi
- [x] **i18n 3 til:** 31 yangi kalit; parity → `uz=922 en=922 ru=922`, farq **0**
- [ ] `MANUAL:` jonli sessiyada qadamlar ko'rinishi (kirish talab qiladi)

**(b) approval kartasi va (e) STOP — P0-6 dan KEYIN yopildi (2026-08-17):**
- [x] **Approval kartasi** (`components/chat/approval-card.tsx`): **Tasdiqlash /
  Tahrirlash / Rad etish**. Uchinchi tugma ⭐ — `ApprovalEvent.modifiedAction`
  ga yoziladi (SAFETY §8 moat); uni "rad etish" ga qo'shib yuborish
  taqiqlangan
- [x] **AYNAN nima yuboriladi to'liq ko'rsatiladi** (`proposedAction` JSON'i) —
  qisqartirilmaydi; ko'r-ko'rona tasdiq HITL qatlamini bezakka aylantirardi
- [x] Tahrirlash: JSON tahriri, yaroqsiz JSON → **maydon yonida xato**
  (modal/toast emas — UI-1 qoidasi)
- [x] Karta hal qilinganda holatini ko'rsatadi (`APPROVED`/`REJECTED`/`MODIFIED`)
- [x] Tasdiq kutayotgan karta **oqim tugagandan keyin ham qoladi** — P0-6 amalni
  bloklaydi va ijro to'xtaydi, karta `isStreaming` bilan yo'qolsa foydalanuvchi
  tasdiqlash imkonini umuman ko'rmasdi
- [x] Bir necha tasdiq so'rovi `stepId` bo'yicha ajratiladi (aralashib ketmaydi)
- [x] **STOP tugmasi** — yuborish tugmasi yonida (header'da emas: ijro davomida
  e'tibor o'sha yerda), `POST /agents/:id/kill` chaqiradi, ijro tugagach yo'qoladi
- [x] **`ApprovalService.request()` ijro yo'liga ULANDI** — quyidagi tuzatishga qarang
- [x] `cd apps/api && npx jest src/policy src/events src/connectors src/agents src/automation src/app.module.spec.ts`
  → **227/227 pass** (16 suite, 0 regressiya)
- [x] `cd apps/web && npx tsc --noEmit && npx next build` → **exit 0**, 37/37 sahifa
- [x] **i18n 3 til:** 17 yangi kalit; parity → `uz=939 en=939 ru=939`, farq **0**
- [ ] `MANUAL:` uchdan-uchgacha jonli sessiyada (`MODIFIED` bilan) — kirish talab qiladi

> ### ⚠️ TUZATISH — `ApprovalService.request()` NI HECH KIM CHAQIRMASDI
>
> P0-6 tugagach aniqlandi: `ApprovalService.request()` yozilgan va
> `APPROVAL_REQUIRED` hodisasini yuboradi, lekin **chaqiruv nuqtasi yo'q
> edi**. Policy darvozasi amalni bloklardi va auditga yozardi, biroq
> `ApprovalEvent` YARATMASDI — ya'ni approval kartasi chatda **hech qachon
> chiqmasdi** va HITL qatlami amalda mavjud bo'lmasdi.
>
> Ulandi: `policyGate` endi `requiresApproval` bo'lganda so'rov yozadi.
>
> **Qolgan bo'g'in:** `ApprovalEvent.runId` majburiy, lekin engine
> `/connectors/internal/invoke` chaqiruvida `runId` **uzatmaydi**. Vaqtinchalik
> ko'prik sifatida `resolveActiveRunId()` qo'shildi — u **faqat AYNAN BITTA**
> `RUNNING` ijro bo'lganda uni tanlaydi; nol yoki bir nechta bo'lsa `null`
> (taxminiy tanlov tasdiqni BOSHQA ijroga bog'lab qo'yardi). To'g'ri yechim —
> engine `runId` ni uzatishi (Python tomonidagi o'zgarish, alohida task).
>
> Ikkala holatda ham **amal BLOKLANADI** — G0.5 ta'sirlanmaydi.

**Holatlar jadvali:** chat qadam-kartasi 6 holat (running/waiting/blocked/
success/failed/cancelled — UI-1 tokenlari) + trace sahifa 4 holat
(yuklanmoqda / xato / bo'sh / ma'lumotli).

---

### UI-5 — Balans / to'lov / limit holatlari

**Demo-critical:** ✅ (demo'da limit ko'rinishi mumkin) · **Bog'liq:** UI-1

**1. Purpose.** `{type:"rate_limit"}` — generic error emas, **aniq va
do'stona** holat. Upgrade — **qiymat bilan** sotiladi, limit bilan emas
(PRICING §5 jadvali — aynan shu qoidalar).

**2. Scope.** (a) Chat'dagi `rate_limit` ko'rinishini qayta ishlash:
"Bugungi 10 bepul xabar tugadi. Ertaga davom etadi — yoki Pro bilan
cheklovsiz" (+ bugungi natija eslatmasi bo'lsa — ko'rsatiladi);
(b) balans ko'rinishi (mavjud billing sahifasi auditi): joriy balans,
oxirgi amallar (`CreditLedger` dan); (c) `insufficient_balance` (402) holati:
qancha yetishmayapti + to'ldirish yo'li; (d) agent `frozen` holati kartada:
sabab (`AgentFrozenReason`) + yechim; (e) PRICING §5 taqiqlari tekshiruvi:
ishni **to'xtatuvchi** upsell modal YO'Q.

**3. Non-goals.** Narx o'zgarishi (C3 qoidasi). Besh tier UI (→ V3-P1).
To'lov provayder oqimlari o'zgarishi. Free tier §8bis oshkorasi sahifasi
(V3-P1 gate — lekin matn tayyorlansa zarar yo'q, task spec qaroriga).

**4. User flow.** Limit → tushunarli karta (ish yo'qolmaydi, kirish
o'chmaydi) → ertaga hisoblagich yangilanadi. 402 → to'ldirish → qaytish →
xabar qayta yuboriladi (matn saqlangan).

**5. Architecture.** Mavjud SSE `rate_limit` va 402 yo'llari; faqat
ko'rinish qatlami. Balans — mavjud endpoint.

> ### ⚠️ TUZATISH (2026-08-17, implementatsiya paytida aniqlandi)
>
> *"Faqat ko'rinish qatlami"* — **noto'g'ri**. BFF'da xulq xatosi topildi:
> API muzlatilgan agent uchun **402** va aniq sabab qaytaradi
> (`agents.service.ts` `frozenErrorPayload` → `reason: 'agent_frozen' |
> 'trial_expired'`), lekin `apps/web/src/app/api/chat/stream/route.ts`
> uni umumiy `!upstream.ok` shoxiga tushirib **`"Agent engine xatosi"`**
> deb yuborardi va `postRefund("engine_error")` yozardi.
>
> Ya'ni foydalanuvchi *"agentingiz muzlatilgan, oylik to'lov kerak"*
> o'rniga *"texnik nosozlik"* ko'rardi — bu UI-5 ning butun maqsadiga zid
> va refund sababi ham noto'g'ri qayd etilardi. Tuzatildi: 402 alohida
> shoxda, `type: "agent_frozen" | "insufficient_balance"` SSE hodisasi
> bilan; refund sababi `payment_required`.

**6. Data model.** O'zgarish yo'q.

**7. Permissions.** O'z ma'lumoti.

**8. Failure modes.** Balans yuklanmadi → skeleton + retry (raqam o'rniga
"—", **noto'g'ri raqam emas**). Ledger bo'sh → bo'sh holat.

**9. Tests.** §6.2 V1–V4 (web'da unit test infra yo'q — bu ataylab).

**10. DoD** — *holat: 2026-08-17 implementatsiyasidan keyin*
- [x] `cd apps/web && npx tsc --noEmit -p tsconfig.json` → **exit 0**
- [x] `cd apps/web && npx eslint <o'zgargan fayllar>` → **0 error**
- [x] `cd apps/web && npx next build` → **exit 0**, 37/37 sahifa
- [x] `rate_limit` endi matn pufagi EMAS — o'z kartochkasi (`LimitNotice`);
  kunlik va **global** cap ajratilgan (global — foydalanuvchining aybi emas,
  shuning uchun u shoxda upgrade taklifi **ko'rsatilmaydi**)
- [x] Kunlik limitda aniq raqam: "{limit} tadan {used} tasi ishlatildi" (`/usage/me` dan)
- [x] `insufficient_balance` kartochkasi balans va xabar narxini **ko'rsatadi** (`/billing/me` dan)
- [x] To'ldirish tugmasi mavjud dialogni ochadi (`openTopup()`, `useToastStore` naqshi) va summani ≥10 xabarga yetadigan qilib oldindan to'ldiradi
- [x] **402 `agent_frozen`/`trial_expired`** endi "Agent engine xatosi" emas — o'z kartochkasi va o'z sababi (BFF tuzatishi, §5)
- [x] Chegara holatida bo'sh "assistant" xabari **saqlanmaydi** (`persistExchange` o'tkazib yuboriladi)
- [x] **PRICING §5 taqiqlari:** chatda ishni to'xtatuvchi modal **yo'q** (kartochka oqim ichida) — `grep "Dialog\|fixed inset-0" src/components/chat` → **0**
- [x] Matn tekshiruvi: "limitingiz tugadi / Pro oling" uslubidagi jumla → **0 moslik**
- [x] **i18n 3 til:** 13 yangi kalit; parity → `uz=891 en=891 ru=891`, farq **0**
- [ ] ~~Balans sahifasida oxirgi amallar (`CreditLedger`)~~ — ⚠️ **BAJARILMADI**:
  `/billing/ledger` endpointi **mavjud emas**, uni qo'shish backend scope'i.
  Demo qiymati past (limit holatlari yuqori) — ochiq qarz sifatida qoldirildi.
- [ ] `MANUAL:` jonli sessiyada uchala holat ko'rsatilishi (kirish talab qiladi)

**Holatlar jadvali:** 4 kontekst (chat-limit kunlik, chat-limit global,
402 balans, 402 frozen) — har biri alohida sarlavha, matn va amal bilan;
`LimitNotice` da bitta `NoticeShell` orqali bir xil tuzilma.

---

### UI-6 — Admin Control Plane qobig'i

**Demo-critical:** ❌ · **Bog'liq:** UI-1 (ENGINEERING MODE)

**1. Purpose.** Admin — CRUD emas, **Control Plane**: 6 domen
(System · Business · Agents · Safety · Economy · Data), oqim
`SIGNAL → INVESTIGATION → DECISION → ACTION → AUDIT` (MASTER_ROADMAP §10).

**2. Scope.** (a) `(admin)` route guruhini 6 domenli navigatsiyaga
qayta tashkil qilish (mavjud 3 sahifa — audit/feedback/users — mos
domenlarga joylashadi: users→Business, audit→Safety, feedback→Business);
(b) har domen uchun qobiq-sahifa: signal kartalari (yuqorida) + bo'lim
ro'yxati; (c) umumiy admin-layout: domen navigatsiyasi, global qidiruv
o'rni (stub emas — yo'q bo'lsa ko'rsatilmaydi).

**3. Non-goals.** Har domenning to'liq ichki sahifalari (UI-7/UI-8 va
V3-P1+). Yangi admin endpointlar (mavjudlar bilan). Business domeni
to'ldirilishi (ma'lumot manbalari V3-P1).

**4. User flow.** Admin kiradi → 6 domen → har birida signal xulosasi
(masalan Safety: "3 policy blok bugun") → domenga kirib tekshiradi →
amal (masalan kill) → amal `AuditLog` da.

**5. Architecture.** `(admin)/admin/layout.tsx` yangilanadi; mavjud
sahifalar ko'chirilmaydi (URL saqlanadi), faqat navigatsiya qatlami.
Contract §6 route'lari **o'zgarmaydi** (MASTER_ROADMAP §10 sharti).

**6. Data model.** O'zgarish yo'q.

**7. Permissions.** Mavjud `@Roles` + SEC-11 2FA (avtomatik). UI faqat
rol bor bo'lganda ko'rsatadi (server tekshiruvi allaqachon bor).

**8. Failure modes.** Signal manbai javob bermasa → domen kartasi "signal
yuklanmadi" (boshqa domenlar ishlaydi — blast radius UI'da ham).

**9. Tests.** §6.2 V1–V4.

**10. DoD (ENGINEERING MODE — §6.2):**
- [ ] `cd apps/web && npx tsc --noEmit && npx eslint src` → toza
- [ ] 6 domen navigatsiyasi + har domen qobig'i render bo'ladi; kontrast,
  overflow va mobil breakpoint tekshiruvlari o'tadi (§6.2 V4)
- [ ] Mavjud 3 admin sahifa eski URL'da ishlaydi (regressiya)
- [ ] i18n 3 til

**Holatlar jadvali:** domen qobig'i × 7 holat.

---

### UI-7 — Admin: System + Agents + Safety

**Demo-critical:** ⚠️ (D4 — global kill ko'rsatilishi mumkin) · **Bog'liq:** UI-6, P0-1, P0-6, P0-7, P0-13

**1. Purpose.** Uch domenning ishchi sahifalari: infratuzilma signallari
(queue/worker), agent ijrolari, xavfsizlik boshqaruvi (policy/kill).

**2. Scope.**
- **System:** queue depth + failed/stalled (P0-1 `/health/queue`), worker
  heartbeat (P0-2), cron reliability (P0-4), so'nggi deploy;
- **Agents:** ijrolar ro'yxati (`/admin/runs` — P0-7), yiqilganlar filtri,
  run trace admin ko'rinishi;
- **Safety:** policy bloklari ro'yxati, approval statistikasi
  (approval/override rate — METRICS §2.2), har agent kill/resume tugmasi,
  **global kill** (dual confirmation — P0-6), konnektor limit urilishlari.

**3. Non-goals.** Business/Economy/Data to'ldirilishi (→ UI-8 va V3-P1).
Grafik kutubxona qo'shish (raqam + jadval yetarli; chart → V3-P1).
Alert konfiguratsiya UI (env'da qoladi).

**4. User flow (Safety misoli).** Signal: "policy blok 3× oshdi" →
Investigation: bloklar ro'yxati → bitta agentdan → Decision → Action:
kill → Audit: `AuditLog` yozuvi ko'rinadi.

**5. Architecture.** Ma'lumot — faqat P0 API'lari (`/admin/runs`,
`/health/queue`, approval/policy so'rovlari). Jonli yangilanish: oddiy
polling 30 s (SSE admin uchun keyin).

**6. Data model.** O'zgarish yo'q.

**7. Permissions.** `@Roles(OWNER, ADMIN)` + 2FA. Global kill — faqat OWNER.

**8. Failure modes.** Queue health 503 → System sahifasi buni **signal**
sifatida ko'rsatadi (xato sahifasi emas — bu aynan ish holati). Kill
tugmasi ikki marta bosilishi → idempotent (`204`).

**9. Tests.** §6.2 V1–V4; kill oqimi backend testi bilan qoplangan
(P0-6 G0.4).

**10. DoD (ENGINEERING MODE):**
- [ ] `cd apps/web && npx tsc --noEmit && npx eslint src` → toza
- [ ] 3 domen sahifasi × (ma'lumotli + bo'sh + xato) DOM'da tekshiriladi
- [ ] `MANUAL:` admin panelidan agent kill → chat'dagi faol ijro to'xtadi
  (uchdan-uchgacha)
- [ ] Global kill dual confirmation: bitta bosishda **ishlamaydi** (DOM asserti)
- [ ] i18n 3 til

**Holatlar jadvali:** 3 sahifa × 7 holat.

---

### UI-8 — Admin: Economy + Data

**Demo-critical:** ⚠️ ("bizga qancha turadi" savoliga raqam — kuchli demo lavha) · **Bog'liq:** UI-6, **P0-5** (qattiq bog'liq)

**1. Purpose.** Metering (P0-5) ma'lumotini ko'rinadigan qilish: token
sarfi, model taqsimoti, internal cost, **gross margin** (G0.2 raqami shu
yerda yashaydi).

**2. Scope.**
- **Economy:** kunlik token in/out, model bo'yicha taqsimot, internal cost
  (tiyin), flat-narx daromadi bilan taqqoslash → marja; eng qimmat 10
  foydalanuvchi/agent (`@admin-scope`);
- **Data:** `UsageEvent` qamrovi (G0.1 metrikasi — `metering_coverage_pct`),
  trace hajmi, retention holati (P0-15 oxirgi ijro).

**3. Non-goals.** Narx boshqaruvi UI. Prognoz/trend chizmalari (V3-P1).
Foydalanuvchiga narx ko'rsatish (G1.6 — V3-P1). Eksport.

**4. User flow.** Ochiladi → bugungi/7 kunlik raqamlar → model bo'yicha
jadval → marja raqami (qizil bo'lsa ham — **raqam bor**, bu G0.2 ning
butun maqsadi).

**5. Architecture.** `GET /admin/economy/margin` va usage yig'ma
so'rovlari (P0-5). Grafik yo'q — raqam kartalari + jadvallar (UI-1
komponentlari).

**6. Data model.** O'zgarish yo'q.

**7. Permissions.** `@Roles(OWNER, ADMIN)` + 2FA. ⚠️ marja — tijorat siri,
faqat shu yerda.

**8. Failure modes.** Metering hali ma'lumot yig'magan (birinchi kunlar) →
bo'sh holat: "Ma'lumot yig'ilmoqda — birinchi raqamlar 24 soatda".
`unknown_model` yozuvlari → alohida qator (yashirilmaydi).

**9. Tests.** §6.2 V1–V4; API testlari P0-5 da.

**10. DoD (ENGINEERING MODE):**
- [ ] `cd apps/web && npx tsc --noEmit && npx eslint src` → toza
- [ ] Economy (raqamli) · Data · bo'sh holatlari DOM'da tekshiriladi
- [ ] Marja raqami sahifada ko'rinadi va SQL bilan solishtirilganda mos
  (`MANUAL`, ±1 tiyin)
- [ ] i18n 3 til

**Holatlar jadvali:** 2 sahifa × 7 holat.

---

### UI-9 — Responsive / mobil

**Demo-critical:** ⚠️ (taqdimotda telefon ko'rsatilishi mumkin) · **Bog'liq:** UI-1…UI-5 (ularning ekranlariga qo'llanadi)

**1. Purpose.** 90 ta `use client` fayl `[MEASURED 2026-08-16]` bo'ylab
asosiy oqimlar (onboarding, chat, konnektorlar, balans) **375px** da to'liq
ishlashi. (Repo tarixida telefon-siljish tuzatishlari bo'lgan — `git log`
`5659a78` — bu ish davom ettiriladi, noldan emas.)

**2. Scope.** (a) 4 asosiy oqim × 3 breakpoint (375 / 768 / 1280) auditi;
(b) topilgan buzilishlar tuzatilishi (gorizontal siljish, kesilgan matn,
bosib bo'lmaydigan nishonlar < 44px); (c) sidebar mobil xulqi tekshiruvi;
(d) approval kartasi (UI-4) mobilda to'liq ishlashi — **demo'da telefon
tasdig'i eng ta'sirli lavha**.

**3. Non-goals.** Mobil ilova (demand gate — MASTER_ROADMAP §14). Admin
sahifalarining mobil optimizatsiyasi (desktop-first — admin telefonda
ishlamaydi degani emas, buzilmasa yetarli). PWA.

**4. User flow.** O'zgarmaydi — kichik ekranda ham ishlaydi.

**5. Architecture.** Mavjud Tailwind breakpoint'lari; yangi kutubxona yo'q.

**6. Data model.** O'zgarish yo'q.

**7. Permissions.** O'zgarish yo'q.

**8. Failure modes.** — (vizual task).

**9. Tests.** 3 breakpoint × 4 oqim uchun gorizontal overflow tekshiruvi
(`document.body.scrollWidth <= window.innerWidth`) + kesilgan matn asserti.

**10. DoD (ENGINEERING MODE):**
- [ ] 4 oqim × 3 breakpoint = **12 tekshiruv**, har birida overflow **yo'q**
- [ ] Overflow skripti 375px da 4 oqimda → 0 buzilish
- [ ] Bosish nishonlari ≥ 44×44 px (approval tugmalari tekshirilgan)
- [ ] `cd apps/web && npx tsc --noEmit && npx eslint src` → toza

**Holatlar jadvali:** qo'llanmaydi (kesib o'tuvchi vizual task) — buning
o'rniga 12 breakpoint-tekshiruvi majburiy.

---

### UI-10 — Accessibility minimum

**Demo-critical:** ❌ · **Bog'liq:** UI-1…UI-5

**1. Purpose.** Minimal A11y poli: kontrast · klaviatura · aria-label ·
reduced-motion. Dark-only "Liquid Obsidian" da kontrast — asosiy xavf
(`--muted-foreground` 58% lightness qora fonda tekshirilishi shart).

**2. Scope.** (a) Kontrast auditi: matn tokenlari WCAG AA (4.5:1 oddiy,
3:1 katta matn) — ayniqsa `--muted-foreground`, `--vein-cyan` matn
sifatida ishlatilgan joylar; (b) klaviatura: chat yuborish, approval
qarori, konnektor biriktirish — sichqonchasiz to'liq; fokus halqasi
ko'rinadi (`--ring` mavjud); (c) `aria-label` interaktiv ikonkalarda
(STOP, tahrirlash…); (d) `prefers-reduced-motion` — "60bpm nafas" va
venalar animatsiyasi o'chadi (globals.css qonuni 4 bilan ziddiyat —
reduced-motion **ustun**).

**3. Non-goals.** To'liq WCAG AAA. Screen-reader to'liq auditi (V3-P1+).
Light rejim.

**4–7.** O'zgarish yo'q (kesib o'tuvchi).

**8. Failure modes.** Token kontrastdan o'tmasa — token **tuziladi**
(UI-1 ga qaytariladi), komponent emas.

**9. Tests.** Avto: axe-core yoki Lighthouse a11y skan 4 asosiy sahifada.
Qo'lda: klaviatura oqimi.

**10. DoD (ENGINEERING MODE):**
- [ ] Lighthouse a11y ball ≥ **90** 4 sahifada (onboarding, chat,
  konnektorlar, balans) — hisobot saqlanadi
- [ ] `prefers-reduced-motion: reduce` da doimiy animatsiya **0** (CSS
  media query grep + vizual)
- [ ] Klaviatura: approval qarori Tab+Enter bilan to'liq (`MANUAL`)
- [ ] `grep -c "aria-label" apps/web/src` → task boshidagidan **oshgan**
  (bazaviy son task spec'da qayd etiladi)

**Holatlar jadvali:** qo'llanmaydi (kesib o'tuvchi).

---

### UI-11 — Bundle va tezlik

**Demo-critical:** ⚠️ (demo sekin ochilsa — birinchi taassurot) · **Bog'liq:** yo'q (parallel)

**1. Purpose.** `three` + `@react-three/*` + `gsap` + `lottie-react` +
`framer-motion` (N7 `[MEASURED 2026-08-16]`) **faqat landing'da** yuklansin —
dashboard foydalanuvchisi ularni to'lamasin.

**2. Scope.** (a) Bundle tahlili (`next build` hisobot yoki
`@next/bundle-analyzer` dev-dep); (b) `three`/`gsap`/`lottie` importlari
qayerda — `dynamic(import, {ssr:false})` bilan faqat landing route'ga;
(c) dashboard birinchi yuklanish JS byudjeti: `[CALIBRATE]` bazaviy
o'lchovdan keyin maqsad — **kamida −30%** landing-kutubxonalar hisobidan;
(d) route-level code splitting tekshiruvi.

**3. Non-goals.** Kutubxonalarni almashtirish/o'chirish (landing ularni
ishlatadi — dizayn qarori saqlanadi). RSC-ga o'tkazish (Contract Phase 8 —
"use client" kamaytirish u yerda). Rasm optimizatsiyasi (alohida).

**4–7.** O'zgarish yo'q.

**8. Failure modes.** Dynamic import xato bersa landing bo'limi bo'sh —
fallback skeleton beriladi.

**9. Tests.** `next build` route jadvalidagi First Load JS raqamlari —
oldin/keyin task spec'ga yoziladi.

**10. DoD (ENGINEERING MODE):**
- [ ] `cd apps/web && npx next build` → xatosiz; route jadvali saqlanadi
- [ ] Dashboard route'larining First Load JS'ida `three`/`gsap`/`lottie`
  chunk'lari **yo'q** (build hisobot tahlili)
- [ ] `grep -rn "from ['\"]three\|from ['\"]gsap\|lottie" apps/web/src --include=*.tsx | grep -v "hero\|three/\|landing"` → 0 (barcha og'ir import landing/hero komponentlarida)
- [ ] Oldin/keyin raqamlar task spec'da (`[CALIBRATE]` → `[MEASURED]`)

**Holatlar jadvali:** qo'llanmaydi.

---

## 5. DEPENDENCY GRAPH

Kod holatiga qarab aniqlashtirilgan (brifdagi taxminiy grafdan **farqlari**
pastda izohlangan):

```
                    ┌─────────────────────────────────────────────────────┐
                    │  PARALLEL START (bog'liqsiz, birinchi kundan):      │
                    │  P0-3 Allowlist · P0-5 Metering · P0-9 Broker ·     │
                    │  P0-11 Deploy · P0-4 Cron lock · UI-1 Dizayn        │
                    └─────────────────────────────────────────────────────┘

P0-13 Event Bus ──┬──▶ P0-7 Trace ──▶ P0-6 Policy+Kill ──▶ P0-10 Verify ──▶ P0-14 Eval Gate
                  │         │                 ▲
                  │         └── P0-5 Metering─┘ (cost event'lari busga yoziladi;
                  │                              P0-5 mustaqil BOSHLANADI, event
                  │                              integratsiyasi P0-13 dan keyin)
                  ▼
            UI-4 Chat/Trace

P0-1 Queue ──▶ P0-2 Browser Worker ──▶ (P0-3 allowlist worker'ga KO'CHADI)
                  │
                  └──▶ P0-12 Device Layer (BrowserTarget P0-2 ga tayanadi;
                                           qolgan qismi mustaqil)

P0-8 Checkpoint  ──▶ (P0-6 approval-pauza undan foydalanadi — yumshoq bog'liqlik:
                      P0-6 checkpointsiz ham ishlaydi, resume'siz qayta boshlash bilan)

P0-15 Governance ──▶ P0-7 dan keyin (jadvallar paydo bo'lgach)

UI-1 ──▶ UI-2 · UI-3 · UI-5 · UI-6 (parallel)
UI-6 ──▶ UI-7 (P0-6/P0-7 API tayyor bo'lgach) · UI-8 (P0-5 tayyor bo'lgach)
UI-4 ──▶ P0-13 + P0-7 + P0-6 API'lariga bog'liq
UI-9 · UI-10 ──▶ UI-2…UI-5 ekranlari mavjud bo'lgach
UI-11 ──▶ bog'liqsiz (istalgan payt)
```

**Brifdagi taxminiy grafdan farqlar (sabab bilan):**

| Brif | Bu blueprint | Sabab |
|---|---|---|
| `P0-2 → P0-3` (worker allowlist'dan oldin) | **P0-3 mustaqil boshlanadi** | `context.route()` ilgagi API'dagi `browser-bridge.ts:118` da allaqachon bor (N3). SEC-07 — yagona ochiq Critical; uni 8-ED worker taskiga bog'lash — kechiktirish. P0-2 tayyor bo'lgach filtr worker'ga **ko'chadi** |
| `P0-7 → P0-6` (trace policy'dan oldin) | Saqlanadi, lekin **P0-13 birinchi** | Event bus — yozuv mexanizmi; trace uning doimiy qatlami (§2.3.2). P0-6 `POLICY_CHECK`/`APPROVAL_*` event'lari busga yozadi |
| P0-8 to'liq parallel | **Yumshoq bog'liqlik P0-6 ga** | Approval-pauza checkpoint'siz "qayta boshlash" bilan ishlaydi (yomon UX, lekin ishlaydi); checkpoint bilan "shu joydan davom" bo'ladi |
| P0-12 parallel | **P0-2 ga qisman bog'liq** | `BrowserTarget` P0-2 `BrowserRunner` interfeysiga tayanadi; pairing-isbot qismi mustaqil |

---

## 6. DEFINITION OF DONE QOIDALARI

### 6.1 Backend (Qism A)

Har DoD band — **buyruq + kutilgan natija** (SPEC_SYSTEM §4). Nasr
taqiqlanadi. Mashinada tekshirilmaydigan band `MANUAL:` prefiksi bilan va
verification sessiyasida **inson** tasdiqlaydi. Har task verification —
**yangi sessiyada** (SPEC_SYSTEM §6.1), natija `docs/verification/<task>-verification.md`.

### 6.2 UI — DASTURIY TEKSHIRUV

> ⚠️ **O'ZGARTIRILDI (2026-08-17, founder qarori).** Bu bo'lim ilgari
> "DEMO MODE / ENGINEERING MODE" ikki rejimini va **skrinshot majburiyatini**
> belgilagan edi. **Skrinshot olish butunlay bekor qilindi** — hech bir UI
> task uchun skrinshot talab qilinmaydi va olinmaydi.
>
> **O'rniga: jonli sahifada bajariladigan dasturiy tekshiruv.** Bu — zaifroq
> emas, **kuchliroq** dalil: skrinshot "shunday ko'rinadi" deydi, DOM va
> hisoblangan uslub tekshiruvi esa "aynan shu token, aynan shu holat, aynan
> shu qiymat" deydi va u **takrorlanadi**.

Har UI task uchun **majburiy to'rt qadam**:

| # | Qadam | Buyruq / usul | O'tish sharti |
|---|---|---|---|
| V1 | Statik | `cd apps/web && npx tsc --noEmit -p tsconfig.json` · `npx eslint src` | exit 0 · **0 error** |
| V2 | Sahifa ko'tariladi | dev server (`.claude/launch.json` → `web-preview`, port 3100) + sahifaga o'tish | sahifa `200`, kutilgan `h1` mavjud |
| V3 | Konsol toza | brauzer konsoli o'qiladi | **0 error** |
| V4 | Holat assertlari | sahifada JS bilan DOM + `getComputedStyle` tekshiruvi | har band uchun kutilgan qiymat |

**V4 — nima aynan tekshiriladi** (task DoD'ida har biri alohida band):

- **Har holat mavjud va farqlanadi:** loading · error (network/validation/server)
  · bo'sh · muvaffaqiyat · qisman — har biri DOM'da topiladi va bir-biridan
  ajraladigan atribut/klass bilan keladi.
- **Token qoidasi:** komponentda hex/hsl yozilmagan —
  `grep -rn "#[0-9a-fA-F]\{6\}"` tegishli papkada **0**.
- **Rang haqiqatan tokendan keladi:** `getComputedStyle(el).color` kutilgan
  token qiymatiga mos.
- **Kontrast:** matn/fon nisbati **≥ 4.5:1** (oddiy matn), **≥ 3:1** (katta).
- **Overflow yo'q:** `document.body.scrollWidth <= window.innerWidth`
  — **375 / 768 / 1280** uchlovida.
- **Kesilgan matn:** uzun qiymatli qatorlarda `truncate` ishlaydi
  (`scrollWidth > clientWidth` bo'lgan element `text-overflow: ellipsis` bilan).
- **Klaviatura:** bosiladigan element `tabIndex` va `role` bilan; Enter/Space
  ishlaydi.
- **Reduced-motion:** `prefers-reduced-motion: reduce` da doimiy animatsiya
  **0** va holat farqi **saqlanadi** (harakatsiz ham ajraladi).

**Founder tasdig'i:** bloklovchi **emas**. Ish V1–V4 o'tgach yopiladi;
founder xohlagan paytda `/design-system` va tegishli ekranni o'zi ochib
ko'radi. Ilgari bu yerda turgan *"founder tasdiqlaguncha keyingi task
boshlanmaydi"* qoidasi **bekor** — u solo founder uchun ijro to'sig'iga
aylanardi (SPEC_SYSTEM §10 ogohlantirishi).

⚠️ **"Ko'rinishidan yaxshi" yozish HAMON TAQIQLANADI.** Dalil — V1–V4
natijalari; taassurot dalil emas.

### 6.3 Umumiy gate

Har task yopilishida: `git status` — faqat kutilgan fayllar ·
`npx tsc --noEmit` (tegishli app) · `npx eslint src` · tegishli testlar.
FAIL → keyingi taskka o'tilmaydi (SPEC_SYSTEM §6.4); qabul qilingan qarz —
faqat `DECISION_LOG.md` yozuvi bilan.

---

## 7. P1+ GA ATAYLAB KECHIKTIRILGANLAR

Jimgina tashlab ketilmaydi — ochiq ro'yxat:

| Element | Nega P0 emas | Qachon | Manba |
|---|---|---|---|
| To'liq eval harness (ball, taksonomiya, ≥50 vazifa) | P0 da minimal exit gate (P0-14) yetarli; vazifa korpusi P0 failure'laridan chiqadi | **V3-P1** | ADR-028, G1.2 |
| To'liq data lifecycle (GDPR export, o'ng-unutilish oqimi) | P0 da retention + redaction + kaskad (P0-15) yetarli | **V3-P1** | ADR-030 |
| Agent/tool versiyalash | Eski ijrolar buzilmasligi muhim, lekin ijro hajmi hali kichik — migratsiya arzon | **V3-P1** | — |
| To'liq ADB / Android integratsiyasi | Real qurilma + SDK + companion-android kerak (A23: bo'sh papka taqiqi) | **V3-P1** | ADR-011 |
| MCP implementatsiyasi | Chegara sharti P0 da (§2.9), implementatsiya distribution bosqichida | **V3-P2** | ADR-029 |
| pgvector / long-term memory | ADR-027; checkpoint (P0-8) ≠ memory — chalkashtirilmaydi | **V3-P1/P2** | ADR-027 |
| Murakkab feature flag tizimi (A/B, foizli rollout) | P0 da env-flag minimal yetarli (§2.7) | **V3-P1** | — |
| Incident response playbook (agent noto'g'ri ish qilsa) | Mavjud `docs/runbooks/` kengaytiriladi; agent-maxsus playbook trace ma'lumotini talab qiladi | **V3-P1** | — |
| `MEDIUM`/`CRITICAL` tier to'liq majburlanishi | P0 da LOW/HIGH; 4 tier V3-P2 (SAFETY §2.2) | **V3-P2** | SAFETY_POLICY_LAYER |
| Approval flow to'liq UI (guruh, org) | P0 da inline karta (UI-4) yetarli | **V3-P2 / V3-P4** | P2.3 |
| Trace UI foydalanuvchi uchun to'liq sahna | P0 da run sahifasi (UI-4); boy vizual V3-P2 | **V3-P2** | P2.2 |
| Contract §6.5 xavfli-amal to'liq oqimi | CLAUDE.md: birinchi xavfli endpoint **oqim bilan birga** keladi — P0-6 global kill shu qoidaga bo'ysunadi: agar §6.5 oqimi hali yo'q bo'lsa, global kill **minimal dual-confirmation** bilan chiqadi va §6.5 oqimi bilan almashtirilishi task spec'da qayd etiladi | **Contract P4 tartibida** | CLAUDE.md |

---

## 8. YAKUNIY JADVAL

**Hajm birligi:** S < 0.5 kun · M = 0.5–1.5 kun · L = 2–4 kun (solo founder + Claude Code).

| ID | Nomi | Qism | Bog'liq | Demo-critical? | [BUDGET-BLOCKED]? | Hajm |
|---|---|---|---|---|---|---|
| P0-1 | BullMQ queue | A | — | ❌ | ❌ | M |
| P0-2 | Browser worker | A | P0-1 | ⚠️ shartli | ✅ **HA** (~$7+/oy instans) | L |
| P0-3 | SEC-07 allowlist | A | — | ✅ | ❌ | M |
| P0-4 | Cron lock | A | — | ❌ | ❌ | S |
| P0-5 | Metering | A | — (event integratsiyasi: P0-13) | ⚠️ | ❌ | L |
| P0-6 | Policy + kill switch | A | P0-13, P0-7 | ✅ | ❌ | L |
| P0-7 | Trace + approval log | A | P0-13 | ✅ | ❌ | L |
| P0-8 | Checkpoint | A | — (yumshoq: P0-6) | ❌ | ❌ | M |
| P0-9 | Secret broker | A | — | ❌ | ❌ | M |
| P0-10 | Verify + retry | A | P0-6 | ⚠️ | ❌ | M |
| P0-11 | Deploy reliability | A | — | ⚠️ | ⚠️ qisman (staging) | S–M |
| P0-12 | Device layer | A | qisman P0-2 | ❌ | ❌ | M |
| P0-13 | Event bus | A | — | ✅ | ❌ | M |
| P0-14 | Eval gate | A | P0-6, P0-7, P0-13 | ✅ | ❌ | M |
| P0-15 | Data governance | A | P0-7 | ❌ | ❌ | S–M |
| UI-1 | Dizayn tili | B | — | ✅ | ❌ | M |
| UI-2 | Onboarding | B | UI-1 | ✅✅ | ❌ | M |
| UI-3 | Konnektor biriktirish | B | UI-1 | ✅✅ | ❌ | M |
| UI-4 | Chat + tool ijrosi | B | UI-1, P0-13, P0-7, P0-6 | ✅✅ | ❌ | L |
| UI-5 | Balans/limit | B | UI-1 | ✅ | ❌ | S–M |
| UI-6 | Admin qobiq | B | UI-1 | ❌ | ❌ | M |
| UI-7 | Admin S+A+S | B | UI-6, P0-1/6/7 | ⚠️ | ❌ | M |
| UI-8 | Admin E+D | B | UI-6, P0-5 | ⚠️ | ❌ | S–M |
| UI-9 | Responsive | B | UI-2…5 | ⚠️ | ❌ | M |
| UI-10 | A11y | B | UI-2…5 | ❌ | ❌ | S |
| UI-11 | Bundle | B | — | ⚠️ | ❌ | S |

**Jami: 15 backend + 11 UI = 26 task.**

### 8.1 — 1 OYLIK MUKOFOT YO'LI (demo-critical to'plam)

Maqsad: §2.8 safe demo path **to'liq ishlaydigan** holatga kelishi.
Taxdiqiy ketma-ketlik (haftalar — mo'ljal, muqaddas emas):

```
1-hafta:  UI-1 (dizayn poydevori) ∥ P0-3 (allowlist — demo D2) ∥ P0-13 (event bus)
2-hafta:  P0-7 (trace) → P0-6 (policy+kill — demo D4) ∥ UI-3 (konnektor biriktirish)
3-hafta:  UI-4 (chat+tool+approval — demo markazi) ∥ UI-2 (onboarding/happy path — D5)
          ∥ P0-5 boshlanadi (UI-8 uchun)
4-hafta:  P0-14 (eval gate — demo ssenariysi 5× barqaror) ∥ UI-5 (limit holatlari)
          ∥ UI-9 (telefon ko'rinishi) ∥ demo mashqi + D6 zaxira yozuvi
```

**Bu yo'lga KIRMAYDI** (1 oyda): P0-2 (worker — `[BUDGET-BLOCKED]` va demo
brauzersiz ham kuchli: konnektor + approval + kill + trace), P0-8, P0-9,
P0-12, P0-15, UI-6/7/8 (UI-8 faqat P0-5 ulgursa — "marja raqami" lavhasi
bonus), UI-10, UI-11.

⚠️ **Agar brauzer lavhasi demo'ga majburiy deb qaror qilinsa** — P0-1+P0-2
2-haftaga kiradi va P0-5 4-haftaga suriladi; bu **founder qarori**
(byudjet + vaqt almashinuvi).

### 8.2 — TO'LIQ P0 YO'LI (mukofotdan keyin)

```
5–6-hafta:  P0-1 → P0-2 (worker, [BUDGET] qarori bilan) ∥ P0-9 (broker) ∥ P0-4 (cron)
7-hafta:    P0-10 (verify) ∥ P0-8 (checkpoint) ∥ P0-11 (deploy) ∥ UI-6 → UI-7
8-hafta:    P0-5 yakuni + UI-8 ∥ P0-12 (device) ∥ P0-15 (governance) ∥ UI-10, UI-11
Yakun:      V3-P0 EXIT GATE tekshiruvi (G0.1–G0.7) → P0_RETRO.md → V3-P1 blueprint
```

**EXIT GATE xaritasi:** G0.1/G0.2 → P0-5 · G0.3/G0.4/G0.5 → P0-6 ·
G0.6 → P0-7 · G0.7 → P0-4. Gate'lar MASTER_ROADMAP V3-P0 jadvalidan —
bu yerda **takrorlanmaydi**, faqat qaysi task yopishi ko'rsatildi.

---

## 9. YAKUNIY TEKSHIRUV (o'z-o'zini baholash)

| # | Savol | Holat |
|---|---|---|
| 1 | §2 dagi 9 kesib o'tuvchi bo'lim to'liqmi? | ✅ §2.1–§2.9 |
| 2 | Idempotency jadvali har yon-ta'sirli toifani qamraydimi? | ✅ §2.2 — 7 toifa, jumladan davlat-hujjat (retry YO'Q) |
| 3 | Verification policy toifaga qarab ajratilganmi? | ✅ §2.4 — 9 toifa, har birida dalil+usul+retry |
| 4 | Policy engine kirishlari 8 o'lchovmi? | ✅ P0-6 §5 — actor/agent/tool/target/data/action/context/scope; `gmail.read` vs `gmail.send×10` misoli bilan |
| 5 | "Model hech qachon xom sirni ko'rmaydi" aniq yozilganmi? | ✅ P0-9 §8 — besh-joy taqiqi + besh-joy testi |
| 6 | Event sxemasi UI+trace+admin uchun yagona manbami? | ✅ §2.3.2 + P0-13 — iste'molchilar o'z jadvalini yaratmaydi |
| 7 | P0-14 eval gate P0 exit sharti sifatida yozilganmi? | ✅ P0-14 §10 FM: suite qizil → keyingi task yo'q; §8.2 exit tartibida |
| 8 | Har A-task TIER A 16 bo'limmi? | ✅ 15/15 task × 16 bo'lim (20→16 farqi §0.2 da ochiq asoslangan) |
| 9 | UI DoD tekshiriladigan shaklda yozilganmi? | ✅ §6.2 — **dasturiy tekshiruv V1–V4**. ⚠️ 2026-08-17: ikki rejim (DEMO/ENGINEERING) va skrinshot majburiyati **bekor qilindi** (founder qarori) |
| 10 | §7 kechiktirilganlar ochiqmi? | ✅ 12 qator, sabab + muddat + manba bilan |
| 11 | Baseline qayta o'lchandimi, farqlar ko'rsatildimi? | ✅ §1 — 15 o'lchov; 3 farq (§1.1 cron 7≠8, §1.2 lock 2/7, §1.3 BullMQ o'lik dep) |
| 12 | Browserbase RAD ETILGANmi? | ✅ P0-2 boshidagi ogohlantirish — ADR-010 kuchda, ADR-026 PROPOSED, kod yozilmaydi |
| 13 | Safe demo path aniq va bajariladimi? | ✅ §2.8 D1–D8 — har biri aniq qiymat va task bog'lanishi bilan |
| 14 | Fayl:qator ishoralar haqiqiymi? | ✅ Hammasi shu sessiyada grep/read bilan olingan (`browser-bridge.ts:118`, `schema.prisma:932`, `connectors.service.ts:80`, `agent_engine.py:256`, `package.json:28`…) |
| 15 | `git status` — faqat bitta yangi fayl? | ✅ Faqat `docs/blueprints/P0_BLUEPRINT.md` (hisobotda tasdiqlanadi) |

**Ochiq qolgan nomuvofiqliklar (halol ro'yxat):**

1. TIER A 20→16 bo'lim farqi — §0.2 da asoslangan, `DECISION_LOG.md` ga
   yozuv **kerak** (bu blueprint boshqa faylga tegmaydi — yozuvni keyingi
   sessiya/founder qo'shadi).
2. Cron 8→7 farqi ham DECISION_LOG'ga yozilishi kerak (ayni sabab).
3. §6.5 xavfli-amal oqimi va global kill tangligi — §7 oxirgi qatorida
   ochiq; P0-6 task spec'ida yakuniy qaror talab qilinadi.
4. `current-state-2026-08-13.md` dagi "8 cron" raqami muzlatilgan snapshot
   sifatida **ataylab tuzatilmaydi** (§1.1).




