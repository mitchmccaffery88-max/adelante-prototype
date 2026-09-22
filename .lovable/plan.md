# Referrals Phase 4f — post-enrollment handoff

## What I found (verified in code, not assumed)

- **First session** (`ReferralStatusTimeline`) takes the earliest appointment by start time and treats its existence as arrival. `Appointment.status` is a real attendance field (`scheduled | attended | no_show | cancelled`) and is never consulted. Confirmed: a future booking or a no-show marks the milestone reached.
- **`reassignPrimaryClinician`** sets `primaryClinicianId` and writes only a `provider_switch` audit entry. The timeline searches `category: "assignment"`, so it never matches and falls back to the enrollment date. **`assignCaseManager` already writes the correct `assignment` entry** (`case_manager_assigned` / `case_manager_reassigned`), so finding #2 is real for clinicians only — I will leave the case-manager path alone rather than duplicate a working write.
- **`enrollReferral`** creates the patient, copies release date/county/CIN, stamps attribution, and stops. No task, no notification.
- **`referralAging`** returns `closed` for enrolled referrals by design. Nothing measures elapsed time after that.
- **`/admin-coordination`** already lists "Unassigned primary clinician" across patients — the only existing cross-patient setup surface. It covers one of four steps and has no staleness or intake/session view.
- `CaseTask` supports an unassigned role pool today (`assignedTo: ""` + `allowedRoles` + claim) — the advocate AHCD-validation tasks already use exactly that shape.

## Decisions that needed a judgment call

**Task system (build item 3): patient-keyed `CaseTask`.** The Phase 4e referral-scoped pattern existed only because no patient record existed yet. After enrollment one does, so every objection that forced that workaround disappears: the worklist row links to a real chart, the personal worklist resolves a real name. Using `CaseTask` also means the setup work lands in the worklist and personal worklist staff already open daily, with no new surface to learn. One task per enrollment titled "New enrollment — assign care team and book intake", unassigned to a role pool (case-manager and coordinator roles), claimable, deduped on the referral id, due in 3 days.

**Staleness thresholds (build item 4) — draft, pending care-operations sign-off**, labelled as such on screen like the Phase 4c aging badge:

| State | Due | Overdue | Reasoning |
| --- | --- | --- | --- |
| No case manager | 3 d | 7 d | Whoever the person calls back needs a named owner; a week without one means nobody is holding the case. |
| No clinician | 5 d | 10 d | Clinician matching depends on licence, language and caseload — slower than naming a coordinator, but still inside two weeks. |
| Intake not completed | 7 d | 14 d | Intake needs a scheduled contact with the person, so it trails assignment by about a week. |
| No attended session | 14 d | 30 d | A first attended visit depends on the person showing up; 30 days is the point where the enrollment is effectively inactive. |

Measured from `enrolledAt` (else `Patient.enrolledAt`), per state, with the earliest unmet step driving the badge. Not ratified by Adelante care operations.

**Home for the cross-patient view (build item 5): `/admin-coordination`.** It is already the routing home and already carries a narrower version of this list. I will replace its "Unassigned primary clinician" card with a fuller "Needs setup" card built as a shared component, and surface the same component on `/referral-queue` so the staff who enrolled someone see the follow-through without switching pages. No new route, no duplicated logic.

## Build

1. **`src/lib/postEnrollment.ts`** (new, pure): `PostEnrollmentStep` (`case_manager | clinician | intake | first_session`), `firstAttendedAppointment(patientId)`, `postEnrollmentGaps(patient)`, `POST_ENROLLMENT_STALENESS_DRAFT` thresholds + note, `postEnrollmentStaleness(patient, now)` → `{ step, state: fresh|due|overdue, days }`, `needsSetup(patient)`.
2. **First session fix** in `ReferralStatusTimeline`: the step reads the earliest appointment with `status === "attended"`; scheduled/cancelled/no-show never mark it reached. A future booked visit shows as "In progress" with its date rather than complete.
3. **Clinician assignment audit** in `reassignPrimaryClinician`: add an `assignment` audit entry (`primary_clinician_assigned` / `primary_clinician_reassigned`, `from`/`to` detail) alongside the existing provider-switch record, which stays untouched. Timeline picks up the real moment with no change to its search.
4. **Enrollment task** in `enrollReferral`: create the pooled `CaseTask` described above, audited, deduped by referral id.
5. **`PostEnrollmentSetupCard`** (new shared component): rows of patients with open gaps, each showing which steps are missing, the honest draft-labelled staleness badge, the assign actions already built (`AssignClinicianButton`, case-manager assign) and a chart link. Mounted on `/admin-coordination` (replacing the narrower card) and `/referral-queue`.
6. **Journey drawer**: a draft-labelled staleness line under the timeline when the patient has an open gap.
7. **Tests**: attendance-gated first session, clinician assignment audit entry, enrollment task creation and dedupe, threshold boundaries per state, `needsSetup` filtering.

## Non-goals

No change to Phase 4e referral-side outreach, to claim advancement, or to note signing. No change to `assignCaseManager`, which is already correct. No new route.

## Verification

Typecheck, full test suite, and a live session at desktop and phone width: enroll a referral → task appears in the worklist and the needs-setup card; assign a clinician → the journey shows the real assignment time; a scheduled-only appointment leaves First session unreached and marking it attended completes it; staleness badges show with the draft label; zero console errors and no regressions to Phase 4a–4e.
