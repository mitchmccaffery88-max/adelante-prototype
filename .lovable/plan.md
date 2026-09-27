# Investigation report: clinician functions, escalation, meds, Adel (no code changes)

Source: a read of the store's method list in `src/lib/ehr.ts` plus targeted searches. I did not use the browser. **(I)** = inferred from a name or comment and not traced end to end. Role details come from earlier sessions unless marked.

## 1. Patients and sessions

| Function | Who | Where / store fn | Status | Notes |
|---|---|---|---|---|
| Create patient (staff) | intake / assisted signup | `createPatient`, `/assisted-signup` | works | |
| Edit demographics / identifiers | — | no `updatePatient` found | missing | Nothing in `components/` or `routes/` edits these |
| Insurance / coverage | billing / eligibility | `setCoverage`, `addCoveragePlan`, `endCoveragePlan`, `recordCoverageCheck` | works | |
| Outpatient episodes (open/close/discharge/readmit) | — | only `openPreReleaseEpisode`/`closePreReleaseEpisode` (in-facility); `recordDischarge`/`currentDischarge` **(I)** in-facility | missing (outpatient) | |
| Primary clinician / care team | coordinator | `reassignPrimaryClinician`, `assignCaseManager` | partial | No care-team roster editor |
| Flags | clinicians | `raiseCrisisFlag`, `flagCrisis`, `flagMessageAsSud` | partial | No general SUD or high-risk patient flag |
| Schedule | booking staff | `bookAppointment`, `rescheduleAppointment`, `staffCancelAppointment`, `markAppointmentNoShow` | works | |
| Start telehealth / in-person | clinician | `vendors/telehealth.ts` (mock), `updateAppointmentStatus` | placeholder | |
| Document | clinician | `addProgressNote`, note templates (versioned), `noteAutofill` | works | |
| Sign / cosign | clinician / supervisor | `signProgressNote`, `cosignProgressNote`, `declineProgressNoteCosign`, `reassignNoteCosign` | works | Supervisor routing is enforced in the store |
| Amend / addendum after signing | — | only `amendAsam` (ASAM) | missing for notes | No addendum, version history or audit of changes to signed notes |
| Lock, late entry, void/delete note | — | none found (`voidBatch` is claims **(I)**) | missing | |
| Visit → note → claim | automatic | `onNoteFinal`, `noteVisitLink.ts`, `/notes-queue` | works | Cancelled or no-show visits never create a claim |

**Edit rules:** Only drafts can be edited **(I)**. After signing, a note is effectively frozen because no edit path exists. That is safe but not compliant: there's no addendum or amendment path. "Who can edit whose notes" isn't coded beyond author drafts **(I)**.

## 2. Escalation

| Path | Trigger | Lands | Reason required | Audited | Part 2-safe |
|---|---|---|---|---|---|
| Crisis queue | auto (`scanTextForCrisis`) plus manual (`flagCrisis`/`raiseCrisisFlag`) | `/crisis-queue` (claim, resolve, re-trigger, SLA) | resolve: yes **(I)** | yes | yes |
| Safety plan | manual | `/safety-plan`, `markSafetyPlanReviewed` | no | yes **(I)** | yes |
| C-SSRS | manual request; score-driven alert **(I)** | `requestCssrs`/`recordCssrs` feed the crisis queue **(I)** | n/a | yes | yes |
| Level-of-care change / ASAM re-assessment | manual | `requestAsamAssessment`, `patientReassessmentDue` | ASAM reason | yes | gated by `roleSeesAsamSection` |
| Supervisor / cosign | automatic | cosign inbox, override reason | override: yes | yes | yes |
| Referral to a higher level of care | — | `createReferral`/`addResourceReferral` handle intake and community resources only | missing | — | — |
| 911/988 guidance | static | `/crisis` (`crisisCopy.ts`, EN/ES) | n/a | n/a | yes |
| Notify care team | manual / automatic | messages, `advocateNudgeCareTeam`, staff SMS alerts | no | yes | masked |

## 3. Outpatient medications

| Function | Who | Where | Status | Notes |
|---|---|---|---|---|
| Med list / reconciliation | PMHNP, nurse **(I)** | `MedReconTab`, `start/completeMedReconciliation` | works | |
| Prescribing | PMHNP (`meds_erx` write); others need attribution | `orders.ts`, `signOrders`, `prescribeMedication` | partial | Real drug data comes from RxNav and DailyMed. Pharmacy sending is only a flag; eRx is a mock (`vendors/erx.ts`) |
| Refills | patient → staff | `requestRefill`, `reviewRefill` | works **(I)** | Not traced on screen |
| MOUD/MAT | PMHNP | `MatOrderCard` (pre-release only) | partial | No outpatient buprenorphine/naltrexone workflow; no methadone referral |
| Controlled meds / CURES | — | `isControlled`, `daysSupply`, DEA schedule | partial | **No CURES/PDMP check anywhere** |
| Allergies / interactions | clinicians | `addAllergy`, `softDeleteAllergy` | partial | No allergy cross-check at order time; interactions are a name-overlap duplicate warning only |
| Adherence / side effects | patient reports, staff acknowledge | `medAdherence.ts`, `reportMedSideEffect`, `acknowledgeMedSideEffect` | works | |
| Part 2 masking of SUD meds | — | no SUD-med flag found in `orders.ts` | missing **(I)** | Buprenorphine can show to restricted roles **(I)** |
| Demo data | — | `outpatientMeds` seed | works | |
| Medication-round tests | — | `mar.test.ts` has 19 `it(` | in-facility only **(I)** | |

## 4. Adel / AI on the clinical side

| Feature | Kind | Reads | Writes | Human sign-off | Audited | Part 2 / roles |
|---|---|---|---|---|---|---|
| Chart review (`/agentic/chart-review`) | facts from the record; sample summary text | record | nothing | n/a | no | `canAccess`, Part 2 screener filter |
| Scribe | static sample | record | nothing | n/a | no | same |
| Dictation | static sample | — | nothing | n/a | no | same |
| Note autofill / automations | rule-based | record | draft note fields, `listNoteAutomationRuns` | yes, clinician signs | yes | yes **(I)** |
| Crisis scanner | rule-based | patient text | crisis queue, alert | staff resolve | yes | yes |
| Adel intake (`saveIntakeProfileViaAdel`) | rule-based script | patient answers | intake profile (no consent) | patient confirms | yes **(I)** | yes |
| Adel chat / recap | live AI (Lovable AI) | prompt only | nothing saved (transcript on hold) | n/a | no | crisis messages never reach the AI |
| Missed-handoff catch-up | rule-based | tasks/alerts | summary **(I)** | n/a | **(I)** | **(I)** |

**Possible Adel add-ons (none exist; each would keep a human decision):** a draft note from the visit and scribe that the clinician signs; draft addenda; suggested medication reconciliation changes; a pre-filled refill decision the PMHNP approves; a drafted crisis or escalation summary that staff edit and send; a drafted referral packet for a higher level of care; a suggested ASAM re-assessment when quick checks worsen; a drafted CURES summary once CURES is connected.

## Top gaps (by clinical and compliance risk)
1. There is no CURES/PDMP check for controlled or MOUD prescribing.
2. There is no way to add an addendum to or amend a signed progress note, and no version history.
3. SUD medications have no Part 2 masking **(I, verify first)**.
4. Orders have no allergy cross-check, and there is no interaction engine.
5. There is no workflow for referral to a higher level of care.
6. There are no outpatient episodes of care (open, discharge, readmit).
7. Demographics and identifiers can't be edited.
8. There is no void, lock or late-entry path for notes.
9. The outpatient MOUD workflow is missing (only pre-release MAT exists).
10. The three AI screens are sample content with no audit trail.

**Separate: in-facility items.** Medication rounds (`mar.ts`, 19 tests), shift count, pre-release episodes, MAT orders and discharge.
