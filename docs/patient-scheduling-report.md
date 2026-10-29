# Patient scheduling — 29 Oct (Mitch)

**Draft — pending clinical review with Christi.** Checkpoint only; scheduling changes below are not implemented. Nothing published, persistence OFF, no Supabase changes, no codes or rates invented. `/schedule` layout unchanged.

## Completed first carry-over: coverage bridge
The existing coverage-request store self-registers a dated minimal funding projection into `resolveFundingSource`. Latest determinations per request and Billing's existing order supply the single answer; no new ordering store. Self-pay acknowledgments, insurance effective dates, active/inactive status and COB are covered. Financial details remain in Billing.

Full units **3,690/3,690 (417 files)**, followed by isolated public browser **53/53 (12.6m)**, one worker :8080, exit 0. See the coverage report for evidence. No approved source pin required a change for these files.

## Inspection before scheduling changes
### Calendars and services today
`careManagerCalendar.ts` seeds active ECM/care-manager/peer calendars using existing availability records, with explicit services and Draft Monday–Friday 09:00–17:00 hybrid hours at Visalia when availability is missing. These are seeded defaults, not confirmed real operating hours.

| Staff | Calendar service provided by the helper |
|---|---|
| s-cm1 Luz Herrera | case_management |
| s-cm2 Lupita Sanchez | case_management |
| s-cf1 Rosa Delgado | case_management |
| s-cf2 Darnell Pope | case_management (outpatient ECM assignment; in-facility assignment remains gated) |
| s-peer1 Andre Willis | peer_support |
| s-peer2 Trey Wilson | peer_support |
| s-chw1 Maribel Ortiz | No CHW mapping/default calendar in this helper |

`ehr.ts` currently documents missing clinician services as all services; `_assertClinicianFit` only rejects omissions when an array exists. This needs to become none. The complete affected-calendar inventory is not yet established; do not claim all calendars have been repaired. Availability blocks without care tags/types also currently inherit site services (`staffProfile.ts:effectiveBlockTags`).

### Group capacity today
`ehr.ts:_assertGroupCapacity` applies 2–12 without category distinction, at create and capacity update. The create screen also constrains the input to that range. `groupRequests.ts` rechecks capacity and existing join requirements; open non-billable groups already have their care-plan-eligibility exception. Category-specific capacity has not been changed. No additional patient-wide group-count limit was proved by this inspection.

### Individual picker today
`/schedule` reads all 11 existing catalog entries through `listServiceTypes`. No `patientAccess` field exists yet. Missing care types and conditional request/book filtering are not implemented at this checkpoint.

## Full proposed patientAccess table for Christi to confirm
The following is Mitch's requested Draft specification, **not the installed catalog**.

| Catalog type | Draft patientAccess | Condition / destination |
|---|---|---|
| intake | staff_only | Getting started / Intake |
| therapy_individual | book | Care-team follow-up; new clinician / first visit requests team |
| therapy_group | staff_only | Groups tab only; existing join rules |
| med_management | book | Current prescriber |
| controlled_med_moud | book | Active MOUD episode + established prescriber; first visit requests team |
| sud_counseling | book | Recorded ASAM placement; hidden otherwise without reason |
| sud_group_odf | staff_only | Placement by staff; Groups tab only |
| sud_group_iot | staff_only | Placement by staff; Groups tab only |
| peer_support | book | Existing assigned-person priority / calendar hours |
| case_management | book | Existing case manager / ECM calendar |
| care_coordination | book | Existing role/calendar checks |
| psychiatric_evaluation (new) | request | Prescriber; Ask my team |
| sud_assessment (ASAM, new) | staff_only | SUD counselor / licensed clinician; existing masking |
| chw_visit (new) | book | CHW; billable only with approved credential checks, otherwise non-billable |
| family_collateral (new) | request | Therapist / associate; Ask my team |
| nurse_visit (new) | staff_only | RN / LVN |

New IDs are proposed names, not a parallel operational list. Modalities, Draft durations and delivery-system tags remain to be installed in the single catalog and listed for Christi. No rate or code mappings have been created.

## Remaining scope at green stop
1. Both carry-over controls: dated, reason-coded SMHS for treating licensed clinicians; appointment funding override for Billing/Intake without chart-access expansion. Rerun full units then public suite after both controls.
2. Catalog field + five care types; conditional bilingual patient book/request menu; request duplicate/auto-close and ASAM type linkage.
3. Shared store/clinician-picker fit, consent, credential, funding and conflict rules; calm self-booking refusal; private-pay confirmation label.
4. CHW calendar and missing-service defaults, assigned-person priority, category-specific group capacity.
5. New all-role/patient/advocate privacy and button/store tests, any exact-once source re-pins, final units/public browser and end-to-end scheduling readback.

Stopped after the completed bridge item with full units and public suite green; no unfinished command is running.