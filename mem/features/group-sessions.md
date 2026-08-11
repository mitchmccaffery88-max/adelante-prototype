---
name: Group sessions (care delivery)
description: GroupSession/enrollment/attendance model, per-attendee note requirement, group_notes consent gate, and what is placeholder pending DHCS content
type: feature
---
**Eligibility gate (NEW, non-negotiable).** `Patient.groupEligibility` lives on the
care-plan layer. NO enrollment path — staff, patient self-service, or the future
advocate role — is possible without it; `assertEnrollmentAllowed` in `src/lib/ehr.ts`
is the SINGLE place that decides who may enroll (the DHCS Authorized Representative /
Collateral role plugs in there, nowhere else). Only therapist/pmhnp/case_manager may
set it (`GROUP_ELIGIBILITY_ROLES`). Criteria text + curriculum tag are PLACEHOLDER.

**Category split (REAL, DHCS-sourced from Christi).** `GroupSession.category`:
`sud_clinical_preauth` (staff-only enrollment, billable H0005 SUD Group
Counseling) | `skills_education` (self-service enrollment, billable H2014
Skills Training and Development, Group, per 15 min) | `open_psychoeducational`
(self-service, NEVER billed). Codes live in `GROUP_BILLING` in `src/lib/ehr.ts`
— one table, no per-category branching elsewhere. No ODF/IOT/MAT variation on
H0005. "Pre-authorization" is still read as INTERNAL clinical
eligibility/placement approval, not payer prior auth.

**Enrollment path is DERIVED from category via `GROUP_BILLING[c].selfService`
(INTERPRETATION, flagged).** billable ≠ staff-placed: `skills_education` is
billable but self-booked. If a combination ever appears that this table can't
express, promote `selfService` to its own field on `GroupSession` rather than
adding categories.

**Occurrence-level billing rule.** `GROUP_MIN_BILLABLE_ATTENDEES = 2` /
`isOccurrenceBillable(category, presentCount)`. Fewer than 2 present = an
individual session in practice per DHCS: no claim, but the occurrence still
happens and is documented normally. Enforced BOTH on the note's
`groupRef.billingEligible`/`billingCode` and again at the claim write point.

**Capacity.** DHCS 2–12, same for telehealth. `GROUP_CAPACITY_MIN`/`MAX` in
`ehr.ts`, enforced by `_assertGroupCapacity` on create AND edit. Configurable
below 12 for county-local caps, never above. No county cap is invented.

**Billing status at point of choice.** `GroupBillingStatus` (exported from
`src/routes/group-sessions.tsx`) renders the billable/non-billable line next to
the category selector and on the group detail header. It is PREVENTIVE only —
`upsertClaimFromGroupAttendee` remains the enforcement backstop.

**Billing hard split.** `upsertClaimFromGroupAttendee` returns `null` for open groups,
enforced at the write point (not by caller filtering); attendee notes get
`billingEligible: false`. Open-group reporting goes through
`openGroupEngagement()` in groupMetrics — engagement/reach data, never claims.

**Model.** `GroupSession` + `GroupSessionEnrollment` (standing, not per-occurrence)
+ `GroupOccurrenceRecord` in `src/lib/ehr.ts`. Recurrence is weekly or one-off.
The 1:1 `bookAppointment` flow is untouched; group self-booking is a separate
tab on `/schedule` (`PatientGroupScheduling`) alongside it.

**Documentation.** One occurrence = 1 shared group note (`GroupOccurrenceRecord.sharedNote`)
+ one individualized `ProgressNote` per PRESENT attendee (`category: "group"`,
`groupRef.billingEligible`). `documentGroupOccurrence` THROWS if any present
attendee lacks their own narrative — a blanket group note is a DMC-ODS denial risk.

**Masking.** `noteGateClass(note)` in `src/lib/roles.ts` is the single place that
decides which RecordClass masks a note (psychotherapy tier > sud > group).
Chart (`RecordTabs`) and export (`noteExportGate`) both call it. Never add a
parallel group-consent check.

**Billing.** `AdelanteEHRExt.upsertClaimFromGroupAttendee` reuses the existing
claims list keyed by `encounterId` = `group:<sessionId>:<start>:<patientId>`.
Claim carries `serviceCode` = H0005/H2014; `GroupAttendeeNoteRef.billingCode` mirrors it.

**OPEN QUESTIONS for Christi (do not decide in code):** whether
`group_participation` is legally distinct from general treatment consent;
real curriculum/topic names; modality/telehealth consent; multi-facilitator
minute tracking. Group sizes and billing codes are now REAL DHCS content.

**Not built (flagged, needs confirmation):** patient-visible "your groups" on
`/home`.

**Built since:** patient-facing read-only "Your groups" section on `/home`
(topic + description + next date ONLY — no attendance history, no roster, no
note content), staff recurrence editor (`AdelanteEHR.updateGroupRecurrence`
preserves past/attended occurrences and only regenerates unused future ones),
per-occurrence attendance + note-completion dashboard on `/group-sessions`,
`/admin` "Next contact" filter (group vs 1:1 vs none, via one shared
`nextContact` resolver), Claims Worklist CSV export with a group-sourced
column, and `GroupSession.description` + surfaced `durationMin`/`locationId`
(address lives on `ClinicLocation`, formatted by `formatLocationAddress`).

**Gating decision (do not loosen):** aggregate occurrence counts sit at the
`group_sessions` gate; the attendee-level "who still owes a note" list is
`group_notes` only. Managing the schedule must not reveal which patients are
behind on documentation.

**Reporting.** `src/lib/groupMetrics.ts` is the single source for group
reporting: `parseGroupEncounterId`/`occurrencePeers` (Claims Worklist group
badge + peer popover, program IDs only), `activeGroupSessions`/
`enrolledPatientCount`/`weeklyGroupSeats` (admin "Group activity" strip and
"Next contact" column), and `groupAttendanceRate`/`groupAbsences` (population
health `group_attendance_rate_pct`). Occurrences with no attendance taken are
EXCLUDED from the rate — missing data, never 0%. No default KPI target is
seeded for group attendance (would be inventing a regulatory threshold).
