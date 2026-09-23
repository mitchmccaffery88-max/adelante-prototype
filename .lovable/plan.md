# Phase 6b — group enrollment consent, join links, seeded audit demo data

## What I found (confirming the brief)

- `assertEnrollmentAllowed` (`src/lib/ehr.ts`) checks cancellation, the clinical
  eligibility flag, self-service category rules, and capacity. No consent check.
- The only real consent check is `groupOccurrenceConsentGate`, called inside
  `documentGroupOccurrence` — attendance/documentation time.
- Modality is two-level: `GroupSession.modality` (`in_person | video | phone`) and an
  optional per-occurrence override `GroupOccurrenceRecord.modality`
  (`in_person | video | audio_only`). Readers fall back to the session default.
- No room/join-link field on the group model. `TelehealthSession` (1:1) has
  `roomId`, `joinUrlPatient`, `joinUrlClinician`, filled from the mock telehealth vendor.
- No group sessions, enrollments or eligibility flags are seeded, so `/group-audit` is empty.

## The mixed-modality question (interpretation)

The risk being prevented is: a patient is seated in a group they cannot lawfully
attend virtually. So the gate should follow the modality the patient would actually
be asked to attend, not the session's default label.

Rule I will implement: **block enrollment only if any projected upcoming occurrence
resolves to a virtual modality.** Because occurrences fall back to the session
default, this means:

- Virtual-default group → blocked (every future meeting is virtual).
- In-person-default group with one virtual occurrence coming up → blocked.
- Virtual-default group where **every** projected upcoming occurrence has an explicit
  in-person override → **not** blocked. Consent is still enforced at documentation
  time if a later meeting turns virtual, so nothing is loosened, only moved earlier.

Past occurrences are ignored. The documentation-time gate stays exactly as-is as the
backstop — this is a second, earlier check, not a replacement.

## Build

**1. Enrollment-time telehealth consent gate**
- New helper `groupVirtualExposure(sessionId)` in `ehr.ts`: returns whether any
  upcoming projected occurrence is virtual, plus the first such start, using the
  existing `groupOccurrenceStarts` + `groupOccurrenceModality` helpers.
- In `assertEnrollmentAllowed`, after the eligibility check, add one branch: if the
  group has virtual exposure and the patient lacks active `telehealth_services`
  consent, `block("no_telehealth_consent", …)`. Wording names the real next step
  (telehealth consent must be captured) and is safe for the patient-facing
  self-service path. Audited by the same `block()` helper, so it appears on
  `/group-audit` with no new logging mechanism.
- `openGroupsForPatient` filters out virtual groups the patient can't consent to, so
  the patient scheduling tab doesn't offer a group it will then refuse.
- Staff group roster UI shows the reason inline when enrollment is refused (existing
  toast path already renders the thrown message).

**2. Virtual room / join link**
- `GroupSession.virtualRoom?: { roomId; joinUrl; setAt; setBy }`, with an optional
  per-occurrence override on `GroupOccurrenceRecord` — mirrors the modality
  two-level pattern already in place.
- `AdelanteEHR.setGroupVirtualRoom(sessionId, joinUrl|undefined, actor)` and
  `setGroupOccurrenceVirtualRoom(...)`, audited; `groupJoinLink(sessionId, start)`
  resolves occurrence → session. Demo seeds use the same mock telehealth vendor URL
  shape as 1:1 (`https://video.adelante.mock/room/...`).
- Surfaces (read-only placeholder, shown only for virtual occurrences; when unset it
  says the link hasn't been added yet rather than inventing one):
  group detail header + occurrence panel on `/group-sessions`, the patient's
  "Your groups" card on `/home`, and `PatientGroupScheduling`.

**3. Demo seed for `/group-audit`**
- A seed block at the bottom of `ehr.ts` in the existing style — built through the
  real store API, never by pushing rows — producing: two demo groups (one in-person
  skills/education, one virtual), eligibility set for two demo patients with real
  clinical reasons, one eligibility later cleared, and three blocked-enrollment
  attempts covering distinct reason codes (no eligibility, staff-enrolled only,
  and the new missing-telehealth-consent). That gives `/group-audit` real content on
  first load across all three of its event types, with filters meaningful.

## Non-goals

No Clinician Workspace changes, no notifications, no change to the
`sud_clinical_preauth` note-access class or billing codes, no change to the
documentation-time gate's behaviour.

## Verification

Typecheck, full test suite (new tests: enrollment blocked without consent on a
virtual group; allowed once consent is granted; in-person group unaffected;
virtual-default group with all-in-person overrides enrollable; join-link
resolution), build, and a live browser pass at desktop and phone viewports
covering the blocked enrollment message, an unaffected in-person enrollment, the
join-link placeholder, and `/group-audit` showing seeded events with working filters.
