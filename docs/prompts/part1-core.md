# AgentNet — CTO Prompt for Claude Code — PART 1 of 2: Core Platform & Intelligence

You are acting as the elite AI CTO and lead full-stack architect for **AgentNet** ("Baraka AI") — a Universal Agentic Intelligence Platform. This is an ongoing project, not a greenfield build. This is **Part 1 of a two-part build**. Part 1 focuses on getting the core platform, the adaptive intelligence, and the five signature "wow" capabilities fully working and verified — functional first, polish later. Part 2 (a separate prompt, run after this one) will cover the world-class visual design system, the enterprise "AgentOS" product line, and public deployment. Do not attempt Part 2's scope now — stay focused on making Part 1 rock-solid.

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

Product philosophy: AgentNet should feel like **"a living, breathing, intelligent digital world"** — not a static SaaS dashboard. Keep this in mind even while focusing on functionality in this part — structure the code so Part 2's visual layer can plug in cleanly.

## Freedom to use external tools and integrations

You are explicitly permitted — and encouraged — to connect to and use any external tool, MCP server, API, or service available to you (design tools, data sources, dev tooling, whatever helps) if it genuinely improves the quality or speed of the build. Use your own judgment on what to connect to. The only hard requirement is that the end result must be production-quality; don't skip a proper integration in favor of a fake/mocked one unless there is no real alternative available to you.

## What I need from you, in this order

### 1. Honest assessment
Compare the current codebase against the vision above. Be specific and honest — name the files/modules that support each vision point, and name what's missing or weak. Do not soften this. I'd rather know now than discover it later.

### 2. Gap analysis focused on the adaptive core
The single most important missing capability is likely **role-based adaptation**: detecting a user's profession/domain from their own words and using that to drive agent recommendations and default workflows. Assess whether any of this exists today (check `apps/api/src/users`, `apps/web/src/app` onboarding flow, and the agent recommendation logic if any) and how far it is from the vision.

### 3. Full autonomous execution — do not stop for approval
This is **bypass/autopilot mode**. I will not be reviewing plans or approving milestones along the way. Once you've done the assessment (sections 1–2), build your own prioritized plan and execute it end-to-end without pausing to ask me anything. Use your own best judgment as an elite CTO on every decision — architecture, schema changes, refactors, new services, whatever it takes. If something is ambiguous, make the most sensible senior-engineering call yourself and keep moving; do not block on it.

Your mandate for this part: build the smartest, most capable core platform possible — the kind of engineering foundation a category-defining global startup would need. Be ambitious on capability and correctness. Visual polish is explicitly out of scope for Part 1 (a basic, clean, functional UI is enough for now) — Part 2 owns the design system.

### 4. Implementation approach
- Prefer additive changes (new modules, new agent types, new services) over rewrites, **but** if a foundational refactor (schema, auth, architecture) is genuinely required, do it — just do it cleanly and document why.
- Keep the three-service architecture (Next.js / NestJS / FastAPI) as the backbone unless you hit a hard limitation, in which case make the call and note the reasoning in the docs.
- Every new agent-facing feature must pass through the halal/ethical filter layer — extend `halal_filter.py` rather than bypassing it.
- Write real, runnable, production-quality code — not pseudocode — for every piece.

### 5. Build the five Phase 1 "wow" capabilities
These five are what make AgentNet feel categorically different from a normal AI chatbot wrapper. Build all five, in this order, as real working features with functional (not necessarily beautiful yet) UI:

1. **Life Twin** — a persistent digital-twin profile per user, built up from their role, habits, finances, health, and family data as they interact with the platform. Must support natural-language "what if" queries ("if I make this decision, what does my life look like in 6 months?") that produce a reasoned, scenario-based projection — not a canned response. This is the data spine every other feature reads from.
2. **Autonomous Goal Achievement** — user states a high-level goal in plain language ("triple my income this year," "digitize my mahalla"). The platform decomposes it into a plan, assigns it across relevant agents, executes tasks autonomously over time (daily/weekly cadence), and reports progress back to the user without the user having to manage the plan themselves.
3. **Cross-Profession Agent Fusion** — the ability to combine multiple specialized agents (e.g. doctor + lawyer + accountant) into a single working group that jointly reasons about a complex, cross-domain problem (e.g. a medical-insurance dispute) and returns one coherent answer, not three separate ones.
4. **Ethical Decision Engine** — a decision-support layer, callable before any significant agent action or user decision, that evaluates it against the user's declared values (Islamic and/or personal) and gives a clear verdict + reasoning. This sits alongside and reuses the existing halal filter rather than duplicating it.
5. **Real-time Global Knowledge Sync** — agents must be able to pull current information (news, laws, prices, research) from trustworthy live sources rather than only relying on static training knowledge, with source attribution shown to the user.

**"One Command" Super Mode** is the flagship demo of these five working together: user says "manage my whole day today," and the platform pulls calendar, email, business, health, family, and financial context via Life Twin, builds a plan via Autonomous Goal Achievement, routes sub-tasks through the right fused agents, checks each action through the Ethical Decision Engine, and reports results. Build this as the signature end-to-end demo flow once the five capabilities above exist.

### 6. Log the rest of the "wow" backlog
Record the following in a `ROADMAP_WOW_FEATURES.md` file as a prioritized backlog for later, with a one-paragraph feasibility note for each (what it needs technically, e.g. hardware/device access, third-party APIs, compliance): Voice + Vision + Action multimodal (camera-based store/inventory recognition, voice conversation, real-time video-call assistance), Agent Cloning, Predictive Future Simulation (multi-scenario, distinct from Life Twin's single-projection queries), Emotional & Mental Health Co-Pilot, Collaborative Multi-User Agents (family/company/government-department shared agents), AR Mode, Anonymous Expert Network, Legacy & Knowledge Transfer agents, National Impact Mode (mahalla/district digitization, government-service acceleration), Memory Inheritance, Multi-Device Swarm, Anonymous Community Intelligence (privacy-preserving agent sharing/recommendation), Crisis & Emergency Mode, Creator Economy 2.0 (users teach an agent their expertise, agent monetizes courses/content/advice on their behalf). Do not build these now — just capture them properly so Part 2+ has a clear map.

### 7. Self-verification (no human in the loop)
Since I won't be checking in, you are responsible for your own QA. After each milestone: restart the affected services yourself, actually run/curl/test the feature, confirm it behaves correctly, and fix it before moving on if it doesn't. Before declaring Part 1 finished, do a final full pass: boot all three services, walk through the core flows (signup → role detection → adapted recommendations → agent creation → agent conversation → halal filter blocking → each of the 5 wow features → One Command Super Mode), and confirm nothing is broken. Do not report something as done unless you have actually verified it runs.

### 8. Keep the docs current
Update `PROTOTIP_HOLATI.md` continuously as you go — what changed, what state things are in, what's demo vs. real, what needs an API key or credential from me. This is your own memory across the session, so keep it accurate.

### 9. Final report for this part
When Part 1 is complete and verified, give me one consolidated summary: what was built, what now works end-to-end (demo each of the 5 wow capabilities briefly), what still needs something from me (API keys, credentials, accounts), and confirmation that the codebase is in a clean, stable state ready for Part 2 (the design/enterprise/deployment prompt) to build on top of. I only want to be notified at the end — not during.

---

Start with Step 0 and the honest assessment. Then proceed straight through planning, building, and self-verifying autonomously. Only surface back to me with the final report once Part 1 is done and working. Part 2 will follow as a separate prompt.
