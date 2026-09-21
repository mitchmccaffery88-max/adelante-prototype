# Phase 4 — Post-intake resources screen

## What I found first

- The directory is real and singular: `RESOURCE_CATEGORIES` (14 categories) and the org list in `src/lib/communityResources.ts` + `communityResources.ported.ts`. The patient-facing read is `patientBrowsableResources(categoryId)`; the card is `components/reentry/ResourceCard.tsx`. I will reuse both exactly — no new lookup, no new resource content.
- **No org in the directory carries any Part 2 classification.** `CommunityResource` has no such field, and no entry is flagged. So the constraint applies in full: nothing can be shown as "Part 2 safe" on real backing.
- Intake today ends with a toast and `navigate({ to: "/home" })`. Phase 3 already writes real, provenance-tagged `SdohPlanItem` rows before that.

## Build

**1. `src/lib/sdohResourceMatch.ts` (new, pure)**
- Maps a plan item's `need` to directory category ids:
  - via the Phase 2/3 intake keys (`itemMatchesIntakeKey`): housing → `housing` + `emergency_shelter`; food → `food`; employment → `employment` + `education`; transport → `transportation`.
  - plus an explicit keyword table for the HRSN-only and staff-written needs: utilities → `financial`; safety/interpersonal → `legal` + `healthcare` (category-only, see below); childcare/parenting → `parenting`; legal/PO → `legal`; recovery/SUD wording → `recovery_meetings` + `support_groups`.
  - no match → returns nothing, and the screen says so honestly rather than guessing.
- `PART2_CAUTION_CATEGORY_IDS = ["recovery_meetings", "support_groups"]` and a per-need `showOrgs` flag. Any need whose match set touches a caution category renders **the category only** (name, count, link to `/resources`), never a named org — because the classification workbook has not landed. Interpersonal-safety matches are also category-only.
- Drift guard: every category id used by the table must exist in `RESOURCE_CATEGORIES`.

**2. `src/routes/next-steps.tsx` (new patient route) + `src/components/patient/PostIntakeResources.tsx`**
- One section per open, patient-visible `SdohPlanItem`, showing its provenance label (`SDOH_SOURCE_LABEL`) and up to 3 real matching orgs via `patientBrowsableResources`, rendered with the existing `ResourceCard` (keeps the verified / pending-verification badge honest), plus "See all in <category>" linking into `/resources`.
- Caution needs render a category card with an explanation instead of orgs.
- Needs with no category match render an honest "your team will follow up" line.
- Empty state (no confirmed needs): explicit copy — nothing was flagged, here is the full directory — never a blank screen.
- Standing note on the page: showing a resource is not a referral; a referral is a staff action. **No `ResourceReferral` is created anywhere in this build.**

**3. Wiring**
- Intake submit navigates to `/next-steps` instead of `/home` (toast unchanged).
- A card on the patient home linking to `/next-steps` whenever there is at least one open, patient-visible need, so the screen is reachable after the first visit.

## Verification
`bunx tsgo --noEmit`, full Vitest, new unit tests for the matcher (category coverage, caution behaviour, no-match honesty), plus a browser run at 1280 and 390: a reconciled pre-release patient, a fresh self-report patient, and a no-needs patient; zero console errors.
