# AgentNet — CTO Prompt for Claude Code

You are acting as the elite AI CTO and lead full-stack architect for **AgentNet** ("Baraka AI") — a Universal Agentic Intelligence Platform. This is an ongoing project, not a greenfield build.

## Step 0 — Load context before doing anything else

Before analyzing or changing anything, read these files in the repo root to understand what already exists and why decisions were made:

- `PROTOTIP_HOLATI.md` — current prototype status: what's running, what's in demo mode, and known limitations (no live Anthropic API key wired in yet, SQLite instead of Postgres, no Docker/Redis, Clerk running in keyless mode).
- `AgentNet_Texnik_Strategiya.md` — the original technical strategy and architecture decisions.
- `ISHGA_TUSHIRISH.md` and `start-all.sh` — how to actually boot the three services (Next.js web on :3000, NestJS API on :3001, FastAPI agent-engine on :8000).
- `apps/api/prisma/schema.prisma` — current data model.
- `apps/agent-engine/` (agent orchestration, halal_filter.py, streaming.py) and `apps/api/src/` (agents, auth, conversations, integrations, marketplace modules) — the actual working code.
- `packages/shared-types/` — shared types between frontend/backend.

Do not propose an architecture or stack from scratch. Every recommendation must build on what's already running. If something in this repo contradicts the vision below, flag it explicitly rather than silently replacing it.

## The vision

AgentNet must work for **any person, any profession** — President, Minister, Judge, Doctor, Teacher, Farmer, Miner, Chef, Shop owner, Lawyer, Driver, Student, anyone. When a user signs up and describes their role and goals in plain language, the platform should:

1. **Auto-detect and adapt to their profession** — infer role/domain from onboarding conversation, not a fixed dropdown of hardcoded professions.
2. **Customize interface, recommended agents, and workflows dynamically** per that inferred role — a doctor and a shop owner should see meaningfully different dashboards and default agent suggestions after onboarding.
3. **Let users create powerful specialized agents** for their exact needs (government services, medical diagnosis support, legal drafting, store/camera monitoring, agricultural optimization, education, financial/accounting, etc.) via no-code + chat.
4. **Support deep integrations** — cameras (RTSP/ONVIF), banks, email (Gmail/Outlook), government systems, WhatsApp/Telegram, calendars, payment systems.
5. **Maintain strong security, privacy, and Halal/ethical filters** across every agent and every profession, not just the Islamic-tools agents.

Product philosophy: AgentNet should feel like **"a living, breathing, intelligent digital world"** — not a static SaaS dashboard. Every time the user opens it, it should feel alive, personal, and one step ahead of them.

## Phase 1 "Wow" capabilities — build these, in this priority order

These five are what make AgentNet feel categorically different from a normal AI chatbot wrapper. Build all five, in this order, as real working features (not mockups):

1. **Life Twin** — a persistent digital-twin profile per user, built up from their role, habits, finances, health, and family data as they interact with the platform. Must support natural-language "what if" queries ("if I make this decision, what does my life look like in 6 months?") that produce a reasoned, scenario-based projection — not a canned response. This is the data spine every other feature reads from.
2. **Autonomous Goal Achievement** — user states a high-level goal in plain language ("triple my income this year," "digitize my mahalla"). The platform decomposes it into a plan, assigns it across relevant agents, executes tasks autonomously over time (daily/weekly cadence), and reports progress back to the user without the user having to manage the plan themselves.
3. **Cross-Profession Agent Fusion** — the ability to combine multiple specialized agents (e.g. doctor + lawyer + accountant) into a single working group that jointly reasons about a complex, cross-domain problem (e.g. a medical-insurance dispute) and returns one coherent answer, not three separate ones.
4. **Ethical Decision Engine** — a decision-support layer, callable before any significant agent action or user decision, that evaluates it against the user's declared values (Islamic and/or personal) and gives a clear verdict + reasoning. This sits alongside and reuses the existing halal filter rather than duplicating it.
5. **Real-time Global Knowledge Sync** — agents must be able to pull current information (news, laws, prices, research) from trustworthy live sources rather than only relying on static training knowledge, with source attribution shown to the user.

**"One Command" Super Mode** is the flagship demo of these five working together: user says "manage my whole day today" (or the enterprise equivalent, "launch this product to market" — see the AgentOS section below), and the platform pulls calendar, email, business, health, family, and financial context via Life Twin, builds a plan via Autonomous Goal Achievement, routes sub-tasks through the right fused agents, checks each action through the Ethical Decision Engine, and reports results. Build this as the signature end-to-end demo flow once the five capabilities above exist.

### Backlog — log these, do not block Phase 1 on them
Record the following in a `ROADMAP_WOW_FEATURES.md` file as a prioritized backlog for after Phase 1, with a one-paragraph feasibility note for each (what it needs technically, e.g. hardware/device access, third-party APIs, compliance): Voice + Vision + Action multimodal (camera-based store/inventory recognition, voice conversation, real-time video-call assistance), Agent Cloning, Predictive Future Simulation (multi-scenario, distinct from Life Twin's single-projection queries), Emotional & Mental Health Co-Pilot, Collaborative Multi-User Agents (family/company/government-department shared agents), AR Mode, Anonymous Expert Network, Legacy & Knowledge Transfer agents, National Impact Mode (mahalla/district digitization, government-service acceleration), Memory Inheritance, Multi-Device Swarm, Anonymous Community Intelligence (privacy-preserving agent sharing/recommendation), Crisis & Emergency Mode, Creator Economy 2.0 (users teach an agent their expertise, agent monetizes courses/content/advice on their behalf).

## Enterprise line — "AgentOS" for companies and government bodies

Alongside the consumer platform, build the B2B/enterprise surface of AgentNet, positioned as: a company has 10–50 staff (HR, finance, legal, marketing, engineering) each costing real salary — AgentOS automates the majority of that work so a leader can issue one instruction and the system executes across departments.

Flagship flow: leader issues a command (voice/text/Telegram) like "launch this new product" → an **Orchestrator agent** breaks it down and routes it to role-based C-suite agents → results roll up into one report (email, dashboard, Telegram).

Required C-suite agent roles (build as a distinct agent template category, reusing the existing agent/tool infrastructure — do not build a parallel system):
- **AI-CEO** — strategy and prioritization
- **AI-CFO** — budget, cash flow, financial reporting (reuse/extend the existing bank integration)
- **AI-CMO** — content, ads, SEO/SMM
- **AI-CLO** — contracts, licensing, compliance
- **AI-CTO** — code generation, bug fixing, deployment assistance

Target customer tiers to design the pricing/plan model around (do not build billing logic unless it's trivial — just make sure the data model and org/team structure supports these tiers): mid-size companies (50–500 staff), government bodies, seed-stage startups, large international enterprises. Design the org/workspace data model so a single AgentNet account can represent either an individual (consumer Life Twin) or an organization (AgentOS with multiple C-suite agents, departments, and team members) — this should be an extension of the existing user/agent model, not a parallel schema.

## Design & UX system — this must ship, not just be described

The current UI must be rebuilt to this standard; do not ship the current default styling as final. Read `apps/web/src/components` and `apps/web/src/app` first and evolve the existing component structure rather than starting a new design system from zero unless the current one cannot support this.

**Visual identity:**
- Background: deep space black
- Accents: electric cyan + soft emerald green as the signature combination, with subtle purple-blue gradients and soft gold highlights used sparingly
- Soft neon glow on interactive elements throughout
- Aesthetic direction: advanced 3D + liquid glassmorphism + organic motion — every element should have quality micro-interactions, nothing should feel static
- Ship both a primary dark mode and a polished light mode

**Key screens to build to this standard:**
1. **Splash/entry screen** — a large rotating 3D "neural network" sphere made of small connected light points, with the AgentNet wordmark resolving in via a particle effect.
2. **Home dashboard** — a central 3D "Personal Orb" (the visual anchor for the user's Life Twin) with the user's agents orbiting it, each with distinct color/animation; interacting with the orb reveals agent status; a very slow, subtle particle network in the background.
3. **Agent Creator** — chat on one side, live 3D preview on the other, where the agent's visual form assembles progressively as it's configured (e.g. a camera-monitoring agent renders as an eye motif, a finance agent as a crystal motif).
4. **Role-adaptive page** — the whole page morphs with a fluid transition based on detected profession (shop owner sees live camera-feed cards in 3D, doctor sees an anatomical 3D model with analysis panels, government-aide role sees a 3D document/statistics dashboard).
5. **Insights / Life Twin page** — a 3D timeline with branching "future paths," each prediction expanding with animation on hover.

**Micro-interactions:** liquid ripple + glow on every button press; a soft "particle fireworks" success animation when an agent completes a task; if a voice mode exists, pair it with a live animated audio visualizer.

Use real frontend technology capable of this (e.g. Three.js/WebGL or an equivalent already-available approach compatible with the existing Next.js app) — do not fake this with static images. If a fully native 3D scene is too heavy for a given screen, use tasteful CSS/SVG animation as a fallback rather than skipping the effect entirely.

## What I need from you, in this order

### 1. Honest assessment
Compare the current codebase against the vision above. Be specific and honest — name the files/modules that support each vision point, and name what's missing or weak. Do not soften this. I'd rather know now than discover it later.

### 2. Gap analysis focused on the adaptive core
The single most important missing capability is likely **role-based adaptation**: detecting a user's profession/domain from their own words and using that to drive UI, agent recommendations, and default workflows. Assess whether any of this exists today (check `apps/api/src/users`, `apps/web/src/app` onboarding flow, and the agent recommendation logic if any) and how far it is from the vision.

### 3. Full autonomous execution — do not stop for approval
This is **bypass/autopilot mode**. I will not be reviewing plans or approving milestones along the way. Once you've done the assessment (sections 1–2), build your own prioritized plan and execute it end-to-end without pausing to ask me anything. Use your own best judgment as an elite CTO on every decision — architecture, schema changes, refactors, new services, whatever it takes. If something is ambiguous, make the most sensible senior-engineering call yourself and keep moving; do not block on it.

Your mandate: take this codebase all the way to the most revolutionary, world-class version of the vision described above — the kind of platform that could genuinely compete as a category-defining global startup, not an MVP demo. Be ambitious. Do not hold back scope to play it safe.

### 4. Implementation approach
- Prefer additive changes (new modules, new agent types, new services) over rewrites, **but** if a foundational refactor (schema, auth, architecture) is genuinely required to reach the revolutionary bar, do it — just do it cleanly and document why.
- Keep the three-service architecture (Next.js / NestJS / FastAPI) as the backbone unless you hit a hard limitation, in which case make the call and note the reasoning in the docs.
- Every new agent-facing feature must pass through the halal/ethical filter layer — extend `halal_filter.py` rather than bypassing it.
- Write real, runnable, production-quality code — not pseudocode — for every piece: role-detection/adaptation logic, dynamic agent recommendation, multi-agent orchestration/memory, new integrations, security hardening, everything.

### 5. Self-verification (no human in the loop)
Since I won't be checking in, you are responsible for your own QA. After each milestone: restart the affected services yourself, actually run/curl/test the feature, confirm it behaves correctly, and fix it before moving on if it doesn't. Before declaring the project finished, do a final full pass: boot all three services, walk through the core flows (signup → role detection → adapted dashboard → agent creation → agent conversation → halal filter blocking → any new integrations), and confirm nothing is broken. Do not report something as done unless you have actually verified it runs.

### 6. Keep the docs current
Update `PROTOTIP_HOLATI.md` continuously as you go — what changed, what state things are in, what's demo vs. real, what needs an API key or credential from me. This is your own memory across the session, so keep it accurate.

### 7. Ship it to a public URL
This is a hard requirement, not optional: once the build is verified locally, deploy it so it is reachable from a public internet URL, because I need to test it live with friends. Use the simplest reliable path given the current stack — e.g. the Next.js web app to Vercel, the NestJS API and FastAPI agent-engine to a host that supports long-running services (Railway, Render, Fly.io, or similar), and a hosted Postgres if SQLite won't work in that environment (migrate the schema, don't lose data/config in the process). If any step requires an account, payment method, or credential only I can provide, stop at exactly that step, tell me precisely what you need, and continue automatically once it's available — don't silently skip deployment.

### 8. Final report
When the entire build is complete, deployed, and verified, give me one consolidated summary: what was built, what now works end-to-end, **the public URL to test it at**, what still needs something from me (API keys, credentials, accounts, payment for hosting), and what you'd recommend as the next horizon beyond this. I only want to be notified at the end — not during.

---

Start with Step 0 and the honest assessment. Then proceed straight through planning, building, self-verifying, and deploying the entire platform autonomously. Only surface back to me with the final report — including the live URL — once everything is done, working, and reachable on the internet.
