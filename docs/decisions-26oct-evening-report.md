# 26 Oct evening decisions (Mitch) — report

Preview only. Nothing published. No schema phase 1, tables, migrations or Supabase changes.

## A. Schema plan
`docs/supabase-schema-plan.md` written from the approved plan with all eight review changes folded in, the 13 headings kept, and a "Changes from review (26 Oct)" section. Record classes recounted: `roles.ts` has **44** (`RecordClass` union), not 41; all 44 are listed and covered by the grants seed. Which number is authoritative needs Mitch's confirmation.

## B. Decisions
1. **Patient self-sign (telehealth, group confidentiality).** `patientSelfSignForm` in `consentForms.ts`, registry action `patient_consent_self_sign` (patient only). Signs the published versioned form (frozen copy, superseding live record) and writes a typed record (`telehealth` / `group_confidentiality`, program recipient, matching purpose code) so the one consent gate updates at once. Shown in the patient's Forms ("Forms you can sign yourself") and inline on the Groups card where the requirement appears. Every other form is refused. Revoking in Forms revokes the typed record too, so the gate re-locks. Spanish uses tú (Draft).
2. **Open, non-billable groups** skip the care-plan eligibility item (`skipsCarePlanEligibility`), in both the request requirements and the store's enrollment gate (hook in `groupRequestBoundary.ts`). Billable, care-team-approval and invite-only groups keep every gate. A group type can still list `group_eligibility` to add it back. MAT/medication paths don't read this.
3. **Safety scan.** Sign-up answers (who's helping, how you heard) and public referral free text run through the existing crisis patterns after each step / on submit. A match never blocks: it records a pattern-ids-only safety source, routes through the existing triage (linked → `flagCrisis`; unlinked → pre-chart triage, moved onto the chart once the same sign-up creates the account), and shows a 988 notice (EN/ES). Intake sees only "Needs clinical triage now". No triggering text in audits.
4. **Care-manager calendars.** `careManagerCalendar.ts`: every active ECM / CF care manager / peer specialist (primary or additional role) gets a calendar (id = staff id, no primary-clinician link) and the Draft default week Mon–Fri 9:00–17:00. Demo roster seeded; new staff and role changes through the audited staff path get the same. Intake first-contact booking now finds these calendars.
5. **On-call duty (Draft, owner TBD).** `onCall.ts` + admin screen `/admin-on-call` (clinical coordinator / sys_admin, menu "On-call schedule"), registry actions `on_call_shift_add` / `_remove` with reasons. Only therapist, PMHNP and physician can carry duty. `resolveCrisisOwner`: assigned clinician → on-call clinician → coordinator pool, with the visible notice "No on-call clinician set — sent to the clinical coordinator" on Escalations and pre-chart triage. Duty description covers crisis response, the existing one-calendar-day note clock and handoff with a reason.
6. **Standard Part 2 consent at intake.** New form `part2_standard` in every intake packet, optional (never a condition of care). Signing writes a typed `part2_tpo_single` record: purpose code `tpo`, class recipients (Adelante care team, treating providers, health plans/payers incl. Medi-Cal and county DMC-ODS, HIE, program operations), no expiry, revocable. It unlocks the treatment gate (and the Intake packet-document lock that reads it); it does **not** satisfy coordinator, counseling-notes, legal, criminal-justice, advocate or named-recipient consents. Patient self-sign only from the intake packet; Intake's paper/verbal-assist capture is unchanged (purpose picker now offers TPO). Revocation re-locks. Draft EN/ES, pending counsel.

## Approved pin/snapshot updates (each commented "26 Oct evening")
- `ehr.ts` exact-once deltas in `src/test/eveningOct26Approved.ts` (on-call import, owner fallback, `ownerGap`, pool notice, open-group hook), chained after the group-request transformer.
- Action snapshot: +3 rows per role for the three new actions only.
- Consent inventory: `consentForms.ts` 19→22 ledger calls; published forms 11→12; packet contents per pathway now include `part2_standard` (replacing the SUD-only `part2` item).
- Admin gate test: `/admin-on-call` uses the coordinator desk gate.

## Limitations / open
- Record-class count 44 vs 41 — needs Mitch.
- On-call owner, SMTP/SMS provider — open.
- A self-signed typed telehealth record is not overridden by a later staff untyped live-section change; staff should use Forms revoke.
- Care-manager calendars are not Medi-Cal credentialed records (`pending`); billing for those visits is unchanged and not tested.
- Preview memory only; delivery remains simulated.

## Validation
- FULL units: **3,444/3,444** (396 files), exit 0.
- FULL public browser: **47/47** (eight public specs, one worker against :8080, 13.0 min), exit 0.
- Build OK.
