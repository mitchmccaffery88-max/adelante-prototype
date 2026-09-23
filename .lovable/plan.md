# Referrals Rework, Phase 4g — referral-to-active-patient funnel

## What I found (real current state)

- `Referral` already carries every timestamp this funnel needs: `createdAt`, `contactedAt`, `enrolledAt`, `declinedAt`, `declineReason`, `enrolledPatientId`, `referralSource`, `justiceInvolved` (yes/no/unsure), and the Phase 4e `outreach.attempts`.
- Phase 4f gives the honest endpoint: `firstAttendedAppointment(patientId)` counts only `status === "attended"`; `nextScheduledAppointment` gives "scheduled but not yet attended". Cancelled and no-show can never count.
- Phase 4c gives the pre-contact staleness thresholds (`REFERRAL_AGING_DRAFT`, 3 due / 7 overdue) and `referralAging()`.
- Decline reasons are already a fixed aggregated list (`REFERRAL_DECLINE_REASONS`, 6 keys) — no free text is ever reported.
- The Social needs section already established the exact pattern to copy: a pure projection module (`sdohReporting.ts`) + `Area` / `Stat` / `BreakdownCard` / `CohortGuardNotice` in `reporting.tsx`, with the shared `cohortGuard` (11).

## Part 2 risk in the source slice — how I handle it

A `drug_court` row with a count of 2 is, at caseload scale, a named disclosure of substance-use involvement — the same problem the Social needs section solved by folding recovery categories into one bucket. So **drug court is never its own row here**. `probation`, `parole`, `drug_court` and `correctional` fold into a single **"Justice system (supervision, court or correctional)"** bucket. Community organisation, community peer, self/family and other stay as themselves. The fold happens inside the projection module, so no reporting surface can opt out of it. The same fold applies to the decline-reason and drop-off breakdowns.

The Phase 4c justice-involved answer (yes / no / unsure) stays a real slice: justice involvement alone is not a Part 2 fact, and it is the answer the referrer actually gave.

## Build

**New `src/lib/referralFunnel.ts`** (pure, unit-testable, no UI):

- `referralFunnel({ sinceDays })` → stages `submitted → contacted → enrolled → firstApptScheduled → firstApptAttended` as counts, plus median days between consecutive stages, plus `cohortGuard(submitted)`.
  - contacted = `contactedAt` set **or** at least one 4e outreach attempt logged (an attempt is real contact work).
  - enrolled = `enrolledAt` + `enrolledPatientId`.
  - scheduled/attended read the 4f helpers off `enrolledPatientId`.
- Slices, each a guarded breakdown over the same windowed referral set: `bySource` (folded as above), `byJusticeAnswer` (yes / no / unsure / not asked), `byTrack` (via `resolveCohorts`, enrolled referrals only — an unenrolled referral has no patient and so no track; stated on screen).
- Drop-off: `declinedByReason` (aggregated keys only), `overdueBeforeFirstContact` (Phase 4c thresholds, unchanged), `enrolledNeverAttended` (enrolled, no attended appointment) split into "has a scheduled appointment" vs "nothing on the books".
- `REFERRAL_FUNNEL_ASSOCIATION_NOTE` — association-only copy, mirroring the SDOH note.

**`src/routes/reporting.tsx`**: a "Referral to active patient" `Area` (id `referral-funnel`) placed directly beside/after Social needs, same components, same guard notices. Five `Stat` cards with median-days notes, three `BreakdownCard`s for the slices, a drop-off card for the three drop-off measures.

**Period behaviour (honest):** the funnel *is* windowed — every referral carries a real `createdAt`, so the cohort is "referrals submitted in the selected period" and the selector genuinely applies; the stage counts follow that cohort forward in time (stated in the purpose line). The overdue-before-first-contact count is current-state for referrals in that cohort and is labelled "as of now". Nothing else is re-windowed.

## Required guarantees

- `cohortGuard` (11) on the funnel itself and on every breakdown.
- Aggregate only — no referral names, no per-record detail, decline reasons as fixed categories.
- Association language on any engagement/retention wording.
- No changes to referral actions, outreach, journey, or staleness thresholds; no new data capture.

## Verification

`src/lib/__tests__/referralFunnelPhase4g.test.ts`: stage counts; attended-not-scheduled endpoint; cancelled/no-show never counted; outreach-attempt-counts-as-contacted; medians; each slice; the drug-court fold; cohort guard. Then typecheck, full suite, build, and a live browser pass at both viewports as a reporting role checking zero console errors and no regression in Social needs.
