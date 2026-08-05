# AgentNet — Arxitektura Auditi (Single Source of Truth)

**Sana:** 2026-08-01
**Auditor:** Software Architect (read-only discovery)
**Repository:** `C:\Users\User\Claude\Projects\agentnet`
**Branch:** `master` @ `4ad5e44` (= `origin/master`) + **13 o'zgargan / 11 kuzatilmagan fayl (uncommitted)**
**Metod:** faqat o'qish. Hech qanday kod, config, dependency, migratsiya o'zgartirilmadi.
**Tekshiruv dalili:** `npx jest` real ishga tushirildi → **30 suite / 253 test, hammasi PASS (71s)**.

> Bu hujjat keyingi barcha promptlar (admin panel va boshqalar) uchun yagona
> texnik asos (reference) sifatida ishlatiladi. Har bir tavsifda ustuvorlik
> (Critical / High / Medium / Low) va qisqa texnik asos ko'rsatilgan.

---

## 1. Executive Summary

AgentNet — **turbo-repo monorepo**dagi uch servisli AI-agent platformasi (Next.js web +
NestJS API + FastAPI agent-engine), Postgres/Prisma ustida. Bu MVP emas — bu
**kengaygan, ishlab turgan mahsulot**: 41 Prisma modeli, 20 migratsiya, 26 controller,
38 service, 17 real konnektor (soliq-uz, my-gov-uz, didox, uzum, eskiz, playmobile,
Payme, Click), 27 frontend sahifa, uch tilli (uz/ru/en) 789-kalitli i18n, 253 o'tadigan test.

**Kuchli tomonlar (haqiqiy, kod bilan tasdiqlangan):**
- **Pul yo'llari atomik**: `chargeForMessage`, `upgradePro`, Payme/Click webhooklar —
  hammasi `updateMany + WHERE guard` yoki `$transaction + pg_advisory_xact_lock`.
  Bu darajadagi puxtalik bu bosqichdagi loyihalarda kam uchraydi.
- **Xavfsizlik qatlamlari real**: HS256 imzolangan sessiya, httpOnly token + same-origin
  BFF proxy, at-rest AES-256-GCM (connector sirlari, 2FA, brauzer-sessiyalari, audit-yozuvlar),
  SSRF guard (DNS-resolve + har redirect hop), InternalTokenGuard (doimiy-vaqtli, prod fail-closed),
  hash-zanjirli AuditLog, engine ichki auth.
- **Lokal moat**: O'zbekiston konnektorlari + Payme/Click real protokol + halal filtr +
  uz/ru/en — global raqobatchilar takrorlay olmaydigan qatlam.

**Asosiy tashvishlar:**
1. **CI umuman ishlamaydi.** `.github/workflows/ci.yml` faqat `main`/`develop` branchlarida
   ishga tushadi, repo esa `master`da. Ya'ni 253 test, lint, typecheck, build — hech qachon
   avtomatik tekshirilmagan. Eng arzon-yuqori ROI tuzatish.
2. **Katta yangi quyi-tizim (Device Control + Companion + Call Recording + Browser Session)
   commit qilinmagan**, 0 test bilan, va uning `POST /device/companion/pair` endpointi
   **autentifikatsiyasiz** (6-xonali kod, muddat yo'q, urinish limiti yo'q).
3. **Bitta-instans arxitekturasi**: Chromium API jarayonining ichida ochiladi,
   `pending`/`interrupts` in-memory `Map`/`Set`, Throttler in-memory. Gorizontal
   miqyoslash bugungi kodda **mumkin emas**.
4. **Pagination umuman yo'q** (54 `findMany`, 0 `skip`/`cursor`) — admin panel uchun
   to'g'ridan-to'g'ri blocker.
5. **RBAC — faqat DB maydoni**, guard emas. `role` bo'yicha butun kodda **bitta** tekshiruv bor
   (`feedback.controller.ts:74`). Admin panel qurishdan oldin bu birinchi qurilishi kerak.
6. **CLAUDE.md repoda umuman yo'q** — agentli ishlash uchun qoidalar fayli yaratilmagan.

**Umumiy kod sifati bahosi: 6.8 / 10** (batafsil 11-bo'limda). Xavfsizlik va pul mantiqi
kuchli; miqyoslash, RBAC, test qamrovi va operatsion tayyorlik zaif.

---

## 2. Technology Stack

| Qatlam | Texnologiya | Qayerda | Vazifa |
|---|---|---|---|
| Monorepo | **Turborepo 2.3** + npm workspaces | `turbo.json`, `package.json` | build/lint/test/typecheck orkestratsiyasi |
| Frontend | **Next.js 15.1 (App Router) + React 19** | `apps/web` | SSR sahifalar, BFF route'lar, middleware |
| UI | **Tailwind 3.4 + Radix UI + shadcn naqshi** (`components.json`) | `apps/web/src/components/ui` | 10 ta bazaviy primitiv |
| Vizual | **three.js 0.185 + @react-three/fiber/drei, framer-motion 12, GSAP 3, lottie-react** | `components/three`, `components/neuro`, `components/hero` | "Liquid Obsidian" dark-only dizayn tizimi |
| State | **@tanstack/react-query 5** (26 faylda), `zustand` (deps'da bor, `agentStore.ts` faqat tip/holat) | `lib/providers.tsx` | server-state; global client-store deyarli ishlatilmaydi |
| i18n | O'z yechimi (server `getLocale` + client `LanguageProvider`) | `lib/i18n` | uz/ru/en, 789 kalit, uchtasi ham to'liq |
| Backend | **NestJS 10** (modular monolit) | `apps/api` | REST API, cron, webhooklar |
| ORM | **Prisma 6.19** | `apps/api/prisma` | 41 model, 20 migratsiya |
| Database | **PostgreSQL** (lokal: `pgvector/pgvector:pg16`) | `docker-compose.yml`, `render.yaml` | yagona saqlash manbai |
| Auth | **O'z HS256 JWT** (`auth/token.util.ts`) + OTP (email/SMS) + TOTP 2FA (`otplib`) | `apps/api/src/auth` | Clerk **login uchun ishlatilmaydi** (faqat webhook qoldig'i) |
| Authorization | `ClerkGuard` (autentifikatsiya), `InternalTokenGuard`, `LlmQuotaGuard` | `auth/`, `usage/` | **RBAC guard YO'Q** |
| API uslubi | REST + Swagger (`@nestjs/swagger`, faqat dev'da mount) | `main.ts` | `/api/*` prefiksi |
| Validation | `class-validator` + global `ValidationPipe({whitelist, transform})` | 14 faylda | DTO dekoratorlari |
| Rate limit | `@nestjs/throttler` 6 (60s/100), global `APP_GUARD` | `app.module.ts` | **in-memory** (Redis yo'q) |
| Queue | **Yo'q** | — | cron = `@nestjs/schedule` (in-process) |
| Cache | **Yo'q** (Redis ataylab olib tashlangan) | `docker-compose.yml` izohi | — |
| Storage | **Yo'q** (R2 kalitlari `.env.example`da, kodda ishlatilmaydi) | — | audio/rasm DB'da base64+shifrlangan |
| Search | Prisma `contains` + `mode:'insensitive'` | `marketplace.service.ts` | full-text index yo'q |
| AI Engine | **FastAPI 0.115 + LangGraph 0.2 + langchain-anthropic + anthropic 0.113** | `apps/agent-engine` | 26 modul, 44 endpoint, SSE streaming |
| LLM | **claude-sonnet-5** (17 joyda), `claude-haiku-4-5` (health tools), Gemini fallback (`google-genai`) | engine | — |
| Brauzer avtomatlashtirish | **Playwright 1.61** (chromium) | `apps/api/src/automation` | API jarayonining ichida |
| Payments | **Payme (JSON-RPC)** + **Click (Prepare/Complete)** — ikkalasi real protokol | `apps/api/src/billing` | prepaid wallet + platforma obunasi |
| Messaging | Telegraf (Telegram), Resend (email OTP), Eskiz/Playmobile (SMS) | `auth/`, `telegram/`, `connectors/` | — |
| Docker | 2 Dockerfile (api: node:26.5-slim + playwright; engine: python:3.12-slim) | `apps/*/Dockerfile` | — |
| Deployment | **Render blueprint** (`render.yaml`): 3 web servis + Postgres `starter` | — | Vercel config web'da ham bor |
| Testing | Jest 29 + ts-jest (**253 test / 30 suite**), pytest (**12 test**), Playwright E2E (**1 spec**) | — | — |
| Logging | Nest `Logger` + `AllExceptionsFilter` (request-id bilan) | `common/` | Sentry/OTel **yo'q** |
| Monitoring | `/api/health`, engine `/health` | `health.controller.ts` | metrika/alert yo'q |
| Build | `nest build` (tsc), `next build`, turbo | — | — |
| Package manager | **npm 10.9.2** (workspaces), pip (engine) | — | — |
| CI/CD | GitHub Actions (`ci.yml`) | `.github/workflows` | **branch nomi mos emas — ishlamaydi** |

---

## 3. Repository Structure

```
agentnet/
├── apps/
│   ├── web/                          # Next.js 15 (App Router) — 103 fayl, ~17.8k LOC
│   │   ├── e2e/                      # Playwright E2E (1 ssenariy: agent yaratish)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/           # sign-in, sign-up (catch-all Clerk qoldiq yo'llari)
│   │       │   ├── (dashboard)/      # 20 sahifa: agents, dashboard, retail, trade,
│   │       │   │                     #   govtech, operations, agentos, fusion, twin,
│   │       │   │                     #   goals, automation, device-control, connectors,
│   │       │   │                     #   marketplace, templates, pricing, settings,
│   │       │   │                     #   onboarding, supermode(->fusion redirect)
│   │       │   ├── api/              # BFF: chat/stream, device/browser/stream, session
│   │       │   ├── s/[token]/        # PUBLIC ulashilgan natija (PLG)
│   │       │   ├── agentos-demo/     # public demo
│   │       │   ├── layout.tsx  page.tsx  globals.css (470 satr dizayn tizimi)
│   │       ├── components/
│   │       │   ├── ui/               # 10 shadcn-naqsh primitivi
│   │       │   ├── neuro/            # "Liquid Obsidian" signature komponentlar
│   │       │   ├── three/ hero/      # 3D sahnalar, landing hero
│   │       │   ├── features/AgentOS/ # enterprise "living interface"
│   │       │   └── agents/ chat/ billing/ auth/ share/ help/ onboarding/ templates/
│   │       ├── lib/                  # api-client, session, i18n, providers, utils
│   │       └── middleware.ts         # auth-gate + /api/backend/* proxy (Authorization in'ektsiyasi)
│   │
│   ├── api/                          # NestJS 10 — 27 modul, ~17.3k LOC (4k test)
│   │   ├── prisma/                   # schema.prisma (954 satr, 41 model) + 20 migratsiya
│   │   └── src/
│   │       ├── auth/                 # ClerkGuard, token.util (HS256), OTP, 2FA, email/sms,
│   │       │                         #   InternalTokenGuard, AuditLogService (hash-chain)
│   │       ├── agents/               # CRUD, compose, run, pricing, trial/monthly billing
│   │       ├── billing/              # wallet, Payme, Click, platforma obunasi, webhooks
│   │       ├── usage/                # kunlik/global LLM kvota + LlmQuotaGuard
│   │       ├── automation/           # Playwright brauzer-agent + BrowserSession (login capture)
│   │       ├── device-control/       # ⚠️ UNCOMMITTED: companion, call recording, capability router
│   │       ├── connectors/           # SDK + 17 konnektor (registry naqshi)
│   │       ├── retail/ operations/ govtech/ trade/   # vertikal modullar
│   │       ├── twin/ goals/ intelligence/ agentos/   # "superpower" modullar
│   │       ├── marketplace/ templates/ share/ referral/ briefing/ feedback/
│   │       ├── crypto/ common/ prisma/ users/ conversations/ telegram/
│   │       └── main.ts app.module.ts health.controller.ts
│   │
│   ├── agent-engine/                 # FastAPI — 26 modul + 8 tool, ~7.1k LOC
│   │   ├── main.py (852)             # 44 endpoint + ichki auth middleware
│   │   ├── agent_engine.py streaming.py agent_tools.py llm_utils.py
│   │   ├── halal_filter.py           # 3 qatlam: lug'at → embedding → LLM
│   │   ├── role_detection.py (847)   # 16 domen taksonomiyasi
│   │   ├── agent_composer.py automation_planner.py computer_use_planner.py ⚠️(new)
│   │   ├── camera_router.py camera_service.py (himoyalangan import, CV deps alohida)
│   │   ├── retail_*.py trade.py govtech.py business_ops.py fusion.py supermode.py
│   │   │   ethics.py life_twin.py goal_engine.py knowledge_sync.py agentos.py
│   │   ├── tools/                    # islam, health, finance, calendar, messaging,
│   │   │                             #   utility, automation
│   │   └── test_engine.py (12 test)  requirements.txt  requirements-camera.txt
│   │
│   ├── companion-desktop/            # ⚠️ UNCOMMITTED: companion.mjs (poll-loop + nut-js stub)
│   └── companion-android/            # ⚠️ UNCOMMITTED: faqat README (kod yo'q)
│
├── packages/shared-types/            # ⚠️ amalda ISHLATILMAYDI (faqat next.config transpile ro'yxatida)
├── docs/                             # architecture/ guides/ status/ prompts/ pitch/
├── scripts/smoke-test.mjs            # deploy'dan keyingi 3-servis smoke testi
├── .github/workflows/ci.yml          # ⚠️ main/develop — repo `master`da
├── render.yaml docker-compose.yml Makefile start-all.sh LAUNCH.md ISHGA_TUSHIRISH.md README.md
└── .env.example (115 satr, yaxshi izohlangan)
```

**Uncommitted ish (git status):**
- O'zgargan (13): engine `main.py`/`llm_utils.py`/`requirements.txt`, `schema.prisma`,
  `app.module.ts`, automation (controller/service/browser-bridge), web `automation/page.tsx`,
  `sidebar.tsx`, 3 ta locale fayli.
- Yangi (11): `device-control/` (6 fayl), `browser-login.ts`, `computer_use_planner.py`,
  4 migratsiya, `device-control/page.tsx`, `api/device/`, `companion-desktop/`, `companion-android/`.

---

## 4. Architecture Overview

### 4.1 Servis topologiyasi

```
Brauzer
  │  (faqat same-origin)
  ▼
Next.js web ─── middleware.ts ──► /api/backend/*  ──rewrite──►  NestJS API
  │  (httpOnly cookie'dan Authorization qo'shadi)                    │
  ├── BFF: /api/chat/stream ────────────────────────────────────────┤ charge → consume → engine
  ├── BFF: /api/device/browser/stream ──────────────────────────────┤
  └── BFF: /api/session (token cookie o'rnatish/tozalash)           │
                                                                     │ x-internal-token
                                                          ┌──────────┴──────────┐
                                                          ▼                     ▼
                                                   FastAPI engine ───►  Anthropic / Gemini
                                                          │
                                                          └── web.automate / connector.invoke
                                                              (x-internal-token bilan API'ga qaytadi)
```

**Qaror:** brauzer NestJS API'ga to'g'ridan-to'g'ri bormaydi — hamma narsa Next
middleware proxy'sidan o'tadi. Bu **kuchli qaror**: token JS'ga ko'rinmaydi (XSS
token-o'g'irlash yopilgan), CORS yuzasi kichik. Narxi: middleware har so'rovda ishlaydi
va Edge'da imzoni tasdiqlay olmaydi (faqat UX-gate; haqiqiy tekshiruv API guard'da).

### 4.2 Qatlamlar (NestJS)

`Controller (DTO + guard) → Service (biznes mantiq + Prisma) → PrismaService`

- **Controller**: yupqa, `@UseGuards(ClerkGuard[, LlmQuotaGuard])`, `@CurrentUser()` dekoratori.
- **Service**: biznes mantiq **va** ma'lumot kirishi bir joyda — **Repository qatlami yo'q**.
- **Entity/Factory/Manager naqshlari yo'q** — Prisma model tiplari to'g'ridan-to'g'ri ishlatiladi.
- **DTO**: faqat 5 ta ajratilgan DTO fayli; qolgan DTO'lar controller fayllari ichida
  inline class sifatida (device-control'da 9 ta shunday).
- **Events**: EventEmitter/CQRS yo'q. Yon-ta'sirlar to'g'ridan-to'g'ri chaqiriladi
  (`audit.record(...)`, `void this.device.logAction(...)`).
- **Cross-cutting**: `APP_GUARD` (Throttler), `APP_FILTER` (AllExceptionsFilter),
  global `ValidationPipe`, `installEngineAuthInterceptor()` (yagona axios interceptor —
  13+ engine call-site avtomatik token oladi). **Bu — juda toza yechim.**

### 4.3 Engine (Python)

- `main.py` — 44 endpoint, `@app.middleware("http")` ichki-token guard (`/health` ochiq,
  prod'da default token fail-closed).
- Har vertikal alohida modul (`trade.py`, `govtech.py`, `retail_forecast.py`...) va
  **LLM-first + heuristik fallback** naqshi: kalit bo'lmasa yoki LLM yiqilsa deterministik
  javob. Bu naqsh butun engine bo'ylab izchil — **arxitekturaning eng kuchli tomonlaridan biri**.
- Halal filtr 3 qatlam: lug'at (regex) → embedding (ixtiyoriy) → Claude JSON klassifikatori.

### 4.4 Muhim arxitektura kuzatuvlari

1. **Modular monolit** — 27 NestJS moduli, aylanma bog'liqliksiz (`ReferralModule`
   ataylab `AuthModule`ni import qilmaydi). Bu bosqich uchun to'g'ri tanlov.
2. **Domen-chegaralari aralashgan**: `AuditLogService` `auth/auth.service.ts` ichida yashaydi
   va 10+ modul undan import qiladi — `common/`ga chiqishi kerak edi.
3. **Ikki mustaqil billing o'qi**: per-agent wallet (`balanceTiyin` + `CreditLedger`) va
   platforma obunasi (`platformPlan`). Ular ataylab izolyatsiya qilingan va bu
   `block-isolation.spec.ts` bilan qoplangan — **yaxshi muhandislik intizomi**.
4. **State in-process**: `AutomationService.pending` (ochiq Chromium oynalari),
   `interrupts` (Set), Throttler hisoblagichlari — hammasi bitta jarayon xotirasida.

---

## 5. Backend Analysis

### 5.1 Struktura va DI
- 27 modul, 38 service, 26 controller. `PrismaModule`, `CryptoModule` — `@Global`.
- Konstruktor-injeksiya izchil; `HttpModule` (axios) engine chaqiruvlari uchun.
- **Repository qatlami yo'q** → Prisma so'rovlari 38 service bo'ylab tarqalgan.
  Bitta so'rov naqshini (masalan `where: {userId}`) markazlashtirish imkoni yo'q.

### 5.2 API Platform / API dizayni
- API Platform (PHP ekotizimi) ishlatilmaydi — bu **NestJS REST**.
- URL naqshlari izchil: `/api/<resurs>` + `@ApiTags`/`@ApiBearerAuth`.
- Swagger faqat dev'da mount qilinadi (prod'da API sxemasi oshkor bo'lmaydi) — to'g'ri.
- **Versiyalash yo'q** (`/api/v1` yo'q) — mobil/companion mijozlar paydo bo'lgach
  buzilishga olib keladigan o'zgarishlarni boshqarish qiyinlashadi.

### 5.3 Validation
- Global `ValidationPipe({ whitelist: true, transform: true })` — dekoratorsiz maydonlar
  o'chiriladi (avval bu real bug bergan: `RefundDto.idempotencyKey` yo'qolib ketgan edi).
- 14 faylda `class-validator`. Lekin: `RecordingDto.data` (base64 audio) da **hech qanday
  hajm cheklovi yo'q** (`@MaxLength` yo'q) — 100MB base64 to'g'ridan-to'g'ri DB ustuniga
  yozilishi mumkin. `CommandDto.payload` — `@IsObject()` dan boshqa sxema yo'q.

### 5.4 Security qatlamlari (kodda)
- `ClerkGuard` (nomi eskirgan — endi Clerk'siz JWT guard).
- `InternalTokenGuard` — `timingSafeEqual`, prod'da ommaviy default rad etiladi.
- `LlmQuotaGuard` — 10+ engine-proxy endpointda.
- `@SkipThrottle` faqat BFF/webhook yo'llarida; `@Throttle` OTP/login'da (5-10/min).

### 5.5 Performance / konfiguratsiya
- `validateEnv()` `main.ts`da birinchi — prod'da yetishmayotgan env bitta aniq ro'yxat bilan.
- `trust proxy = 1` faqat prod'da (XFF spoofing'ga yo'l bermaydi) — to'g'ri nozik qaror.
- Xavfsizlik sarlavhalari qo'lda (helmet paketisiz): nosniff, X-Frame-Options, HSTS.

### 5.6 Naming / coding style
- **Izohlar o'zbekcha va juda batafsil** — har nozik qaror uchun "nega" yozilgan.
  Bu odatiy emas va **auditor uchun juda foydali**; lekin xalqaro jamoa uchun to'siq.
- Kod nomlari inglizcha, NestJS konvensiyasiga mos (`*.service.ts`, `*.controller.ts`).
- ESLint 9 (flat config), `no-explicit-any` — warning darajasida.

---

## 6. Frontend Analysis

### 6.1 Struktura
- App Router, ikki route-guruh: `(auth)` va `(dashboard)`; 27 `page.tsx`.
- `(dashboard)/layout.tsx` → `DashboardShell` → `Sidebar` (navigatsiya bitta joyda).
- 3 ta BFF route (`api/chat/stream`, `api/device/browser/stream`, `api/session`) —
  server sirlarini (INTERNAL_API_TOKEN) brauzerdan uzoqda ushlaydi.

### 6.2 Komponentlar
- `components/ui/` — 10 primitiv (button, card, dialog, input, badge, toast, tabs...).
  shadcn naqshi (`components.json` bor), lekin generatsiya qilingan to'liq to'plam emas.
- `components/neuro/` — dizayn tizimining "signature" qatlami (LiquidCard, NeuroCore,
  Waveform, Magnetic, SceneCanvas).
- `components/three/`, `components/hero/`, `features/AgentOS/` — og'ir 3D/animatsiya.

### 6.3 State va data-fetching
- **React Query** yagona server-state manbai (26 faylda `useQuery`/`useMutation`).
- `useApiClient()` — barcha chaqiruvlar `/api/backend/*` orqali; xato normalizatsiyasi
  va `apiErrorMessage(err, t)` bilan i18n-ga bog'langan xato matnlari — **yaxshi naqsh**.
- Zustand `package.json`da bor, lekin amalda global store yo'q.

### 6.4 Theme / Dark Mode / Responsive
- **Dark-only**: `layout.tsx` `dangerouslySetInnerHTML` bilan `dark` classini majburlaydi;
  `theme-toggle.tsx` fayli hali turibdi (o'lik qoldiq).
- `globals.css` 470 satr — CSS o'zgaruvchilari + utility'lar (`.liquid-glass`, `.cta-gold`).
- Responsive Tailwind breakpoint'lari bilan; mobil uchun alohida layout yo'q.

### 6.5 Kod sifati kuzatuvlari
- 103 fayldan **80 tasi `"use client"`** — SSR/RSC afzalligi deyarli ishlatilmayapti.
  Faqat `layout.tsx`, `s/[token]/page.tsx` va i18n server-qismi haqiqiy server komponenti.
- **69 ta `: any`** (ts/tsx bo'ylab).
- Eng katta fayllar: 3 locale (854-866), `settings/page.tsx` (578), `dashboard/page.tsx` (500),
  `retail/page.tsx` (484), `device-control/page.tsx` (466), `fusion/page.tsx` (462) —
  sahifalar **juda semiz**, ichida data-fetching + forma + render aralash.
- Bundle: three + drei + gsap + framer-motion + lottie + react-markdown bitta ilovada.
  Landing va dashboard uchun alohida code-splitting strategiyasi ko'rinmaydi.

---

## 7. Database Analysis

**Provider:** PostgreSQL. **Modellar:** 41. **Migratsiyalar:** 20 (4 tasi uncommitted).

### 7.1 Naming va konvensiyalar
- Model nomlari PascalCase, maydonlar camelCase — Prisma standarti. Izchil.
- **Enum yo'q** — barcha holat/rol/tur maydonlari `String` (`status`, `role`, `plan`,
  `kind`, `purpose`, `category`). Schema izohida bu ataylab deb yozilgan
  ("migratsiyada buzilmasligi uchun"), lekin natijada **DB darajasida qiymat kafolati yo'q**:
  `status = 'runing'` (typo) DB'ga bemalol tushadi.
- **Pul har doim `Int` (tiyin)** — float ishlatilmagan. To'g'ri qaror.
  Diqqat: `Int` = 2.1 mlrd tiyin ≈ 21 mln so'm; agregat/yig'indi maydonlar uchun chegara yaqin.

### 7.2 Kalitlar va munosabatlar
- Hamma `id` — **cuid** (UUID emas, lekin bir xil maqsad: taxmin qilinmaydi, sortlanadi).
- FK'lar to'g'ri e'lon qilingan; `onDelete` siyosati **aralash**:
  - `Cascade` — ~25 munosabatda (TwinFact, Goal, ConnectorConfig, Device*, Retail*).
  - `SetNull` — `Feedback.userId`, `User.referredById`.
  - **Default (Restrict)** — `Agent.userId`, `Conversation.userId/agentId`, `AuditLog.actorId`.
    Shuning uchun GDPR o'chirish (`users.controller` `DELETE /me`) bu uchtasini
    **qo'lda `$transaction` ichida** o'chiradi. Ishlaydi, lekin mo'rt: yangi model
    qo'shilganda unutilsa, o'chirish 500 beradi.
- **Soft delete**: faqat `User.deletedAt` bor va u **hech qayerda filtrlanmaydi**
  (kodda `deletedAt` bo'yicha `where` yo'q) — ya'ni amalda ishlamaydigan maydon.

### 7.3 Indekslar
- Har modelda `@@index([userId])` bor — asosiy egalik-so'rovlari qoplangan.
- Kompozit indekslar: `TwinFact([userId, category])`, `DeviceActionLog([userId, createdAt])`,
  `DeviceCommand([companionId, status])`, `UsageCounter @@unique([userId, day, kind])`,
  `ConnectorConfig @@unique([userId, connectorId, label])`, `BrowserSession @@unique([userId, domain])`.
- `AuditLog.seq @unique @default(autoincrement())` — hash-zanjir uchun monotonik tartib.
- **Yetishmayotgan indekslar**: `Conversation([userId, updatedAt])` (ro'yxat sortlash),
  `CreditLedger([userId, createdAt])` (balans tarixi), `Agent([userId, createdAt])`.
  Hozirgi hajmda muammo emas, admin panel filtrlarida darhol sezilади.
- **Full-text search yo'q** — marketplace qidiruvi `contains` (ILIKE `%...%`) → sekventsial skan.

### 7.4 Normalizatsiya
- Asosan 3NF. Ataylab denormalizatsiya:
  - `Agent.installCount/usageCount/ratingAvg/ratingCount` — agregat hisoblagichlar.
  - `Conversation.messages Json` — **butun suhbat bitta JSON ustunida**.
  - `Agent.originalCreatorId` — atributsiyani JOIN'siz saqlash uchun.

**`Conversation.messages Json` — eng jiddiy ma'lumot-modeli qarori.** Har yangi xabar
= butun massivni o'qish + yozish (`agents.service.ts:458` advisory lock bilan himoyalangan).
Oqibatlar: (a) uzun suhbatda yozish O(n) va satr kattalashadi (Postgres TOAST),
(b) xabar bo'yicha qidiruv/analitika/pagination mumkin emas, (c) admin panelda
"foydalanuvchi xabarlari" jadvalini ko'rsatish uchun butun JSON'ni yuklash kerak.

### 7.5 Audit
- `AuditLog` hash-zanjiri (`prevHash`/`entryHash` + `seq`), yozish `$transaction` +
  `pg_advisory_xact_lock(4771)` bilan seriyalashtirilgan. **Bu kuchli dizayn.**
- Narxi: **butun platformadagi har audit yozuvi bitta global lock uchun navbatda turadi** —
  yozuv hajmi oshganda bu birinchi DB bottleneck bo'ladi.

### 7.6 Scaling
- Read replica, sharding, partitioning tayyorgarligi yo'q (kutilgan holat).
- `UsageCounter.userId = "_global"` — FK'siz "sehrli qiymat" (model FK e'lon qilmaydi,
  shuning uchun ishlaydi). Ishlaydi, lekin nozik va hujjatsiz konvensiya.

---

## 8. Security Analysis

### 8.1 Authentication
- **Oqim**: `POST /auth/otp/request` (email→Resend / telefon→Eskiz) → 6-xonali kod
  (sha256 + `AUTH_JWT_SECRET` pepper bilan hash, ochiq saqlanmaydi, `OtpCode` jadvali)
  → `POST /auth/otp/verify` → agar `twoFactorEnabled` bo'lsa `needsTwoFactor` →
  `POST /auth/2fa/login-verify` (TOTP) → HS256 JWT (30 kun).
- `dev-login` controller darajasida `NODE_ENV !== production` bilan yopilgan.
- Token: `token.util.ts` — HS256, `timingSafeEqual`, `exp` tekshiriladi.
  `AUTH_JWT_SECRET` bo'lmasa tasodifiy fallback (restartda mass-logout, lekin
  `render.yaml` `generateValue` bilan ta'minlaydi).
- **Refresh token yo'q** — 30 kunlik uzoq JWT, **bekor qilish (revocation) mexanizmi yo'q**.
  O'g'irlangan token 30 kun amal qiladi; parol o'zgartirish tushunchasi ham yo'q.

### 8.2 Session
- `agentnet_token` — **httpOnly** (server `/api/session` o'rnatadi), `agentnet_user` —
  tokensiz profil (UI uchun). Middleware httpOnly cookie'ni `Authorization`ga aylantiradi.
- `SameSite=Lax` profil-cookie'da; token cookie sozlamalari `/api/session` route'da.
- **Legacy fallback hali ochiq**: `middleware.ts:13 legacyToken()` va BFF route'lar
  eski profil-cookie ichidagi tokenni ham qabul qiladi — migratsiya oynasi yopilishi kerak.

### 8.3 Authorization / RBAC
- **RBAC amalda yo'q.** `User.role` (`OWNER|ADMIN|MEMBER|VIEWER`) DB'da bor, lekin
  butun kodda **bitta** tekshiruv: `feedback.controller.ts:74` (`user.role !== 'OWNER'`).
- `@Roles()` dekoratori, `RolesGuard`, policy qatlami — **yo'q**.
- Rolni o'zgartiradigan endpoint ham yo'q (faqat qo'lda DB orqali).
- **Org-scoping ham deyarli yo'q**: `orgId` butun API'da 12 marta uchraydi;
  `Agent.orgId` bor, lekin so'rovlar `userId` bo'yicha filtrlanadi.
- **Ijobiy tomoni**: egalik (ownership) tekshiruvi izchil — deyarli har service
  `where: { id, userId: user.id }` naqshini ishlatadi (IDOR yuzasi kichik).

### 8.4 Encryption
- `CryptoService` — AES-256-GCM, versiyalangan `v1:` format, legacy plaintext'ga
  orqaga-moslik, prod'da `ENCRYPTION_KEY` **majburiy (fail-closed)**.
- Shifrlanadi: konnektor konfiglari (17 konnektor bitta nuqtadan), 2FA sirlari,
  brauzer `storageState` (cookie+localStorage), qo'ng'iroq yozuvlari.
- **Kalit rotatsiyasi yo'q** (`v1:` prefiksi tayyorgarlik bergan, lekin rotate skripti yo'q).

### 8.5 Rate limiting
- Global `ThrottlerGuard` 100 req/60s; OTP 5/min, verify 10/min.
- **In-memory** — bir nechta instansda har biri o'z hisobini yuritadi (limit×N).
- `@SkipThrottle` BFF endpointlarida (`charge-message`, `consume-chat`) — bu to'g'ri,
  chunki BFF bitta IP; lekin himoya endi to'liq **balans + kunlik kvota**ga tayanadi.

### 8.6 CSRF / XSS
- CSRF: API `Authorization` header bilan ishlaydi (cookie-avtomatik emas) →
  klassik CSRF yuzasi kichik. **Lekin** BFF route'lar (`/api/chat/stream`,
  `/api/device/browser/stream`, `/api/session`) **cookie bilan** autentifikatsiya qiladi
  va CSRF tokeni yo'q → boshqa saytdagi forma/`fetch` (SameSite=Lax POST'ni bloklaydi,
  shuning uchun amaliy xavf past, lekin kafolat sozlamaga bog'liq).
- XSS: React avtomatik escaping; `dangerouslySetInnerHTML` faqat theme-script'da (statik).
  `react-markdown` ishlatiladi — `rehype-raw` yo'q, ya'ni xom HTML render qilinmaydi (yaxshi).
- Xavfsizlik sarlavhalari: nosniff, X-Frame-Options: DENY, Referrer-Policy, HSTS (prod).
  **CSP yo'q.**

### 8.7 SSRF
- `common/ssrf.ts` — DNS-resolve + ichki IP/metadata bloklash, har redirect hop qayta
  tekshiriladi. Qo'llanilgan: brauzer `navigate` + `page.route()` tarmoq qatlami,
  raqobatchi narx-scrape, login-capture URL. **Sifatli implementatsiya.**

### 8.8 Audit logs
- Hash-zanjirli `AuditLog` + `DeviceActionLog` (qurilma harakatlari).
- **Auditni ko'radigan interfeys yo'q** (faqat `/agents/:id/trust-log`).

### 8.9 Aniqlangan xavfsizlik risklari

| # | Topilma | Fayl | Daraja |
|---|---|---|---|
| S1 | **Companion juftlash autentifikatsiyasiz**: `POST /device/companion/pair` — 6-xonali kod, **muddat yo'q, urinish limiti yo'q, hisobga bog'lanmagan**. Kod topilsa doimiy `x-companion-token` beriladi → navbatdagi buyruqlarni (SMS matni, telefon raqamlari) o'qish + `computer-use/plan` (LLM xarajati) chaqirish. Kod `pairingCode` sifatida `@unique` — ya'ni butun platforma bo'ylab 1M kalit maydoni. | `device-control/device-control.controller.ts:230`, `device-companion.service.ts:97` | **Critical** |
| S2 | **Companion yo'li kvota/billing'siz**: `companion/computer-use/plan` `LlmQuotaGuard`dan o'tmaydi va `chargeForMessage` chaqirmaydi; companion loop 15 iteratsiya × skrinshot (vision) — cheksiz Anthropic xarajati. | `device-control.controller.ts:250` | **High** |
| S3 | **Yozuv hajmi cheklanmagan**: `RecordingDto.data` (base64 audio) uchun `@MaxLength` yo'q, body-limit sozlanmagan (Nest default 100kb JSON — amalda bu **feature'ni buzadi**, lekin oshirilsa DB-flood yuzasi ochiladi). | `device-control.controller.ts:109` | **Medium** |
| S4 | **JWT bekor qilish yo'q** — 30 kunlik token, logout faqat cookie'ni o'chiradi; o'g'irlangan token amal qilaveradi. Qurilma-boshqaruv (SMS/qo'ng'iroq) huquqlari bilan bu jiddiylashadi. | `token.util.ts` | **High** |
| S5 | **Legacy cookie-token fallback** hali qabul qilinadi (XSS-mumkin bo'lgan eski yo'l). | `middleware.ts:13`, BFF route'lar | **Medium** |
| S6 | **RBAC yo'q** — admin huquqi bitta inline `if` bilan; hech qanday guard/dekorator. | butun API | **High** (admin panel uchun blocker) |
| S7 | **Brauzer-sessiyalari birlashtirilgan holda in'ektsiya qilinadi** — bitta run kontekstida foydalanuvchining BARCHA saytlaridagi cookie'lari mavjud; LLM-boshqariladigan agent prompt-injection ta'sirida boshqa saytga o'tishi mumkin. Domen-allowlist yo'q. | `automation.service.ts` `loadSession`/`mergeStorageStates` | **High** |
| S8 | **CSP yo'q**, `theme-toggle` kabi o'lik kod qolgan. | `layout.tsx` | **Low** |
| S9 | **Konnektor sirlarini deshifrlash logi**: `connectors.service.ts:95` `decryptJson` natijasi service'dan chiqadi — controller'da maskalanadi, lekin yangi chaqiruvchi qo'shsa sir sizishi oson. | `connectors.service.ts` | **Low** |

---

## 9. Performance Analysis

### 9.1 Caching
- **Yo'q.** Redis ataylab olib tashlangan; HTTP cache sarlavhalari yo'q; React Query
  `staleTime: 30s` — yagona kesh qatlami (klientda).
- `templates/registry.ts` (20 shablon) va `connectors.registry.ts` — kodda, ya'ni tabiiy kesh.

### 9.2 N+1 va so'rov naqshlari
- 54 `findMany`, 16 `include`. Ochiq N+1 halqalari kam — asosiy naqsh: bitta `findMany`
  + `map`. Lekin:
  - `automation.service.loadSession()` — barcha sessiyalarni o'qib **har birini alohida
    deshifrlaydi** (CPU, AES per row) — har brauzer-run boshida.
  - `marketplace.creatorDashboard` — 4 ta ketma-ket aggregate/findMany.
  - `dashboard/page.tsx` — bir nechta parallel `useQuery` (bu normal).

### 9.3 Pagination
- **Umuman yo'q**: `skip:`/`cursor:` butun API'da **0 marta**. `take:` faqat 13 faylda
  (asosan qattiq `take: 30/50`).
- Ta'sir: `GET /agents`, `GET /conversations`, `GET /device/actions`,
  `GET /automation/runs`, `GET /marketplace` — hammasi to'liq jadval qaytaradi.
  **Admin panel uchun bu birinchi navbatda tuzatilishi kerak.**

### 9.4 Lazy loading / bundle
- `three`, `drei`, `gsap`, `framer-motion`, `lottie-react`, `react-markdown` — hammasi
  asosiy `dependencies`da. `next/dynamic` ishlatilishi cheklangan.
- 80/103 komponent `"use client"` → JS bundle katta, RSC afzalligi yo'qolgan.

### 9.5 Backend performance
- **Chromium API jarayonining ichida** (`BrowserBridge`, `LoginCapture`). Render free
  (512MB) yoki starter (512MB-2GB) instansda bir necha parallel run = OOM.
  Konkurentlik cheklovi (semaphore/queue) **yo'q**.
- Cron'lar in-process (`@nestjs/schedule`): agent-billing (kunlik), platform-billing (10:00),
  briefing (dushanba 9:00), goals, competitor-price. **Bir nechta instansda har biri
  takroran ishlaydi** (leader election yo'q) → ikki marta yozib olish xavfi.
- LLM chaqiruvlari sinxron HTTP (`firstValueFrom`) — 60s timeout; navbat yo'q.

### 9.6 API performance
- SSE streaming chat va brauzer-agent uchun — to'g'ri tanlov.
- BFF `chat/stream` har so'rovda **3 ta ketma-ket ichki HTTP** (charge → consume → engine)
  qiladi. Latency +2 round-trip; alohida servislar bo'lgani uchun tarmoq xarajati real.

---

## 10. Documentation Analysis

| Hujjat | Holat | Baho |
|---|---|---|
| `README.md` | Arxitektura diagrammasi, quick start, stack | **Eskirgan**: Redis'ni stack va diagrammada ko'rsatadi (kodda yo'q), "Clerk Auth" deb yozadi (login OTP), `prisma migrate dev --name init` (20 migratsiya bor) |
| `ISHGA_TUSHIRISH.md` (88) | Windows-yo'naltirilgan quick start | Yaxshi, lekin README bilan **takrorlanadi** |
| `LAUNCH.md` (70) | Operator-only qadamlar (sirlar, e2e, biznes) | **Eng foydali** hujjat; dolzarb |
| `docs/architecture/texnik-strategiya.md` (320) | 2026-06-29 sanali MVP strategiyasi | Vizyon uchun yaxshi, **muhandislik holati bilan mos emas** (8 haftalik MVP rejasi allaqachon ortda qolgan) |
| `docs/status/prototip-holati.md` (455) | 2026-07-04 holati | **Eng eskirgan**: undan keyin 10+ katta partiya ish bo'lgan (OTP, device control, 15+ xavfsizlik tuzatishi) |
| `docs/status/roadmap.md` (161) | Tier 2 (native OS) rejasi | Qisman bajarilgan (companion qurildi) — yangilanmagan |
| `docs/guides/deployment.md` (75) | Render/Vercel | Asosan dolzarb; `render.yaml` bilan qisman takrorlanadi |
| `docs/guides/connector-sdk.md` (104) | Connector qo'shish yo'riqnomasi | **Dolzarb va aniq** — kod bilan mos |
| `docs/guides/threejs-integration.md` (127) | drei Html mo'rtligi | Nishe, lekin foydali |
| `docs/prompts/*` (6 fayl, 348) | Eski Claude Code promptlari | **Arxiv** — texnik qiymat yo'q, chalkashlik manbai |
| `docs/pitch/*` | Pitch deck + video skript | Biznes hujjatlari |
| `.env.example` (115) | Har o'zgaruvchi izohli | **A'lo** — repodagi eng yaxshi texnik hujjat |

**Xulosa:** hujjatlar **hajmi yetarli, dolzarbligi past**. `docs/status/` bo'limi
haqiqatni aks ettirmaydi va yangi kelgan muhandisni chalg'itadi. `docs/prompts/`
arxivga ko'chirilishi kerak.

### 10.1 CLAUDE.md tahlili

**CLAUDE.md repoda MAVJUD EMAS** (`find . -name CLAUDE.md` → 0 natija; `.claude/` faqat
`launch.json` saqlaydi). Prompt so'ragan tahlil obyekti yo'q, shuning uchun:

- Qaysi qoidalar yaxshi — **yo'q**
- Qaysi qoidalar takrorlangan — **yo'q**
- Qaysi qoidalar eskirgan — **yo'q**
- **Yetishmayotgani (agar yaratilsa, unda bo'lishi kerak):**
  1. Branch nomi `master` (CI mos emasligi shu yerda hujjatlashtirilishi kerak).
  2. Izohlar tili — o'zbekcha (mavjud konvensiya).
  3. `npm test` + `tsc --noEmit` har o'zgarishdan keyin (hozir og'zaki qoida).
  4. Prisma migratsiya nomlash konvensiyasi (`YYYYMMDDHHMMSS_snake_case`).
  5. Pul yo'llariga tegilganda atomiklik talabi (`updateMany + WHERE` yoki advisory lock).
  6. Yangi endpoint uchun guard matritsasi (ClerkGuard / LlmQuotaGuard / InternalTokenGuard).
  7. i18n: yangi UI matni **uchala** locale'ga qo'shilishi shart.

---

## 11. Code Quality Score

| Mezon | Ball | Asos |
|---|---|---|
| **Naming** | 8/10 | NestJS/Next konvensiyalari izchil; `ClerkGuard` nomi endi noto'g'ri (Clerk yo'q); `_global` sehrli qiymat |
| **SOLID** | 6/10 | SRP asosan hurmatlanadi, DI toza; lekin service'lar biznes+data'ni birlashtiradi (DIP buzilishi), `AuditLogService` `auth.service.ts` ichida (SRP), 500 satrli service'lar bor |
| **DRY** | 7/10 | Connector/template registry naqshi a'lo; engine-auth interceptor yagona nuqta; lekin `tokenPayload` web va API'da takrorlangan, `packages/shared-types` ishlatilmagani uchun tiplar ikki marta yozilgan, BFF route'larda cookie-o'qish mantiqi 3 marta |
| **KISS** | 6/10 | Ko'p joyda sodda; lekin ikki parallel billing o'qi + trial + platform plan + marketplace ledger = katta kognitiv yuk; 44 engine endpointi |
| **PSR-12** | N/A | PHP loyihasi emas. Ekvivalent: ESLint 9 flat config + Prettier + ruff/mypy (engine) — **hammasi sozlangan va toza** |
| **Readability** | 8/10 | Izohlar g'ayrioddiy darajada yaxshi ("nega" tushuntirilgan); minus — izohlar faqat o'zbekcha, ba'zi fayllarda kod izohdan qisqa |
| **Maintainability** | 6/10 | Modul chegaralari aniq; lekin 27 modul + 20 sahifa uchun 1 kishilik jamoa, `any`lar, semiz sahifalar, uncommitted katta blok |
| **Reusability** | 7/10 | Connector SDK, template registry, guard'lar, `LlmQuotaGuard` — qayta ishlatiladigan; UI primitivlari kam (10 ta), sahifalar o'z komponentlarini ichida saqlaydi |
| **Scalability** | 3/10 | In-memory throttler/interrupts/pending, jarayon ichidagi Chromium, pagination yo'q, kesh yo'q, navbat yo'q, cron leader-election yo'q, global audit lock |
| **Testability** | 6/10 | 253 test / 30 suite (mock-Prisma) — asosan pul/auth/kripto yo'llari; **device-control (~850 LOC) 0 test**, controller/e2e qamrovi minimal, integratsiya testi yo'q (Postgres'siz) |
| **Documentation** | 6/10 | `.env.example` va kod izohlari a'lo; `docs/status/` eskirgan; CLAUDE.md yo'q; API sxemasi faqat dev Swagger'da |

**O'rtacha: 6.3 / 10** (PSR-12 hisobga olinmagan).
Xavfsizlik va pul-mantiq alohida baholansa **8/10**, miqyoslash **3/10** — bu loyihaning
haqiqiy profili: *puxta yozilgan, lekin bitta serverga mo'ljallangan*.

---

## 12. Admin Panel Readiness

### 12.1 Tayyor (qayta ishlatiladi)

| Element | Qayerda | Izoh |
|---|---|---|
| Auth infratuzilmasi | `ClerkGuard`, `token.util`, OTP, 2FA | Admin ham xuddi shu login orqali kiradi |
| `User.role` maydoni | `schema.prisma:23` | `OWNER/ADMIN/MEMBER/VIEWER` — qiymatlar bor |
| Audit log | `AuditLogService` (hash-chain) + `AuditLog` modeli | Admin harakatlarini yozish uchun tayyor |
| `DeviceActionLog`, `AutomationRun`, `CreditLedger`, `CreatorLedger`, `UsageCounter` | Prisma | Admin ko'rsatadigan ma'lumot allaqachon yig'iladi |
| Billing servislari | `BillingService`, `PlatformBillingService`, `WalletCreditService` | Balans ko'rish/qo'lda kredit uchun asos |
| Feedback moduli | `feedback.controller.ts` | **Yagona mavjud admin-ekran naqshi** (OWNER-only tab `settings`da) |
| UI primitivlari | `components/ui/*` (10), `Toaster`, `error-state` | Jadval/forma qurish uchun asos |
| Data-fetching naqshi | `useApiClient` + React Query + `apiErrorMessage` | Yangi admin sahifalari darhol shu naqshdan foydalanadi |
| i18n | 789 kalit, 3 til | Admin matnlari shu tizimga qo'shiladi |
| Layout | `DashboardShell` + `Sidebar` | Admin bo'limi nav'ga qo'shiladi |

### 12.2 Tayyor emas (qurish kerak)

| Yetishmayotgan | Nima uchun blocker | Ustuvorlik |
|---|---|---|
| **RolesGuard + `@Roles()` dekoratori** | Hozir admin tekshiruvi bitta inline `if` — har yangi admin endpoint uni takrorlaydi va bittasini unutish = to'liq ma'lumot sizishi | **Critical** |
| **Rol boshqaruvi endpointi** | Rolni faqat DB'dan qo'lda o'zgartirish mumkin; birinchi OWNER qanday paydo bo'ladi — hujjatsiz | **High** |
| **Pagination + filtr + sort** | 0 ta `skip`/`cursor`. Admin "barcha foydalanuvchilar/to'lovlar" ro'yxatini ochsa butun jadval keladi | **Critical** |
| **Admin-scoped so'rovlar** | Hamma service `where: { userId: user.id }` bilan qattiq bog'langan — admin "boshqa foydalanuvchi nomidan" o'qiy olmaydi. Har service'ga admin-yo'li kerak (yoki alohida `AdminModule` + o'z so'rovlari) | **Critical** |
| **Jadval (DataTable) komponenti** | `components/ui`da jadval yo'q; har sahifa o'z kartalarini chizadi | **High** |
| **Audit ko'rish interfeysi** | Ma'lumot bor, ekran yo'q | **Medium** |
| **Impersonation / support-mode** | Qo'llab-quvvatlash uchun kerak, ammo xavfsizlik jihatdan alohida loyiha | **Low** |
| **Metrikalar/analitika agregatsiyasi** | `UsageCounter` kunlik, lekin platformaviy KPI so'rovlari (DAU, ARPU, churn) yozilmagan | **Medium** |
| **Server-side eksport (CSV)** | Faqat `GET /users/me/export` (o'z ma'lumoti) bor | **Low** |

### 12.3 Qayta ishlatiladigan aniq artefaktlar

- **Servislar**: `UsersService`, `BillingService`, `PlatformBillingService`, `UsageService`,
  `AuditLogService`, `MarketplaceService`, `FeedbackService`, `AgentsService`.
- **Entity/modellar**: `User`, `Agent`, `CreditLedger`, `PaymeTransaction`, `ClickTransaction`,
  `Payout`, `CreatorLedger`, `UsageCounter`, `AuditLog`, `Feedback`, `AutomationRun`,
  `DeviceActionLog`.
- **API'lar**: `/users/me*`, `/billing/*`, `/platform/*`, `/usage/me`, `/feedback` (admin GET/PATCH),
  `/marketplace/creator/dashboard`.
- **Komponentlar**: `Card`, `Badge`, `Dialog`, `AlertDialog`, `Tabs`, `Toast`, `ErrorState`,
  `InfoHint`, `LiquidCard`, `charts.tsx`.

---

## 13. Risks

| # | Risk | Turi | Ehtimol/Ta'sir | Yechim |
|---|---|---|---|---|
| R1 | **CI hech qachon ishlamaydi** (`main/develop` vs `master`) — regressiyalar sezilmaydi | Maintainability | Yuqori / Yuqori | `ci.yml`ga `master` qo'shish (1 satr). **Critical** |
| R2 | **Companion pairing brute-force** (S1) — begona qurilma tokeni | Security | O'rta / Kritik | Kodga TTL (10 daq), urinish limiti, `@Throttle`, foydalanuvchi tasdig'i |
| R3 | **Admin panel ma'lumot sizishi** — RolesGuard yo'qligida bitta unutilgan tekshiruv butun bazani ochadi | Security | Yuqori / Kritik | Avval `RolesGuard` + `AdminModule`, keyin ekranlar |
| R4 | **Pagination yo'qligi** — admin jadvali butun jadvalni yuklaydi, API timeout / OOM | Performance | Yuqori / Yuqori | Kursorli pagination standartini joriy etish |
| R5 | **Bitta instans qulfi** — Chromium in-process, in-memory throttler/interrupts, cron leader'siz | Scaling | Yuqori / Yuqori | Brauzerni alohida worker servisga; Redis (throttler+lock); cron uchun advisory-lock |
| R6 | **`Conversation.messages Json`** — uzun suhbatda yozish sekinlashadi, xabar-darajali admin ko'rinishi mumkin emas | Database | O'rta / Yuqori | Yangi `Message` jadvali + bosqichma-bosqich migratsiya |
| R7 | **Uncommitted katta blok** (device-control, 4 migratsiya, 0 test) — yo'qolish/konflikt xavfi | Maintainability | Yuqori / O'rta | Commit + test + code review |
| R8 | **Flat 500 so'm/xabar** — 8-tool-loop yoki uzun kontekstli agent real xarajatdan qimmat tushadi | Biznes/Xarajat | Yuqori / Yuqori | Token-asosli hisob (engine `usage` qaytarsin) |
| R9 | **Brauzer-sessiyalari birlashtirilgan in'ektsiyasi** (S7) — prompt-injection ta'sirida boshqa saytga kirish | Security/UX | O'rta / Kritik | Run-scoped domen allowlist + tasdiq |
| R10 | **Observability yo'q** (Sentry/OTel 0) — prod xatolari faqat Render loglarida | Operations | Yuqori / O'rta | `AllExceptionsFilter`da ulash nuqtasi bor — DSN qo'shish |
| R11 | **JWT revocation yo'q** (S4) — qurilma huquqlari bilan birga jiddiy | Security | O'rta / Yuqori | `tokenVersion` maydoni + guard tekshiruvi |
| R12 | **Enum yo'qligi** — `status`/`role` typo'lari DB'ga tushadi va admin filtrlarini buzadi | Database | O'rta / O'rta | Prisma enum yoki `CHECK` constraint |
| R13 | **Feature bloat** — 20 dashboard sahifa, 44 engine endpoint, 1 kishilik jamoa | Maintainability | Yuqori / O'rta | Sahifalarni foydalanish bo'yicha kesish/arxivlash |
| R14 | **Free plan spin-down** (`render.yaml` web+api `free`) — 30-60s sovuq start, cron o'tkazib yuboriladi | Operations | Yuqori / O'rta | API'ni starter'ga ko'tarish (operator qarori) |

---

## 14. Improvement Roadmap

### Critical (admin paneldan OLDIN)
| # | Tavsiya | Texnik asos |
|---|---|---|
| C1 | `.github/workflows/ci.yml`ga `master` branchini qo'shish | 253 test + lint + typecheck hozir hech qachon ishlamaydi; bir satrlik o'zgarish butun sifat-darvozasini yoqadi |
| C2 | `RolesGuard` + `@Roles()` dekoratori + `AdminModule` | Admin endpointlari uchun yagona avtorizatsiya nuqtasi; hozirgi inline `if` naqshi takrorlanishga va unutilishga mahkum |
| C3 | Kursorli pagination standarti (`take`/`cursor` + `PageDto`) | 54 `findMany`, 0 pagination; admin ro'yxatlari bugun butun jadvalni qaytaradi |
| C4 | Companion pairing'ni mustahkamlash: kod TTL, urinish hisobi, `@Throttle`, hisobga bog'lash | `POST /device/companion/pair` autentifikatsiyasiz va cheklovsiz — qurilma-boshqaruv tokeni beradi |
| C5 | Uncommitted device-control blokini test bilan commit qilish | ~1.3k LOC + 4 migratsiya versiya nazoratidan tashqarida |

### High
| # | Tavsiya | Texnik asos |
|---|---|---|
| H1 | Companion/computer-use yo'liga `LlmQuotaGuard` + billing | Kvotasiz vision-loop = cheklanmagan Anthropic xarajati |
| H2 | Brauzerni alohida worker servisga chiqarish (yoki qat'iy semaphore) | Chromium API jarayonida; 512MB instansda parallel run = OOM |
| H3 | Redis'ni **maqsadli** qaytarish: Throttler store + cron leader lock + brauzer navbati | Bugun 3 ta mustaqil "bitta instans" faraz mavjud |
| H4 | Token-asosli billing (engine haqiqiy `input/output` tokenlarni qaytarsin) | Flat 500 so'm/xabar real xarajat bilan bog'liq emas — og'ir agentlar zarar keltiradi |
| H5 | JWT `tokenVersion` + revocation | Logout/qurilma o'chirish real ta'sir bermaydi |
| H6 | Sentry (yoki OTel) DSN ulash | `AllExceptionsFilter`da tayyor nuqta bor, faqat konfiguratsiya |
| H7 | `Message` jadvali (Conversation JSON o'rniga) — bosqichma-bosqich | O(n) yozish, admin/analitika ko'rinishi mumkin emas |
| H8 | Brauzer-run uchun domen allowlist + foydalanuvchi tasdig'i | Birlashtirilgan sessiya in'ektsiyasi prompt-injection'ga ochiq |

### Medium
| # | Tavsiya | Texnik asos |
|---|---|---|
| M1 | `CLAUDE.md` yaratish (branch, test buyruqlari, guard matritsasi, i18n qoidasi, migratsiya nomlash) | Repoda umuman yo'q; agentli ishlashda har sessiya qoidalarni qaytadan kashf qiladi |
| M2 | Prisma `enum`lar (status/role/plan/kind) | DB darajasida qiymat kafolati; admin filtrlari ishonchli bo'ladi |
| M3 | `docs/status/*` yangilash yoki arxivlash; `docs/prompts/` → `docs/archive/` | Hujjatlar haqiqatdan ~1 oy orqada |
| M4 | README'dan Redis/Clerk da'volarini olib tashlash | Kod bilan mos emas |
| M5 | `packages/shared-types`ni haqiqatda ishlatish yoki o'chirish | Hozir faqat `next.config` transpile ro'yxatida; tiplar ikki joyda takrorlanadi |
| M6 | DTO'larni `dto/` papkalariga chiqarish (ayniqsa device-control'dagi 9 inline class) | Controller fayllari 342 satrga yetgan |
| M7 | Yetishmayotgan kompozit indekslar (`Conversation[userId,updatedAt]`, `CreditLedger[userId,createdAt]`) | Admin ro'yxatlari shu bo'yicha sortlaydi |
| M8 | `Dockerfile`dagi o'lik `sed sqlite→postgresql` qadamini olib tashlash | `schema.prisma` allaqachon `postgresql` — qadam hech narsa qilmaydi, chalg'itadi |
| M9 | Controller-darajasidagi (e2e) testlar: `supertest` + admin yo'llari | Hozirgi testlar service-darajasida mock-Prisma bilan |
| M10 | CSP sarlavhasi | XSS chuqurlikdagi himoya |

### Low
| # | Tavsiya | Texnik asos |
|---|---|---|
| L1 | `ClerkGuard` → `AuthGuard` nomini o'zgartirish | Clerk login uchun ishlatilmaydi — nom chalg'itadi |
| L2 | `theme-toggle.tsx` va light-mode qoldiqlarini o'chirish | Dark-only qaror qabul qilingan |
| L3 | `deletedAt` (soft delete) — yo ishlatish yo o'chirish | Hozir hech qayerda filtrlanmaydi |
| L4 | API versiyalash (`/api/v1`) | Companion/mobil mijozlar paydo bo'lgandan keyin qiyinlashadi |
| L5 | Marketplace qidiruvi uchun `pg_trgm`/tsvector | `contains` ILIKE sekventsial skan |
| L6 | `: any` (69 ta web'da) kamaytirish | Tip xavfsizligi |
| L7 | `companion-android` — yo kod qo'shish yo README'ni "reja" deb belgilash | Hozir bo'sh papka |

---

## 15. Recommended Next Steps

**Admin panel qurishdan oldingi tartib (bog'liqlik bo'yicha):**

1. **C1 — CI branch tuzatish** (5 daqiqa). Busiz keyingi har bir qadam tekshirilmagan qoladi.
2. **C5 — uncommitted blokni commit qilish** (+ device-control uchun kamida
   pairing/permission testlari). Yangi ish toza bazadan boshlansin.
3. **C4 + H1 — companion xavfsizlik/kvota tuzatishlari.** Bu allaqachon jonli kod;
   admin panel uni yanada ko'proq ochadi.
4. **C2 — `RolesGuard` + `AdminModule` skeleti** (endpoint'siz, faqat avtorizatsiya poydevori).
5. **C3 — pagination standarti** (`PageDto` + kursor) va uni avval mavjud og'ir
   ro'yxatlarga qo'llash (`agents`, `conversations`, `automation/runs`, `device/actions`).
6. **M1 — `CLAUDE.md`** (branch, test buyruqlari, guard matritsasi, i18n, migratsiya nomlash).
7. Shundan keyingina **admin panel ekranlari**: foydalanuvchilar → to'lovlar/ledger →
   agentlar → audit → feedback. Har ekran uchun: `AdminModule` endpointi +
   `@Roles('OWNER','ADMIN')` + kursorli pagination + `DataTable` komponenti.

**Parallel (admin panelga bog'liq emas, lekin muhim):**
- H6 (Sentry), H4 (token-billing), H3 (Redis), H2 (brauzer worker).

**Ochiq savollar (mahsulot egasi hal qilishi kerak):**
- Birinchi `OWNER` qanday tayinlanadi (seed skript / env / qo'lda SQL)?
- Admin panel alohida route-guruh (`(admin)`) bo'ladimi yoki `settings` ichida tab?
- Impersonation (foydalanuvchi nomidan ko'rish) kerakmi — bu audit va huquqiy talablarni oshiradi.
- Feature bloat: 20 dashboard sahifadan qaysilari admin panelda ham boshqarilishi kerak?

---

## Ilova A — Tekshirilgan asosiy fayllar

`apps/api/src/main.ts`, `app.module.ts`, `prisma/schema.prisma`, `auth/{clerk.guard,token.util,auth.controller}.ts`,
`billing/billing.service.ts`, `usage/{usage.service,llm-quota.guard}.ts`, `agents/agents.service.ts`,
`automation/{automation.service,browser-login}.ts`, `device-control/*` (6 fayl),
`marketplace/marketplace.service.ts`, `connectors/*`, `common/{ssrf,engine-auth,validate-env,all-exceptions.filter}.ts`,
`apps/web/src/{middleware.ts,lib/{session,api-client,providers}.ts,app/layout.tsx,app/api/**}`,
`apps/agent-engine/{main.py,halal_filter.py,requirements.txt,test_engine.py}`,
`apps/companion-desktop/companion.mjs`, `render.yaml`, `.github/workflows/ci.yml`,
`docker-compose.yml`, `Dockerfile`(×2), `.env.example`, `README.md`, `docs/**`.

## Ilova B — O'lchamlar

| Metrik | Qiymat |
|---|---|
| Prisma modellari / migratsiyalar | 41 / 20 |
| NestJS modul / controller / service / spec | 27 / 26 / 38 / 30 |
| API LOC (test bilan / testsiz) | 17 343 / 13 307 |
| Web fayllar / LOC / `"use client"` | 103 / 17 804 / 80 |
| Web sahifalar (`page.tsx`) | 27 |
| Engine modul / tool / LOC / endpoint | 26 / 8 / 7 127 / 44 |
| Konnektorlar | 17 |
| i18n kalitlar × til | ~789 × 3 |
| Testlar | API 253 (30 suite) · engine 12 · E2E 1 |
| `findMany` / pagination | 54 / 0 |
| `$transaction` / advisory lock | 21 / 5 |
