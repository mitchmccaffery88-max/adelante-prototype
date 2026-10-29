# Patient scheduling — 29 Oct (Mitch)

**Draft — pending clinical sign-off and review with Christi.** Coverage bridge and item (a), the two coverage controls, are implemented; sections 1–5 remain proposed below. Nothing published, persistence OFF, no Supabase changes, no codes or rates invented. `/schedule` layout unchanged.

## Completed first carry-over: coverage bridge
The existing coverage-request store self-registers a dated minimal funding projection into `resolveFundingSource`. Latest determinations per request and Billing's existing order supply the single answer; no new ordering store. Self-pay acknowledgments, insurance effective dates, active/inactive status and COB are covered. Financial details remain in Billing.

Full units **3,690/3,690 (417 files)**, followed by isolated public browser **53/53 (12.6m)**, one worker :8080, exit 0. See the coverage report for evidence. No approved source pin required a change for these files.

## 20:00 continuation — item (a): two coverage controls
- Care plan: **SMHS determination**, with explicit meets/does-not-meet, actual determination date and required reason code. Treating licensed clinician only (therapist, PMHNP, physician), using the unchanged shared direct-treatment relationship fact; an off-team reason-only chart open does not qualify. Store and registry both check this. No clinical answer or free text enters the standard audit; the domain audit keeps staff ID, date and reason code only. Existing appointment funding is not silently rewritten.
- Billing: **Appointment funding**, using the existing `billingAppointments()` projection, opens the **Change who pays** drawer. No chart link, clinical appointment graph, member insurance details or wider Billing allowlist.
- Intake: the same drawer is available beside **First visit funding**, only for the active referral's own first-visit receipt. Other appointments are absent. The editor disappears after handoff; the existing 60-day follow-up remains read-only. No chart-access grant is added.
- Funding choices/reasons are the existing resolver constants. The existing `appointment_funding_set` registry and store perform the write; one standard action event plus the existing single domain event. Private pay displays the existing Draft sliding-scale label, without amounts. The appointment stays booked and no claim/notification is sent.
- Existing opt-in fictional coverage scenario now assigns its treating clinician through the real `chart_team_assignment` registry before recording SMHS; no default seed or permission matrix changed.

### Item (a) validation and provenance
- 20:42 continuation checkpoint: the earlier `/tmp/scheduling29a/` process/output was unavailable in the fresh sandbox, so its partial 36/53 run cannot be certified. A fresh unchanged full nine-spec public run completed **53/53, exit 0, 17.3 minutes**, one worker against :8080, with no edits or units overlapping. Evidence: `/tmp/scheduling29b/public-before.txt` and `public-before.exit`. No test, retry, timeout or assertion changed. Items (b)–(d) have not started; the patientAccess table below remains proposed, not installed.
- New `coverageControlsOct29.test.ts`: licensed/treating all-role checks, patient/advocate denial, reason-only denial, real date/reason requirements, audit privacy and exactly one registry success, Billing/Intake role parity, and active-referral first-visit funding readback removed at handoff.
- Full units after implementation: **3,695/3,695, 418 files**. One earlier full-run presentation binding pin rejected the new inline table `rows` binding; the funding section was extracted into its focused component, preserving the older Billing bindings without changing the test or re-pinning it. A sixth Intake flow test was subsequently added; final full-suite/public results are recorded below after completion.
- Real preview walkthroughs: treating clinician save → SMHS care-plan readback; Billing drawer save → appointment funding readback; Intake first-visit booking → funding drawer save → receipt readback. Desktop 1280 and phone 390 checked; no page errors. Evidence: `/tmp/browser/coverage29a/`, including `check_controls.py`, `check_intake.py`, and screenshots. First browser attempts hit render timing/selector issues; successful fresh runs are recorded in `out.txt` and `intake-out.txt`, both EXIT 0.
- No existing source pin needed a re-pin: full units passed with all previous tests/adapter assertions unchanged. Prior and final source hashes retained for item (a): `structuredCarePlan.ts` 75ff1878ca083693d13a108c13952157efd75cb65b891c1d53f648495363ceac → eec31d4f897e5b31bb42d7430057919ba42e04f71c86ff32b5497a95542116a0; `chartActions.ts` 4e5cc4b48d5ab46624baf0c3bea2d73a0b4fd9fc7e664c9c80347479000fc4e8 → 0bd2c6c75aa81d6d792b2b7e162f8fcb5efb1c183899ff78733c29acd7114a50. Prior copies: `/tmp/scheduling29a/`.
- Draft SMHS reason labels (clinical assessment, clinical review, correction) require Christi's confirmation; these are administrative reason codes, not invented billing codes/rates.

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

## patientAccess table for Christi to confirm (installed 29 Oct, Draft)
Installed in the single catalog (`ehr.ts` SERVICE_TYPES `patientAccess`, `patientCondition`, `patientRequestKind`). Draft — pending Christi.

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

Installed conditions: "established" (therapy, medication, MOUD) = only clinicians the patient already sees for that type (prior non-cancelled visit; therapy also the assigned clinician); otherwise the type reads "Ask my team" and files the existing therapy/medication request. MOUD "active episode" is approximated by an established MOUD prescriber — counsel/Christi to confirm. SUD counseling needs a signed ASAM with a recorded level, otherwise it is hidden. Request types: psychiatric evaluation → medication request; family session → therapy request. New-type fit (Draft): psychiatric evaluation prescribers only; ASAM assessment SUD counselor or licensed clinician on a calendar that lists it; CHW visit community_health_worker role only (no CHW calendar yet — item c); family session therapist/associate; nurse visit RN/LVN credential (no such staff in the demo, so not bookable). New-type delivery tags: psychiatric evaluation smhs_or_nsmhs; ASAM county_dmc_ods; CHW non_billable until credential checks are approved; family session smhs_or_nsmhs (collateral billing needs review); nurse visit nsmhs (needs review). Durations 60/60/30/50/20 min are Draft. One fictional demo enrollment row was added (c3, Medi-Cal FFS, psychiatric evaluation).

### Step (b) results — 29 Oct
1. patientAccess menu + `patient_request_visit` registry action (existing duplicate/auto-close request flow). Full units 3,703/3,703 (first run had one unrelated jsdom teardown error in `appointmentDirections.test.tsx`; that file passed alone twice and an immediate full rerun exited 0).
2. Five new types, ES draft labels, Visalia in-person list, request-kind dedupe. Full units 3,706/3,706, exit 0.
3. One booking rule: self-scheduled visits must be a patient "book" type and never a group (calm refusal); clinician fit, telehealth and group consent now run for patient and staff bookings; credentialing for the resolved funding source and conflicts already ran for both. Pickers drop calendars blocked by `bookingCredentialingBlock`. Full units 3,709/3,709, exit 0.
Preview check: as the demo patient, the menu listed book and "Ask my team" types with no intake, group, ASAM or nurse entries; "Ask my team" for psychiatric evaluation returned "You already have this kind of visit scheduled" (existing medication visit). Tests corrected (not weakened): two self-booking fixtures now give the patient an established clinician; seven raw conflict-test self-bookings now name a visit type. Exact-once re-pins: `src/test/patientSchedulingOct29Approved.ts` (ehr.ts 8a53351e… prior, ehr-ext.ts) chained after coverage rules; runAction snapshot gained only the new action rows.

New IDs are names in the single catalog, not a parallel operational list. Modalities, Draft durations and delivery-system tags remain to be installed in the single catalog and listed for Christi. No rate or code mappings have been created.

## Remaining scope at green stop
1. Item (a) controls implemented and read back; prior final units were 3,696/3,696; fresh full public checkpoint passed 53/53 as recorded above.
2. Catalog field + five care types; conditional bilingual patient book/request menu; request duplicate/auto-close and ASAM type linkage.
3. Shared store/clinician-picker fit, consent, credential, funding and conflict rules; calm self-booking refusal; private-pay confirmation label.
4. CHW calendar and missing-service defaults, assigned-person priority, category-specific group capacity.
5. New all-role/patient/advocate privacy and button/store tests, any exact-once source re-pins, final units/public browser and end-to-end scheduling readback.

20:42 checkpoint: public validation is complete; stop before starting a partial item (b). A subsequent unchanged full unit run also passed **3,696/3,696 across 418 files, exit 0** (`/tmp/scheduling29b/units-checkpoint.txt`, `units-checkpoint.exit`); no unit/browser overlap. Items (b) catalog/new types/shared booking/picker, (c) CHW/missing-service inventory, and (d) category capacity remain unimplemented. The table above is still proposed for Christi, not an installed patientAccess field. Nothing published; persistence OFF; no Supabase changes.