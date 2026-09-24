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
- [x] `ResourceReferral.sdohItemId`; drop never-written `SdohPlanItem.referralId`
- [x] Refer action on a need; creating a referral moves the need to sent
- [x] Real directory picker (`resourceId`) + link state via referralLinks.ts
- [x] Off-directory referral (name + note), never writes to the directory
- [x] Seven real outcomes with reason + attribution
- [x] Connected prompts staff to resolve the need (no auto-close)
- [x] Materialize positive AHC-HRSN domains as real needs
- [x] Interpersonal-safety needs + their referrals default staff-only, warn before making visible
- [x] Remove the stale "Build 2" resource-library string

## Phase 5d-3 — SDOH activity log, follow-up tasks, aging
- [x] SdohLogEntry type + append-only writers on needs and referrals (audited)
- [x] Pre-existing single `note` shown as unattributed "Earlier note"
- [x] followUpDate UI + real CaseTask creation (origin sdoh_follow_up), honest no-case-manager message
- [x] src/lib/sdohAging.ts draft thresholds, last-action includes log entries
- [x] patientOpenItems: add open referrals + aging detail
- [x] myWork: sdohAging bucket for the assigned case manager
- [x] Shared SdohActivityLog component wired into SdohTab + ReferralsTab (Part 2 / safety respected)
- [x] Tests, typecheck, build, live browser both viewports

## Phase 5d-4 (final) — unified need thread, advocate referrals, reporting funnel
- [ ] Patient unified need thread on /next-steps (+ home summary card, remove ReferralsForYouCard)
- [ ] Closure message: "Resolved — {need}. Let your care team know if this comes back."
- [ ] All new patient/advocate strings via i18n with Spanish marked pending bilingual review
- [ ] Advocate referral status per tier in advocateCoordination + panel
- [ ] Reporting funnel (identified → referred → connected → resolved) + barriers, cohort guard
- [ ] Disengagement link: recommendation only, nothing built

## Phase 5d-4 (done)
- Unified patient need thread on /next-steps (one list; directory match inside each need card).
- Home summary card replaces the separate "Referrals for you" list.
- Advocate coordination now carries referrals per need, tier-aware Part 2 restricted rows.
- Social needs funnel + slices + barrier frequency on /reporting, cohort-guarded.
- Disengagement link: recommendation only (separate "needs stalled" signal), not built.

## Referrals Rework Phase 4g — referral-to-active-patient funnel
- [x] `src/lib/referralFunnel.ts`: stages submitted → contacted (reached only) → enrolled → first appt scheduled → first appt attended, medians, cohort guard
- [x] Slices: source (justice sources folded), justice-involved answer, population track
- [x] Drop-off: declined by reason, outreach attempted-not-reached, overdue before first contact, enrolled never attended
- [x] Reporting Area beside Social needs, with confidentiality note on the source fold
- [x] Tests incl. unanswered attempt ≠ contacted; typecheck, suite, build, browser

## Phase 5e — Ask Adel prototype (staff top bar)
- [x] src/lib/askAdel.ts — role groups, question library, real answers, cohort guard
- [x] src/components/AskAdelPanel.tsx — sheet, sample questions, encounter shortcuts, no free text
- [x] StaffBreadcrumbs button, shown only when a question or shortcut applies
- [x] Tests: role mapping, access filtering, Part 2 masking, cohort guard, read-only
- [x] Typecheck, suite, build, live browser at both viewports incl. Part 2-gated role

- [x] Phase 7a: Revenue & billing group, Consent & privacy group, billing_coordinator full parity (incl consent_ledger read) + parity test, /billing-calaim-codes, billing status card

## Phase 7b — Claim as single billing source
- [x] Claim states + written_off; transitionClaim (billing write enforced, attributed, audited); write-off reversible → generated with reason
- [x] markClaimSignedFromNote for note signing; claimChargeCents single amount fn
- [x] Attended visit creates claim; remove appointment billingStatus + transitionBilling/advanceClaim
- [x] /billing, summary, pilot card, clinician line read claims; tests; browser check

## Phase 7c — rate table + billing units
- [x] rates.ts: billing code table (unit rules), effective-dated rates, add/end-date, audit, billing-write
- [x] Claims: code/program/units at creation, rate × units, no-rate flag blocks Ready, corrections
- [x] /billing Rates + Codes sections; units shown on /billing and /admin-claims; remove fake table
- [x] Tests + browser (Billing, Billing Coordinator, Sys Admin)
- [x] Phase 7b.1: signature-to-claim gaps (cosign ceremony, enforced claim signing, traceability, seed audit)
- [x] Demo: attended visits waiting for a note (Kayla Nguyen trainee c4 / Rosa T.; Dr. Reyes / Alicia)

## Phase 7d — General-population billing
- [x] Programs self_pay / sliding_fee / grant_isl / commercial (inactive); selection rule; migration
- [x] Patient payment arrangement (billing write, audited); unrecorded → flag + blocks Ready; setting re-prices open claims
- [x] Optional payerId on rates, payer-specific preferred
- [x] Patient responsibility split; manual payments (no overpay, no card numbers, void); audit
- [x] Placeholder rates; /billing + /admin-claims UI; tests; browser
- [x] Phase 7d follow-ups: payment arrangement on chart (Eligibility section); Lane label derived from claim program / real coverage type
- [ ] Intake benefits step + eligibility-response structures (Part B investigation delivered; awaiting design direction)
