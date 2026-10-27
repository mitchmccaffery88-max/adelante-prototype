# Referral lifecycle batch — clean-boundary stop, 27 Oct 2026

Draft — pending EHR/Admin audit. **Inventory complete; implementation stopped before UI, role, store or registry changes.**

## Completed

- Wrote `docs/referral-lifecycle-inventory.md` before changing any UI, including audiences, sources, actions, count provenance, duplicate lists, dead ends, canonical work homes and clinical/reporting exclusions.
- Recorded Mitch's lifecycle requirements and the later narrow Intake/peer permission decision without changing running permissions.
- Updated the roadmap with this explicit stop; no work is running after this response.

## Why implementation stopped

Stage 2 requires an Intake-owned first care plan before stage 4 materializes the patient. The only existing care-plan writer is patient-keyed and clinical-role gated:

- `src/lib/structuredCarePlan.ts`: `addStructuredGoal(input: { patientId: string; ... })` calls `assertEdit(input.actor)` then `patientOf(input.patientId)`. `PLAN_EDIT_ROLES` excludes Intake; clinical coordinator may only reassign owners.
- `src/lib/chartActions.ts`: `care_plan_goal.allowed` hides the action when `!canEditPlan(role)`.
- Root/lib architecture and existing Intake requirements forbid a second store, fake patient creation or broader clinical/chart permission.

No lawful existing action home can clear this required pre-enrollment gap. A shared chip would therefore create the exact permanent dead end this batch prohibits. I did not substitute packet receipt for clinical plan authorship, fabricate completion, or grant access.

## Additional reconciliation found

- Intake navigation is explicitly restricted to its workspace and identity review (`navSections.ts`); opening Care → Referrals needs a documented narrow referral-only navigation exception, not broader chart/navigation rights.
- `websiteReferralActionsConsistency.test.ts` currently asserts peer `contact`, `enroll` and `decline` all false. Mitch's new decision requires contact true but enroll/decline false. The approved stop rule forbids silently weakening protected assertions; record the exact contact-only update with implementation authorization.
- Existing referral drawer calls enroll/contact/decline/outreach stores directly; these must be registered and reason/actor checked before new controls ship. Intake enrollment also needs source-bound confirmed-identity evidence, not mere presence of DOB or identityConfidence.
- Existing `mayDispose` combines enroll/decline in the drawer; must separate enroll and reason-aware close. Store currently disallows declining an enrolled referral, so “Closed at any stage” needs an explicit enrolled-lifecycle closure design without changing episodes or clinical discharge.

## Changes per surface / what moved

**None.** No lists, numbers, clinical actions or reporting-only work moved or disappeared. The inventory provides the proposed canonical home mapping for the next approved pass. Existing five-stage funnel, Intake lanes and four setup steps remain unchanged; no new “active/billable” status claimed.

## Validation and boundaries

No application code changed, so full units/public browser were **not rerun for this inventory-only stop**. Latest completed validation from the preceding peer-send batch remains 3,514/3,514 units, then 47/47 public browser, and 4/4 staff browser; those are not lifecycle verification. Latest preview signal checked separately.

No Supabase/schema/integration changes, TEST_SUPABASE_* reads, secret requests, migration, persistence activation or publishing.

## Decision needed to resume

Clarify stage 2: make pre-enrollment enrichment **administrative only**, with existing clinical care-plan drafting deferred to the enrolled patient record and owned by a currently authorized care-team author; or authorize a precisely scoped alternative compatible with the existing care-plan store and privacy gates. Also define how an enrolled lifecycle is closed without treating it as a declined inbound referral. Until then, shared model/UI, narrow action implementation, reporting and lifecycle tests remain blocked rather than partially shipped.