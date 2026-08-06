---
name: Group sessions (care delivery)
description: GroupSession/enrollment/attendance model, per-attendee note requirement, group_notes consent gate, and what is placeholder pending DHCS content
type: feature
---
**Model.** `GroupSession` + `GroupSessionEnrollment` (standing, not per-occurrence)
+ `GroupOccurrenceRecord` in `src/lib/ehr.ts`. Recurrence is weekly or one-off.
Enrollment is STAFF-initiated (clinical decision); the patient-driven 1:1
`bookAppointment` flow is untouched and must stay that way.

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

**Reporting.** `src/lib/groupMetrics.ts` is the single source for group
reporting: `parseGroupEncounterId`/`occurrencePeers` (Claims Worklist group
badge + peer popover, program IDs only), `activeGroupSessions`/
`enrolledPatientCount`/`weeklyGroupSeats` (admin "Group activity" strip and
"Next contact" column), and `groupAttendanceRate`/`groupAbsences` (population
health `group_attendance_rate_pct`). Occurrences with no attendance taken are
EXCLUDED from the rate — missing data, never 0%. No default KPI target is
seeded for group attendance (would be inventing a regulatory threshold).
