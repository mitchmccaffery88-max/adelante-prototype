# Roadmap

## In progress
- None.

## Done
- [x] Dashboard Standardization Phase 5c — demo CINs, expandable My tasks rows with attributed edits/notes/follow-up, per-client follow-ups consolidated onto the record with a read-only open-items rollup.
- [x] Dashboard Standardization Phase 5a — Care Coordination naming, honest scope copy, dashboard cleanup, refusal queue, eligibility consolidation, and blank initial chart.
- [x] Dashboard Standardization Phase 5b — shared staff top bar with typed patient search (name/DOB/program ID/CIN) and persistent My Work count; chart tab reuses the same search.
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

## SDOH Referral Thread Phase 5d-1 (consent + attribution)
- [x] Part 2 consent gate in the data layer for both referral creation paths
- [x] `sudDisclosureConsent` stamped from the patient's live consent (viewer-access bug fixed)
- [x] Generic restricted row (no category/provider/note) for Part 2 gated viewers
- [x] Attribution + audit on need and referral create/status changes

## SDOH Referral Thread Phase 5d-2 (needs <-> referrals, directory, outcomes)
- [ ] `ResourceReferral.sdohItemId`; drop never-written `SdohPlanItem.referralId`
- [ ] Refer action on a need; creating a referral moves the need to sent
- [ ] Real directory picker (`resourceId`) + link state via referralLinks.ts
- [ ] Off-directory referral (name + note), never writes to the directory
- [ ] Seven real outcomes with reason + attribution
- [ ] Connected prompts staff to resolve the need (no auto-close)
- [ ] Materialize positive AHC-HRSN domains as real needs
- [ ] Interpersonal-safety needs + their referrals default staff-only, warn before making visible
- [ ] Remove the stale "Build 2" resource-library string
