# AgentNet — Engineering Contract (Muhandislik Shartnomasi)

**Status:** BINDING. Bu hujjat `docs/ARCHITECTURAL_AUDIT.md` dan keyingi **yagona ijro hujjati**.
**Sana:** 2026-08-02 · **Muallif:** Principal Architect · **Versiya:** 1.0 (FROZEN)
**Amal qilish doirasi:** loyihaning qolgan barcha implementatsiyasi.
**O'zgartirish tartibi:** faqat yangi ADR orqali (`docs/adr/NNNN-*.md`), eski ADR `SUPERSEDED` deb belgilanadi. Kod bilan ADR ziddiyati — kod noto'g'ri.

**Jamoa farazi (barcha baholar shunga asoslangan):** 1 muhandis + AI-agent juftligi, ~5 samarali muhandislik-kuni/hafta. "Engineering day (ED)" = 1 to'liq fokuslangan ish kuni.

---

# 1. Executive Decision

**Arxitektura tubdan to'g'rimi? — HA.**
Uch servisli ajratish (Next.js BFF · NestJS modular monolit · FastAPI AI engine) to'g'ri chegaralar bo'ylab kesilgan: UI/sessiya, tranzaksion biznes mantiq, LLM orkestratsiyasi. Pul yo'llari atomik, sirlar bitta nuqtada shifrlanadi, engine hech qachon ommaviy emas, egalik-scoping izchil. Bu — qayta yozishga arzimaydigan poydevor. **Muammo dizaynda emas, ijro-muhitida (runtime) farazlarida.**

**Global SaaS'ga chiqa oladimi? — HA, lekin faqat bitta sinf o'zgarish bilan.**
Bugungi kod **bitta jarayon** borligini uch joyda jimgina faraz qiladi: Chromium API jarayonining ichida, `interrupts`/`pending` in-memory, Throttler in-memory, cron leader'siz. Bu — 100 foydalanuvchida ko'rinmaydi, 10 000 da xizmatni o'ldiradi. Monolit **muammo emas** (Shopify/GitHub monolitda global). Stateful in-process ish — muammo. Uni ajratish ~3 sprintlik ish, qayta yozish emas.

**HECH QACHON o'zgarmasligi kerak (arxitektura yadrosi):**
1. **Prepaid, chaqiruvdan-oldin-atomik yechish** modeli (`updateMany + WHERE balance >= amount`). Platforma egasi hech qachon o'z cho'ntagidan LLM to'lamaydi — bu biznes modelining fizikasi.
2. **BFF + httpOnly sessiya izolyatsiyasi.** Brauzer JS hech qachon tokenni ko'rmaydi; brauzer NestJS'ga to'g'ridan-to'g'ri bormaydi.
3. **Engine hech qachon ommaviy emas** — har chaqiruvda ichki token, prod'da fail-closed.
4. **At-rest shifrlash yagona nuqtadan** (`CryptoService`) — yangi sir turi avtomatik qamraladi.
5. **Egalik-scoped so'rovlar** (`where: { id, userId }`) — IDOR'ga qarshi asosiy mudofaa.
6. **Hash-zanjirli AuditLog** — huquqiy/ishonch qatlami.
7. **Halal filtr yadro qatlami sifatida** — mahsulotning differensiatsiyasi, opsiya emas.
8. **uz/ru/en uchligi** — har UI matni uchala tilda. Bu bozor shartnomasi.
9. **Postgres — yagona haqiqat manbai.** Ikkinchi tranzaksion DB kiritilmaydi.
10. **LLM-first + deterministik fallback** naqshi (engine) — kalitsiz/uzilishda mahsulot ishlaydi.

**MAJBURIY o'zgarishi kerak (aks holda global SaaS bo'lolmaydi):**
1. **CI `master`da ishlasin** — hozir 253 test hech qachon avtomatik tekshirilmagan. Bularsiz qolgan hamma narsa tekshirilmagan taxmin.
2. **RBAC guard sifatida** — hozir bitta inline `if`. Admin panel busiz qurilsa, ma'lumot sizishi vaqt masalasi.
3. **Pagination shartnomasi** — 54 `findMany`, 0 kursor. Admin panel busiz qurilsa, keyin butunlay qayta yoziladi.
4. **Stateful ishni jarayondan chiqarish** — brauzer worker'ga, throttler/lock Redis'ga, cron leader-lock ostiga.
5. **Token-asosli billing** — flat 500 so'm/xabar og'ir agentlarda zarar keltiradi; birlik-iqtisod noto'g'ri.
6. **Pul ustunlari `Int` → `BigInt`** — `Int` shifti 21.4 mln so'm (~$1.7k). Biznes hamyoni uchun bu real shift.
7. **`Conversation.messages Json` → `Message` jadvali** — O(n) yozish va admin/analitika ko'r nuqtasi.
8. **Companion pairing** — autentifikatsiyasiz 6-xonali kod qurilma-boshqaruv tokenini beradi.

**Bir jumlada:** *Poydevor to'g'ri qurilgan, lekin bitta serverga mixlangan va avtorizatsiya qatlamisiz. Uchta narsani (CI, RBAC+pagination, stateful ishni ajratish) tuzatmaguncha yangi feature yozilmaydi.*

---

# 2. Freeze the Architecture

Har qaror: **Current → Decision → Reason → Risk → Migration Cost → Status**.
Status: `KEEP` (tegilmaydi) · `MODIFY` (saqlanadi, o'zgartiriladi) · `REMOVE` (olib tashlanadi).

### A. Platforma va topologiya

**A1. Monorepo (Turborepo + npm workspaces)**
Current: `apps/{web,api,agent-engine}` + `packages/`.
Decision: **KEEP**. Turbo task grafigi, yagona lock-fayl, atomik cross-servis commitlar.
Rad etildi: Nx (migratsiya narxi foydadan katta), poly-repo (3 servis 1 muhandis uchun sinxronizatsiya do'zaxi).
Risk: past. Migration: 0. **Status: KEEP**

**A2. Uch servisli ajratish (web / api / engine)**
Current: BFF Next.js, NestJS API, FastAPI engine.
Decision: **KEEP**. Python AI ekotizimi (LangGraph, CV) va TypeScript biznes mantiqi turli reliz sikliga ega; ularni birlashtirish har ikkalasini ham sekinlashtiradi.
Rad etildi: engine'ni Node'ga ko'chirish (LangGraph/CV yo'qoladi), hammasini bitta Python'ga (Prisma/Nest ekotizimi yo'qoladi).
Risk: past. Migration: 0. **Status: KEEP**

**A3. NestJS modular monolit**
Current: 27 modul, bitta deploy.
Decision: **KEEP — mikroservislarga bo'linmaydi.** 1 muhandisda mikroservis = tarqoq tranzaksiya + 5× operatsion yuk. Monolit 1M foydalanuvchigacha yetadi (§8).
Rad etildi: mikroservislar (erta optimallashtirish), serverless funksiyalar (Prisma cold-start + uzoq SSE).
Risk: past. Migration: 0. **Status: KEEP**

**A4. BFF proxy + httpOnly sessiya**
Current: `middleware.ts` `/api/backend/*` rewrite, token JS'ga ko'rinmaydi.
Decision: **KEEP**. Sinfiy to'g'ri yechim.
Risk: past. Migration: 0. **Status: KEEP**

**A5. Engine ichki-token auth**
Current: `x-internal-token`, prod fail-closed, yagona axios interceptor.
Decision: **KEEP** + Render private networking qo'shiladi (engine `type: pserv`, ommaviy URL'siz).
Rad etildi: mTLS (sertifikat boshqaruvi 1 muhandisga ortiqcha), JWT-per-call (foyda yo'q).
Risk: past. Migration: 0.5 ED. **Status: KEEP**

### B. Auth va avtorizatsiya

**A6. Autentifikatsiya (o'z HS256 JWT + OTP + TOTP)**
Current: 30 kunlik imzolangan JWT, revocation yo'q.
Decision: **MODIFY** — `User.tokenVersion Int @default(0)` qo'shiladi, JWT payload'da `tv`, `AuthGuard` mos kelmasa rad etadi. Logout/parol-tiklash/qurilma-o'chirish `tokenVersion++`. TTL 30 kun → **7 kun** + jimgina yangilanish (`/api/session/refresh`).
Rad etildi: Clerk'ga qaytish (mahalliy OTP/SMS oqimi va narx sabab), refresh-token jadvali (bitta `tokenVersion` 95% foydani 5% murakkablikda beradi).
Risk: o'rta (barcha sessiyalar bir marta bekor bo'ladi). Migration: 2 ED. **Status: MODIFY**

**A7. Clerk qoldiqlari**
Current: `@clerk/nextjs`, `@clerk/backend`, webhook controller, `clerkId @unique`, `.env` kalitlari — login uchun ishlatilmaydi.
Decision: **REMOVE** — paketlar, webhook, sign-in/sign-up catch-all yo'llari o'chiriladi. `clerkId` ustuni **saqlanadi**, lekin `String? @unique` ga aylantiriladi (tarixiy ma'lumot).
Reason: o'lik auth kodi — eng xavfli kod turi; kimdir uni qayta yoqishi mumkin.
Risk: past. Migration: 1 ED. **Status: REMOVE**

**A8. Avtorizatsiya / RBAC**
Current: `User.role` maydoni + 1 ta inline `if`.
Decision: **MODIFY** — `@Roles()` dekoratori + `RolesGuard` + `PolicyService`. Rollar: `OWNER > ADMIN > SUPPORT > MEMBER > VIEWER` (`SUPPORT` yangi — impersonation/o'qish uchun). Global `APP_GUARD` sifatida ro'yxatdan o'tadi; dekoratorsiz endpoint **default = MEMBER**.
Rad etildi: CASL/policy-engine (over-engineering), har controller'da qo'lda if (hozirgi holat — takrorlanadi va unutiladi).
Risk: past. Migration: 3 ED. **Status: MODIFY**

**A9. Ijara-scoping (tenant scoping)**
Current: har service qo'lda `where: { userId: user.id }`.
Decision: **MODIFY** — `ScopedQuery` helper + ESLint qoidasi: `prisma.<model>.findMany` `where` ichida `userId`/`ownerId`/`adminScope: true` bo'lishi shart. Admin cross-tenant o'qish **faqat** `AdminQueryService` orqali.
Rad etildi: Prisma middleware bilan avtomatik scoping (jim xatolar, admin yo'llari bilan konflikt), RLS (Postgres row-level security — Prisma connection-per-user talab qiladi, pool bilan mos emas).
Risk: o'rta. Migration: 3 ED. **Status: MODIFY**

### C. Ma'lumotlar

**A10. Postgres yagona manba**
Decision: **KEEP**. Ikkinchi tranzaksion DB (Mongo/Dynamo) kiritilmaydi.
Risk: past. Migration: 0. **Status: KEEP**

**A11. Prisma + service ichida so'rovlar (Repository qatlamisiz)**
Current: 38 service to'g'ridan-to'g'ri Prisma bilan.
Decision: **KEEP** — Repository qatlami kiritilmaydi. Buning o'rniga **qat'iy qoida**: Prisma faqat `*.service.ts` ichida (controller/guard/util'da taqiqlanadi, ESLint bilan majburlanadi).
Rad etildi: to'liq Repository/UnitOfWork (38 service × boilerplate, Prisma allaqachon repository).
Risk: past. Migration: 1 ED (ESLint qoidasi). **Status: KEEP**

**A12. `Conversation.messages Json`**
Decision: **MODIFY** → `Message` jadvali (`id, conversationId, role, content, halalFlag, tokensIn, tokensOut, createdAt`, `@@index([conversationId, createdAt])`). Ikki bosqichli migratsiya: dual-write → backfill → o'qishni ko'chirish → ustunni o'chirish.
Rad etildi: JSONB + GIN indeks (yozish baribir O(n)), alohida saqlash (Postgres yetarli).
Risk: yuqori (jonli ma'lumot). Migration: 5 ED. **Status: MODIFY**

**A13. Pul turlari (`Int` tiyin)**
Decision: **MODIFY** → `BigInt` (`balanceTiyin`, `CreditLedger.amount/balanceAfter`, `CreatorLedger`, `Payout`, `*Transaction.amountTiyin`, `Agent.*PriceTiyin`). Prisma `BigInt` → API'da string sifatida serializatsiya (`BigInt.prototype.toJSON` global patch + DTO).
Reason: `Int` shifti 21.4 mln so'm — B2B hamyon uchun real chegara.
Rad etildi: `Decimal` (float xavfi yo'q, lekin tiyin butun son — BigInt sodda va tez).
Risk: o'rta (serializatsiya). Migration: 3 ED. **Status: MODIFY**

**A14. Enum'lar (`String` holatlar)**
Decision: **MODIFY** → Prisma `enum` (`UserRole`, `AgentStatus`, `PaymentPurpose`, `CommandKind`, `CommandStatus`, `LedgerKind`, `FeedbackStatus`, `PlatformPlan`, `DeviceCategory`). Har biri migratsiyada `USING` bilan konvertatsiya.
Rad etildi: CHECK constraint (Prisma tip xavfsizligini bermaydi), string qoldirish (typo'lar admin filtrlarini buzadi).
Risk: o'rta. Migration: 3 ED. **Status: MODIFY**

**A15. `deletedAt` soft delete**
Current: mavjud, hech qayerda filtrlanmaydi.
Decision: **REMOVE** ustunni; GDPR hard-delete + `AuditLog` yozuvi yagona yo'l.
Rad etildi: soft-delete'ni to'liq joriy etish (har so'rovga filtr = unutilgan filtr = ma'lumot sizishi).
Risk: past. Migration: 1 ED. **Status: REMOVE**

**A16. cuid identifikatorlari**
Decision: **KEEP**. UUIDv7'ga o'tish foydasi yo'q; cuid sortlanadi va taxmin qilinmaydi.
Risk: past. Migration: 0. **Status: KEEP**

**A17. AuditLog hash-zanjiri + global advisory lock**
Decision: **MODIFY** — zanjir saqlanadi, lekin lock **global** (`4771`) dan **per-actor** (`hashtext(actorId)`) ga o'tadi; zanjir per-actor bo'ladi (`prevHash` shu actor bo'yicha oxirgi yozuv).
Reason: global lock — butun platformadagi har audit yozuvi uchun navbat. Per-actor zanjir bir xil isbot-kuchini beradi.
Rad etildi: zanjirni butunlay olib tashlash (ishonch xususiyati yo'qoladi), append-only tashqi log (narx).
Risk: o'rta (migratsiyada zanjir qayta hisoblanadi). Migration: 2 ED. **Status: MODIFY**

**A18. Pagination**
Current: yo'q.
Decision: **MODIFY** → majburiy **kursorli** pagination shartnomasi: `?limit=<=100&cursor=<id>` → `{ items, nextCursor, hasMore }`. `PageQueryDto` + `paginate()` helper. Offset pagination taqiqlanadi.
Rad etildi: offset/`skip` (chuqur sahifada sekin, jonli ma'lumotda dublikat).
Risk: past. Migration: 5 ED (barcha ro'yxatlar). **Status: MODIFY**

### D. Ijro-muhiti (runtime)

**A19. Redis**
Current: yo'q (ataylab olib tashlangan).
Decision: **MODIFY → QAYTARILADI**, lekin faqat **uch aniq maqsad uchun**: (1) Throttler store, (2) cron/lider taqsimlangan lock, (3) BullMQ backend. **Kesh sifatida ishlatilmaydi** (kesh — keyingi bosqich, alohida ADR bilan).
Rad etildi: Postgres advisory-lock'ni throttler sifatida ishlatish (DB'ga ortiqcha yuk), stateless qolish (limit×N instans).
Risk: past (yangi bog'liqlik). Migration: 2 ED. **Status: MODIFY**

**A20. Navbat (queue)**
Current: yo'q; hamma narsa sinxron HTTP.
Decision: **ADD → BullMQ** (Redis ustida). Navbatga chiqadigan ishlar: brauzer-run, companion computer-use loop, kamera vision, oylik billing sikli, brifing, goals/competitor cron, GDPR eksport.
Rad etildi: pg-boss (Postgres'ga yana yuk), SQS/Cloud Tasks (vendor lock + narx), Temporal (og'ir).
Risk: o'rta. Migration: 3 ED (infra) + har ish uchun 1-2 ED. **Status: ADD**

**A21. Brauzer avtomatlashtirish**
Current: Chromium NestJS API jarayonining ichida; konkurentlik cheklovisiz.
Decision: **MODIFY** → alohida `apps/browser-worker` servisi (BullMQ consumer, o'z Docker image'i, playwright bazasi). API faqat ish yaratadi va SSE orqali progress'ni Redis pub/sub'dan uzatadi. Har worker `MAX_CONCURRENT_RUNS=2`.
Rad etildi: Browserless/Browserbase (oylik narx + sessiya cookie'lari uchinchi tomonga chiqadi — bizning eng maxfiy ma'lumotimiz), API'da semaphore (API OOM'da butun platforma o'ladi).
Risk: yuqori (yangi servis). Migration: 8 ED. **Status: MODIFY**

**A22. Headful login-capture (`LoginCapture`, `headless:false`)**
Current: serverda ko'rinadigan brauzer ochadi — hosted muhitda **ishlamaydi**.
Decision: **REMOVE**. O'rniga: (1) qisqa muddatda — konnektorlar (API-birinchi, `CapabilityRouter` allaqachon shuni qiladi), (2) o'rta muddatda — brauzer-kengaytma orqali sessiya eksporti (foydalanuvchi mashinasida), (3) companion.
Reason: prod'da displey yo'q; feature marketingda bor-u ishlamaydi — bu eng yomon holat.
Risk: past (funksiya jonli ishlatilmaydi). Migration: 1 ED (olib tashlash + UI'da halol xabar). **Status: REMOVE**

**A23. Companion ilovalari**
Current: desktop `companion.mjs` (nut-js stub), Android — faqat README.
Decision: **MODIFY** — desktop companion **saqlanadi va mustahkamlanadi** (pairing TTL, urinish limiti, tokenni rotatsiya, kvota, versiya-tekshiruv). `apps/companion-android` **REMOVE** (bo'sh papka repo'da yolg'on va'da).
Risk: o'rta (xavfsizlik yuzasi). Migration: 4 ED. **Status: MODIFY / REMOVE**

**A24. Cron (`@nestjs/schedule` in-process)**
Decision: **MODIFY** — har cron ishi Redis lock (`SET NX PX`) ostida; keyin BullMQ repeatable job'ga ko'chiriladi.
Rad etildi: tashqi scheduler (Render cron job — alohida konteyner narxi), hozirgicha qoldirish (ko'p instansda ikki marta yozib olish = ikki marta pul yechish).
Risk: **yuqori** (billing cron'i ikki marta ishlashi mumkin). Migration: 2 ED. **Status: MODIFY**

**A25. Fayl saqlash (qo'ng'iroq yozuvlari base64 DB'da)**
Decision: **MODIFY** → Cloudflare R2 (S3-mos). DB faqat `objectKey` + `encryptedDataKey` saqlaydi (envelope shifrlash: `CryptoService` data-key'ni shifrlaydi, obyekt R2'da shifrlangan).
Rad etildi: DB'da qoldirish (satr hajmi, backup shishishi, TOAST), Render disk (bitta instansga bog'lanadi).
Risk: o'rta. Migration: 3 ED. **Status: MODIFY**

### E. Biznes qatlami

**A26. To'lov provayderlari (Payme + Click)**
Decision: **KEEP**. Ikkalasi real protokol, atomik, testlangan. Stripe qo'shilmaydi (bozor UZ).
Risk: past. Migration: 0. **Status: KEEP**

**A27. Billing metrikasi (flat 500 so'm/xabar)**
Decision: **MODIFY** → **token-asosli**: engine har javobda `usage {input_tokens, output_tokens, model}` qaytaradi; API `hold → reconcile` naqshi bilan ishlaydi (oldin taxminiy summa bloklanadi, javobdan keyin haqiqiy summaga tenglashtiriladi, farq qaytariladi). Narx jadvali `model → tiyin/1k token × ustama` env'da.
Rad etildi: flat narx (og'ir agentlarda zarar), post-paid (o'zbek bozorida undirish riski), obuna-only (foydalanish farqi 100×).
Risk: yuqori (pul mantiqi). Migration: 6 ED. **Status: MODIFY**

**A28. Ikki billing o'qi (per-agent wallet + platform subscription)**
Decision: **KEEP**. `block-isolation.spec.ts` bilan qoplangan; biznes modeli shunga qurilgan.
Risk: past. Migration: 0. **Status: KEEP**

**A29. Marketplace kreator payout**
Current: halol blocked-stub (503, balans saqlanadi).
Decision: **KEEP** — rails ulanmaguncha shu holatda. Yangi kod yozilmaydi.
Risk: past (biznes riski: kreator jalb qilish). Migration: 0. **Status: KEEP**

### F. Frontend

**A30. Next.js App Router + dark-only "Liquid Obsidian"**
Decision: **KEEP**. Dizayn tizimi mahsulot identifikatori.
Risk: past. Migration: 0. **Status: KEEP**

**A31. Klient-og'ir render (80/103 `"use client"`)**
Decision: **MODIFY** — yangi sahifalar **RSC-birinchi**; `"use client"` faqat interaktiv barg-komponentlarda. Mavjud sahifalar bosqichma-bosqich (yangi ish tegganda).
Rad etildi: SPA'ga to'liq o'tish (SEO va boshlang'ich yuklanish yo'qoladi), hammasini bir zarbada refaktor (regressiya xavfi).
Risk: past. Migration: doimiy. **Status: MODIFY**

**A32. `packages/shared-types`**
Current: qo'lda yozilgan, amalda ishlatilmaydi.
Decision: **REMOVE** → o'rniga **OpenAPI codegen**: Nest Swagger sxemasidan build vaqtida TS klient generatsiya qilinadi (`packages/api-client`, git'ga commit qilinadi).
Rad etildi: tRPC (Nest bilan tabiiy emas), qo'lda tiplarni saqlash (bugungi holat — chalkashlik).
Risk: past. Migration: 3 ED. **Status: REMOVE + ADD**

**A33. API versiyalash**
Decision: **ADD** → `/api/v1/*` (Nest URI versioning). Companion va mobil mijozlar uchun majburiy.
Risk: past. Migration: 2 ED. **Status: ADD**

### G. Sifat va operatsiya

**A34. CI**
Decision: **MODIFY** — `master` (+ `main`) triggeri, required status checks, `prisma migrate diff` drift tekshiruvi, `npm audit --production` gate, web bundle-size gate.
Risk: past. Migration: 1 ED. **Status: MODIFY**

**A35. Test strategiyasi**
Current: 253 mock-Prisma unit testi.
Decision: **MODIFY** → uch qatlam: (1) unit (mock, mavjud), (2) **integratsiya — Testcontainers Postgres + supertest** (har modul uchun kamida auth+scoping testi), (3) E2E Playwright (kritik 5 oqim). Yangi kod uchun coverage gate: **o'zgargan satrlar bo'yicha ≥80%**.
Rad etildi: faqat E2E (sekin, mo'rt), coverage'ni global 80% qilish (mavjud kodni bir zarbada qoplash real emas).
Risk: past. Migration: 5 ED (harness) + doimiy. **Status: MODIFY**

**A36. Observability**
Current: strukturaviy log + `AllExceptionsFilter`, Sentry ulash-nuqtasi.
Decision: **ADD** → Sentry (3 servis: web, api, engine) + `pino` JSON loglari + request-id propagatsiyasi + 4 ta biznes-alert (global LLM cap 80%, to'lov webhook xatolari, cron o'tkazib yuborildi, 5xx ko'tarilishi). OTel **keyinga** (Phase 8).
Rad etildi: Datadog (narx), o'z-o'zidan quriladigan metrika (vaqt).
Risk: past. Migration: 2 ED. **Status: ADD**

**A37. Sirlar boshqaruvi**
Current: Render `generateValue` + `sync: false`.
Decision: **KEEP** + rotatsiya runbook'i (`ENCRYPTION_KEY` uchun `v2:` kalit versiyasi qo'llab-quvvatlanadi — `CryptoService` allaqachon versiyalangan).
Risk: past. Migration: 2 ED (runbook + rotate skript). **Status: KEEP**

**A38. Deploy platformasi (Render)**
Decision: **KEEP** 1M foydalanuvchigacha. API+web `starter`ga ko'tariladi, engine `pserv` (private), worker yangi servis. Kubernetes **kiritilmaydi**.
Rad etildi: AWS ECS/EKS (operatsion yuk), Vercel+Railway aralash (ikki panel).
Risk: past. Migration: 1 ED. **Status: KEEP**

**A39. Feature yuzasi (20 dashboard sahifa, 44 engine endpoint)**
Decision: **MODIFY → FEATURE FREEZE.** Phase 0–4 tugamaguncha **yangi vertikal/sahifa qo'shilmaydi**. Phase 4 dan keyin har yangi vertikal uchun "kill-criteria" (30 kunda X faol foydalanuvchi bo'lmasa — arxivlanadi).
Risk: past (biznes: sabr talab qiladi). Migration: 0. **Status: MODIFY**

**A40. `CLAUDE.md`**
Current: yo'q.
Decision: **ADD** — bu shartnomaning ijro-qoidalari (branch, test buyruqlari, guard matritsasi, i18n, migratsiya nomlash, Prisma-faqat-service qoidasi).
Risk: past. Migration: 0.5 ED. **Status: ADD**

---

# 3. Critical Path

**Qoida: fazalar qayta tartiblanmaydi.** Har faza keyingisining oldindan sharti (precondition) bo'lgani uchun shu joyda turadi.

### Phase 0 — Repo Integrity (2 ED)
CI `master`da; branch protection; uncommitted device-control bloki test bilan commit; `CLAUDE.md`.
**NEGA BIRINCHI:** bundan keyingi har bir o'zgarish tekshirilishi kerak. CI ishlamaguncha "test o'tdi" degan har qanday da'vo isbotsiz. 1.3k LOC versiya nazoratidan tashqarida turgan holda hech narsa qurilmaydi.

### Phase 1 — Security Containment (6 ED)
Companion pairing (TTL/urinish/throttle/scope), companion yo'liga kvota+billing, `tokenVersion` revocation, legacy cookie fallback'ni o'chirish, body/payload limitlari, Clerk qoldiqlarini olib tashlash, engine `pserv`.
**NEGA 2-CHI:** bular **jonli ekspluatatsiya qilinadigan** yo'llar. Admin panel bu yuzani kengaytiradi — avval yopiladi. RBAC'dan oldin, chunki RBAC bu teshiklarni yopmaydi (pairing endpointi umuman auth talab qilmaydi).

### Phase 2 — Authorization Core (6 ED)
`@Roles()` + `RolesGuard` (global) + `PolicyService`; `UserRole` enum; `SUPPORT` roli; `AdminQueryService` skeleti; OWNER bootstrap (seed + audit); ESLint scoping qoidasi.
**NEGA 3-CHI:** admin panelning har bir endpointi shu poydevorga tayanadi. Avval ekran qurilsa, avtorizatsiya keyin "yamoq" bo'lib qo'shiladi — bu sinf xatosi.

### Phase 3 — Data Access Contract (14 ED)
Kursorli pagination shartnomasi + barcha ro'yxatlarga qo'llash; Prisma enum'lar; `BigInt` pul migratsiyasi; `Message` jadvali (dual-write→backfill); yetishmayotgan kompozit indekslar; audit lock per-actor; `deletedAt` olib tashlash.
**NEGA 4-CHI:** admin panel = ro'yxat + filtr + sort. Bu shartnomasiz qurilgan har admin ekrani Phase 5'da qayta yoziladi. Pul ustunlari admin balans-ekranidan **oldin** BigInt bo'lishi shart, aks holda migratsiya jonli admin funksiyasini buzadi.

### Phase 4 — Admin Panel (16 ED)
`AdminModule` + `(admin)` route guruhi + `DataTable` + 6 modul (Users, Billing, Agents, Audit, Feedback, Ops) + impersonation + xavfli-amal tasdiqlash oqimi.
**NEGA 5-CHI:** biznes blokeri (qo'llab-quvvatlash, moderatsiya, moliyaviy nazorat) — miqyoslashdan oldin kerak, chunki bugungi yuk past, lekin qo'lda DB-SQL bilan boshqarish allaqachon xavfli.

### Phase 5 — Observability & Operations (5 ED)
Sentry×3, pino JSON, request-id propagatsiyasi, 4 biznes-alert, `/api/health` chuqurlashtirish (DB+engine+redis), backup/restore mashqi, incident runbook.
**NEGA 6-CHI:** Phase 6 ijro-topologiyasini o'zgartiradi (worker, queue, Redis). **Ko'rmasdan turib topologiyani o'zgartirish — ko'r operatsiya.** Shuning uchun aynan shu yerda.

### Phase 6 — Runtime Decoupling / Scale Foundation (16 ED)
Redis (throttler store + lock), BullMQ, `apps/browser-worker`, cron leader-lock → repeatable job, headful login-capture'ni olib tashlash, SSE progress Redis pub/sub orqali, API+web `starter` plan.
**NEGA 7-CHI:** bu yerda gorizontal miqyoslash qulfi ochiladi. Undan oldin barcha ma'lumot-shartnomalari (Phase 3) va kuzatuv (Phase 5) tayyor bo'lishi kerak, aks holda migratsiya xatolari ko'rinmaydi.

### Phase 7 — Billing Correctness (8 ED)
Engine `usage` qaytaradi → `hold → reconcile` modeli; model narx-jadvali; foydalanuvchi uchun shaffof "bu javob X so'm" ko'rsatkichi; oylik hisobot.
**NEGA 8-CHI:** token-metering worker/queue plumbing'iga (Phase 6) va BigInt ledger'ga (Phase 3) tayanadi; bundan tashqari o'sish boshlanmaguncha zarar hajmi kichik.

### Phase 8 — Performance & Frontend (10 ED)
RSC-birinchi refaktor (top-5 sahifa), bundle splitting (3D faqat landing'da), kesh qatlami (Redis, aniq ADR bilan), DB so'rov profilizatsiyasi, `pg_trgm` marketplace qidiruvi.
**NEGA 9-CHI:** optimallashtirish faqat o'lchov (Phase 5) va real yuk naqshlari mavjud bo'lganda ma'noga ega.

### Phase 9 — Developer Experience & Contracts (8 ED)
OpenAPI codegen klienti, `/api/v1` versiyalash, Testcontainers integratsiya harness'i, ADR intizomi, hujjatlarni tozalash (`docs/status` arxivi, README tuzatish).
**NEGA OXIRGI:** DX investitsiyasi kod-baza shakli barqarorlashgandan keyin eng ko'p qaytim beradi.

**Jami: ~91 ED ≈ 18 hafta ≈ 9 sprint.**

---

# 4. Dependency Graph

```
                    ┌──────────────────────────┐
                    │ P0  Repo Integrity (CI)  │   ← hamma narsaning sharti
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
   ┌──────────────────────┐              ┌──────────────────────┐
   │ P1 Security          │              │ [PARALLEL A]         │
   │  · companion pairing │              │  CLAUDE.md           │
   │  · tokenVersion      │              │  README/docs tozalash│
   │  · Clerk REMOVE      │              │  Clerk paket o'chirish│
   └──────────┬───────────┘              └──────────────────────┘
              ▼
   ┌──────────────────────┐
   │ P2 Authorization     │
   │  RolesGuard          │
   │  UserRole enum ──────┼──────────────┐
   │  AdminQueryService   │              │ (enum ishi P3 bilan birlashadi)
   │  OWNER bootstrap     │              ▼
   └──────────┬───────────┘   ┌──────────────────────────────┐
              │               │ P3 Data Access Contract      │
              │               │  pagination ──┐              │
              │               │  Prisma enums │              │
              │               │  BigInt money │ (uchtasi     │
              │               │  Message tbl  │  parallel)   │
              │               │  indexes      │              │
              │               │  audit lock ──┘              │
              │               └──────────┬───────────────────┘
              └──────────────┬───────────┘
                             ▼
              ┌──────────────────────────────┐
              │ P4 Admin Panel               │
              │   RolesGuard + pagination    │
              │   ↓                          │
              │  AdminModule                 │
              │   ↓                          │
              │  ┌────────────┬────────────┐ │
              │  │User Mgmt   │Audit Viewer│ │  ← parallel
              │  │Billing Dash│Feedback    │ │
              │  │Agent Mgmt  │Ops Console │ │
              │  └─────┬──────┴────────────┘ │
              │        ▼                     │
              │   Impersonation              │  ← Audit Viewer'dan KEYIN
              │   (audit ko'rinishisiz       │     (nazoratsiz impersonation
              │    joriy etilmaydi)          │      taqiqlanadi)
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │ P5 Observability             │
              │  Sentry → alerts → runbook   │
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │ P6 Runtime Decoupling        │
              │  Redis                       │
              │   ├──► Throttler store       │  (parallel)
              │   ├──► Cron leader lock      │
              │   └──► BullMQ                │
              │            ↓                 │
              │      browser-worker          │
              │            ↓                 │
              │      LoginCapture REMOVE     │
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐      ┌────────────────────┐
              │ P7 Token Billing             │      │ [PARALLEL B]       │
              │  engine usage → hold/reconcile│ ────►│ P8 Performance     │
              └──────────────┬───────────────┘      │  RSC, bundle, cache│
                             ▼                       └────────────────────┘
              ┌──────────────────────────────┐
              │ P9 DX & Contracts            │
              │  OpenAPI client, /v1, tests  │
              └──────────────────────────────┘
```

**Parallel ishlar (xavfsiz):**
- `[A]` hujjat/paket tozalash — istalgan vaqtda.
- P3 ichida: pagination ∥ enums ∥ BigInt (turli fayllar; `Message` jadvali oxirgi).
- P4 ichida: 6 admin moduli o'zaro parallel; **impersonation faqat Audit Viewer'dan keyin**.
- P6 ichida: throttler-store ∥ cron-lock (ikkalasi Redis'ga tayanadi, o'zaro bog'liq emas).
- P8 P7 bilan parallel bo'lishi mumkin (turli qatlamlar).

**Qat'iy ketma-ketlik (buzilmaydi):** P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P9.

---

# 5. Architecture Decision Records

> Har ADR: **Problem · Decision · Alternatives · Why rejected · Long-term impact**. Bular `docs/adr/` ga alohida fayllar sifatida ko'chiriladi.

### ADR-001 — Authentication
**Problem:** 30 kunlik imzolangan JWT, bekor qilish mexanizmi yo'q; Clerk qoldiqlari o'lik kod sifatida turibdi.
**Decision:** O'z OTP + TOTP + HS256 JWT saqlanadi; `User.tokenVersion` qo'shiladi, TTL 7 kunga tushiriladi, jimgina yangilash `/api/session/refresh` orqali; Clerk butunlay olib tashlanadi.
**Alternatives:** (a) Clerk/Auth0'ga to'liq o'tish, (b) refresh-token jadvali, (c) hozirgicha qoldirish.
**Why rejected:** (a) O'zbek raqami + Eskiz SMS + halal brendi bilan tashqi provayder oqimi mos emas; foydalanuvchi boshiga narx marja bilan mos kelmaydi. (b) alohida jadval + rotatsiya mantiqi `tokenVersion`dan 5× murakkab, foydasi marginal. (c) qurilma-boshqaruv huquqlari bilan bekor qilinmaydigan token — qabul qilib bo'lmas.
**Long-term impact:** har foydalanuvchida bir marta chiqib-kirish; keyin xavfsizlik hodisasida bitta SQL bilan butun parkni bekor qilish imkoni.

### ADR-002 — Authorization
**Problem:** RBAC faqat DB maydoni; bitta inline `if`.
**Decision:** Global `RolesGuard` + `@Roles()` dekoratori + `PolicyService`; ierarxiya `OWNER > ADMIN > SUPPORT > MEMBER > VIEWER`; dekoratorsiz endpoint default `MEMBER`; cross-tenant o'qish faqat `AdminQueryService` orqali.
**Alternatives:** (a) CASL/ability-based, (b) OPA/Rego, (c) qo'lda if'lar.
**Why rejected:** (a) 5 rol va ~40 endpoint uchun ability-DSL ortiqcha kognitiv narx. (b) tashqi policy engine — 1 muhandis uchun operatsion aql-bovar qilmas. (c) bugungi holat, statistik jihatdan unutiladi.
**Long-term impact:** admin/support/enterprise-org rollarini qo'shish arzonlashadi; auditor uchun avtorizatsiya bitta faylda ko'rinadi.

### ADR-003 — Payments
**Problem:** UZ bozorida karta-token avtomatik yechim yo'q; ikkita provayder qo'llab-quvvatlanadi.
**Decision:** Payme + Click **KEEP**; `PaymentProviderService` interfeysi yagona kengaytma nuqtasi; global provayder (Stripe) **qo'shilmaydi** to global ekspansiyagacha.
**Alternatives:** (a) Stripe'ni hozir qo'shish, (b) bitta provayderga qisqartirish, (c) to'lov agregatori.
**Why rejected:** (a) UZ kartalari Stripe'da ishlamaydi — nol qiymat. (b) provayder uzilishida to'lov butunlay to'xtaydi. (c) agregator komissiyasi marjani yeydi.
**Long-term impact:** yangi bozorga chiqishda faqat yangi provayder klassi yoziladi.

### ADR-004 — AI Engine
**Problem:** Engine ommaviy servis sifatida deploy qilinadi (`type: web`), ichki token bilan himoyalangan.
**Decision:** Engine Render **private service** (`pserv`) ga o'tadi; ichki token **qoladi** (ikki qatlam); barcha LLM chaqiruvlari engine orqali — NestJS to'g'ridan-to'g'ri Anthropic'ga bormaydi.
**Alternatives:** (a) engine'ni NestJS ichiga ko'chirish, (b) LLM chaqiruvlarini API'dan qilish, (c) hozirgicha ommaviy qoldirish.
**Why rejected:** (a) Python AI ekotizimi yo'qoladi. (b) prompt/tool mantiqi ikki tilda ikkilanadi. (c) tarmoq darajasidagi himoya token'dan kuchliroq — bepul yutuq.
**Long-term impact:** engine'ni GPU instansga ko'chirish yoki mintaqaviy replikalash mumkin bo'ladi.

### ADR-005 — Queues
**Problem:** Uzoq ishlar (brauzer-run 12 qadam, vision loop 15 iteratsiya, oylik billing) HTTP so'rovi ichida bajariladi.
**Decision:** BullMQ (Redis) joriy etiladi; uzoq/qayta-urinadigan har ish navbatga o'tadi; SSE faqat progress uzatadi.
**Alternatives:** (a) pg-boss, (b) Cloud Tasks/SQS, (c) Temporal, (d) navbatsiz qolish.
**Why rejected:** (a) Postgres allaqachon eng qimmat resurs; navbat yuki uni yanada yuklaydi. (b) vendor lock + lokal dev murakkabligi. (c) Temporal 1 muhandisga operatsion jihatdan og'ir. (d) HTTP timeout va qayta urinishsiz pul yo'qotish.
**Long-term impact:** worker'larni mustaqil miqyoslash; ishlar tarixi va qayta urinish siyosati markazlashadi.

### ADR-006 — Redis
**Problem:** Throttler in-memory, cron leader'siz, navbat yo'q — uchalasi "bitta instans" farazini yaratadi.
**Decision:** Redis qaytariladi, **faqat**: throttler store, taqsimlangan lock, BullMQ backend. Kesh sifatida ishlatish alohida ADR talab qiladi.
**Alternatives:** (a) Postgres advisory lock + jadval-navbat, (b) stateless qolish, (c) Redis'ni hamma narsa uchun (kesh, sessiya).
**Why rejected:** (a) DB yagona bottleneck'ka aylanadi. (b) gorizontal miqyoslash mumkin emas. (c) keshning invalidatsiyasi noto'g'ri qilinsa — jim ma'lumot buzilishi; ataylab kechiktiriladi.
**Long-term impact:** aniq chegaralangan Redis — migratsiya va debug oson.

### ADR-007 — Storage
**Problem:** Qo'ng'iroq yozuvlari base64 sifatida Postgres ustunida.
**Decision:** Cloudflare R2 + envelope shifrlash; DB'da `objectKey` + shifrlangan data-key; hayot-sikli siyosati (90 kun default).
**Alternatives:** (a) DB'da qoldirish, (b) Render disk, (c) S3.
**Why rejected:** (a) backup hajmi va TOAST jarimasi; 1 soatlik audio ≈ 30MB base64 → 40MB satr. (b) instansga bog'lanadi, worker'lar ko'ra olmaydi. (c) R2 — chiqish trafigi bepul, narx afzalligi.
**Long-term impact:** media (skrinshot, kamera kadrlar, eksportlar) uchun tayyor yo'l.

### ADR-008 — Audit
**Problem:** Hash-zanjir global advisory lock bilan seriyalashtirilgan — yozuv hajmida bottleneck.
**Decision:** Zanjir **per-actor** bo'ladi; lock kaliti `hashtext(actorId)`; admin harakatlari uchun majburiy `actorId` + `impersonatedUserId` maydoni qo'shiladi.
**Alternatives:** (a) global zanjirni saqlash, (b) zanjirni olib tashlash, (c) tashqi append-only log (QLDB kabi).
**Why rejected:** (a) yozuv o'sishida navbat. (b) buzilmaslik isboti yo'qoladi — ishonch mahsulotning bir qismi. (c) narx va vendor lock.
**Long-term impact:** audit yozuvi cheksiz miqyoslanadi; huquqiy isbot kuchi saqlanadi.

### ADR-009 — Database
**Problem:** String-enum'lar, `Int` pul, JSON suhbatlar, ishlatilmaydigan soft-delete.
**Decision:** Prisma enum'lar; `BigInt` pul; `Message` jadvali; `deletedAt` olib tashlanadi; har ro'yxat so'rovi uchun kompozit indeks majburiy.
**Alternatives:** (a) hozirgicha qoldirish, (b) JSONB + GIN, (c) alohida analitik DB.
**Why rejected:** (a) admin filtrlari va analitika ishonchsiz bo'ladi. (b) yozish baribir O(n). (c) hozircha erta — Postgres yetadi.
**Long-term impact:** admin, analitika va billing hisobotlari bitta ishonchli sxemadan o'qiydi.

### ADR-010 — Browser Automation
**Problem:** Chromium API jarayonida; konkurentlik cheklovisiz; headful login prod'da ishlamaydi.
**Decision:** Alohida `browser-worker` servisi (BullMQ consumer, `MAX_CONCURRENT_RUNS=2`); headful `LoginCapture` olib tashlanadi; har run uchun **domen allowlist** majburiy.
**Alternatives:** (a) Browserless/Browserbase, (b) API'da semaphore, (c) hozirgicha.
**Why rejected:** (a) foydalanuvchi sessiya cookie'lari uchinchi tomon infratuzilmasiga chiqadi — bizning eng maxfiy aktivimiz; qabul qilinmaydi. (b) API OOM'i butun platformani o'ldiradi. (c) prod'da ishlamaydi.
**Long-term impact:** brauzer yuki API SLO'siga ta'sir qilmaydi; worker'lar arzon spot instanslarda ishlaydi.

### ADR-011 — Companion Apps
**Problem:** Pairing autentifikatsiyasiz; Android papkasi bo'sh; companion yo'li kvota/billing'siz.
**Decision:** Desktop companion saqlanadi va mustahkamlanadi (pairing TTL 10 daq, 5 urinish, throttle, token rotatsiyasi 30 kun, `x-companion-version` tekshiruvi, har amal kvota+billing orqali). Android papkasi olib tashlanadi.
**Alternatives:** (a) companion'ni butunlay olib tashlash, (b) hozirgicha, (c) tayyor RMM/RPA vositasini integratsiya qilish.
**Why rejected:** (a) "qurilma boshqaruvi" — mahsulotning eng kuchli differensiatori. (b) ekspluatatsiya qilinadigan. (c) halal/lokal kontekstga mos emas, narx.
**Long-term impact:** qurilma qatlami xavfsiz asosda kengayadi (Android keyin real kod bilan qaytadi).

### ADR-012 — Billing
**Problem:** Flat 500 so'm/xabar — token sarfidan mustaqil.
**Decision:** `hold → reconcile` token-asosli hisob; engine `usage` qaytaradi; narx jadvali env'da; foydalanuvchiga har javob narxi ko'rsatiladi.
**Alternatives:** (a) flat narx, (b) faqat obuna, (c) post-paid hisob-faktura.
**Why rejected:** (a) og'ir agent zarar keltiradi — birlik-iqtisod salbiy. (b) foydalanish farqi 100× — bir tarif ikkala segmentni ham yo'qotadi. (c) undirish riski va UZ bozorida to'lov intizomi.
**Long-term impact:** marja har chaqiruvda kafolatlanadi; enterprise uchun hajmli chegirma qo'shish oson.

### ADR-013 — Internationalization
**Problem:** O'z i18n yechimi, 789 kalit × 3 til, qo'lda sinxronizatsiya.
**Decision:** Yechim **KEEP**; CI'da **kalit-tenglik testi** qo'shiladi (uz/ru/en kalitlari aynan bir xil bo'lishi shart); kod izohlari o'zbekcha qoladi, lekin **yangi public API/DTO nomlari inglizcha**.
**Alternatives:** (a) next-intl/i18next, (b) tarjima SaaS (Crowdin), (c) faqat inglizcha.
**Why rejected:** (a) migratsiya narxi, mavjud yechim ishlaydi. (b) 3 til uchun erta. (c) bozor talabi — uz/ru majburiy.
**Long-term impact:** 4-til (qozoq/tojik) qo'shish mexanik ish bo'ladi.

### ADR-014 — Logging
**Problem:** Nest default logger, strukturasiz matn.
**Decision:** `pino` JSON loglari; majburiy maydonlar: `ts, level, reqId, userId?, module, msg, durationMs?`; PII **hech qachon** logga tushmaydi (telefon/email/token/sir maskalanadi).
**Alternatives:** (a) Winston, (b) console, (c) Nest default.
**Why rejected:** (a) pino tezroq va JSON-birinchi. (b/c) qidiruv va alert qurish mumkin emas.
**Long-term impact:** log agregatori (Loki/Datadog) qo'shilganda o'zgarish kerak bo'lmaydi.

### ADR-015 — Monitoring
**Problem:** Xato kuzatuvi va biznes-alertlar yo'q.
**Decision:** Sentry (3 servis) + 4 biznes-alert + `/api/health` chuqur tekshiruv (DB, engine, redis) + haftalik SLO hisoboti.
**Alternatives:** (a) Datadog/New Relic, (b) o'z Prometheus stack'i, (c) faqat Render loglari.
**Why rejected:** (a) narx bu bosqichda oqlanmaydi. (b) operatsion yuk. (c) hodisani foydalanuvchi aytguncha bilmaslik.
**Long-term impact:** OTel keyin Sentry ustiga qo'shiladi (ikkalasi mos).

### ADR-016 — Secrets
**Problem:** Sirlar Render env'da; rotatsiya protsedurasi yo'q.
**Decision:** Render env-group **KEEP**; `ENCRYPTION_KEY` uchun `v2:` versiyali rotatsiya skripti; sir rotatsiyasi runbook'i; hech qanday sir kodda/logda/testda bo'lmaydi (CI'da `gitleaks`).
**Alternatives:** (a) Vault/Doppler, (b) AWS Secrets Manager, (c) hozirgicha.
**Why rejected:** (a/b) qo'shimcha narx va integratsiya; Render env-group yetarli. (c) rotatsiyasiz sir — muddatsiz risk.
**Long-term impact:** compliance (SOC2/ISO) so'rovlariga tayyor javob.

### ADR-017 — Configuration
**Problem:** `validateEnv()` bor, lekin tiplanmagan; env kalitlari kod bo'ylab `process.env` orqali o'qiladi.
**Decision:** `ConfigModule` + **zod sxemasi** bilan tiplangan config; `process.env` to'g'ridan-to'g'ri o'qish taqiqlanadi (ESLint); har env `.env.example`da hujjatlashadi.
**Alternatives:** (a) hozirgicha, (b) `@nestjs/config` `Joi` bilan.
**Why rejected:** (a) noto'g'ri env prod'da jim xatoga aylanadi. (b) zod TS-tiplarni tabiiy beradi.
**Long-term impact:** yangi muhit (staging) qo'shish xavfsiz.

### ADR-018 — Testing
**Problem:** 253 unit test mock-Prisma bilan; DB/guard/scoping xatolari testlanmaydi; device-control 0 test.
**Decision:** Uch qatlam (unit / Testcontainers-integratsiya / E2E). **Har yangi endpoint uchun majburiy: 1 auth testi + 1 scoping testi.** O'zgargan satrlar coverage ≥80%.
**Alternatives:** (a) faqat unit, (b) faqat E2E, (c) global 80% coverage.
**Why rejected:** (a) eng qimmat xatolar (scoping, migratsiya) unit'da ko'rinmaydi. (b) sekin va mo'rt. (c) mavjud kodni qoplash uchun sun'iy testlar yoziladi — qiymatsiz.
**Long-term impact:** refaktor qilish xavfsiz bo'ladi; bu — miqyoslash uchun asosiy shart.

### ADR-019 — Deployment Platform
**Problem:** Render free plan, spin-down, bitta instans.
**Decision:** Render **KEEP**; API+web `starter`, engine `pserv`, worker yangi servis, DB `starter`→`standard` (100k foydalanuvchida). Kubernetes 1M gacha kiritilmaydi.
**Alternatives:** (a) AWS ECS/EKS, (b) Fly.io, (c) Vercel + Railway.
**Why rejected:** (a) operatsion yuk 1 muhandisga nomutanosib. (b) migratsiya foydasi marginal. (c) ikki panel, ikki hisob-faktura.
**Long-term impact:** 1M dan keyin ECS/EKS'ga ko'chish rejasi §8'da.

### ADR-020 — Feature Governance
**Problem:** 20 dashboard sahifa, 44 engine endpoint, 1 muhandis; qo'llab-quvvatlash qarzi o'sadi.
**Decision:** **Feature freeze** P0–P4 davomida; keyin har yangi vertikal uchun kill-criteria (30 kun / X faol foydalanuvchi); har chorakda foydalanilmagan sahifalar arxivlanadi.
**Alternatives:** (a) freeze'siz davom etish, (b) hozir mavjud yarmini o'chirish.
**Why rejected:** (a) qarz yig'iladi va poydevor ishi hech qachon boshlanmaydi. (b) qaysi feature qiymatli ekani hali o'lchanmagan (Phase 5 dan keyin ma'lum bo'ladi).
**Long-term impact:** kod-baza kattaligi qiymat bilan bog'lanadi.

---

# 6. Admin Panel Blueprint

## 6.1 Rol modeli va ruxsatlar

| Rol | Tavsif | Asosiy huquqlar |
|---|---|---|
| `OWNER` | Platforma egasi (1-2 kishi) | Hamma narsa + xavfli amallar + rol tayinlash + break-glass |
| `ADMIN` | Operatsion admin | O'qish + moderatsiya + qo'lda kredit (limit bilan) + agent muzlatish |
| `SUPPORT` | Qo'llab-quvvatlash | Faqat o'qish + impersonation (read-only) + feedback javobi |
| `MEMBER` | Oddiy foydalanuvchi | Faqat o'z ma'lumoti |
| `VIEWER` | Cheklangan (org) | Faqat o'qish, o'z org doirasida |

**Ruxsat matritsasi (asosiy amallar):**

| Amal | OWNER | ADMIN | SUPPORT |
|---|:---:|:---:|:---:|
| Foydalanuvchilar ro'yxati / detali | ✅ | ✅ | ✅ |
| Balans ko'rish / ledger | ✅ | ✅ | ✅ |
| **Qo'lda kredit berish** | ✅ | ✅ (≤500k so'm/kun) | ❌ |
| **Balans yechish (debit)** | ✅ | ❌ | ❌ |
| Foydalanuvchini bloklash | ✅ | ✅ | ❌ |
| **Foydalanuvchini o'chirish (GDPR)** | ✅ | ❌ | ❌ |
| Rol tayinlash | ✅ | ❌ | ❌ |
| Agent muzlatish / muzdan chiqarish | ✅ | ✅ | ❌ |
| Marketplace nashrini olib tashlash | ✅ | ✅ | ❌ |
| Audit jurnalini ko'rish | ✅ | ✅ | ✅ |
| **Impersonation (read-only)** | ✅ | ✅ | ✅ |
| **Impersonation (write)** | ✅ | ❌ | ❌ |
| Feature-flag / limit o'zgartirish | ✅ | ❌ | ❌ |
| **Sessiyalarni ommaviy bekor qilish** | ✅ | ❌ | ❌ |
| To'lov tranzaksiyasini qo'lda yopish | ✅ | ❌ | ❌ |

## 6.2 Route'lar

```
/admin                          → dashboard (KPI)                  [ADMIN+]
/admin/users                    → ro'yxat (kursor, filtr, qidiruv) [SUPPORT+]
/admin/users/[id]               → profil, balans, agentlar, sessiyalar, audit
/admin/users/[id]/ledger        → kredit daftar (kursor)
/admin/billing                  → to'lovlar: Payme/Click tranzaksiyalari
/admin/billing/reconcile        → mos kelmagan tranzaksiyalar navbati [OWNER]
/admin/subscriptions            → platforma obunalari, muddati tugayotganlar
/admin/agents                   → barcha agentlar, muzlatilganlar, marketplace
/admin/agents/[id]              → agent detali, trust-log, egasi
/admin/marketplace              → nashrlar moderatsiyasi, shikoyatlar
/admin/audit                    → audit jurnali (aktor, amal, resurs, sana)
/admin/feedback                 → foydalanuvchi fikrlari (mavjud modul ko'chiriladi)
/admin/ops                      → cron holati, navbat holati, kvota holati, health
/admin/ops/jobs                 → BullMQ navbatlari (yiqilganlar, qayta urinish)
/admin/settings                 → limitlar, narxlar, feature-flag'lar   [OWNER]
/admin/access                   → rol tayinlash, break-glass jurnali    [OWNER]
```

Frontend: yangi route guruh `apps/web/src/app/(admin)/` — **alohida layout**, alohida sidebar, doim ko'rinadigan "ADMIN REJIM" indikatori (qizil chiziq).
Backend: `apps/api/src/admin/` — `AdminModule`, `AdminQueryService` (yagona cross-tenant so'rov nuqtasi), har controller `@Roles(...)` bilan.

## 6.3 Navigatsiya

```
ADMIN
├── Dashboard            (KPI: DAU, yangi ro'yxat, tushum, LLM sarfi, xatolar)
├── Foydalanuvchilar     (ro'yxat → detal → ledger → sessiyalar)
├── Moliya
│   ├── To'lovlar        (Payme / Click)
│   ├── Obunalar
│   └── Solishtirish     [OWNER]
├── Agentlar             (barcha / muzlatilgan / marketplace)
├── Marketplace          (moderatsiya, shikoyatlar)
├── Audit                (jurnal + impersonation tarixi)
├── Fikrlar              (feedback)
├── Operatsiyalar        (cron, navbat, kvota, health)
└── Sozlamalar           [OWNER] (limitlar, narxlar, flag'lar, kirish)
```

## 6.4 Modullar, jadvallar, filtrlar, amallar

**Users**
- Ustunlar: `id(qisqa) · email/telefon · ism · rol · plan · platformPlan · balans · agentlar soni · oxirgi faollik · yaratilgan`
- Filtrlar: rol, plan, platformPlan, balans oralig'i, ro'yxat sanasi, `hasAgents`, `frozen`, `referredBy`
- Qidiruv: email / telefon / id (aniq moslik; `contains` faqat `ILIKE` indeks bilan)
- Amallar: profil ochish · sessiyalarni bekor qilish · kredit berish · bloklash · impersonate · GDPR eksport · **o'chirish** (xavfli)

**Billing**
- Ustunlar: `provider · trans_id · user · summa · holat · maqsad · yaratilgan · yakunlangan`
- Filtrlar: provider, holat (state), maqsad (topup/subscription), sana oralig'i, summa oralig'i
- Amallar: detal (webhook payload) · **qo'lda yopish** (xavfli, OWNER) · ledger'ga o'tish

**Agents**
- Ustunlar: `nom · egasi · model · vertical · holat(frozen/trial) · oylik narx · install/usage · reyting · yaratilgan`
- Filtrlar: frozen, trial, published, vertical, templateId, egasi
- Amallar: muzlatish/ochish · nashrni olib tashlash · trust-log · egasiga o'tish

**Audit**
- Ustunlar: `sana · aktor · impersonatedBy? · amal · resurs · metadata · zanjir holati`
- Filtrlar: aktor, amal (enum), resurs turi, sana oralig'i, faqat admin-amallar
- Amallar: detal · zanjir yaxlitligini tekshirish (`verifyChain(actorId)`) · CSV eksport (OWNER)

**Ops**
- Panellar: cron oxirgi ishga tushish + natija · BullMQ navbat chuqurligi/yiqilganlar · kunlik global LLM hisoblagichi · health (DB/engine/redis) · oxirgi 50 ta 5xx
- Amallar: yiqilgan ishni qayta urinish · navbatni pauza qilish (OWNER) · global LLM cap'ni vaqtincha oshirish (OWNER, audit bilan)

## 6.5 Xavfli amallar va tasdiqlash oqimi

**Xavfli deb tasniflanadi:** foydalanuvchini o'chirish · balansdan yechish · qo'lda kredit >500k so'm · rol tayinlash · sessiyalarni ommaviy bekor qilish · to'lov tranzaksiyasini qo'lda yopish · global limitlarni o'zgartirish · impersonation (write).

**Har xavfli amal uchun majburiy oqim:**
1. **Sabab matni** (min 20 belgi) — `AuditLog.metadata.reason`ga yoziladi.
2. **Qayta autentifikatsiya** — TOTP kodi (2FA yoqilgan bo'lishi SHART; 2FA'siz OWNER/ADMIN roli berilmaydi).
3. **Tasdiqlash dialogi** — foydalanuvchi identifikatorini qo'lda yozib tasdiqlash (`DELETE user_abc123` naqshi).
4. **Audit yozuvi** amaldan **oldin** (`intent`) va **keyin** (`result`) — ikkita yozuv.
5. **Kechiktirilgan bajarish** (faqat o'chirish uchun): 24 soat "bekor qilish oynasi"; shu vaqtda OWNER bekor qila oladi.
6. **Bildirishnoma**: har xavfli amal OWNER Telegram kanaliga darhol yuboriladi.

**Rate limit:** admin xavfli amallari — 10/soat/admin (throttler).

## 6.6 Impersonation

- **Faqat `Audit Viewer` modulidan keyin** joriy etiladi (nazoratsiz impersonation taqiqlanadi).
- Boshlash: `POST /admin/impersonate/:userId` → sabab majburiy → **maks. 30 daqiqalik** maxsus token (`imp: true, sub: <target>, act: <admin>`).
- **Default read-only**: token `imp_ro` bo'lsa, guard barcha `POST/PATCH/DELETE`ni rad etadi (faqat OWNER `imp_rw` ola oladi).
- **Hech qachon ruxsat etilmaydi** (hatto OWNER uchun ham): to'lov qilish, balans yechish, parol/2FA o'zgartirish, konnektor sirlarini ko'rish, qo'ng'iroq yozuvini eshitish, qurilma buyrug'i yuborish.
- UI: butun ekran bo'ylab qizil banner "«X» nomidan ko'rilmoqda — chiqish", timer bilan.
- Har so'rov `AuditLog`ga `actorId=admin, impersonatedUserId=target` bilan yoziladi.
- Foydalanuvchiga xabar: impersonation tugagach unga bildirishnoma (shaffoflik — ishonch mahsulotning bir qismi).

## 6.7 Owner hisobi va favqulodda kirish

**Bootstrap:** `scripts/bootstrap-owner.mjs` — `OWNER_BOOTSTRAP_EMAIL` env'idagi email bilan foydalanuvchini `OWNER` qiladi. Skript: (a) faqat OWNER mavjud bo'lmaganda ishlaydi, (b) `AuditLog`ga `system.owner_bootstrap` yozadi, (c) bir marta ishlagach env olib tashlanadi.

**Ikkinchi OWNER:** birinchi OWNER tomonidan `/admin/access` orqali; **kamida ikkita OWNER bo'lishi majburiy** (bus factor); tizim bitta OWNER qolganda ogohlantiradi.

**Break-glass (favqulodda kirish):**
- Alohida `OWNER` hisobi, offline saqlangan parol-menejerda, 2FA sirlar bilan.
- Har 90 kunda ishlashi tekshiriladi (runbook mashqi).
- Ishlatilganda: `AuditLog` + Telegram + email — uchala kanalga darhol signal.
- Agar Redis/queue yiqilsa ham admin panel **faqat o'qish rejimida** ishlashi shart (DB yetarli).

---

# 7. Security Blueprint

Har vazifa: **Priority · Complexity · Risk · Effort · Dependencies · Acceptance Criteria · Definition of Done**.
DoD barcha vazifalar uchun umumiy minimum: *kod + test + CI yashil + `.env.example`/hujjat yangilandi + audit yozuvi (agar amal xavfli bo'lsa) + ADR havolasi.*

### SEC-01 · Companion pairing'ni mustahkamlash
- **Priority:** Critical · **Complexity:** O'rta · **Risk:** Kritik (begona qurilma tokeni) · **Effort:** 2 ED · **Deps:** P0
- **AC:**
  1. `pairingCode` 10 daqiqada amal qilishdan to'xtaydi (`pairingExpiresAt`).
  2. Muvaffaqiyatsiz urinishlar hisoblanadi; 5 urinishdan keyin kod bekor qilinadi.
  3. `POST /device/companion/pair` `@Throttle(5, 60s)` bilan cheklanadi.
  4. Kod 6 xona → **12 belgili base32** (`randomBytes`), ya'ni brute-force amaliy jihatdan imkonsiz.
  5. Juftlash muvaffaqiyatli bo'lganda foydalanuvchiga bildirishnoma (Telegram/email).
  6. Companion tokeni 30 kunda rotatsiya qilinadi (`/companion/refresh`).
- **DoD:** brute-force testi (1000 urinish → bloklangan), muddat testi, rotatsiya testi.

### SEC-02 · Companion yo'liga kvota + billing
- **Priority:** Critical · **Complexity:** O'rta · **Risk:** Yuqori (cheksiz LLM xarajati) · **Effort:** 1.5 ED · **Deps:** SEC-01
- **AC:** `companion/computer-use/plan` `UsageService.consumeChat` + `BillingService.chargeForMessage` orqali o'tadi; balanssiz companion 402 oladi; vision loop maks. **10** iteratsiya (hozir 15) va har iteratsiya alohida hisoblanadi.
- **DoD:** integratsiya testi: balans 0 → 402; kvota tugagan → 429; hisoblagich oshgani tasdiqlanadi.

### SEC-03 · JWT revocation (`tokenVersion`)
- **Priority:** High · **Complexity:** O'rta · **Risk:** Yuqori · **Effort:** 2 ED · **Deps:** P0
- **AC:** JWT payload'da `tv`; `AuthGuard` `user.tokenVersion !== payload.tv` → 401; logout, 2FA o'zgarishi, qurilma o'chirish, admin "sessiyalarni bekor qilish" — hammasi `tokenVersion++`; TTL 30→7 kun; `/api/session/refresh` jimgina yangilaydi.
- **DoD:** test: eski token 401; refresh oqimi E2E; barcha foydalanuvchilar uchun bir martalik chiqish hujjatlashtirilgan.

### SEC-04 · Legacy cookie-token fallback'ni olib tashlash
- **Priority:** High · **Complexity:** Past · **Risk:** O'rta · **Effort:** 0.5 ED · **Deps:** SEC-03
- **AC:** `middleware.ts:legacyToken()` va BFF route'lardagi `decodeSession(...).token` fallback'lari o'chiriladi; faqat httpOnly `agentnet_token` qabul qilinadi.
- **DoD:** eski cookie bilan so'rov → sign-in redirect; test.

### SEC-05 · RBAC guard (asosiy avtorizatsiya)
- **Priority:** Critical · **Complexity:** Yuqori · **Risk:** Kritik · **Effort:** 3 ED · **Deps:** SEC-03
- **AC:** `RolesGuard` `APP_GUARD` sifatida; `@Roles()` dekoratori; `UserRole` Prisma enum; dekoratorsiz endpoint `MEMBER` talab qiladi; `feedback.controller.ts`dagi inline `if` guard'ga ko'chiriladi; ESLint qoidasi: `@Roles` bo'lmagan `admin/*` endpoint — xato.
- **DoD:** har rol uchun matritsa testi (5 rol × 8 namunaviy endpoint = 40 assertion).

### SEC-06 · Tenant scoping majburlash
- **Priority:** Critical · **Complexity:** Yuqori · **Risk:** Kritik · **Effort:** 3 ED · **Deps:** SEC-05
- **AC:** `AdminQueryService` — cross-tenant o'qishning yagona nuqtasi; ESLint custom qoida: `prisma.*.findMany/findFirst` `where` ichida `userId|ownerId|creatorId|actorId` yoki `// @admin-scope` izohi bo'lishi shart; barcha mavjud chaqiruvlar tekshiriladi.
- **DoD:** ESLint qoidasi CI'da bloklovchi; 0 ta istisno qolgan holda yashil.

### SEC-07 · Brauzer-run domen allowlist
- **Priority:** High · **Complexity:** O'rta · **Risk:** Kritik (prompt injection → boshqa saytda amal) · **Effort:** 2 ED · **Deps:** P6 (worker) yoki mustaqil
- **AC:** Har run boshlanishida foydalanuvchi ruxsat bergan domenlar ro'yxati (maks. 5) belgilanadi; `page.route()` boshqa domenga navigatsiyani bloklaydi; faqat shu domenlarning cookie'lari in'ektsiya qilinadi (birlashtirilgan `mergeStorageStates` **filtrlanadi**); blok hodisasi `DeviceActionLog`ga `status: blocked` bilan yoziladi.
- **DoD:** test: ruxsatsiz domenga navigatsiya bloklangan; sessiya filtri testi.

### SEC-08 · Payload va hajm limitlari
- **Priority:** High · **Complexity:** Past · **Risk:** O'rta · **Effort:** 1 ED · **Deps:** —
- **AC:** Global JSON limiti 1MB; `RecordingDto.data` uchun alohida multipart yo'l (R2'ga to'g'ridan-to'g'ri, presigned URL) yoki maks. 10MB; `CommandDto.payload` har `kind` uchun aniq DTO bilan validatsiya qilinadi (`SendSmsPayload`, `CallPayload`, `OpenAppPayload`, `ComputerUsePayload`).
- **DoD:** limitdan katta so'rov 413; har payload turi uchun validatsiya testi.

### SEC-09 · Clerk qoldiqlarini olib tashlash
- **Priority:** High · **Complexity:** Past · **Risk:** O'rta (o'lik auth kodi) · **Effort:** 1 ED · **Deps:** —
- **AC:** `@clerk/*` paketlari, webhook controller, catch-all sign-in/up route'lari, env kalitlari olib tashlanadi; `clerkId` `String? @unique` bo'ladi.
- **DoD:** `grep -ri clerk apps/` → faqat migratsiya tarixi va `clerkId` ustuni.

### SEC-10 · Engine private networking
- **Priority:** High · **Complexity:** Past · **Risk:** O'rta · **Effort:** 0.5 ED · **Deps:** —
- **AC:** `render.yaml`da engine `type: pserv`; ommaviy URL yo'q; ichki token **saqlanadi**; smoke-test yangilanadi.
- **DoD:** tashqi `curl` engine URL'iga → ulanmaydi.

### SEC-11 · Xavfli admin amallari kontrollari
- **Priority:** Critical · **Complexity:** Yuqori · **Risk:** Kritik · **Effort:** 3 ED · **Deps:** SEC-05, P4
- **AC:** §6.5'dagi 6 qadamli oqim to'liq (sabab, TOTP re-auth, yozib tasdiqlash, ikki audit yozuvi, 24s bekor oynasi o'chirish uchun, Telegram signal); OWNER/ADMIN uchun 2FA majburiy.
- **DoD:** har xavfli amal uchun E2E test; 2FA'siz admin roli berilmasligi testi.

### SEC-12 · Impersonation xavfsizligi
- **Priority:** High · **Complexity:** Yuqori · **Risk:** Kritik · **Effort:** 3 ED · **Deps:** SEC-11, Audit Viewer
- **AC:** §6.6 to'liq (30 daq, read-only default, taqiqlangan amallar ro'yxati guard darajasida, banner, har so'rov audit, foydalanuvchiga bildirishnoma).
- **DoD:** taqiqlangan amallar uchun 403 testlari (7 ta); audit yozuvlari tekshiriladi.

### SEC-13 · CSP va qolgan sarlavhalar
- **Priority:** Medium · **Complexity:** O'rta · **Risk:** Past · **Effort:** 1.5 ED · **Deps:** —
- **AC:** Next.js'da nonce-asosli CSP (`script-src 'self' 'nonce-...'`), `frame-ancestors 'none'`, `connect-src` faqat o'z origin; report-only rejimdan boshlanadi, 2 hafta kuzatiladi, keyin majburiy.
- **DoD:** CSP buzilishlari 0 bo'lgach enforce; Sentry'da CSP report integratsiyasi.

### SEC-14 · Sir rotatsiyasi va gitleaks
- **Priority:** Medium · **Complexity:** O'rta · **Risk:** O'rta · **Effort:** 2 ED · **Deps:** —
- **AC:** `ENCRYPTION_KEY` `v2:` rotatsiya skripti (eski kalit bilan deshifrlab, yangisi bilan shifrlaydi, batch); CI'da `gitleaks`; runbook `docs/runbooks/secret-rotation.md`.
- **DoD:** test bazasida rotatsiya muvaffaqiyatli; gitleaks CI'da bloklovchi.

### SEC-15 · Bog'liqlik xavfsizligi
- **Priority:** Medium · **Complexity:** Past · **Risk:** O'rta · **Effort:** 1 ED · **Deps:** P0
- **AC:** `npm audit --omit=dev --audit-level=high` CI'da bloklovchi; `pip-audit` engine uchun; Dependabot/Snyk haftalik PR.
- **DoD:** CI yashil; mavjud yuqori-darajali zaifliklar yopilgan yoki hujjatlashtirilgan istisno.

**Xavfsizlik bloki jami: ~26 ED.**

---

# 8. Scalability Blueprint

Bosqichlar **bir vaqtdagi faol foydalanuvchi** emas, **ro'yxatdan o'tgan** foydalanuvchi soni bo'yicha. Faraz: 10% oylik faol, 20% kunlik-faoldan chat yozadi, o'rtacha 8 xabar/kun.

### 10 000 foydalanuvchi (≈1 000 DAU, ≈8k LLM so'rov/kun)
- **Arxitektura:** hozirgi topologiya + Phase 6 (Redis, BullMQ, browser-worker). API 2 instans, worker 1, engine 1.
- **Bottleneck:** brauzer-run konkurentligi; Postgres yozish (audit + usage counter); engine LLM latency.
- **Infra:** Render — API `standard` ×2, web `starter`, engine `standard`, worker `starter`, Redis `starter`, Postgres `standard` (4GB RAM).
- **DB:** yagona instans; connection pool 20/instans; `pgBouncer` shart emas.
- **Queue:** BullMQ 1 navbat (`browser`), konkurentlik 2/worker.
- **Cache:** hali yo'q (React Query yetadi).
- **Storage:** R2 — yozuvlar va eksportlar.
- **AI Engine:** 1 instans, `AGENT_MAX_TOOL_ITERATIONS=8`; Anthropic rate-limit tier 2.
- **Monitoring:** Sentry + 4 alert + haftalik SLO.
- **Xarajat drayverlari:** Anthropic tokenlari (~70%), Render (~20%), R2+Redis (~10%).

### 100 000 foydalanuvchi (≈10 000 DAU, ≈80k LLM so'rov/kun)
- **Arxitektura:** API 4-6 instans (stateless — Phase 6 shuni ta'minlaydi), worker 3-4, engine 3 instans + o'z navbati.
- **Bottleneck:** Postgres yozish (audit, usage, message) va ulanishlar soni; Anthropic konkurent so'rov limiti; SSE ulanishlari soni.
- **Infra:** `pgBouncer` (transaction pooling) **majburiy**; Redis `standard`; Postgres `standard`→`pro` (16GB).
- **DB:** o'qish replikasi (admin panel va analitika replikadan o'qiydi); `Message` va `AuditLog` uchun oylik **partitioning**; `UsageCounter` kunlik partitioning yoki Redis'ga ko'chirish (kunlik hisoblagichlar Redis'da, kechqurun Postgres'ga flush).
- **Queue:** 4 navbat (`browser`, `vision`, `billing`, `notify`) — alohida konkurentlik.
- **Cache:** Redis kesh qatlami joriy etiladi (template katalogi, connector registry, user plan/limits — TTL 60s).
- **Storage:** R2 + CDN; hayot-sikli 90 kun.
- **AI Engine:** streaming uchun alohida instans guruhi; prompt-caching (Anthropic) yoqiladi — bu **eng katta xarajat tejash**.
- **Browser:** 4-6 worker, spot/preemptible; har run maks. 90s.
- **Monitoring:** OTel trace (web→api→engine), p95 dashboard, xarajat/foydalanuvchi metrikasi.
- **Xarajat drayverlari:** tokenlar (~60%), compute (~25%), DB (~10%), R2/CDN (~5%).

### 1 000 000 foydalanuvchi (≈100k DAU, ≈800k LLM so'rov/kun)
- **Arxitektura:** monolit **hali ham saqlanadi**, lekin uch domen alohida deploy qilinadi (bir kod-baza, turli `START_MODULE`): `api-core`, `api-billing`, `api-admin`. Worker parki 15-25.
- **Bottleneck:** yagona Postgres yozish IOPS'i; audit hajmi; global LLM kvota mantiqi; SSE uchun ulanish limiti.
- **Infra:** boshqariladigan Postgres (AWS RDS/Neon) 3 replika bilan; Redis klaster; CDN majburiy.
- **DB:** **vertikal bo'lish** — `AuditLog`, `Message`, `UsageCounter` alohida Postgres instansiga (logical replication bilan ko'chirish); asosiy DB faqat tranzaksion (user, agent, billing).
- **Queue:** BullMQ Pro yoki Kafka'ga ko'chish qaroriga qaytiladi (yangi ADR); hozircha BullMQ + Redis klaster.
- **Cache:** ko'p qatlamli (Redis + CDN edge); `user limits`, `agent definition`, `template catalog` — kesh majburiy.
- **Storage:** R2 + multi-region.
- **AI Engine:** avtomatik miqyoslanuvchi guruh; **model marshrutlash** (oddiy vazifalar Haiku, murakkab Sonnet) — marja uchun hal qiluvchi; batch API kechiktirilishi mumkin bo'lgan ishlarga.
- **Browser:** alohida klaster, har foydalanuvchi uchun konkurentlik kvotasi.
- **Monitoring:** to'liq OTel + SLO error budget + on-call rotatsiya.
- **Xarajat drayverlari:** tokenlar (~55%), compute (~25%), DB (~12%), tarmoq/CDN (~8%).

### 10 000 000 foydalanuvchi (≈1M DAU)
- **Arxitektura:** mintaqaviy hujayralar (cells): har mintaqa (UZ/MENA/SEA) — to'liq stack + o'z DB'si; foydalanuvchi mintaqaga biriktiriladi (data residency talablari ham shu bilan yopiladi). Global qatlam: identifikator/marshrutlash xizmati.
- **Bottleneck:** cross-region konsistentlik, global marketplace, global audit.
- **Infra:** Kubernetes (bu bosqichda oqlanadi) yoki ECS; ko'p mintaqa; anycast CDN.
- **DB:** hujayra-per-mintaqa; global ma'lumot (marketplace katalogi, shablonlar) alohida replikalangan xizmat.
- **Queue:** Kafka (hodisa jurnali) + BullMQ (ish navbatlari).
- **Workers:** mintaqaviy parklar; GPU parki (kamera/vision) alohida.
- **Cache:** edge kesh + mintaqaviy Redis klaster.
- **AI Engine:** o'z inference qatlami yoki provayder-aralash (Anthropic + mahalliy model arzon vazifalar uchun); prompt-caching + model marshrutlash marjani belgilaydi.
- **Monitoring:** SRE amaliyoti, error budget, xaos mashqlari.
- **Xarajat drayverlari:** inference (~50%), compute (~25%), tarmoq (~15%), DB/saqlash (~10%).

**Miqyoslash qoidasi:** *har bosqichda birinchi savol — "bu ishni umuman qilmaslik mumkinmi?" (kesh, batch, arzon model). Infra qo'shish — ikkinchi javob.*

---

# 9. Technical Debt

Har band: **ED (muhandislik-kuni) · Biznes riski · Kelajakdagi bug ehtimoli**.

### Critical (18 ED) — bloklovchi
| Qarz | ED | Biznes riski | Bug ehtimoli |
|---|---|---|---|
| CI `master`da ishlamaydi | 0.5 | Yuqori — regressiya jim o'tadi | 95% (allaqachon sodir bo'lmoqda) |
| RBAC guard yo'q | 3 | **Kritik** — admin panel bilan ma'lumot sizishi | 80% |
| Pagination shartnomasi yo'q | 5 | Yuqori — admin panel qayta yoziladi | 90% |
| Companion pairing autentifikatsiyasiz | 2 | **Kritik** — qurilma o'g'irlash | 60% |
| Tenant scoping majburlanmagan | 3 | Kritik — cross-tenant sizish | 50% |
| Uncommitted 1.3k LOC blok | 1 | O'rta — ish yo'qolishi | 40% |
| Cron leader-lock yo'q (billing ikki marta) | 2 | **Kritik** — ikki marta pul yechish | 70% (ko'p instansga o'tganda 100%) |
| Xavfli admin amallari kontrollari | 3 | Kritik — qaytarib bo'lmas xato | 60% |

### High (30 ED)
| Qarz | ED | Biznes riski | Bug ehtimoli |
|---|---|---|---|
| Brauzer API jarayonida (OOM) | 8 | Yuqori — to'liq uzilish | 75% |
| Token-asosli billing yo'q | 6 | Yuqori — salbiy marja | 100% (allaqachon zarar) |
| `Int` pul shifti (21.4M so'm) | 3 | Yuqori — B2B hamyon buziladi | 40% |
| `Conversation.messages Json` | 5 | O'rta — sekinlashuv, analitika ko'r nuqtasi | 60% |
| JWT revocation yo'q | 2 | Yuqori | 35% |
| Observability yo'q | 2 | Yuqori — hodisa ko'rinmaydi | 100% |
| Throttler in-memory | 1 | O'rta — limit×N | 100% (ko'p instansda) |
| Integratsiya testlari yo'q | 5 | Yuqori — migratsiya/scoping xatolari | 70% |

### Medium (22 ED)
Enum'lar (3) · audit global lock (2) · fayl saqlash DB'da (3) · Clerk qoldiqlari (1) · legacy cookie (0.5) · `shared-types` → OpenAPI codegen (3) · API versiyalash (2) · yetishmayotgan indekslar (1) · RSC refaktor top-5 sahifa (4) · CSP (1.5) · config zod (1) · hujjatlar tozalash (2).
**Biznes riski:** o'rta · **Bug ehtimoli:** 30-50%.

### Low (12 ED)
`ClerkGuard` nomi (0.5) · `theme-toggle` o'lik kod (0.2) · `deletedAt` (1) · `: any` 69 ta (3) · Dockerfile o'lik `sed` (0.2) · marketplace `pg_trgm` (2) · `docs/prompts` arxivi (0.5) · companion-android papkasi (0.2) · DTO'larni `dto/`ga chiqarish (2) · bundle splitting (2.4).
**Biznes riski:** past · **Bug ehtimoli:** <20%.

**Jami qarz: ~82 ED.** Critical+High = 48 ED — bu §10'dagi Sprint 1-6 doirasida yopiladi.

---

# 10. Sprint Plan

**Sprint = 2 hafta = 10 ED.** Har sprintda ~8 ED reja + 2 ED zaxira (kutilmagan/ko'chirish).

### Sprint 1 — "Poydevorni qulflash" (P0 + P1 boshlanishi)
- **Objective:** Repo tekshiriladigan holatga keladi; jonli xavfsizlik teshiklari yopiladi.
- **Deliverables:** CI `master` + required checks + gitleaks + npm audit gate · device-control bloki test bilan commit (SEC-01 bilan birga) · `CLAUDE.md` · SEC-01 (pairing) · SEC-02 (companion kvota) · SEC-10 (engine pserv).
- **Dependencies:** yo'q.
- **AC:** CI har push'da yashil; pairing brute-force testi o'tadi; companion balanssiz 402 oladi; engine tashqaridan ochilmaydi.
- **Rollback:** har band alohida commit; `render.yaml` o'zgarishi bitta revert bilan qaytariladi.
- **Risk:** past. Eng katta xavf — device-control commit'ida yashiringan regressiya; shuning uchun avval test yoziladi.

### Sprint 2 — "Sessiya va tozalik" (P1 yakuni)
- **Objective:** Auth qatlamini yakuniy holatga keltirish.
- **Deliverables:** SEC-03 (`tokenVersion`, TTL 7 kun, refresh) · SEC-04 (legacy cookie) · SEC-09 (Clerk REMOVE) · SEC-08 (payload limitlari) · SEC-15 (dependency gate).
- **Dependencies:** Sprint 1 (CI).
- **AC:** eski token 401; `grep -ri clerk` toza; >1MB so'rov 413; refresh oqimi E2E o'tadi.
- **Rollback:** `tokenVersion` guard'ini feature-flag bilan o'chirish mumkin (`AUTH_ENFORCE_TOKEN_VERSION=false`).
- **Risk:** o'rta — barcha foydalanuvchilar bir marta chiqib ketadi. Yumshatish: reliz oldidan e'lon + tunda deploy.

### Sprint 3 — "Avtorizatsiya yadrosi" (P2)
- **Objective:** RBAC va scoping poydevori.
- **Deliverables:** SEC-05 (`RolesGuard`, `@Roles`, `UserRole` enum) · SEC-06 (`AdminQueryService`, ESLint scoping qoidasi) · `SUPPORT` roli · OWNER bootstrap skripti · rol matritsasi testi (40 assertion).
- **Dependencies:** Sprint 2.
- **AC:** dekoratorsiz endpoint `MEMBER` talab qiladi; ESLint scoping qoidasi CI'da bloklovchi va 0 istisno; OWNER bootstrap audit yozadi.
- **Rollback:** `RolesGuard` `APP_GUARD` ro'yxatidan olib tashlanadi (bitta satr) — RBAC vaqtincha o'chadi, mavjud xulq qaytadi.
- **Risk:** o'rta — noto'g'ri dekorator jonli endpointni bloklashi mumkin. Yumshatish: canary deploy + 403 monitoringi.

### Sprint 4 — "Ma'lumot shartnomasi I" (P3a)
- **Objective:** Ro'yxat va pul turlarini yakuniy shaklga keltirish.
- **Deliverables:** kursorli pagination shartnomasi (`PageQueryDto`, `paginate()`) + 12 ta og'ir ro'yxatga qo'llash · Prisma enum'lar (9 ta) · yetishmayotgan kompozit indekslar · audit lock per-actor.
- **Dependencies:** Sprint 3.
- **AC:** `skip:` API'da 0 marta; har ro'yxat `nextCursor` qaytaradi; enum migratsiyasi `USING` bilan ma'lumot yo'qotmaydi; audit zanjiri per-actor tekshiruvi o'tadi.
- **Rollback:** pagination — qo'shimcha parametr (orqaga-mos); enum migratsiyasi uchun `down` skripti tayyorlanadi va staging'da sinaladi.
- **Risk:** o'rta-yuqori (migratsiya). Yumshatish: migratsiya oldidan backup + staging'da to'liq nusxada mashq.

### Sprint 5 — "Ma'lumot shartnomasi II" (P3b)
- **Objective:** Pul va suhbat modelini kelajakka tayyorlash.
- **Deliverables:** `BigInt` pul migratsiyasi (serializatsiya + DTO'lar) · `Message` jadvali (dual-write + backfill skripti) · `deletedAt` REMOVE · Testcontainers integratsiya harness'i (SEC/billing modullari uchun).
- **Dependencies:** Sprint 4.
- **AC:** balans API'da string sifatida to'g'ri qaytadi; backfill 100% suhbatni ko'chiradi (hisob mos keladi); integratsiya testlari CI'da ishlaydi.
- **Rollback:** dual-write bosqichida eski JSON ustuni saqlanadi — o'qishni bir satr bilan qaytarish mumkin. Ustun faqat Sprint 7'da o'chiriladi.
- **Risk:** **yuqori** (pul + jonli ma'lumot). Yumshatish: read-path oxirgi ko'chiriladi; 7 kun ikkala manba solishtiriladi.

### Sprint 6 — "Admin panel I" (P4a)
- **Objective:** Admin panelning o'qish qatlami.
- **Deliverables:** `AdminModule` + `(admin)` layout + `DataTable` komponenti · Users (ro'yxat/detal/ledger) · Audit Viewer · Feedback ko'chirish · Admin dashboard KPI.
- **Dependencies:** Sprint 3 (RBAC) + Sprint 4 (pagination).
- **AC:** SUPPORT roli faqat o'qiy oladi; har admin so'rov `AdminQueryService` orqali; 10k satrli jadval 300ms ichida birinchi sahifani qaytaradi.
- **Rollback:** `(admin)` route guruhi va `AdminModule` butunlay olib tashlanadi — boshqa hech narsaga ta'sir qilmaydi (izolyatsiya talabi).
- **Risk:** past.

### Sprint 7 — "Admin panel II + xavfli amallar" (P4b)
- **Objective:** Yozish amallari va nazorat.
- **Deliverables:** SEC-11 (xavfli amal oqimi) · Users yozish amallari (kredit, blok, sessiya bekor qilish, GDPR o'chirish) · Billing/Subscriptions modullari · Agents modul · SEC-12 (impersonation) · `Conversation.messages` ustunini o'chirish (Sprint 5 backfill'i tasdiqlangach).
- **Dependencies:** Sprint 6 (Audit Viewer — impersonation sharti).
- **AC:** har xavfli amal: sabab + TOTP + ikki audit yozuvi + Telegram signal; impersonation read-only default va taqiqlangan amallar 403.
- **Rollback:** xavfli amallar feature-flag ostida (`ADMIN_DANGEROUS_ACTIONS=false` → UI'da ko'rinmaydi, endpoint 403).
- **Risk:** yuqori — admin xatosi qaytarilmas. Yumshatish: 24 soatlik bekor oynasi + zaxiradan tiklash mashqi.

### Sprint 8 — "Ko'rish qobiliyati" (P5)
- **Objective:** Topologiyani o'zgartirishdan oldin ko'rish.
- **Deliverables:** Sentry ×3 · pino JSON + request-id propagatsiyasi · 4 biznes-alert · chuqur `/api/health` · backup/restore mashqi · `docs/runbooks/` (incident, secret rotation, break-glass).
- **Dependencies:** Sprint 7.
- **AC:** sun'iy xato Sentry'da 60s ichida ko'rinadi; restore mashqi hujjatlashtirilgan va bajarilgan; har alert bir marta sinovdan o'tgan.
- **Rollback:** Sentry DSN'ni bo'shatish (kod ta'sirsiz).
- **Risk:** past.

### Sprint 9 — "Ijro-muhitini ajratish I" (P6a)
- **Objective:** Stateless API.
- **Deliverables:** Redis (Render) · Throttler Redis store · cron leader-lock · BullMQ infra + `browser` navbati · `apps/browser-worker` skeleti (bitta ish turi ishlaydi).
- **Dependencies:** Sprint 8.
- **AC:** API 2 instansda throttler bir xil hisoblaydi; cron bir marta ishlaydi (2 instans testi); brauzer-run worker'da bajariladi va SSE progress uzatiladi.
- **Rollback:** `RUNTIME_MODE=inprocess` env — eski in-process yo'lga qaytadi (ikkala yo'l bir sprintda birga yashaydi).
- **Risk:** yuqori. Yumshatish: ikkala yo'l parallel; 1 hafta soyada (shadow) ishlatiladi.

### Sprint 10 — "Ijro-muhitini ajratish II + billing" (P6b + P7 boshlanishi)
- **Objective:** Brauzerni to'liq ko'chirish va token-billing'ni boshlash.
- **Deliverables:** barcha brauzer/vision ishlari worker'da · `LoginCapture` REMOVE + UI halol xabar · SEC-07 (domen allowlist) · API+web `starter` plan · engine `usage` qaytarishi (token metering — 1-qism).
- **Dependencies:** Sprint 9.
- **AC:** API konteynerida Chromium jarayoni **yo'q**; ruxsatsiz domen bloklanadi; engine har javobda `usage` qaytaradi va u loglanadi (hali hisoblanmaydi).
- **Rollback:** `RUNTIME_MODE=inprocess` hali mavjud (Sprint 11'da olib tashlanadi).
- **Risk:** o'rta.

### Sprint 11+ (reja, yakuniy tafsilot Sprint 10 oxirida qulflanadi)
- Sprint 11: token-billing `hold → reconcile` to'liq + narx jadvali + foydalanuvchiga shaffoflik.
- Sprint 12: Performance (RSC top-5, bundle splitting, Redis kesh ADR bilan).
- Sprint 13: DX (OpenAPI codegen, `/api/v1`, hujjatlar tozalash, ADR arxivi).

---

# 11. Non-negotiable Engineering Rules (Muhandislik Konstitutsiyasi)

> Bu qoidalar **majburiy**. Qoidani buzish uchun yagona yo'l — yangi ADR. "Shoshilinch edi" — sabab emas.

### Avtorizatsiya va xavfsizlik
1. RBAC hech qachon chetlab o'tilmaydi. Har endpoint `@Roles()` bilan aniq belgilanadi.
2. Dekoratorsiz endpoint = `MEMBER` talab qiladi. "Ochiq" endpoint `@Public()` bilan **aniq** belgilanadi.
3. Har ma'lumot so'rovi ijara-scoped: `userId`/`ownerId` shart, yoki `AdminQueryService` orqali.
4. Cross-tenant o'qish faqat `AdminQueryService` ichida. Boshqa joyda — CI xatosi.
5. Engine hech qachon ommaviy internetga chiqarilmaydi.
6. Ichki servis chaqiruvlari doim `x-internal-token` bilan; taqqoslash doim `timingSafeEqual`.
7. Sir hech qachon logga, testga, xato-xabariga, git'ga tushmaydi.
8. Yangi sir turi `CryptoService` orqali shifrlanadi — xom saqlash taqiqlanadi.
9. Xavfli amal sabab + qayta-autentifikatsiya + ikkita audit yozuvisiz bajarilmaydi.
10. OWNER/ADMIN roli 2FA'siz berilmaydi.
11. Impersonation doim audit yoziladi va default read-only.
12. Foydalanuvchi kiritgan URL har doim `urlBlockedReason()` dan o'tadi (SSRF).
13. Foydalanuvchi kiritgan HTML hech qachon render qilinmaydi (`rehype-raw` taqiqlanadi).
14. Har yangi endpoint uchun: 1 auth testi + 1 scoping testi — majburiy.

### Pul
15. LLM chaqiruvidan **oldin** pul yechiladi (prepaid printsipi buzilmaydi).
16. Har pul o'zgarishi atomik: `updateMany + WHERE guard` yoki `$transaction` + advisory lock.
17. Har pul o'zgarishi `CreditLedger`/`CreatorLedger`ga yoziladi — balans yolg'iz o'zgartirilmaydi.
18. Refund har doim `idempotencyKey` bilan.
19. Tashqi to'lov webhook'i idempotent bo'lishi shart (bir xil `trans_id` ikki marta kreditlamaydi).
20. Pul summalari `BigInt` tiyin; float **hech qachon**.
21. Xizmat ko'rsatilmasa (xato/demo/uzilish) pul qaytariladi — jim ushlab qolish taqiqlanadi.

### Ma'lumot va Prisma
22. Prisma faqat `*.service.ts` ichida chaqiriladi (controller/guard/util/BFF — taqiqlanadi).
23. Xom SQL faqat advisory lock va migratsiyalarda; biznes so'rovi uchun xom SQL taqiqlanadi.
24. Har ro'yxat endpointi kursorli pagination bilan; `limit` maksimumi 100.
25. Har yangi `findMany` uchun mos indeks bo'lishi shart (`EXPLAIN` bilan tasdiqlanadi).
26. Holat maydonlari Prisma `enum` bilan; erkin string taqiqlanadi.
27. Har migratsiya orqaga qaytarish rejasi bilan keladi; `--accept-data-loss` **hech qachon**.
28. Jonli ma'lumot ustidagi sxema o'zgarishi dual-write → backfill → cutover tartibida.
29. `Json` ustun faqat sxemasiz metadata uchun; asosiy biznes obyekti uchun taqiqlanadi.
30. Har foydalanuvchiga tegishli model `onDelete: Cascade` yoki GDPR o'chirish yo'liga aniq qo'shiladi.

### Kod
31. `any` — faqat izoh bilan asoslanganda (`// any: <sabab>`); yangi kod uchun CI bloklaydi.
32. DTO takrorlanmaydi; har DTO o'z faylida (`dto/`), inline class taqiqlanadi.
33. Public API nomlari inglizcha; izohlar o'zbekcha.
34. `process.env` to'g'ridan-to'g'ri o'qilmaydi — tiplangan config orqali.
35. Har yangi UI matni **uchala** locale'ga qo'shiladi (CI kalit-tenglikni tekshiradi).
36. Yangi sahifa RSC-birinchi; `"use client"` faqat interaktiv barg komponentda.
37. Fayl 400 satrdan oshsa bo'linadi (service, sahifa, controller).
38. O'lik kod darhol o'chiriladi — "keyin kerak bo'ladi" taqiqlanadi (git tarixi bor).
39. Feature-flag'ning umri maksimum 2 sprint; keyin olib tashlanadi.
40. Yangi tashqi bog'liqlik ADR bilan asoslanadi (hajm, xavfsizlik, saqlanish).

### Test va CI
41. CI qizil bo'lsa merge yo'q. Istisno yo'q.
42. Test yozilmagan yangi kod merge qilinmaydi (o'zgargan satrlar coverage ≥80%).
43. Test skip/`.only` bilan merge qilinmaydi.
44. Migratsiya staging'da (jonli nusxada) sinalmasdan prod'ga chiqmaydi.
45. Deploy oldidan backup mavjudligi tasdiqlanadi.
46. Yiqilgan deploy 15 daqiqa ichida qaytariladi (fix-forward emas).
47. Har reliz uchun rollback yo'li oldindan yozilgan bo'ladi.

### Operatsiya
48. Xavfsizlik middleware'i hech qachon o'chirilmaydi (dev qulayligi uchun ham).
49. Prod'da Swagger yopiq qoladi.
50. Har cron ishi taqsimlangan lock ostida.
51. Uzoq (>10s) ish HTTP so'rovi ichida bajarilmaydi — navbatga chiqadi.
52. Har tashqi chaqiruv timeout va qayta-urinish siyosati bilan.
53. Har alert egasiga ega; egasiz alert o'chiriladi.
54. Hodisadan keyin 48 soat ichida post-mortem (aybsiz).
55. Feature freeze davrida yangi vertikal qo'shilmaydi.

---

# 12. Success Metrics

Barcha KPI'lar **haftalik** o'lchanadi va admin `/admin/ops` panelida ko'rinadi.

| Kategoriya | Metrika | Bugungi (taxminiy) | 3 oy maqsad | 12 oy maqsad |
|---|---|---|---|---|
| **Test** | O'zgargan satrlar coverage | yo'q (o'lchanmaydi) | ≥80% | ≥85% |
| | Integratsiya testlari soni | 0 | ≥40 | ≥120 |
| | E2E kritik oqimlar | 1 | 5 | 10 |
| | Flaky test darajasi | noma'lum | <2% | <1% |
| **CI/CD** | CI ishga tushish darajasi | **0%** | 100% | 100% |
| | CI davomiyligi (p95) | ~6 daq | <8 daq | <10 daq |
| | Deploy chastotasi | ~haftada 1 | haftada 3+ | kuniga 1+ |
| | O'zgarish muvaffaqiyatsizligi (CFR) | noma'lum | <15% | <10% |
| | Tiklanish vaqti (MTTR) | noma'lum | <60 daq | <30 daq |
| **Performance** | API p95 latency (o'qish) | o'lchanmaydi | <300ms | <200ms |
| | API p99 latency | — | <800ms | <500ms |
| | Chat birinchi token (TTFT) p95 | — | <2.5s | <1.8s |
| | DB so'rov p95 | — | <50ms | <30ms |
| | Web LCP (dashboard) | — | <2.5s | <2.0s |
| | Web JS bundle (dashboard, gzip) | ~o'lchanmagan | <250KB | <180KB |
| **Xavfsizlik** | Kritik/yuqori zaifliklar (prod deps) | noma'lum | 0 | 0 |
| | Guard'siz endpointlar | ~5 | 0 | 0 |
| | Sir sizishi (gitleaks) | noma'lum | 0 | 0 |
| | Sir rotatsiyasi | hech qachon | har 180 kun | har 90 kun |
| | 2FA yoqilgan adminlar | 0% | 100% | 100% |
| **Ishonchlilik** | Uptime (API) | o'lchanmaydi | 99.5% | 99.9% |
| | Error budget sarfi | — | <100%/oy | <80%/oy |
| | 5xx darajasi | — | <0.5% | <0.1% |
| | Yiqilgan navbat ishlari | — | <1% | <0.5% |
| | Backup tiklash mashqi | 0 | har chorak | har oy |
| **Biznes/Xarajat** | LLM xarajati / faol foydalanuvchi | noma'lum | o'lchanadi va <marja | 20% pasayish |
| | Yalpi marja (LLM'dan keyin) | noma'lum (salbiy bo'lishi mumkin) | >40% | >60% |
| | Infra xarajati / 1k foydalanuvchi | — | <$40 | <$25 |
| | To'lov webhook muvaffaqiyati | — | >99.5% | >99.9% |
| **Muhandis tezligi** | O'rtacha PR hajmi | — | <400 satr | <300 satr |
| | PR yashash vaqti | — | <2 kun | <1 kun |
| | Qarz nisbati (qarz ED / jami ED) | ~45% | <25% | <15% |
| | ADR'siz arxitektura o'zgarishi | — | 0 | 0 |

---

# 13. Final Verdict

## 13.1 Ballar (0-10)

| O'lcham | Ball | Izoh |
|---|:---:|---|
| **Architecture** | 7.5 | Chegaralar to'g'ri kesilgan, BFF/engine izolyatsiyasi sinfiy; minus — stateful in-process ish, RBAC yo'qligi |
| **Security** | 6.5 | Kripto, SSRF, atomiklik, audit — kuchli; minus — companion pairing, RBAC, revocation |
| **Scalability** | 3.5 | Uch joyda "bitta instans" farazi, pagination yo'q, kesh/navbat yo'q |
| **Maintainability** | 6.5 | Modul chegaralari va izohlar a'lo; minus — 27 modul/20 sahifa 1 muhandisga, semiz fayllar |
| **Developer Experience** | 5.0 | Turbo/tsc/lint sozlangan; minus — CI ishlamaydi, integratsiya test harness'i yo'q, tip codegen yo'q |
| **Operations** | 4.0 | Health + strukturaviy log + smoke-test bor; minus — Sentry yo'q, alert yo'q, runbook yo'q, backup mashqi yo'q |
| **Testing** | 5.5 | 253 test — jiddiy sarmoya; minus — hammasi mock, CI'da ishlamaydi, yangi modul 0 test |
| **Documentation** | 6.0 | `.env.example` va kod izohlari a'lo; minus — status hujjatlari eskirgan, CLAUDE.md yo'q |
| **Business Readiness** | 6.5 | Real to'lov, real konnektorlar, PLG halqalari, marketplace; minus — birlik-iqtisod noto'g'ri, payout stub |
| **Global Readiness** | 3.0 | i18n va ko'p-valyuta poydevori bor; minus — bitta mintaqa, bitta to'lov korridori, data-residency rejasi yo'q |
| **O'rtacha** | **5.4** | *Kuchli yadro, zaif ijro-muhiti va operatsiya* |

## 13.2 Muvaffaqiyat ehtimoli

| Ssenariy | Ehtimol | Asos |
|---|:---:|---|
| **Regional SaaS (UZ/Markaziy Osiyo)** | **75%** | Moat real (17 lokal konnektor, Payme+Click real protokol, uz/ru/en, halal). Texnik to'siqlar shu shartnoma bilan 3 oyda yopiladi. Asosiy xavf — texnik emas, **taqsimot va birlik-iqtisod**. |
| **Global SaaS** | **25%** | Arxitektura yetadi, lekin lokal moat global bozorda qiymatsiz; global raqobat (OpenAI/Anthropic/Zapier/Lindy) kapital jihatdan nomutanosib. Realistik yo'l — MENA/Janubi-Sharqiy Osiyo musulmon bozorlariga hujayrali kengayish (§8), "global" emas. |
| **Enterprise Platform** | **40%** | AgentOS/C-suite, compliance packlar, audit zanjiri, GovTech konnektorlari — asos bor. To'siq: SSO/SAML yo'q, SOC2 yo'q, SLA/on-call yo'q, org-scoping deyarli yo'q. Bular ~2 chorak qo'shimcha ish. |

## 13.3 Yakuniy javob

> **"CTO sifatida shu repozitoriyda davom etarmidingiz yoki noldan boshlarmidingiz?"**

# **DAVOM ETAMAN.** Noldan boshlash — noto'g'ri qaror bo'lardi.

**Nega:**

1. **Qayta yozish qiymat yaratmaydi.** Bu repoda ~42k satr **ishlaydigan** kod bor: 41 modelli sxema, 20 migratsiya, real Payme/Click protokoli, 17 lokal konnektor, 3 tilli 789-kalitli i18n, 253 o'tadigan test. Bularning hech biri arxitektura xatosi tufayli qayta yozilishi shart emas.

2. **Muammolar sinf jihatidan "tuzatiladigan", "tubdan noto'g'ri" emas.** Stateful in-process ish → worker'ga ko'chiriladi (8 ED). RBAC → guard qo'shiladi (3 ED). Pagination → shartnoma joriy etiladi (5 ED). Bularning birortasi ham domen modelini, ma'lumot sxemasini yoki servis chegaralarini o'zgartirmaydi. **Qayta yozish talab qiladigan yagona belgi — noto'g'ri domen modeli — bu yerda yo'q.**

3. **Eng qimmat aktiv — qaror tarixi.** Kod izohlarida "nega shunday qilingan" yozilgan: nega charge consume'dan oldin, nega advisory lock 4772, nega trust proxy `1` va `true` emas. Bu bilim qayta yozishda **yo'qoladi** va uni qayta kashf qilish narxi kod yozishdan qimmatroq.

4. **Xavfsizlik va pul mantiqi — eng qiyin qism — allaqachon yetuk.** Ko'pchilik loyihalar aynan shu yerda yiqiladi. Bu yerda atomik yechish, idempotent refund, hash-zanjirli audit, envelope shifrlash, SSRF guard allaqachon ishlaydi va testlangan. Noldan boshlash bu 6 oylik yetuklikni nolga qaytaradi.

5. **Qayta yozishning haqiqiy narxi:** ~6-9 oy, 0 yangi mijoz qiymati, va **yangi kod-baza aynan shu xatolarni takrorlaydi**, chunki xatolar bilim yetishmasligidan emas, **ustuvorlik tanlovidan** (feature'lar poydevordan oldin qurilgan) kelib chiqqan. Bu shartnoma aynan o'sha ustuvorlikni tuzatadi.

**Shart (bu qaror shartsiz emas):** yuqoridagi **Phase 0–4 (Sprint 1-7) bajarilmaguncha bironta yangi biznes-feature yozilmaydi.** Agar bu feature-freeze buzilsa — qarz o'sish tezligi tuzatish tezligidan oshadi va 6 oydan keyin javob "noldan boshlash" ga aylanadi. Bugun esa javob aniq: **davom etamiz.**

---

## Ilova — Hujjat boshqaruvi

- Bu shartnoma `docs/ENGINEERING_CONTRACT.md` da yashaydi va **faqat** yangi ADR bilan o'zgaradi.
- ADR'lar `docs/adr/NNNN-<mavzu>.md` (§5 dagilar birinchi 20 ta).
- Runbook'lar `docs/runbooks/` (incident, secret-rotation, break-glass, restore).
- `docs/ARCHITECTURAL_AUDIT.md` — muzlatilgan tarixiy hujjat (yangilanmaydi).
- Har sprint oxirida: metrikalar yangilanadi (§12), qarz ro'yxati qayta baholanadi (§9).
