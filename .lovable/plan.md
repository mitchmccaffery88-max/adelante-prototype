# Access rules Part B continuation — Draft

## 1. Complete the shared chart gate
- Verify Today, Inbox, bell and quick-peek click-throughs with an off-team staff member.
- Keep chart data unmounted until the existing shared reason gate passes; repair any bypass using that component.
- Run gate tests and full units before continuing.

## 2. DEA from the existing service catalog
- Remove the newly introduced controlled-service fields from bookings, evaluator inputs and claim-like inputs.
- Derive DEA requirements from a Draft flag on the existing service-type catalog, without changing Billing's projection or booking controls.
- Assumption: if dedicated buprenorphine or controlled-medication entries are absent, flag the matching medication-management catalog entry as Draft and list it for Mitch's confirmation; do not infer classification from patient SUD status.
- Test verified/unexpired DEA on service date, booking/store parity and the existing neutral Billing result. Update the credentialing report and approved exact-once source pins; run full units.

## 3. SQL acceptance and separate approvals
- Run all-role, temporal, Part 2, group, Intake day-60/day-61 and patient/advocate vectors in rolled-back transactions on the connected main project, recording before/after counts.
- Keep any failing or unproved policy group closed.
- Present chart, packet and handoff policy openings one migration at a time for approval, only after their acceptance passes.

## Boundaries
- Draft; no publishing; persistence OFF.
- Part 2 matrix and permission values unchanged. Part 2 internal-use basis: pending counsel confirmation.
- Reason/coverage commands remain browser-revoked until Phase 2d.
- Stop after a completed green item if resources run low, reporting the exact remainder.

## Technical details
- Reuse ChartAccessGate, existing catalog and credentialing authority; no parallel stores or expanded Billing allowlists.
- Preserve codes, dates, provider and units assertions and never project note text.
- Use approved exact-once SHA-256 adapters for changed gate-related source pins.