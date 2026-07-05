# AgentNet — PART 1B: Platform-Wide Superpowers (Competitor-Grade Additions)

You are acting as the elite AI CTO for AgentNet. Part 1 (already built) delivered the core platform and five signature capabilities (Life Twin, Autonomous Goal Achievement, Cross-Profession Agent Fusion, Ethical Decision Engine, Real-time Global Knowledge Sync). This prompt adds a set of platform-wide capabilities that real competitors in the agentic-AI space have already proven work at scale, so AgentNet doesn't just look revolutionary — it actually out-executes the best-funded startups in this category. This is additive to Part 1; do not redo or regress anything already working.

## Why these specific additions

Each capability below is grounded in what a real, currently-operating company has proven viable — not speculation:

- Anthropic's own Claude (Computer Use, Cowork, Dispatch) and OpenAI's Operator prove that an AI agent can genuinely operate other software — clicking, typing, navigating — not just call APIs.
- Lindy, CrewAI, Beam AI, and 11x.ai (the leading "AI employee" platforms) prove that agents which reason contextually through messy real-world input outperform rigid rule-based automation (their explicit differentiator vs. Zapier/Make.com), and that breadth of integrations (Lindy: 5,000+) is a core value driver.
- Sierra, Harvey, Legora, and Hippocratic AI (billion-dollar verticals in customer service, legal, and healthcare respectively) prove that deep, compliance-aware specialization per domain beats generic one-size-fits-all agents — Hippocratic AI in particular ships with HIPAA compliance built in, not bolted on.
- Lumana, ifactory, and ECAM (retail loss-prevention/inventory AI) prove that cross-referencing camera vision against POS/inventory records (not raw video alone) is what makes theft/stock-out detection accurate enough to act on autonomously.
- Marketplaces like Agentshub.AI and Agentman prove the "creators publish agents, best performers rise, creators earn" model is a real, working growth mechanic, not just a nice idea.

Build toward this bar, not toward a generic demo of each idea.

## 1. Universal App & Device Control (tiered — be realistic about scope)

Users must be able to say "connect this app and let the agent run it," matching what Claude Computer Use / Cowork / Dispatch and OpenAI Operator already do in production.

- **Tier 1 (build now):** Browser/web-app automation — an agent, once granted access, can operate any web-based tool on the user's behalf (navigate, click, fill forms, read data) via browser automation (e.g. Playwright or an equivalent already available to you). This alone covers the overwhelming majority of real business tools: CRMs, government web portals, POS dashboards, banking web interfaces, email web clients, e-commerce back-offices.
- **Tier 2 (log to `ROADMAP_WOW_FEATURES.md`, do not build yet):** True native OS-level device control (a phone/desktop companion agent with accessibility permissions, à la Claude's actual Computer Use). This is a materially harder engineering problem — it requires an installable companion app per platform and real device permissions, not just backend code. Document the technical path (what a companion app would need) and the risk/effort honestly rather than faking it in the current web app.

## 2. Connector / Integration SDK — make integrations a growth engine, not a bottleneck

Right now AgentNet has a handful of hardcoded integrations. Build a proper internal Connector SDK: a consistent interface (auth, action schema, data schema) that makes adding a new integration fast and uniform, so the platform can scale toward dozens and eventually hundreds of integrations the way Lindy scaled to 5,000+. Ship the SDK plus 10-15 new high-leverage connectors as proof (e.g. WhatsApp Business, Telegram, common e-commerce platforms, common accounting tools, common government-facing services relevant to Uzbekistan/CIS if available). Document the SDK so this becomes a foundation, not a one-off.

## 3. Vertical Compliance Packs — sits alongside the Ethical Decision Engine, doesn't replace it

The Ethical Decision Engine from Part 1 handles values/halal alignment. This is different: each profession vertical needs domain-specific compliance behavior baked in, the way Hippocratic AI ships HIPAA-aware behavior by default. Build a compliance-pack framework and populate it for at minimum: healthcare (medical-advice disclaimers, no definitive diagnosis claims, privacy-of-health-data handling), finance/banking (no unlicensed financial advice framed as guaranteed outcomes, transaction data handling), government (data sovereignty/retention rules), legal (not-a-lawyer disclaimers, confidentiality handling). Each relevant agent template must load its vertical's compliance pack automatically.

## 4. Retail Intelligence Agent — camera + inventory fusion, not raw video alerts

Rebuild/extend the store-monitoring agent concept to match how real competitors do it: cross-reference camera-vision events against POS/inventory data rather than acting on video alone — this is what separates a useful signal from constant false alarms. When a real discrepancy is detected (shelf empty vs. inventory record, or a vision-flagged event with no matching transaction), the agent must autonomously push a message to the right channel (Telegram/WhatsApp/SMS/email, owner's choice) without the owner needing to check a dashboard — this is the literal behavior the product must deliver: "bu tovar tugadi" as a message that arrives on its own.

## 5. Business Operations Agent — full-company management, not just chat

Extend the AgentOS line (Part 2) with an operations agent capable of: staff scheduling and time-off tracking, payroll-adjacent calculations (hours, pay periods — not tax filing), and autonomous outbound communication with clients, partners, and sponsors (drafting and, with permission, sending real messages/emails on the business's behalf). This is what makes AgentOS a genuine "run my company" product rather than a dashboard.

## 6. Cross-Border Trade Agent — new vertical

Add an import/export agent template: customs documentation assistance, tariff/duty lookups, multi-currency handling, and trade-compliance checks, plus logistics/shipment tracking integration where available. This directly serves international trade businesses, a segment explicitly in scope for AgentNet.

## 7. GovTech vertical — promote from backlog to real build

Given how central "davlat xizmati" is to the vision, build this now rather than leaving it in the backlog: a district/mahalla digitization agent template (citizen request intake, routing to the right government service, status tracking) and a government-service-acceleration agent (helping citizens navigate multi-step bureaucratic processes). Keep this scoped to what's realistically buildable without live government API access — build the workflow and UI for it, and clearly mark which parts need a real government data-sharing agreement to go fully live.

## 8. Marketplace mechanics — make it a real competitive market, not a static catalog

Currently the marketplace is a flat grid of install cards. Rebuild it with real market dynamics: a usage-based ranking/leaderboard (agents that are actually used more and rated well rise to the top), a "verified/certified" badge for agents that pass a quality bar (reliability, task-success rate), visible ratings from real usage, and an automatic revenue-share payout mechanism for creators (the data model needs to track usage and attribute revenue per agent per creator, even if actual payment processing is stubbed for now — the accounting logic must be real).

## 9. Cross-cutting engineering principle — reasoning over rigid rules

This applies to every agent you build or touch, now and going forward: agents must make contextual decisions from messy real input using real reasoning, not brittle if-this-then-that logic dressed up as AI. This is the explicit differentiator that separates the platforms actually winning right now (Lindy vs. Zapier) from ones that don't hold up under real use. When you implement any new agent behavior, ask whether it would survive an unexpected/malformed input gracefully — if not, it's not done.

## Execution

Same operating mode as the rest of Part 1: autonomous, self-verifying, no approval gate needed (this is scoped functionality, not the visual layer). Work through sections 1–8 in priority order (they're ordered by leverage). For each, verify it actually works with a real test case before moving to the next, and update `PROTOTIP_HOLATI.md` and `ROADMAP_WOW_FEATURES.md` as you go. Report back only with a consolidated summary once this pass is complete, including what you verified working with real inputs.
