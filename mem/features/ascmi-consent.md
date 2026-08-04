---
name: ASCMI structured consent records
description: ConsentRecord model, placeholder categories, write roles, live gate + disclosure audit — and what must be replaced before production
type: feature
---
**Model.** `ConsentRecord` in `src/lib/ehr.ts` is the single source of truth for
Part 2 / consent-gated access. `getConsentState().part2Sud` is DERIVED from
`isConsentCategoryAuthorized(patientId, "sud_treatment")`, which is evaluated
LIVE on every call (never cached) — that is what makes revocation/expiry
auto-stop access everywhere. Patients with no structured record fall back to
the legacy boolean; the legacy `setConsent("part2Sud")` toggle mirrors into the
record so there is still exactly one source of truth.

**Placeholder categories (MUST be replaced).** `sud_treatment`,
`mental_health`, `case_coordination`, `billing` are placeholders, not DHCS
ASCMI categories. Same for form-type labels and attestation wording. Replace
with Christi's DHCS-sourced content before production.

**Write roles.** `consent_ledger` is `write` for `case_manager` (captures the
form with the patient) and `sys_admin` (correction/administration); all other
roles stay read-only.

**Revocation** never deletes: status → `revoked` with reason/timestamp/actor.
A new record supersedes the prior active one via `supersedesId`.

**Disclosure trail.** Audit category `disclosure` /
`consent_gated_content_disclosed`, fired from `printRecord.ts` when a
consent-gated note is actually INCLUDED in an export (category-level only).

**Psychotherapy-notes tier.** `psychotherapy_notes` RecordClass = default deny
for every role, not unlocked by SUD consent; `ProgressNote.restrictedTier` is
the flag. Deliberately UNAPPLIED — needs clinical author sign-off before any
template is tagged.