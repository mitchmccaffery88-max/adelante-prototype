# Dashboard Standardization Phase 5a — honesty, naming, and cleanup

## Current-state findings and decisions

- **One surface name:** `/case-manager` is the existing working route and remains unchanged, preserving every link and bookmark. Its navigation label, page title/metadata, eyebrow, and H1 become **Care Coordination**. This remains distinct from **Clinical Coordination** at `/admin-coordination`: Care Coordination is the assigned-client workspace; Clinical Coordination is the administrative routing/coverage center. The `care_coordination` record class remains an internal access category and is not renamed.
- **Honest scope copy:** replace the false “Non-clinical view” subtitle with copy stating that the page lists assigned or program-wide clients and that opening a record shows chart sections allowed for the viewer’s role. Preserve the Phase 1g “assigned to me” default and `CASELOAD_SCOPE_NOTE` exactly.
- **External Coordination placeholder:** remove the non-functional card and its demo timestamp. Its Part 2 warning is currently the only copy on this page, but the same guardrail remains on the patient record’s real Coordination section, where external contacts and coordination entries are actually recorded. The warning will therefore move with the real workflow rather than disappear from the product.
- **Eligibility consolidation:** the program worklist can record eligibility checks, and the patient record’s Eligibility section already owns benefit flags, comparisons, plan spans, and notes. The case-management cards are duplicate surfaces, but two follow-up actions exist only there today. Move those follow-up actions and per-client check access into the patient record’s Eligibility section, then replace the two large dashboard cards with one compact status card linking directly to that patient section and to the program worklist. This preserves every capability while establishing the patient record as the single per-client editing surface.

## Implementation

1. Update English and Spanish `navCaseManager`, `cmTitle`, and `cmSubtitle`; update `/case-manager` metadata, including complete social metadata. Keep `/case-manager` as the canonical URL.
2. Remove `CoordinationCard` and its unused imports/props from the Care Coordination page.
3. Remove the hardcoded Monday–Friday availability card from Clinician Workspace. Keep `/clinician-availability` unchanged in the **My account** navigation and linked from **My profile**.
4. Add `/refusal-queue` as a staff-only, single-purpose queue page using the existing `NurseRefusalWorklist` unchanged. Gate both navigation and page behavior with the existing `meds_erx` access level, including read-only behavior. Register it in the **Queues** group so the staff shell and breadcrumbs resolve from the shared registry.
5. Remove the refusal worklist from the Clinician dashboard. Add a **Refusal documents** queue pill only when the acting role can access `meds_erx` and pending refusal forms exist; link it to `/refusal-queue`.
6. Extend the patient record Eligibility section with the existing record-check dialog plus reactivation and enrollment-assistance actions. Respect its existing read-only mode. Replace `CoverageActionsCard` and `EligibilityFlagsCard` on Care Coordination with one compact summary containing direct links to the selected patient’s Eligibility section and `/eligibility-worklist`.
7. Initialize the Clinician Workspace chart selection to empty. The Patient chart tab will show a clear choose-a-patient empty state until the picker or an appointment action selects someone; existing appointment “open chart” actions continue selecting the intended patient.

## Tests and verification

- Update navigation tests for the Care Coordination label and new refusal queue, including role gating and staff-route ownership.
- Add focused tests for the refusal queue’s pending-only dashboard pill and blank initial chart state where practical.
- Run TypeScript checks and the full test suite.
- Verify live at 1280×1800 and 390×1400: consistent Care Coordination naming and honest subtitle; no placeholder coordination or static availability card; real availability still reachable from My account/profile; refusal queue appears in the staff shell and its dashboard pill appears only with pending work; eligibility checks, flags, plan details, and both follow-up actions remain reachable; Patient chart starts blank; no console errors.
