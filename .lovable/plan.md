# SDOH Referral Thread, Phase 5d-4 (final)

One picture of each need for the patient and the advocate, and a need-to-resolution
reporting funnel. Builds on 5d-1 (Part 2 consent gate + attribution), 5d-2 (need↔referral
link + outcomes), 5d-3 (activity log + aging).

## What I found in the current code

- `PostIntakeResources.tsx` (`/next-steps`) reads open, patient-visible needs and renders
  directory category matches through `matchResourcesForNeed`. It never reads
  `resourceReferrals`. Resolved needs are filtered out silently.
- `ReferralsForYouCard` in `PatientHome.tsx` lists referrals in a separate card with their
  own status labels and no link back to the need they serve.
- `AdelanteEHR.advocateCoordination(linkId)` returns needs only — id, need, status, note,
  updatedAt — already filtering `visibleToPatient !== false` and SUD-looking text, with a
  masked count. No referral ever reaches an advocate.
- `engagementReporting.ts` and `/reporting` carry no need or referral measure at all.
- The shared small-cohort guard is `cohortGuard()` / `MIN_COHORT_SIZE = 11` in
  `src/lib/cohortGuard.ts`; `BreakdownCard` + `CohortGuardNotice` in `reporting.tsx`
  already render a `GuardedBreakdown`.

## 1. Unified patient view

**Where it lives: `/next-steps` only.** That page becomes the one need-centred thread.
`ReferralsForYouCard` is removed from `PatientHome`, replaced by a small summary card
("Your everyday needs — N being worked on") linking to `/next-steps`, so there is never a
second competing list. Any referral with no linked need (older or standalone) is rendered on
`/next-steps` under an "Other places we connected you with" block so nothing disappears.

New pure module `src/lib/patientNeedThread.ts`:

- `patientNeedThreads(patientId)` → per need: the need, its provenance label, its
  patient-visible referrals (`referralsForNeed`, filtered `visibleToPatient !== false`), a
  plain-language status line, and the directory match.
- Status copy from the real outcome: pending → "Your team has sent this to {org} — waiting to
  hear back"; connected → "We've connected you with {org}"; waitlisted → "You're on a waitlist
  with {org}"; unreachable → "We couldn't reach them — your care team is following up";
  not_eligible → "You weren't eligible there — your team is looking at other options";
  declined_by_client → "You told us you didn't want this one"; closed → "This one is closed".
  No referral yet → "Your team is looking for a place for this."
- `recentlyResolvedNeeds(patientId, days = 14)` → completed/not_completed needs whose
  `updatedAt` is inside the window, for the closure block: "Sorted — {need}. Tell your team if
  this comes back." They leave the active list but say goodbye first.

Protections carried unchanged:
- The thread selector reads only need/referral display fields. `log`, `barriers`, contact
  fields and staff notes are never included in the returned shape — not filtered in the
  component, absent from the data.
- Recovery/support-group organisations stay **category-only**. Decision: keep the existing
  `sdohResourceMatch.ts` rule. No `CommunityResource` carries a Part 2 classification yet, so
  naming an org still risks disclosing SUD involvement on a screen a family member can see
  over a shoulder. Where a staff-created referral to such a category exists, the patient sees
  the category and status without the organisation name.
- `visibleToPatient !== false` is applied to needs and referrals independently; safety needs
  (5d-2 staff-only default) never appear unless staff deliberately made them visible.

## 2. Advocate view

`advocateCoordination` gains `referrals` per item, built with the same restraint:

| Tier | Needs | Referral status | Organisation name |
| --- | --- | --- | --- |
| HIPAA-only | yes | yes | only when Part 2 consent is live (`advocateSudUnmasked`) and the category is not Part 2 sensitive |
| Authorized representative | yes | yes | never for Part 2 sensitive categories — AR is categorically barred |
| AHCD agent | yes | yes | authority-derived; suppressed when `ahcdPart2ScopeUnclear` |
| Conservator | yes | yes | authority-derived |

Implementation: a referral in `PART2_SENSITIVE_REFERRAL_CATEGORIES` is returned as a
restricted row (status only, no category, no provider, no note) for any link whose SUD access
resolves masked — the same shape staff Part 2-gated viewers see. Safety needs remain excluded
entirely and counted in `maskedCount`. Activity log never crosses the boundary.
`AdvocateCoordinationPanel` renders the referral lines under each need.

## 3. Reporting funnel

New `src/lib/sdohReporting.ts`:

- `sdohFunnel({ patientIds, windowDays })` → stages **identified → referred → connected →
  resolved** as counts plus median days between consecutive stages, derived from
  `createdAt`/`updatedAt`/referral outcome timestamps. Each stage carries `cohortGuard()`.
- Slices: need category (the `matchResourcesForNeed` primary category), provenance
  (`SdohItemSource`), and population track via `resolveCohorts()`. Every slice is a
  `GuardedBreakdown`.
- `barrierFrequency()` over 5d-3 log entries, carrying `SDOH_BARRIERS_DRAFT_NOTE`.
- Part 2: recovery/support-group referrals are folded into a single
  "Other / confidential services" category bucket and are never a slice value of their own, so
  no breakdown a Part 2-gated reporting viewer sees can isolate them. Cell counts below 11 are
  flagged by the shared guard exactly as elsewhere.

`/reporting` gets a "Social needs" Area between Operational and CalOMS: the four funnel stats
with median-days notes, three `BreakdownCard`s (category, provenance, track), and the barrier
table. Copy states association only — e.g. "Needs and engagement shown side by side; this is
an association, not a cause."

## 4. Disengagement link — recommendation only, nothing built

Recommendation: **yes, but as its own labelled signal, not merged into the existing one.** An
unresolved need past its 5d-3 overdue threshold is a strong operational reason to reach out,
but the current My Work disengagement signal means "the patient went quiet". Folding an
overdue staff-side referral into it would attribute a staff backlog to the patient. Proposal
for a later phase: a separate "needs stalled" line in My Work, already partly present as the
5d-3 `sdohAging` bucket.

## Files

- new: `src/lib/patientNeedThread.ts`, `src/lib/sdohReporting.ts`,
  `src/components/patient/NeedThreadList.tsx`, tests for both libs + advocate tiers.
- edit: `PostIntakeResources.tsx`, `PatientHome.tsx`, `src/lib/ehr.ts`
  (`advocateCoordination`), `AdvocateWorkspace.tsx`, `src/routes/reporting.tsx`.

## Verification

Typecheck, full vitest run. New tests: need↔referral pairing, closure window, safety and
`visibleToPatient` respected on both patient and advocate paths, per-tier organisation-name
rules, funnel stage counts and medians, cohort guard on every breakdown, and a no-Part 2-leak
assertion over the reporting output. Live browser at both viewports as a patient, two advocate
tiers, and a population-health reporting role; zero console errors.
