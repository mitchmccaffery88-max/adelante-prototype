# Eligibility for every coverage path (26 Oct, Mitch) — preview

Extends the Phase B contract (`requestIntakeEligibility`, `billing_intake_check`, coverage-only projection). No parallel system: the same request store now carries a coverage path. Nothing published. Draft — pending billing sign-off.

## 1. Coverage paths
One request type; the path is a field. Paths (data in `src/lib/eligibility/coverageConfig.ts`):
Medi-Cal (FFS or managed care plan) · Medicare (incl. Medi-Medi) · County or public program · Private / commercial · Self-pay · Sliding scale · Uninsured — help applying for Medi-Cal · Unknown — Billing determines.

- County/public programs are a configurable list (`listCountyPrograms` / `setCountyPrograms`) with optional counties and a per-program re-check interval. Defaults: DMC-ODS county-funded, MHSA/BHSA, Realignment/AB 109, CalAIM justice-involved pre-release services.
- Who can request: Intake (referral-scoped, `intake_eligibility_request`, now takes a path) and care-team roles that **already** have coverage access (`care_coverage_request`, gated by the existing `canAccess(role, "eligibility")` plus chart entry). Today that is ECM provider (write) and CF care manager, SUD counselor, therapist, physician, PMHNP, clinical coordinator (read). No new grant.
- Uninsured also creates a "Medi-Cal application assistance" Billing task.
- Coverage TYPE stays a plain label; the chip shows status.

## 2. Billing processing (Billing roles only; store re-checks the staff identity)
| Path | Billing action | Result |
|---|---|---|
| Medi-Cal, Medicare, county, private | `billing_coverage_run` through the configured adapter, or the existing manual `billing_intake_check` | Active / Inactive / Not found, next-check date |
| Private / Medicare details | `billing_coverage_insurance` — payer (from payer table), member ID, group, subscriber relationship | Billing-only |
| Self-pay | `billing_coverage_self_pay` — acknowledgment + fee schedule from the table; no check | Self-pay |
| Sliding scale | `billing_coverage_sliding` — household size, income, documents received/attested; tier from the tier table | Sliding scale — tier set |
| Uninsured | `billing_coverage_application` | Application in progress |
| Unknown | `billing_coverage_path` — Billing sets the real path, then processes it | — |
| Multiple coverages | `billing_coverage_order` — primary/secondary order + COB note | Billing-only |
| Re-verification | `billing_coverage_recheck` / `sweepCoverageReverification(date)` — one Billing task per active coverage whose next-check date has arrived (deduped per date) | — |

Cadence is configuration: Medi-Cal monthly, Medicare yearly, commercial on the payer's next plan-year start, sliding scale yearly, county per program, self-pay none.

Sliding-scale tier table (poverty base, per-person increment, tiers by % of poverty) is a **Draft placeholder** and must be replaced with the clinic's approved table before use.

## 3. What Intake and the care team see
`intakeCoveragePath` / `careTeamCoverage` / `coverageProjection` return only: path label, status (Active / Inactive / Pending / Not found / Self-pay / Sliding scale — tier set / Application in progress), checked-on date, next-check date, and the payer-unreachable notice. Never member IDs, payer financial details, copays/deductibles, income, tiers, documents, COB notes or verification history (tests assert absence). `intakeCoverageResult` keeps its Phase B shape.

Patient portal: `patientCoverageSummary(patientId, lang)` returns plain words ("Your coverage: Medi-Cal — active", "Sliding scale — set up" / "Tu cobertura: Escala móvil — lista") with no amounts. Not mounted. Spanish is draft pending native-speaker review.

## 4. Clearinghouse readiness (Simulated now)
- **Interface** (`src/lib/eligibility/adapter.ts`): channel-agnostic `CoverageAdapter { channel, simulated, check(CoverageCheckRequest) → CoverageCheckResponse }`. Channels: `manual`, `simulated_vendor` (the existing honest "not connected"), `clearinghouse` (stub), `external_billing` (seam for an external billing module such as SculptSoft, via `registerCoverageAdapter`). The original 8c `EligibilityAdapter` / `applyEligibilityResponse` path is unchanged.
- **Selection is configuration**: `configureEligibilityAdapter({ selected, clearinghouse: { enabled, vendor, credentialsSecretName, baaOnFile, timeoutMs } })`. Default: `manual`, clearinghouse disabled. Switching it on is refused without a signed BAA, a vendor and a credentials setting name (the secret itself is never stored in code). Selecting it while disabled refuses with "Clearinghouse isn't contracted yet — record a manual check instead."
- **Payload mapping** (stub, documented in `coverageAdapters.ts`): 270 NM1*IL ← member reference, NM1*PR ← payer EDI id, DTP*291 ← service date, EQ 30 + MH/AI (behavioral health / SUD). 271 EB segments → outcome, plan, effective dates, copay/deductible/out-of-pocket (Billing-only), BH/SUD carve-out flags. The stub invents no amounts.
- **Payer list** is data (`listPayers` / `setPayers`); Medi-Cal plans come from the managed care plan list.
- **Errors/timeouts**: configured timeout or a thrown adapter → status Pending, notice "Couldn't reach the payer — Billing will check manually.", and a "Manual coverage check needed" Billing task.
- **Audit**: ids only (`coverage_request_created`, `coverage_check_run` with channel/outcome/transaction ref/`simulated`, `coverage_self_pay_recorded`, `coverage_sliding_tier_set` with tier id, `coverage_order_set`, `coverage_recheck_due`, …); plus one registry `action.*` event per attempt. `billing_coverage_run` carries the existing `eligibility_simulated` flag and audits `simulated: true`.
- **A BAA is required before any real request.** No real request is possible in this build.

## Stop boundaries / gaps
- Billing determinations, insurance details and requests live in preview memory (same as Phase B); no hosted persistence.
- Sliding-scale tier table and fee schedule are Draft placeholders awaiting finance sign-off.
- Patient portal coverage view is projection-only (not built, as instructed).
- The automatic re-verification sweep runs when Billing presses "Create due re-verification tasks" (or the function is called); no background scheduler in the preview.
- No new stop boundary found.

## Files
New: `src/lib/eligibility/coverageConfig.ts`, `src/lib/eligibility/coverageAdapters.ts`, `src/lib/coverageRequests.ts`, `src/lib/__tests__/coveragePaths.test.ts`, this report.
Changed: `src/lib/eligibility/adapter.ts` (interface added), `src/lib/intakePhaseB.ts` (request takes a path; projection delegates; care-team request), `src/lib/chartActions.ts` (9 actions, registry version), `src/components/staff/IntakePhaseBActions.tsx` (path picker + coverage-only status), `src/components/staff/IntakeBillingRequests.tsx` (per-path Billing controls), `src/lib/__tests__/__snapshots__/runAction.test.ts.snap` (only the 9 new action rows added), `roadmap.md`, `src/lib/AGENTS.md`.

## Validation
FULL units 3,422/3,422 (395 files), exit 0. FULL public browser 47/47 (eight public specs, one worker against :8080, 10.8 min), exit 0. Action snapshot changed only by the 9 new action rows. Nothing published.
