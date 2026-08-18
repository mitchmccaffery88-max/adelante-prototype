# Port the AdelanteJourney design system and patient experience

## Blocker first

I can't reach `AdelanteJourney` from this workspace — cross-project tools only see projects that live in the same workspace with sharing enabled. Once you move/share it in, tell me and I'll start with a read-only checkout of its source.

Nothing below can begin before that.

## Phase 0 — Read and diff (no code changes)

Check out AdelanteJourney read-only and produce a written diff against this project across four axes:

1. **Tokens** — its stylesheet vs our `src/styles.css` `.patient-theme` block: colors, radii, shadows, spacing scale, animation keyframes/durations.
2. **Typography** — font families, weights, loaded font files, heading scale, line heights.
3. **Components** — its shared UI primitives (cards, buttons, tiles, sheets, nav) vs ours; which are genuinely different vs cosmetically renamed.
4. **Screens and features** — its patient routes vs ours; flag anything it has that we don't.

I'll report the diff before writing code, so you can confirm the port list.

## Phase 1 — Design system

Adopt AdelanteJourney's tokens as the source of truth in `src/styles.css`: full color set, radii, shadow utilities, animation keyframes, and the typography stack (including loading its exact fonts via the root route head). Mirror them into the shadcn component variants so the change is token-level, not per-component overrides.

Applied app-wide, not just patient surfaces — staff and admin pick up the same tokens. Where our staff screens rely on tokens AdelanteJourney doesn't define (crisis, gold/teal/navy, sidebar), those stay and are re-tuned to sit inside the new palette rather than being deleted.

## Phase 2 — Shared components

Port its layout primitives and interaction patterns (page shells, headers, cards, buttons, nav rail, bottom sheet, motion/transition behavior) into our existing `PatientPage`, `PatientPageHeader`, `AppShell`, `PatientSidebar`, `PatientMoreSheet`, and the shadcn variants. Prefer updating our primitives over adding parallel ones, so every screen inherits the change.

## Phase 3 — Patient screens

Rebuild each patient surface to match its AdelanteJourney counterpart visually — home dashboard, crisis, naloxone, craving/slip, check-in, library, recovery journey, resources, schedule, medications, documents, profile, Adel, weekly recap.

Rule for this phase: presentation changes only. Every screen keeps the data, state, and gating it has today.

## Phase 4 — Missing features

For anything AdelanteJourney has that we don't, I'll list it after Phase 0 with a rough size each, and we decide together what's in scope. I won't silently build new features into this phase.

## Non-negotiable constraints

Per your call, this project's behavior wins over visual fidelity wherever they conflict:

- 42 CFR Part 2 SUD masking stays exactly as implemented
- RBAC and route access gates stay enforced
- Crisis detection, crisis banners, and the 988 affordance stay present and reachable on every patient surface
- Population-based nav filtering, advocate document gates, and consent flows stay intact

Where AdelanteJourney's design has no slot for one of these, I restyle our element to match its visual language rather than removing it, and note each instance.

## Verification

Per phase: typecheck plus the existing test suite (patient nav shell parity, RBAC route access, documents i18n), then a real browser pass over the patient routes across desktop and mobile viewports checking for console errors, contrast, and 44px tap targets.

## Technical notes

- Tokens live in `src/styles.css` as OKLCH custom properties registered in `@theme inline`; no hardcoded color utilities in components.
- Fonts load via a `<link>` in `src/routes/__root.tsx` — Tailwind v4 can't `@import` a remote stylesheet here.
- AdelanteJourney is likely a Vite SPA; any `src/pages/`, React Router, or `App.tsx` structure gets translated to `src/routes/` file-based routing on the way in. No router or framework swap.
