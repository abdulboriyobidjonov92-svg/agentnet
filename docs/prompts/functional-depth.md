# AgentNet — Functional Depth & Product Substance Pass

You are acting as the elite AI CTO for AgentNet. I reviewed the app live (screenshots of `/sign-in`, `/twin`, `/goals`, `/fusion`, `/marketplace`, `/dashboard`). The visual redesign mostly worked — dark, clean, no more neon/cartoon look. But the product still feels like a toy demo, and after looking closely, the reason is **not visual, it's functional**. Fix these specific problems. Do not touch the color/token system from the Visual Refactor pass — this is about behavior and content, not styling.

## Problem 1 — the signature features are empty forms with no visible output

On `/twin`, `/goals`, and `/fusion`, I can fill in a field and press the action button, but no result appears anywhere in the screenshot I took. Check each of these end-to-end right now, for real, with a real test input, and fix whichever of these is true:

- If the button doesn't actually call the agent/LLM logic yet — wire it up for real. No stubs.
- If it does call something but the response isn't rendered — build a proper result panel for each:
  - **Life Twin "what if" query** → after submitting, show a written, reasoned projection (not a generic paragraph — it must visibly reference the facts the user entered under Moliya/Ish/Oila/etc.), with a loading state while it thinks.
  - **Goals** → after creating a goal, show the actual decomposed plan: the sub-tasks, which agent/capability each is assigned to, and a visible schedule/cadence. An empty "Hali maqsad yo'q" state is fine before creation, but after creation there must be a real plan visible, not just the goal text sitting there.
  - **Fusion** → after "Mutaxassislarni chaqirish," show which experts were actually selected/synthesized and their combined reasoning — not just a spinner that goes nowhere.
- Test every one of these three yourself with a realistic Uzbek-language example before reporting this fixed, and include the actual output you got in your final report to me.

## Problem 2 — the dashboard shows fabricated numbers

"Etika o'tish darajasi 99.2%" and a rising weekly-activity chart are shown while Agentlar/Suhbatlar/Xabarlar all read 0. That is either fake placeholder data or a real bug (a metric being computed from nothing). Fix it: every stat tile must reflect real, currently-true data. If the true value is zero, show zero everywhere, including the ethics score and the chart (a flat/empty chart state, not an invented upward trend). Do not show any number on this dashboard that isn't computed from real state.

## Problem 3 — nobody can tell what a feature is for or who it's for

Add short, concrete explanatory copy to `/twin`, `/goals`, `/fusion`, and any other wow-feature page: one sentence on what it does, and 2-3 example prompts relevant to different professions (e.g. a shop owner example, a doctor example, a farmer example) so a first-time user immediately understands the value without guessing. Pull the profession examples from the role-adaptation system already built in Part 1 — if the user has a detected profession, lead with an example tailored to them specifically.

## Problem 4 — internal tool IDs are visible to end users

On `/marketplace`, tags like `prayer_times`, `quran_surah`, `get_transactions`, `currency_rates` are shown raw to the user. Replace these with short, human-readable capability labels (e.g. "Namoz vaqtlari," "Bank tranzaksiyalari") in the current language. Keep the internal IDs in code/data only, never in UI copy.

## Problem 5 — no visible monetization

"AgentOS" has a "PRO" badge with nothing behind it. Build a real `/pricing` (or `/plans`) page showing the actual tiers implied by the AgentOS enterprise brief (individual / team / enterprise, or whatever tiers make sense given what's actually built), what each tier includes, and wire the "PRO" badge to link there. You do not need working billing/payment yet — but the page, the tier boundaries, and what's gated behind "PRO" must be real and consistent with what the product actually does, not a placeholder badge that goes nowhere.

## Verification requirement — this is not optional

For each of the 5 problems above, do not report it as fixed until you have actually loaded the page yourself, performed the real user action (typed a real question, created a real goal, requested real fusion), and observed a correct result. Screenshot or paste the actual rendered output in your final report for Twin, Goals, and Fusion specifically, so I can see the real AI output without opening the app myself.

## Scope discipline

Do not redesign colors, spacing, or the token system — that work is done and approved. This pass is exclusively: making existing features actually produce and display real results, killing fake data, adding explanatory copy, cleaning up user-facing labels, and standing up a real pricing page. Work through problems 1–5 in order and report back only when all five are verified working with real output shown.
