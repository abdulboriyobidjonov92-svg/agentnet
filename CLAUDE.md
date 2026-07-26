# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

AgentNet ("Baraka AI") is a "halal-first" no-code AI agent platform targeting Uzbekistan/CIS users. Users pick a profession, get profession-tailored AI agents, and every agent action passes through a halal/ethical content filter. Most product docs and in-code comments are written in **Uzbek** — expect this when reading `docs/`, `README.md`, and inline comments.

Turborepo/npm-workspaces monorepo, three runtime services + one shared package:

| Path | Service | Stack | Port |
|---|---|---|---|
| `apps/web` | Frontend | Next.js 15 (App Router) + React 19 | 3000 |
| `apps/api` | Core backend | NestJS 10 + Prisma + PostgreSQL | 3001 |
| `apps/agent-engine` | Agent orchestration | FastAPI (Python) + LangGraph + Claude | 8000 |
| `packages/shared-types` | Shared TS types, consumed as source (no build step) | | |

## Commands

All root scripts fan out through Turborepo to each workspace (`turbo.json`).

```bash
npm install              # install everything (root, one node_modules via workspaces)
npm run dev               # turbo run dev — starts web + api concurrently (NOT agent-engine, that's Python)
npm run build              # turbo run build
npm run lint                # turbo run lint
npm run test                 # turbo run test
npm run typecheck             # turbo run typecheck
npm run db:generate            # prisma generate (apps/api)
npm run db:migrate              # prisma migrate dev (apps/api)
npm run format                   # prettier --write "**/*.{ts,tsx,md,json}" (no .prettierrc — uses Prettier defaults)
```

Local infra: `docker compose up -d` starts **only Postgres** (`pgvector/pgvector:pg16`, db `agentnet_dev`, port 5432). There is **no Redis** in this stack — it was deliberately removed (nothing in the code used it; `ThrottlerModule` rate limiting is in-memory). Ignore stale Redis mentions in `README.md`, `ISHGA_TUSHIRISH.md`, and the `Makefile` comments — they're outdated. An optional `agent-engine` compose service exists behind `--profile full`.

### apps/api (NestJS)

```bash
cd apps/api
npm run dev            # nest start --watch
npm run build            # nest build
npm run lint               # eslint src --ext .ts
npm run typecheck            # tsc --noEmit
npm test                       # jest (rootDir: src, matches *.spec.ts)
npx jest auth.service.spec.ts    # run a single test file
npx jest -t "should verify otp"    # run tests matching a name
npx prisma migrate dev --name x      # new migration
npx prisma generate                    # regen client after schema.prisma changes
npx prisma studio                        # inspect DB
```

### apps/web (Next.js)

```bash
cd apps/web
npm run dev            # next dev --port 3000
npm run build             # next build
npm run lint                # next lint
npm run typecheck             # tsc --noEmit
npm run test:e2e                # playwright test (spins up api + web itself; needs Postgres running + migrated)
npx playwright test e2e/create-agent.spec.ts   # run a single e2e spec
```
Playwright e2e runs are **not parallel** (`fullyParallel: false`) — the suite depends on shared DB/test-user state, so specs run serially.

### apps/agent-engine (FastAPI / Python)

```bash
cd apps/agent-engine
python -m venv .venv && source .venv/bin/activate     # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt        # core deps only; requirements-camera.txt is separate/optional
                                          # (heavy CV libs — opencv/torch/ultralytics — split out to fit Render's 512MB free plan;
                                          #  main.py guards the camera router import so the engine runs fine without them)
uvicorn main:app --reload --port 8000
ruff check .                    # lint
mypy . --ignore-missing-imports    # typecheck — blocking in CI
pytest --tb=short -q                 # full suite
pytest test_engine.py::test_halal_keyword_layer   # single test
```

Runs fine with **no `ANTHROPIC_API_KEY` set** — most engine modules fall back to heuristics/demo mode (see "LLM-first + heuristic fallback" below), which is how CI and local dev without a real key still work.

### Running everything locally

Three terminals, in order: Postgres (`docker compose up -d`) → migrate (`cd apps/api && npx prisma migrate dev`) → `apps/agent-engine` (`uvicorn main:app --reload --port 8000`) → `apps/api` (`npm run dev`) → `apps/web` (`npm run dev`). `apps/web`'s `npm run test:e2e` will itself boot `apps/api` and `apps/web` as Playwright `webServer`s, but Postgres + migrations must already be up.

## Architecture

### Service boundaries and internal auth

`apps/web` (Next.js route handlers under `src/app/api/*` act as a BFF) → `apps/api` (NestJS) → `apps/agent-engine` (FastAPI) for anything agent/LLM-related. All server-to-server calls between the three carry a shared `x-internal-token` header (`INTERNAL_API_TOKEN` env var, identical across all three services) — the API's `internal-token.guard.ts` and the engine's equivalent check reject requests without it and **fail closed in production** if the token is left at its dev default. `apps/api/src/main.ts` installs a global axios interceptor (`installEngineAuthInterceptor`) so every outbound call to agent-engine automatically carries this header.

### Auth is NOT Clerk, despite the dependency

`@clerk/backend` is present and `POST /auth/webhooks/clerk` (verified via `svix` against the raw request body — hence `rawBody: true` on the Nest app) still exists, but it's only a legacy/alternate user-sync path. **Primary login is custom**: `POST /auth/otp/request` → `POST /auth/otp/verify` (email via Resend or SMS via Eskiz.uz — `apps/api/src/auth/otp.service.ts`), then `POST /auth/2fa/login-verify` if the user has TOTP 2FA enabled (`otplib`/`qrcode`). Sessions are locally-signed JWTs (`token.util.ts`), verified by `ClerkGuard` (name is a holdover; it's Clerk-free) which attaches `request.dbUser`. `POST /auth/dev-login` (passwordless-by-email) is hard-disabled outside `NODE_ENV !== 'production'`.

### Prepaid billing gates every LLM call

`User.balanceTiyin` (wallet, in UZS tiyin) + `CreditLedger` (idempotency-key-protected ledger) mean **no LLM call executes unless the user's balance covers it** — this is deliberate so the platform operator never subsidizes usage. Payme and Click (Uzbek payment gateways) top up balance via their respective webhook protocols (`PaymeTransaction`/`ClickTransaction` models, JSON-RPC for Payme, Prepare/Complete for Click). On top of the wallet, `UsageCounter` + env vars (`USAGE_FREE_CHAT_PER_DAY`, `USAGE_PRO_CHAT_PER_DAY`, `USAGE_GLOBAL_LLM_PER_DAY`, etc.) enforce daily rate limits, including a global daily LLM cap as a cost circuit-breaker.

### LLM-first, heuristic-fallback is the dominant engine pattern

Nearly every `apps/agent-engine` module (halal filter, role/profession detection, retail forecasting, business-ops parsing, GovTech triage, ethics evaluation) tries Claude first and falls back to keyword/regex heuristics when there's no API key or the LLM call fails. Results generally carry a `method: "llm" | "heuristic"` (or similar) tag so callers know which path produced them. This is why the whole platform is usable in "demo mode" with zero `ANTHROPIC_API_KEY` configured.

### Halal filter (`apps/agent-engine/halal_filter.py`)

Three layers, cheapest first: (1) regex/keyword blocklist (uz/ru/en) — the deterministic, directly-tested layer; (2) embedding-based semantic similarity (soft-guarded, optional numpy dep); (3) low-confidence fallback to Claude for JSON classification. Categories: `QIMOR` (gambling), `RIBO` (usury/interest), `NOJOYA_KONTENT` (explicit/drugs), `FITNA` (incitement/hate), `XAVFSIZ` (safe), `NOANIQ` (unclear); actions: `BLOCK` / `ALLOW` / `HUMAN_REVIEW`. `Agent.halalFilterEnabled` is always true — this is a core, non-optional layer, not a toggleable feature. Explicitly documented in code as a technical guardrail, not a religious ruling authority.

### Agent orchestration (`apps/agent-engine`)

- `agent_engine.py` — LangGraph-based `AgentEngine`/`AgentDefinition`/`ToolRegistry` core, used by the blocking `/agents/run` path. `langchain_anthropic`/`langgraph` imports are lazily guarded (`_LANGGRAPH_AVAILABLE`) so the module degrades gracefully if unavailable.
- `streaming.py` — the primary chat path, SSE-based (`sse_starlette`), does **not** depend on LangGraph. Loads a vertical "compliance pack" (`compliance_packs.py`) into the system prompt, bounds tool-call rounds (`_MAX_TOOL_ROUNDS`) and total tool iterations (`AGENT_MAX_TOOL_ITERATIONS`, default 8) as a cost/runaway-loop guard.
- `role_detection.py` — 16-domain profession taxonomy (healthcare, law, gov service, education, agriculture, retail/trade, finance, IT, construction, transport, food, industry, religion, media, sport, general); LLM-first with keyword fallback; unmatched professions land in `"general"`, never a hard-coded closed list.
- `tools/` (per-domain: calendar, finance, health, islam, messaging, automation, utility) vs. top-level `agent_tools.py` (the function-calling registry actually exposed to Claude — deliberately excludes side-effecting tools like `messaging.telegram_send` from the "info-only" set, and sanitizes tool names since Claude disallows dots).
- Each top-level `apps/agent-engine/*.py` module (`agentos.py`, `automation_planner.py`, `business_ops.py`, `ethics.py`, `fusion.py`, `goal_engine.py`, `govtech.py`, `knowledge_sync.py`, `life_twin.py`, `retail_forecast.py`, `retail_intel.py`, `supermode.py`, `trade.py`) is the engine-side counterpart of an identically-named NestJS module (`apps/api/src/*`) and web dashboard route (`apps/web/src/app/(dashboard)/*`) — when working on one of these features, expect to touch all three layers.

### NestJS module map (`apps/api/src/app.module.ts`)

`AppModule` wires ~25 feature modules: `auth`, `prisma`, `crypto`, `agents`, `conversations`, `users`, `marketplace`, `telegram`, `twin`, `goals`, `intelligence`, `agentos`, `automation`, `connectors`, `retail`, `operations`, `govtech`, `trade`, `usage`, `billing`, `templates`, `feedback`, `share`, `referral`, `briefing`, `admin`. Global: `ThrottlerModule` (100 req/min per IP, in-memory), `ScheduleModule` (cron — e.g. daily goal advancement/briefing), `APP_GUARD → ThrottlerGuard`, `APP_FILTER → AllExceptionsFilter`.

Notable `main.ts` behavior: Swagger (`/api/docs`) mounts only when `NODE_ENV !== 'production'`; `trust proxy` is set only in prod (single Render hop); manual security headers are set by hand (no `helmet` dependency); CORS allows no-origin, any-localhost in dev, and exact `NEXT_PUBLIC_APP_URL` match in prod.

### Prisma schema (`apps/api/prisma/schema.prisma`)

Single Postgres schema, ~31 models. Key groupings: core identity (`User`, `Org`, `OrgCommand`), agents/chat (`Agent`, `Conversation`), Life Twin/goals (`TwinFact`, `Goal`, `GoalTask`), audit (`AuditLog` — hash-chained via `prevHash`/`entryHash`/monotonic `seq`, written under a Postgres advisory lock to keep the chain serial under concurrency; `OtpCode` — stores only a salted hash of the OTP, never the raw code), the admin-managed catalog (`Category`, `Product` — see "Admin panel" below), and the "Part 1B superpowers": browser automation (`AutomationRun`), the Connector SDK (`ConnectorConfig`), retail intelligence (`RetailProduct`/`RetailSale`/`VisionEvent`/`RetailAlert`/`RetailSettings`/`ReorderDraft`/`CompetitorSource`/`CompetitorPriceCheck`), business ops (`Employee`/`Shift`/`TimeOff`/`OutboundMessage`), GovTech (`CitizenRequest`, explicitly not wired to a real government API yet), and marketplace economics (`AgentInstall`/`AgentReview`/`CreatorLedger`/`Payout`, 70/30 creator split). `User.role` is a plain `String`, not a Prisma enum (kept that way from an earlier SQLite-compat constraint — values are `OWNER`/`ADMIN`/`MEMBER`/`VIEWER`, mirrored in `packages/shared-types`).

### Admin panel (`apps/api/src/admin`, `apps/web/src/app/(dashboard)/admin`)

Platform super-admin panel — reuses the existing `User.role === 'OWNER'` convention as "super-admin" (same check the `feedback` module already used; there's no separate `SUPER_ADMIN` role). Backend: `AdminGuard` (`admin.guard.ts`) composes after `ClerkGuard` on every `/admin/*` route and 403s anyone who isn't `OWNER` — this is the real security boundary; the frontend `admin/layout.tsx` gate (hide-and-redirect for non-owners) is UX only. Four sub-areas, each its own controller/service pair: `categories` (CRUD for `Category`, shared taxonomy for both agents and the product catalog via a `type: "agent" | "product"` discriminator), `products` (CRUD for the global `Product` catalog — distinct from the per-user `RetailProduct` inventory model used by the retail feature), `agents-admin` (moderate *any* user's agent: publish/verify/freeze/toggle halal filter/change price or category/delete, bypassing the normal ownership check in `agents.controller.ts`), and `stats` (`GET /admin/stats/overview` — aggregate counts, 14-day time series for signups and revenue via `$queryRaw` date-bucketing, top agents by installs, and category breakdowns; all real DB aggregation, no mock data). Frontend charts reuse the existing hand-rolled SVG primitives in `src/components/charts/charts.tsx` (`StatTile`, `AreaChart`, `BarList`) rather than pulling in a charting library — that file's own comment says "sof SVG, og'ir kutubxonasiz" (plain SVG, no heavy library), so don't add recharts/chart.js etc. for new dashboard work here.

### Frontend (`apps/web`)

App Router routes under `src/app/(dashboard)/*` map 1:1 onto backend feature modules (`admin` [OWNER-only], `agentos`, `agents`, `automation`, `connectors`, `dashboard`, `fusion`, `goals`, `govtech`, `marketplace`, `onboarding`, `operations`, `pricing`, `retail`, `settings`, `supermode`, `templates`, `trade`, `twin`); `(auth)/*` for sign-in/up; `s/[token]` is the public shareable-result page (`SharedResult` model). i18n is hand-rolled (not next-intl) — `src/lib/i18n/` with `dictionary.ts`/`server.ts`/`client.tsx` (`useT()` hook) and per-locale dictionaries in `locales/{en,ru,uz}.ts`. Styling is Tailwind with a dark-mode-first, glassmorphism-heavy design system ("Liquid Obsidian" per `docs/status/`) driven by HSL CSS variables, plus Framer Motion/GSAP/`@react-three/fiber` for the 3D landing/AgentOS visuals.

### Shared types (`packages/shared-types`)

`src/index.ts` is the entire surface — `Role`, the `Halal*` types (hand-kept in sync with `halal_filter.py`'s Python enums, no codegen), and generic API contract types (`AgentSummary`, `ConversationMessage`, `ApiResponse<T>`). Consumed directly as TS source by both `apps/web` and `apps/api` via workspace linking — no separate build step.

## Conventions and pitfalls

- **Docs vs. code drift**: `docs/architecture/texnik-strategiya.md` is the *original* planning doc and describes several things that were never actually built or were later reversed — React Flow visual builder, Redis/Upstash, Clerk as primary auth, multi-LLM fallback (GPT/Gemini), E2B/Daytona sandboxing, Vercel/Railway/AWS deploy. The actual system: chat/form-based agent creation, no Redis, custom OTP+JWT auth, Anthropic-only, no isolated code-execution sandbox, deployed on Render (`render.yaml`). Treat that doc as historical intent, not current architecture. Likewise, the bottom section of `docs/status/prototip-holati.md` describes an even earlier SQLite/Clerk-keyless/no-real-key dev state that predates the current Postgres-only schema — that file is an append-only dev log where **newer entries (top) supersede older ones (bottom)**.
- **Env var validation is fail-fast**: `apps/api` calls `validateEnv()` at boot and refuses to start if required secrets are missing in production (`AUTH_JWT_SECRET`, `ENCRYPTION_KEY`, and at least one OTP channel — Resend email or Eskiz SMS). See `.env.example` for the full set of categories (DB, Clerk-legacy, OTP, Anthropic, service URLs, Payme/Click/Plaid sandbox, R2 storage, Telegram/WhatsApp, camera service, usage/rate-limit caps, billing prices in tiyin, JWT secret, encryption key).
- **No shared root tsconfig** — `apps/api`, `apps/web`, and `packages/shared-types` each define their own compiler options independently (CommonJS/ES2021 partial-strict for api, ESNext/bundler full-strict for web). Don't assume changes to one propagate.
- **ESLint intentionally relaxes `no-explicit-any` in `apps/api`** — Prisma JSON columns and agent-engine responses are `any` by design; don't "fix" this without cause.
- Inline comments (mostly in Uzbek) frequently document *why* a past bug was fixed (CORS/trust-proxy handling, Swagger being prod-gated, the Redis removal, `rawBody` webhook parsing, the audit-log advisory-lock race fix) — read them before "cleaning up" code that looks odd; it's usually load-bearing.
