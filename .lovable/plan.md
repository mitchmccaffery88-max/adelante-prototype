# Reporting Tier 2 — structured CalOMS fields + honestly-labeled self-reported data

## What I found first (drives the consolidation decisions)

- **Already real and structured — will NOT be duplicated:**
  - `Patient.needs` (housing, food, employment, transport, substanceUse, benefits, family) — these are *need* booleans, not CalOMS status values.
  - `Patient.sdohPlan.items` (`SdohPlanItem`) — need → referral → closed-loop status, with the urgent-escalation lane.
  - `ReentryCarePlan.housing.arrangement` + `CarePlanPreReleaseSlice.housingArrangement` — living arrangement already captured (free text, episode-scoped).
  - `Patient.coverage.justiceInvolvement` (TriState) and `coverage.jiReentryFlag` — justice involvement *existence* is already structured.
  - `ReleaseDateMeta` (`source`, `confidence`) and `ResourceReferralSource = "internal" | "pre_release"` — the existing provenance conventions.
- **Genuinely missing (free text on note templates only):** substance-use profile, prior treatment history, discharge status/reason (today `discharge_reason` / `condition_at_discharge` are template answers — unqueryable).
- **Honesty-label pattern in use today:** amber outline `Badge` ("Pending verification" on unverified resources; draft/pending-review chips in the crisis work). That is the pattern to reuse.

**Consolidation decision:** employment and living arrangement are *not* re-added as new CalOMS fields. The CalOMS card reads and displays the existing `needs.employment` flag and the existing housing arrangement instead, with a link to where each is edited. Only the three genuinely-missing domains get new typed fields.

## 1. New structured CalOMS model — `src/lib/caloms.ts`

Typed vocabularies (all marked DRAFT pending real DHCS field-level specs) plus a `CalomsProfile` stored as one optional field on `Patient`:

- `SubstanceUseEntry` — `substance` (typed enum: alcohol, heroin, other_opiates, methamphetamine, cocaine_crack, cannabis, benzodiazepines, other, none), `rank` (primary/secondary/tertiary), `route` (oral, smoking, inhalation, injection, other), `frequency` (no_use, 1_3_month, 1_2_week, 3_6_week, daily), `ageAtFirstUse`, `source`, `recordedAt/By`.
- `PriorTreatmentHistory` — `priorEpisodes` (none / 1 / 2_4 / 5_plus / unknown), `lastTreatmentType` (typed), `lastTreatmentEndedOn`, `priorMat` (TriState), `source`, `recordedAt/By`.
- `DischargeRecord` — `status` (completed_treatment, left_satisfactory, left_unsatisfactory, transferred, incarcerated, deceased, unknown), `reason` (typed) + optional `otherReason` free text, `dischargedOn`, `episodeId?`, `recordedAt/By`. Append-only array; latest is current.
- `JusticeInvolvementSelfReport` — `arrestsPast30Days`, `arrestsPast12Months`, `timeInCustodyMonths`, `justiceReferralSource` (typed: court, probation, parole, drug_court, jail_release, self, other). Every field carries provenance and is `source: "self_report"` by default.

**Provenance:** reuses the existing vocabulary rather than inventing one — `CalomsDataSource = "self_report" | "pre_release" | "internal"`, i.e. the `ResourceReferralSource` union plus the `self_report` value already defined in `ReleaseSource`. A type-level test asserts it stays a superset of `ResourceReferralSource`.

**Store methods** on `AdelanteEHR` (same audit/emit pattern as `addSdohItem`): `setSubstanceUseProfile`, `setPriorTreatmentHistory`, `recordDischarge`, `setJusticeSelfReport`.

**Query helpers** (the point of the exercise — proving these are queryable, not free text): `calomsCompleteness()`, `substanceUseBreakdown()`, `priorTreatmentBreakdown()`, `dischargeStatusBreakdown()`, `justiceSelfReportCoverage()` — each returning counts across the whole caseload.

## 2. Honest labeling — one shared pattern

New `src/components/ProvenanceBadge.tsx` wrapping the existing amber outline badge:
- `self_report` → "Self-reported" (amber)
- `pre_release` → "From pre-release record" (muted outline)
- `internal` → "Staff-entered" (muted outline)

Used on every surface where these values appear: the chart card, the intake review, and the reporting tiles. The whole justice-involvement block additionally carries a one-line explanatory note that facility/county data sharing is a separate future phase, so these are patient estimates.

## 3. Where it appears

- **Chart:** new `CalomsProfileCard.tsx` registered as a `CalOMS profile` section in `src/components/clinical/recordSections.tsx` (chart group, existing clinical gate) — read + edit for the three new domains, plus read-only display of the already-real employment need and housing arrangement with links.
- **Intake:** new self-reported step capturing substance-use basics and the justice-involvement estimates, every field badged "Self-reported" and written with `source: "self_report"`.
- **Reporting home (`/reporting`):** new "CalOMS data capture" area between Program eligibility and Patient behavior — completeness tiles (substance profile / prior treatment / discharge recorded), a top-substances breakdown, a discharge-status breakdown, and the justice-involvement block rendered under a visible self-reported banner. Point-in-time labelling, consistent with Tier 1 rules.

## 4. Tests + verification

- `src/lib/__tests__/caloms.test.ts` — typed writes, append-only discharge history, provenance defaults, and each aggregation helper returning real counts.
- Regression assertions that SDOH plan items and intake needs are untouched.
- Typecheck, full suite, then a real browser pass at 1280px and 390px: chart card, intake step, reporting area, zero console errors.

## Non-goals honoured

No facility/county integration, no submission pipeline, no changes to fields that are already real and structured.
