# Roadmap

## In progress
- [ ] Dashboard Standardization Phase 5a — Care Coordination naming and honest scope copy
- [ ] Remove placeholder coordination and hardcoded dashboard availability
- [ ] Dedicated refusal-document queue with conditional dashboard count
- [ ] Consolidate per-client eligibility actions into the patient record
- [ ] Clinician Patient chart opens without a preselected patient

## Done
- [x] Referrals Rework Phase 4b — consolidated duplicate referral tracker cards.
- [x] Referrals Rework Phase 4a — movable referrals, attributed disposition, honest welcome SMS.
- [x] Investigation: intake↔scheduling coordination + intake SDOH fidelity/handoff (reported).
- [x] Investigation: pre-release SDOH vs general intake duplication risk (reported).

## Paused (plan written, not approved)
- [ ] Staff-initiated patient record creation (no login attached).

## Later phases (sequenced, not started)
- [ ] SDOH prerequisites: intake↔AHC-HRSN need mapping table, `SdohPlanItem` provenance field.
- [ ] Intake SDOH reconciliation against existing pre-release data.
- [ ] Scheduling: patient-side conflict checks + appointment provenance.

## Referrals Phase 4c
- [x] Referrer status-change SMS (contact/enroll/decline)
- [x] Staleness badge on shared tracker (draft threshold)
- [x] Segmented referral form (justice-involved yes/no/unsure)
- [x] Advocate discovery prompt at enrollment

## Referrals Phase 4d
- [x] Standalone staff referral queue page (/referral-queue)
- [x] Repoint "Referrals" nav entry to the staff queue
- [x] Staff "submit on someone's behalf" via shared form in a dialog
- [x] Dashboard tracker cards kept, with link-through to the queue

## Referrals Phase 4f
- [x] First session requires a real attended appointment
- [x] Clinician assignment writes the real assignment audit entry
- [x] Enrollment creates a pooled care-team/intake setup task
- [x] Post-enrollment staleness (draft thresholds, per step)
- [x] Cross-patient "Needs setup" view on coordination + referral queue

## Referrals Phase 4e
- [x] Real manual-outreach task created when no welcome text can send
- [x] Outreach attempt trail with outcomes and attribution
- [x] Referrer-fallback prompt (no phone / dead number / 2 unanswered)
- [x] Honest form copy for "no reliable phone"

## Pre-Release Pipeline (episode→patient + CSV import)
- [ ] Anticipated release date + custody state onto patient at episode open
- [ ] redeemEnrollmentCode copies release date from the episode
- [ ] markPreReleaseEpisodeReleased persists the confirmed date (episode + patient)
- [ ] Honest `Patient.custody` field sourced from the episode
- [ ] Intake/profile pre-fill with provenance + confirm step
- [ ] /pre-release-import staff CSV upload (preview-first, row reasons, RBAC)
