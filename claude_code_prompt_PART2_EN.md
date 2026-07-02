# AgentNet — CTO Prompt for Claude Code — PART 2 of 2: World-Class Design, Enterprise AgentOS & Public Launch

You are acting as the elite AI CTO and lead full-stack architect for **AgentNet** ("Baraka AI"). This is **Part 2 of a two-part build**. Part 1 (already completed in a prior session) built the core platform and five signature intelligence capabilities (Life Twin, Autonomous Goal Achievement, Cross-Profession Agent Fusion, Ethical Decision Engine, Real-time Global Knowledge Sync) with functional but unpolished UI. Your job now is to take that working foundation and turn it into a category-defining, visually stunning, enterprise-ready product, and put it live on the internet.

## Step 0 — Load context before doing anything else

Read these before changing anything:

- `PROTOTIP_HOLATI.md` — current status, updated at the end of Part 1; reflects what's live vs. demo.
- `ROADMAP_WOW_FEATURES.md` — the backlog of additional "wow" features logged in Part 1, with feasibility notes.
- `AgentNet_Texnik_Strategiya.md` — original technical strategy.
- `apps/web/src/components` and `apps/web/src/app` — the current (functional but plain) frontend, which you will evolve into the design system below rather than replace wholesale.
- `apps/api/src/` (agents, auth, conversations, integrations, marketplace) and `apps/agent-engine/` — the working backend and agent logic from Part 1, including the five wow capabilities. Do not break these.

Do not undo or regress anything working from Part 1. This part is additive: visual layer, enterprise product line, and shipping to production.

## Freedom to use external tools and integrations

You are explicitly permitted — and encouraged — to connect to and use any external tool, MCP server, API, or service available to you, including design tools like Figma or Canva, asset/image generation, animation libraries, hosting/deployment platforms, or anything else that meaningfully improves quality or speed. Use your own judgment on what to connect to and how. The only hard requirement is that the final result must be genuinely production-quality — polished, coherent, and real (not mocked placeholders where a real integration is available to you).

## Design & UX system — this must ship, not just be described

The current UI must be rebuilt to this standard; do not ship the current default styling as final. Evolve the existing component structure from Part 1 rather than starting a new design system from zero, unless the current one genuinely cannot support this.

**Visual identity:**
- Background: deep space black
- Accents: electric cyan + soft emerald green as the signature combination, with subtle purple-blue gradients and soft gold highlights used sparingly
- Soft neon glow on interactive elements throughout
- Aesthetic direction: advanced 3D + liquid glassmorphism + organic motion — every element should have quality micro-interactions, nothing should feel static
- Ship both a primary dark mode and a polished light mode

**Key screens to build to this standard:**
1. **Splash/entry screen** — a large rotating 3D "neural network" sphere made of small connected light points, with the AgentNet wordmark resolving in via a particle effect.
2. **Home dashboard** — a central 3D "Personal Orb" (the visual anchor for the user's Life Twin from Part 1) with the user's agents orbiting it, each with distinct color/animation; interacting with the orb reveals agent status; a very slow, subtle particle network in the background.
3. **Agent Creator** — chat on one side, live 3D preview on the other, where the agent's visual form assembles progressively as it's configured (e.g. a camera-monitoring agent renders as an eye motif, a finance agent as a crystal motif).
4. **Role-adaptive page** — the whole page morphs with a fluid transition based on the detected profession from Part 1's role-adaptation logic (shop owner sees live camera-feed cards in 3D, doctor sees an anatomical 3D model with analysis panels, government-aide role sees a 3D document/statistics dashboard).
5. **Insights / Life Twin page** — a 3D timeline with branching "future paths," each prediction expanding with animation on hover, wired to the real Life Twin data from Part 1.

**Micro-interactions:** liquid ripple + glow on every button press; a soft "particle fireworks" success animation when an agent completes a task; if a voice mode exists, pair it with a live animated audio visualizer.

Use real frontend technology capable of this (e.g. Three.js/WebGL or an equivalent compatible with the existing Next.js app) — do not fake this with static images. If a fully native 3D scene is too heavy for a given screen, use tasteful CSS/SVG animation as a fallback rather than skipping the effect entirely. Check real performance (load time, frame rate) on a mid-range device/connection, not just on your own machine — this must feel fast, not just look good.

## Enterprise line — "AgentOS" for companies and government bodies

Build the B2B/enterprise surface of AgentNet, on top of the Part 1 agent/user model, positioned as: a company has 10–50 staff (HR, finance, legal, marketing, engineering) each costing real salary — AgentOS automates the majority of that work so a leader can issue one instruction and the system executes across departments.

Flagship flow: leader issues a command (voice/text/Telegram) like "launch this new product" → an **Orchestrator agent** breaks it down and routes it to role-based C-suite agents → results roll up into one report (email, dashboard, Telegram).

Required C-suite agent roles (build as a distinct agent template category, reusing Part 1's agent/tool infrastructure — do not build a parallel system):
- **AI-CEO** — strategy and prioritization
- **AI-CFO** — budget, cash flow, financial reporting (reuse/extend the existing bank integration)
- **AI-CMO** — content, ads, SEO/SMM
- **AI-CLO** — contracts, licensing, compliance
- **AI-CTO** — code generation, bug fixing, deployment assistance

Design the org/workspace data model so a single AgentNet account can represent either an individual (consumer Life Twin) or an organization (AgentOS with multiple C-suite agents, departments, and team members) — extend Part 1's user/agent model, don't fork it. Target customer tiers to design the data model around (do not build billing logic unless it's trivial): mid-size companies (50–500 staff), government bodies, seed-stage startups, large international enterprises. Give AgentOS workspaces their own visual treatment consistent with the design system above but readable as "enterprise/command-center" rather than "personal."

## Autonomous execution

Same operating mode as Part 1: **bypass/autopilot**. Do not stop to ask for approval on design choices, architecture, or implementation details — use your own best senior judgment and keep moving. Be ambitious; this needs to look and feel like a billion-dollar product, not an MVP.

## Self-verification (no human in the loop)

After each milestone, actually load the pages, check animations render and run smoothly, confirm nothing from Part 1 regressed (signup, role detection, agent creation/conversation, halal filter, all five wow capabilities, One Command Super Mode). Test the AgentOS flow end-to-end with a sample company scenario. Do not report something as done unless you've actually seen it work.

## Ship it to a public URL

This is a hard requirement, not optional: once the build is verified locally, deploy it so it is reachable from a public internet URL — I need to test it live with friends. Use the simplest reliable path given the current stack — e.g. the Next.js web app to Vercel, the NestJS API and FastAPI agent-engine to a host that supports long-running services (Railway, Render, Fly.io, or similar), and a hosted Postgres if SQLite won't work in that environment (migrate the schema, don't lose data/config in the process). If any step requires an account, payment method, or credential only I can provide, stop at exactly that step, tell me precisely what you need, and continue automatically once it's available — don't silently skip deployment.

## Keep the docs current

Update `PROTOTIP_HOLATI.md` continuously — what changed, current state, what's demo vs. real, what needs a credential from me.

## Final report

When the entire build is complete, deployed, and verified, give me one consolidated summary: what was built in this part, what now works end-to-end (design system + AgentOS + all Part 1 capabilities together), **the public URL to test it at**, what still needs something from me (API keys, credentials, accounts, payment for hosting), and what you'd recommend as the next horizon beyond this. I only want to be notified at the end — not during.

---

Start with Step 0. Then proceed straight through design, enterprise build-out, self-verifying, and deploying autonomously. Only surface back to me with the final report — including the live URL — once everything is done, working, and reachable on the internet.
