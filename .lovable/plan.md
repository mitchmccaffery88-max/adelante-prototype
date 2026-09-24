# Phase 8b — One shared intake benefits step

## What exists today (short)
- Self-service intake (`intake.tsx`, Coverage step) writes only through the 8a merge: type, Medi-Cal status (Medi-Cal/dual only), county, flags, free-text "other plan". No CIN, no plan span, no check record.
- Staff-assisted intake = the same `SignupFlow` driven by staff (`assisted-signup.tsx`), then the patient goes on to intake. No coverage questions of its own.
- Referral form: CIN only when justice-involved, with a live duplicate-CIN warning; copied to `Patient.cin` at conversion.
- There is no separate "new chart" form in the app; staff create charts through the caseload upload (CIN only). Pre-release CSV has no CIN/coverage.
- Worklist ranks by the most recent check; a patient with no record is "never checked".
- Tasks: `CaseTask` already supports role pools (`allowedRoles`, empty `assignedTo`, claim) and `dedupeKey`.

## What gets built

### 1. One data function: `recordIntakeBenefits(patientId, answers, actor)`
New file `src/lib/intakeBenefits.ts`. Every path calls this; nothing writes coverage from intake any other way.
- Always goes through the 8a merge (type, Medi-Cal status only for Medi-Cal/dual, never "verified").
- **Medi-Cal / dual:**
  - CIN: validated (9 characters), written to `Patient.cin` only if empty. If a different CIN is already on file, it is not overwritten — the step shows a notice and the audit row records "CIN mismatch, not written". The duplicate-CIN check (another patient or referral holds it) is lifted out of the referral form into a shared helper and shown as the same warning; it warns, it doesn't block (matching today).
  - Managed care plan: structured list of the Tulare/Kings plans (Anthem Blue Cross, CalViva Health, Kaiser, Medi-Cal FFS / no plan) plus "Other" with a name, plus "I don't know".
  - Adds a **plan span** (source `self_report`, from today) — only if no open self-report span with the same payer exists, so re-running doesn't duplicate.
  - Adds a **self-reported verification record**: a new channel value `self_report` and result `pending`. It is labelled "Patient-reported — needs staff verification" and never counts as a staff check (the 8a rule that "verified" needs a real check ignores these). One per intake run at most; a repeat on the same day is skipped.
- **Non-Medi-Cal:** records what the patient said (no insurance / private insurance with plan name / prefer to pay myself / other). Private insurance with a plan name becomes a self-report plan span (payer name). Then creates one task "Set payment arrangement", open to the Billing and Billing Coordinator pool, `dedupeKey = payment-arrangement:<patientId>`. No task if an arrangement is already set. Intake never sets the arrangement.
- Everything audited (`intake_benefits_recorded`, with what was written/skipped; no CIN value in the audit).

### 2. One component: `<BenefitsStep>`
`src/components/intake/BenefitsStep.tsx`, coverage type first, then the branch above. Used in:
- Self-service intake (replaces the current Coverage step body; county/justice/ECM questions stay).
- Staff-assisted intake (same intake screen, staff acting — actor recorded as the staff member).
- Referral enrollment: replaces the justice-only CIN box. Since the referral patient doesn't exist yet, the component returns answers that are stored on the referral and applied through `recordIntakeBenefits` at conversion (replacing today's plain CIN copy).
- Staff chart: shown on the chart's Eligibility section as "Record reported benefits" for staff (no separate new-chart form exists to add it to).

### 3. Worklist
New state **"Needs verification"**: the latest record is a patient self-report and there is no staff check after it. Ranking: **Never checked first, then Needs verification, then Overdue, Due, Current.** Reason: never-checked means we know nothing at all, not even a CIN; a self-report gives staff a CIN and plan to verify against, so it is quicker work but still unverified. Days-since and due dates only count staff checks.

### 4. Recommendations (not built unless you say so)
- **Pre-release import:** yes, add *optional* `cin` and `coverage_type` columns, applied through `recordIntakeBenefits` as source "front desk / roster", never as verified. Small; I'd do it in 8b if you agree.
- **Self-service sign-up:** should defer to intake — no coverage questions added there.

### 5. Language
All patient-facing wording in English and Spanish through the existing i18n file, Spanish tagged pending bilingual review (existing convention).

## Non-goals
No electronic eligibility fields or clearinghouse (8c). No changes to payment-arrangement rules or pricing.

## Verification
Typecheck; tests: each path calls the shared function; Medi-Cal patient gets one plan span + one self-report record and lands as "Needs verification"; non-Medi-Cal patient gets exactly one billing task; CIN only in `Patient.cin`, never overwritten; re-running creates no duplicate spans, records or tasks; prior plans/checks kept. Browser at both viewports: completed self-service intake, staff-assisted intake, and a referral enrollment. Full test count reported.
