---
name: Front-door two-tier helper model
description: Tier 1 informal helper field on /start/signup and Tier 2 staff-operated assisted sign-up at /assisted-signup, incl. consumedBy rule
type: feature
---
Front door has ONE sign-up implementation: `src/components/frontdoor/SignupFlow.tsx`,
rendered by both `/start/signup` (public) and `/assisted-signup` (staff). Never fork it.

- Tier 1: optional free-text "Did someone help you sign up today?" on BOTH branches
  (new patient + code redemption). Never validated, never required, no gate.
  Stored as `helperNameUnverified` in the existing audit detail — always labelled unverified.
- Tier 2: `operator` prop => real staff identity. RBAC via the `assisted_signup`
  record class in `src/lib/roles.ts` (`canRunAssistedSignup`), granted to
  ecm_provider, cf_care_manager, peer_specialist, sys_admin. No new permission concept.
- Tier 2 redemption stamps the OPERATOR staff id into `EnrollmentCode.consumedBy`
  and audits `enrollment_code_redeemed_assisted`; Tier 1 keeps the patient's own id
  and `enrollment_code_redeemed`.
- Track A (staff-provisioned via createPatient with no credential) emits no signup audit event.
