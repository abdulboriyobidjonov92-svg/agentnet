# AgentNet — EXECUTIVE ORDER: 10X Unicorn Visual & Experience Refactor

You are acting as the world's leading UI/UX designer — head of an Apple-caliber design studio — paired with a senior full-stack engineer. This prompt is a **visual/UX-only refactor pass** on top of the existing AgentNet codebase. It is meant to run after the core platform is functional (Part 1 of the build), and it **supersedes any earlier, conflicting visual direction** (specifically: any prior instruction describing a bright neon cyan/emerald, particle-fireworks, maximalist sci-fi aesthetic no longer applies — this prompt's minimalist premium direction is the authoritative one going forward).

Goal: turn AgentNet's interface into the most expensive-feeling, visually flawless software product in the world — an interface quality bar 10x above Apple, iOS, and the best unicorn startups. Every screen should give the feeling of a $10 billion product.

## 🔴 HARD CONSTRAINT — read this twice

The product's functionality is essentially complete. **Do not change business logic, features, data flow, API contracts, or how anything works.** Do not add new features. Your job is exclusively: interface, visual design, layout, animation, and user experience — on top of what already works, without altering what it does.

If you find yourself editing a `.service.ts`, `.controller.ts`, a Prisma schema, an API route handler, or any agent/orchestration logic, stop — that is out of scope for this pass. The only backend-adjacent touches allowed are the minimum markup/prop changes needed to pass existing data into a redesigned component.

## Step 0 — Load context before touching anything

- Read `PROTOTIP_HOLATI.md` for current product state.
- Read `apps/web/src/app` and `apps/web/src/components` in full to understand the current component structure, routing, and what data each screen actually renders.
- Read the current styling setup (Tailwind config, `globals.css`, any existing design tokens/theme file) so you extend the existing system rather than bolting on a second one.
- If a prior design brief exists in this repo describing a neon/maximalist visual direction, treat it as **deprecated** — this prompt's direction replaces it. Note this explicitly in your plan (section below) so there's no ambiguity about which direction is being executed.

## 1. Visual Language — Supremacy Through Restraint

- **Eliminate all "cartoon" cues**: no playful/gamified elements, no bright saturated colors, no cheap-looking gradients, no default component-library look.
- **Reference bar**: minimalism and seriousness that sits 10x above Stripe, Linear, and Vercel — premium B2B, ultra-modern SaaS.
- **Grid and composition discipline**: every element's position, spacing (padding/margin), and proportions must follow a consistent, mathematically precise system — define an explicit spacing scale (e.g. 4/8px base unit) and a type scale, and use only values from those scales everywhere. No ad-hoc pixel values.
- **Color palette**: deep, expensive-feeling dark neutrals as the base (deep obsidian, slate, muted monochromatic tones), with restrained glass/frosted (glassmorphism) surfaces and, where a signature accent is needed, a single refined accent color used sparingly — not a rainbow of neon. The palette should look like it was chosen by a luxury brand, not a tech demo.
- **Typography**: one premium, highly legible type family, used with deliberate weight/size hierarchy — this alone should visibly separate AgentNet from template-based products.

## 2. Motion — Next-Gen Kinetics, Not Decoration

- **Depth over flatness**: elements should read as physically layered — real depth via shadows, blur, and z-index layering, not flat cards on a flat background.
- **Fluid transitions**: page changes, menu opens, and data loading should feel buttery on high-refresh-rate (120Hz) displays — use easing curves and durations consistent with Apple's own motion language (fast, physically plausible, never bouncy/cartoonish).
- **Micro-interactions**: hover, press, and focus states should feel alive but never distracting or fatiguing — subtle, purposeful, consistent across every interactive element (define one micro-interaction system and reuse it everywhere, don't invent a new effect per component).
- **Performance discipline**: motion must not cost frame rate. Test on a mid-range device/connection profile, not just your own machine — a beautiful animation that stutters is worse than no animation.

## 3. Premium User Journey

- **Onboarding and first impression**: signup, login, and the first screen after login must feel as considered and refined as the most polished premium products in the world — this is the highest-leverage surface for the "10 billion dollar" impression.
- **Zero clutter**: every button, label, and element must justify its presence. No stray lines, no unused visual weight, no filler.
- **Effortless intelligence**: despite AgentNet being powerful and universal underneath, the surface must feel simple, self-explanatory, and quietly intelligent — complexity should be earned through progressive disclosure, not hidden by omission.
- **Accessibility is part of "premium," not opposed to it**: maintain real contrast ratios (WCAG AA minimum) even within a dark, muted palette; keep interactive targets appropriately sized; respect reduced-motion preferences.

## 3b. Every screen must be fully responsive — this is not optional

This product will be tested live by real people on their own phones, tablets, and laptops, on the first day it ships. Every single screen and component covered by this refactor must look and work correctly at minimum at these breakpoints: mobile (~375–430px), tablet (~768–1024px), and desktop (1280px+). This means:
- No fixed pixel widths that break or overflow on a small screen; layouts must reflow (stack, collapse navigation into a menu, resize type) rather than force horizontal scrolling or clip content.
- Touch targets on mobile must be comfortably tappable (roughly 44px minimum), not sized for a mouse cursor.
- The signature 3D moment (Personal Orb / landing sphere) must degrade gracefully on low-power mobile devices — reduce complexity or fall back to a lighter version rather than lag or crash the page.
- Test each screen at actual mobile and tablet widths (use browser device emulation at minimum) before marking it done — "it works on my desktop monitor" is not sufficient verification.

## 4. Execution Plan — Staged, Approval-Gated

This pass runs differently from the rest of the build: **do not change all the code at once.**

1. First, study the project files and give me a visual-change plan — screen by screen / component by component — showing exactly how each part reaches the 10x bar above, **without touching existing functionality**. Include: what's changing (layout, color, motion, typography), what's explicitly staying untouched (functionality), and the order you'd tackle it in.
2. Wait for my confirmation.
3. Once approved, refactor component by component — not the whole app in one pass. After each component or screen, show me (describe or screenshot) the before/after so I can sanity-check direction early rather than discovering a mismatch at the end.
4. Before considering a component "done," verify: no functional regression (the feature still works exactly as before), no console/runtime errors, responsive behavior still correct, and it visually matches the design language defined above — not just "looks nicer" in isolation.

## Final report

Once the full pass is complete and approved component by component, give me a summary: what was redesigned, what design tokens/system you established (so future components stay consistent), and confirm nothing functional changed anywhere in the app.

---

Start with Step 0, then produce the screen-by-screen visual-change plan and stop there for my review before touching any code.
