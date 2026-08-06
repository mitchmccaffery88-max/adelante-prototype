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

**Category split (PLACEHOLDER taxonomy — confirm the real list with Christi).**
`GroupSession.category`: `sud_clinical_preauth` (staff-only enrollment, BILLABLE) vs
`open_psychoeducational` (eligible patients self-book from `/schedule`, NEVER billed).
"Pre-authorization" here is read as INTERNAL clinical eligibility/placement approval,
NOT a payer-facing prior-auth process — confirm.

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
No CPT/H-code invented — `billingCodePlaceholder` is deliberately empty.

**OPEN QUESTIONS for Christi (do not decide in code):** whether
`group_participation` is legally distinct from general treatment consent;
DHCS group-size limits; real curriculum/topic names; billing codes. All
current values are placeholders.

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
