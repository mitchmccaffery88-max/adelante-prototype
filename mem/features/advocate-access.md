---
name: Advocate / Family Member third-party access (v3.0 Phase 4)
description: Why Advocate is NOT a StaffRole, the AdvocateLink entity, authorization-type gates, invitation-only invariant, and the schedule-only scope ceiling
type: feature
---
**Architecture.** An Advocate is a SEPARATE entity (`AdvocateLink` in
`src/lib/ehr.ts`), never a `StaffRole`, never in `STAFF_NAV` or the RBAC
matrix. Every StaffRole encodes cross-patient, employment-derived reach; an
advocate is the inverse — one external person, one patient, authority from a
legal instrument. Policy lives in `src/lib/advocate.ts` and is PURE (facts in,
decision out); `ehr.ts` supplies live facts on every call, so revocation /
expiry / ROI withdrawal auto-stop access everywhere.

**Scope ceiling — do not raise without Mitch's swim-lane role doc.**
`schedule_view` is the ONLY permission granted to ANY authorization type.
`care_plan_view`, `clinical_notes_view`, `messaging` exist as names only.
`advocateSchedule()` returns a minimal DTO with no clinical field, and SUD-track
(`sud_clinical_preauth`) group topics are withheld — the topic string is itself
Part 2 content.

**Two-halves rule.** An invitation alone grants NOTHING. Access requires the
code AND an explicitly confirmed `AdvocateAuthorizationType`. Gates that
genuinely differ by type: `dhcs_collateral` → zero access until an active
`roi_collateral` ConsentRecord; `ahcd` → dormant until a physician activation
(`activateAdvocateAhcd`).

**Hard invariant (tested).** There is NO code path that locates a patient from
advocate-supplied identifying information. `advocateLinkByCode` is the only
lookup. Never add a find-by-name/DOB/phone here. The invitation goes DIRECTLY to
the advocate's contact, never relayed through the patient (tampering vector).
The code shown in `AdvocateDesignationPanel` is a flagged DEMO affordance only —
no email/SMS transport exists in the prototype.

**Placeholder content.** `roi_collateral` label and the DHCS AR / Collateral
summaries are placeholders pending Christi's DHCS-sourced form content, same
discipline as every other ASCMI category.

**Audit.** Own `advocate` AuditCategory (mapped to `consent_ledger` in
`auditRedaction.ts`). Every designation, claim, AHCD activation, revocation,
allowed view AND denial is logged with advocate identity + authorization type.
The invitation code is never written to the audit log.
