# Roadmap

## Consent workflow (9 Oct, Draft — pending counsel)
- [x] W1 form library  - [x] W2 send  - [x] W3 Forms to sign  - [x] W4 track  - [x] W5 store/retention/migration
- [x] W6 renew + revoke  - [x] W7 packet + group gate  - [x] W8 advocate forms  - [x] handoff doc

## Group 2 (9 Oct) — pathways, Part 2 fixes, contacts + advocate
- [x] G1 content gaps → content owner (journey owner, else owner pool)
- [x] G2 SUD journeys hidden from non-Part 2 staff + advocate tiers (fixed restricted plan view leak)
- [x] G3 group 1 browser walkthrough (e2e/group1Availability.spec.ts)
- [x] S1–S5
- [x] P1–P5
- [x] O1/O2/O4 onboarding contacts + advocate; [x] O3 staff contacts editor uses onboarding model

## In progress — Player and engagement (K1–K3, P1–P10)
- [ ] K1 registry content mutations + additive permissions snapshot
- [ ] K2 ASAM dimension tag interventions
- [ ] K3 production-served parallel browsers, warm-up, unchanged assertions
- [ ] P1/P2 animated breathing, exercise input persistence and toolkit summaries
- [ ] P3 session Simulated read aloud EN/ES, tap-only safety
- [ ] P4/P8 Home resume and today's action; unanswered confidence; toolkit preview/completion
- [ ] P5/P6 shared practice and grounding stepper
- [ ] P7 three-question Simulated Adel, crisis scan, tag links
- [ ] P9 patient theme/readability and architecture guidance
- [ ] P10 Part 2/private-text redaction
- [ ] Full units, harness typecheck, all parallel browsers, EN/ES/advocate walkthrough
- [ ] Content tables/search/editor preview: deferred by Mitch to next batch

## In progress — Content center + care/Adel/SDOH wiring (C0–C6)
- [x] C0 seeds load on any entry path; titles not ids
- [x] C1 baseline verification (59/60 — SMART Recovery has no phone), no patient badge, one resource store, verify stamps managed revision
- [~] C2 home digest, groups (Education/Recovery/Directory/Messages placeholder); full tables + side-drawer editor still to do
- [x] C3 tags/flags/ES status/reading level/owner/review date; Draft backfill; recovery lessons Part 2; check-in shows category only
- [x] C4 clinical/Part 2 need a different clinical reviewer; Spanish block + override reason
- [x] C5 live picker, deep links, auto-complete, tag suggestions in care plan, Adel chat (Simulated), needs; lessonRecommends + Adel lesson list on live content; coverage view
- [ ] Content edits through runAction registry (currently direct store calls + store audit)
- [ ] ASAM interventions read tags (still fixed ids)
- [x] C6 MAT seed at 2 days; screener drafts survive reload


## Done
- [x] Moved resource verification to Patient Content & Resources Center; retained verifier gates and published revision attribution, added filters/counts and verification provenance, restored coordination-first ordering with Reassign needed. All 2,406 unit tests pass and harness typecheck/build is clean; selected sequential browsers: 37 pass including the coordinator content walkthrough, calendar and continuity checks fail (stability/seed work remains deferred).
- [x] Section 6 item 3: cancel requests (patient/advocate), staff cancel with reason, no-show, late-cancel label (draft), ASAM task reopening, claim guard, reporting, demo data.
- [x] Advocate demo thread via upload → staff verification of a two-way HIPAA release.
- [x] Patient and advocate navigation correction: persistent desktop sidebars, phone left drawer, no user top-nav strips, and no staff-link leakage.
- [x] Sticky demo controls with neutral unselected QA label and protected-control spacing.
- [x] Pre-demo My Care consolidation: folded duplicate needs, appointment, weekly check, recommendations, and advocate status surfaces.
- [x] Consent-gated advocate invitation delivery with pre-consent privacy test and row-level failure feedback.
- [x] One positive-signal Recovery Journey rule across navigation, cards, recommendations, and direct route access.
- [x] Full typecheck, 1,696-test suite, persona browser inventory, advocate flow, Kayla billing flow, and referral attempt verification.

- [x] Dashboard Standardization Phase 5c — demo CINs, expandable My tasks rows with attributed edits/notes/follow-up, per-client follow-ups consolidated onto the record with a read-only open-items rollup.
- [x] Dashboard Standardization Phase 5a — Care Coordination naming, honest scope copy, dashboard cleanup, refusal queue, eligibility consolidation, and blank initial chart.
- [x] Dashboard Standardization Phase 5b — shared staff top bar with typed patient search (name/DOB/program ID/CIN) and persistent My Work count; chart tab reuses the same search.
- [x] Referrals Rework Phase 4b — consolidated duplicate referral tracker cards.
- [x] Referrals Rework Phase 4a — movable referrals, attributed disposition, honest welcome SMS.
- [x] Investigation: intake↔scheduling coordination + intake SDOH fidelity/handoff (reported).
- [x] Investigation: pre-release SDOH vs general intake duplication risk (reported).

## Paused (plan written, not approved)
- [x] Staff-initiated patient record creation (no login attached).

## Later phases (sequenced, not started)
- [x] SDOH prerequisites: intake↔AHC-HRSN need mapping table, `SdohPlanItem` provenance field.
- [x] Intake SDOH reconciliation against existing pre-release data.
- [x] Scheduling: patient-side conflict checks + appointment provenance.

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
- [x] Anticipated release date + custody state onto patient at episode open
- [x] redeemEnrollmentCode copies release date from the episode
- [x] markPreReleaseEpisodeReleased persists the confirmed date (episode + patient)
- [x] Honest `Patient.custody` field sourced from the episode
- [x] Intake/profile pre-fill with provenance + confirm step
- [x] /pre-release-import staff CSV upload (preview-first, row reasons, RBAC)

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
- [x] Patient unified need thread on /next-steps (+ home summary card, remove ReferralsForYouCard)
- [x] Closure message: "Resolved — {need}. Let your care team know if this comes back."
- [x] All new patient/advocate strings via i18n with Spanish marked pending bilingual review
- [x] Advocate referral status per tier in advocateCoordination + panel
- [x] Reporting funnel (identified → referred → connected → resolved) + barriers, cohort guard
- [x] Disengagement link: recommendation only, nothing built

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
- [x] Phase 8a: coverage merge (no erase), self-report never verified, Medi-Cal status only for Medi-Cal/dual
- [x] Phase 8b: intake benefits step (CIN, plan spans, arrangement prompt)
- [x] 8b follow-up: craving button stays on /intake, repositioned above Save bar
- [x] 8b follow-up: worklist "Not Medi-Cal (reported)" filter, not never-checked
- [x] Phase 8c: electronic eligibility infrastructure (approved; electronic counts as verified)

## Pre-demo batch
- [x] Home Start my intake → /intake; Start/Continue/Completed tile
- [x] Sign-up / redemption → /intake
- [x] Daniel scenario label
- [x] Ask Adel help line (intake + landing), en/es
- [x] Staff header role indicator
- [x] Outreach attempts on queue + journey
- [x] Public referral confirmation; remove your-referrals + storage; referrer SMS
- [x] Rename journey → Re-entry Pathway (blocked: text "Getting back on your feet journey" not found in app — need its location)

## Demo final build (Sep 24)
- [x] Part A: seeded pre-release persona (Tomás R.) + switcher entry
- [x] Part A: CF care manager must not be "Rosa" — use staff directory name
- [x] Part B: Adel-guided intake (profile + benefits), scripted, Prototype label "guided questions, not AI-generated"
- [x] Shared profilePatch helper + full Rosa form intake regression in browser

## Part B pre-demo (approved narrow scope)
- [ ] B1 About You: justice question moved, "looking for" → Patient.seeking (SUD merged into needs.substanceUse), content gating, advocate pending invite
- [ ] B1 suggested goals (clinician accept/dismiss, audited) — no auto goals; screeners unchanged
- [ ] B2 My Care tiles: first appointment, needs w/ match counts, recommended
- [ ] B3(a) matched resources per need
- [ ] Tests + browser verification
- [ ] Resume interrupted approved My Care consolidation and deliver one complete verification report covering all eight items and requested browser workflows.
- [x] Final pre-demo freeze: add CALOMS to the shared substance-use signal, remove Alicia's seeded signal, gate all SUD-specific tools, preserve universal crisis/overdose access, and complete persona regression verification.

## Phase 10a + 10b (approved Sep 25)
- [x] Part A: 10a screener fixes (AUDIT 0/2/4, PC-PTSD-5 + PCL-5-20, retired short form, AHC intake options, cadence table, verbatim tests) + 10b C-SSRS (placeholder text, triggers, crisis queue risk, staff/self paths); result metadata on EHR record; draft labels; 10c/10d-ready model
- [x] Part B: QA switcher scenario matrix audit + add missing scenarios via store API; report per-record changes (separate message)
- [x] Part C: persistent top-bar QA + staff role switchers side by side on every page, desktop + phone (separate message)
- [ ] Verification: typecheck, build, full tests, browser walk per scenario
## Phase 10c (approved, building now)
- [ ] ASAM data model (AsamAssessment, task, triggers)
- [ ] recordSeeking Part 2 change (no-consent masked task)
- [ ] Roles: SUD counselor authors, LPHA signs/cosigns
- [ ] Chart UI, My Work, Ask Adel, Guided Chart Review
- [ ] Outputs on cosign: episode, CALOMS prompt, H0001, care plan suggestion
- [ ] Demo data: Luis signed, Jasmine counselor-authored pending, Daniel due, no-consent scenario
- [ ] Tests + typecheck + build + browser verification

## Phase 10c — ASAM (in progress)
- [x] asam.ts model, triggers, store methods, chart panel, cosign inbox, Ask Adel, chart review facts, H0001 claim hook
- [x] Demo seeds (Luis signed, Jasmine counselor-authored pending cosign, Daniel due, Jordan Vega no-consent) + switcher entry
- [ ] Typecheck/build clean
- [ ] asam.test.ts (triggers, masking, cosign, no auto-level, patient view)
- [ ] Full test run + browser verification (desktop/phone)
- [ ] Report with the two navigation confirmations

## Phase 10d-1 (done)
- [ ] Decision: should clinical coordinator see ASAM reporting? (currently hidden — no Part 2 access)
## Next: 10d-2, 10d-3 (separate messages)
- [x] Rename staff Elena Vargas → Renee Castillo
- [x] Rename QA patients colliding with staff (2b, 3, 5)
- [x] ASAM reporting lib (worklists, differences, timeliness, cohort guard, Part 2)
- [x] My Work ASAM group; /reporting "ASAM (clinical)" section; chart level history
- [x] Demo: overdue task + recommended≠actual signed record
- [x] Tests, typecheck, browser check
## Item 6 — Clinical Coordination (done)
- [x] Carry-overs: advocate cancel seed + check, telehealth button check, task title fix
- [x] Kayla profile, role gate, reassign with reason, audit, unassigned list, export names, demo
## Section 4 part 2 (done)
- [x] Advocate page phone width; mood count for case managers; B8 merged care-team thread; E7 Adel greeting check-in
## Clinical core — turn A (done)
- [x] A1 SUD-medication masking (single classifier + toggle, every med surface)
- [x] A2 Note addendum / correction / void / late entry / version history
- [x] A3 Demographics & identifiers edit with reason + history
## Clinical core — turn B (next message)
- [x] A-finish: void approval inbox, primary clinicians, browser checks
- [x] B1 allergy cross-check  - [x] B2 CURES placeholder step  - [x] B3 outpatient episodes  - [x] B4 higher-level referrals
## Carry-overs + E5 Phase A (voice intake)
- [x] (a) Referral list in staff menu (clinical roles)
- [x] (b) Legal / Part 2 disclosure card on consent screen
- [x] (c) Safety panel on note orders
- [x] E5A useAdelVoice layer, plain-language intake, tap-only sensitive items, crisis scan, admin guardrail notice, remove homepage placeholder

- [x] Turn 2: clinician workspace tiles, unified Today/action queues, dashboard + New, carry-over custody gate, and full verification.
- [x] One-tab Anita, Marisol, Luz, Priya desktop/mobile and dashboard + New checks; outpatient medication-pass filtering fixed; 2,039 tests passed.

## Turn 4 of 6 (batch E) — in progress
- [ ] Carry-overs: hydration <p> fix, eligibility simulated outcome, turn 2 browser re-proof
- [ ] patientMatching.ts engine on every creation path (+HIE)
- [ ] Patient matching review queue (merge / not same / link related)
- [ ] Merge + unmerge (consents flagged, duplicate claim block)
- [ ] Multi-role staff identities, dedupe, retire s-cf2, advocate/patient personas
- [ ] Demo seeds + tests + browser
## U1/U2 — Escalations + team messaging (done)
- [x] advocateSelfSeparation stable in full suite (cold-start warm-up)
- [x] Unified Escalations queue, crisis-queue redirect, Needs my action link
- [x] Staff-to-staff threads, mentions, read receipts, Discuss from escalation
## Adel chat persistence (done)
- [x] History/continue, delete/clear, 90-day retention, share summary via disclose(), advocate isolation, EN/ES, handoff rows 12–16

## Staff content center S1–S6
- [x] Private real-player Browse + care plan preview
- [x] Structured Manage forms + exercises/journeys CMS
- [x] Journey patient progress/assignment integrity
- [x] Revision-pinned engagement + suppressed Audit/history/stale queue
- [x] Full unit (2,458) + typecheck; browser 54/55 together — continuity.spec screener-resume step intermittent under parallel load only (passes standalone)

## Access & notifications batch (Draft — pending exec RBAC review)
- [x] A1 chart entry by role + enrolled site; /record + print gated; restricted record (reason, audit, compliance item); outside-caseload + unusual-volume reports
- [x] A2 search only for chart-entry roles on staff work pages; results limited to enterable patients
- [x] A3 per-person read state; task pointers linked to My work; bell filters; new events; narrowed LVN cosign + HLOC routing; four text leaks fixed; Part 2 text lint; seeded broadcasts ≤5 per role
- [x] A4 Spanish screener resume fixed at source; all browser specs green together (56/56, live preview)

## Group 1 (8 Oct) — profile, availability, flag journeys (Draft)
- [x] K1 chartAccess comment · [x] K2 event + routing tests (notificationEvents.test.ts)
- [x] P1–P4, A1–A4, C2 with unit tests (group1Profile.test.ts)
- [ ] Browser walkthrough spec for Group 1 flows (not yet written)
