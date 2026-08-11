---
name: PO disclosure two-tier split
description: Mandatory (court order / supervision condition, never togglable) vs voluntary (revocable ConsentRecord) probation-parole disclosure, mirroring the AB 133 split
type: feature
---
`src/lib/poDisclosure.ts` mirrors `src/lib/ab133.ts`: two separate code paths.

- `poMandatoryDisclosure()` — never touches the consent ledger; resolves from
  (item x `PoMandate` kind court_order|supervision_condition). Not patient
  controllable; `assertPatientControllable()` throws on mandatory items and the
  consent path refuses them outright, so there is no write path.
- `poVoluntaryDisclosure()` — requires live `po_voluntary_coordination`
  ConsentRecord authorization (the ONE new category); revocation stops it.
- `poDisclosureDecision()` routes by tier; it never merges the paths.

UI: `PoDisclosureCard` (patient-facing, read-only, wrapped in `PopulationGate`
for pre/post-release JI) renders mandatory items as information with NO control
and voluntary items with their real consent status. Staff still capture/revoke.

PLACEHOLDER: the mandatory/voluntary item classification and wording need
Christi's confirmation against real county supervision/court-order language.
FOLLOW-UP (not built): Cathy's full topic x audience consent-matrix UI.
