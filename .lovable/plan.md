# Phase 10a + 10b — Screener accuracy and C-SSRS (plan only)

Build frozen for the demo. Nothing below changes until approved after the demo.

## Where instrument text will come from

| Instrument | Source | Confidence today |
|---|---|---|
| PHQ-9 / PHQ-2 | Pfizer PHQ Screeners site (public, no permission needed) | Current text looks verbatim; confirm against the source PDF |
| GAD-7 / GAD-2 | Same source | Same as above |
| AUDIT | WHO AUDIT manual, 2nd ed. (2001), Box 4 | Items look verbatim; items 9/10 anchors are wrong (simplified) |
| DAST-10 | Skinner (1982), 10-item version, via NIDA | Confirm wording and reverse-scored item 3 |
| PC-PTSD-5 | National Center for PTSD (public domain) | Not written yet; copy from the NCPTSD PDF, not from memory |
| PCL-5 (20 items) | National Center for PTSD (public domain) | Not written yet; copy from the NCPTSD PDF |
| AHC-HRSN core | CMS AHC HRSN Screening Tool PDF | Current text believed verbatim; confirm per-item options |
| C-SSRS Screener | Columbia Lighthouse Project (official site) | **Will not be written from memory.** Placeholder slots until clinical staff supply and confirm the text |
| Spanish (all) | Official Spanish versions where they exist (PHQ/GAD from Pfizer, C-SSRS from Columbia, AHC from CMS) | None in the app yet; all flagged pending bilingual review |

Every item in the source file will note its origin (document, version, page). Anything not yet checked against the source is labelled "Unverified text" in code and in the staff view.

## Phase 10a — Screener accuracy fixes

### 1. AUDIT items 9 and 10
- Items 9 and 10 get their own three answer choices, scored 0 / 2 / 4, per WHO. Items 1–8 unchanged.
- Re-scoring: results with stored answers are recalculated. Results without stored answers (imported or seeded with a score only) keep their score and are labelled "Scored before 0/2/4 fix".
- **Marcus (p3), AUDIT 16:** the build step will report his old and new score and band. If his seed has item-level answers, the new score comes from them. If it only has a total, it stays 16 with the label above. No other persona has an AUDIT result.
- Tests with fixed answer sets: all zeros = 0; all maximum = 40; item 9/10 at the middle choice = 2 each; boundary totals at 7/8, 15/16, 19/20.

### 2. PTSD screening
- Retire the 5-item "PCL-5 short" for new use.
- Draft default (pending clinical decision): **PC-PTSD-5** at intake and re-screen. Draft positive cutoff 4 (NCPTSD's suggested value), labelled draft.
- **Full PCL-5 (20 items, 0–80)** available to staff and offered after a positive PC-PTSD-5. Draft cutoff 31–33 band, labelled draft.
- Past short-form results stay in the record, labelled "Retired form — not validated". They never appear on the same trend line as PC-PTSD-5 or PCL-5, and are left out of reporting totals.

### 3. AHC-HRSN at intake
- The intake form uses each question's own answer choices, the same way re-screen and pre-release already do.
- Test: every AHC question at intake shows exactly the choices in its definition.

### 4. Re-screen timing (one draft rule per instrument)
| Instrument | Draft rule |
|---|---|
| PHQ-9, GAD-7 | Intake, then day 30 / 60 / 90 |
| PHQ-2 / GAD-2 | Weekly quick check (unchanged) |
| AUDIT, DAST-10 | Intake, then day 90; also when staff ask (needs Part 2 consent) |
| PC-PTSD-5 | Intake, then day 90 |
| PCL-5 | When PC-PTSD-5 is positive or staff ask; repeat at day 30 if started |
| AHC-HRSN | Intake, then every 6 months or at a big life change |
| C-SSRS | Triggered only (see 10b) |
- One table in code holds this. Every place that shows "due" reads from it. Staff and patient views show "Draft schedule — pending clinical sign-off".

### 5. Word-for-word tests
- One test per instrument checks item count, each item's text, each option's label and value, cutoffs, and bands against a frozen copy of the source text.
- Checks that Part 2 protection still applies only to AUDIT and DAST-10.
- Checks that screener choices at intake still don't change based on "looking for" answers.

## Phase 10b — C-SSRS

### 1. Content
- Draft default: C-SSRS **Screener** (recent version). Structure is built first: the question list, yes/no answers, and the skip rules (some questions are only asked depending on earlier answers).
- Item wording goes in **placeholder slots** labelled "Awaiting official Columbia text — clinical staff to supply and confirm". The form cannot be used for real patients until every slot is filled and approved. It can be shown in demo mode with a visible placeholder banner.
- Official Spanish version goes in the same slots, flagged pending bilingual review.
- Check Columbia's terms of use before shipping. Using it for clinical care is usually free, but it should be confirmed.

### 2. What starts a C-SSRS
- PHQ-9 item 9 above 0 (intake, re-screen, or staff) → a C-SSRS task, plus the existing crisis flag, which is unchanged.
- Crisis wording detected in Adel or messages → the existing crisis step runs first, unchanged (988, crisis queue). A C-SSRS is then offered to staff as the next step. It never replaces or delays the crisis response.
- The result adds a risk level (Low / Moderate / High, draft mapping) to the existing crisis queue item.
- What staff must do at each risk level is a **draft setting pending clinical sign-off**, shown as such on the queue.

### 3. Who can give it, and where results show
- **Staff-given:** from the chart and the crisis queue. Records who gave it and is audited.
- **Patient self-report:** only offered after a trigger, with 988 and "I need help now" kept on screen. A patient's own answers never lower an existing risk level. Only staff can close the item.
- Shown in: chart (Tracking tab and a crisis/safety section), Guided Chart Review (facts only), crisis queue (risk badge), and staff Ask Adel ("who has an open C-SSRS"). Patients see "Your care team will follow up", never a score or risk label.

## Data changes (both phases)
- Screener results gain: instrument version, scoring version, a "retired form" flag, and a "text verified" flag.
- New instrument definitions: PC-PTSD-5, PCL-5-20, C-SSRS Screener (with skip rules).
- AUDIT items 9/10 get their own answer choices.
- Crisis queue items gain an optional C-SSRS link and risk level.
- New draft settings: re-screen schedule table and a C-SSRS response protocol for each risk level.
- Nothing is deleted. Old results are relabelled, not rewritten, unless item-level answers make exact re-scoring possible (logged in the audit trail).

## Every place affected
- **Intake:** AHC choices fixed; PC-PTSD-5 replaces the short form; item 9 triggers a C-SSRS task.
- **Re-screen:** new schedule table; PC-PTSD-5; retired form not offered.
- **Adel-guided intake:** no change. It still doesn't give screeners, and crisis handling comes first.
- **Chart / Tracking:** version labels, separate trend line for the retired form, C-SSRS results.
- **Care plan:** staff highlights show new instruments. No automatic goals.
- **Guided Chart Review:** new instruments and C-SSRS facts. Part 2 hiding unchanged.
- **Ask Adel (staff):** overdue re-screens use the new schedule; open C-SSRS list.
- **Reporting:** population summary leaves out retired and unverified forms. No new reports in 10a/b.
- **Patient view:** due dates follow the new schedule. No C-SSRS scores shown.
- **Pre-release:** AUDIT re-scoring applies. Otherwise unchanged.

## Moving existing demo data
- Marcus AUDIT: re-score or relabel as described above. Report the before and after.
- Any seeded PCL-5-short result: relabel as retired.
- Daniel, Rosa, Alicia, Tomás: PHQ/GAD results unchanged. Due dates may move under the new schedule. The build report will list them.

## Test plan
- Known-answer tests for AUDIT; word-for-word tests for every instrument.
- The retired form never appears on a validated trend line.
- Item 9 > 0 creates a C-SSRS task and the crisis flag, unchanged.
- Crisis wording still sends to 988 and the crisis queue first.
- C-SSRS cannot be used for real patients while placeholder text is present.
- A patient's self-report never lowers a staff-set risk level.
- Part 2 hiding is unchanged.
- Full suite, then a browser check of Rosa intake, Daniel reassessment, Tomás pre-release, Kayla note → cosign → billing.

## Risks to demo personas
- Marcus's AUDIT band may change (16 is at the High risk boundary).
- Re-screen due dates and "Things to do" counts may change for Daniel, Rosa, and Alicia.
- Any persona whose PHQ-9 item 9 is above 0 would get a new C-SSRS task. This will be checked before the build.
- A new PTSD question set at intake changes Rosa's intake walkthrough.

## Open clinical decisions
- **10a-1:** confirm the WHO AUDIT source edition. Decide whether seeded totals without item answers should be re-scored or relabelled.
- **10a-2:** PC-PTSD-5 vs other PTSD screener; PC-PTSD-5 and PCL-5 cutoffs; when to offer the full PCL-5.
- **10a-3:** none (bug fix). Confirm AHC option text against the CMS PDF.
- **10a-4:** re-screen schedule for every instrument.
- **10a-5:** who signs off each verbatim source.
- **10b-1:** C-SSRS version (screener, recent vs lifetime); who supplies and approves the English and Spanish text; Columbia terms of use.
- **10b-2:** risk-level mapping; response protocol per level; whether crisis wording triggers C-SSRS for staff only or also for patient self-report.
- **10b-3:** whether patient self-report is allowed at all; who can close a C-SSRS item.

## Phase 10c — ASAM framework (decisions recorded, not built)

ASAM assessment is triggered by:
- A positive AUDIT or DAST-10 (intake, re-screen, or pre-release).
- The patient selecting substance use treatment at intake.
- A referral that names a substance use need (pre-release screening or public/partner referral).
- A clinician's decision from the chart or a note.
- An existing DMC-ODS episode or CalOMS SUD record on entry.

Justice involvement alone is not a trigger. It affects timing and routing only (pre-release: assess before or at release, with warm handoff).

Change to the current rule: when a patient selects substance use treatment but declines Part 2 sharing consent, the answer is not dropped. It creates a protected "ASAM assessment needed" task, visible only to clinical and authorized staff per RBAC (never advocates, never Part 2-restricted staff). The sharing consent governs who else can see it. (Today `recordSeeking` drops the selection without consent; 10c changes this.)

### 10c plan (for review, no code yet)

**Ground rules**
- Licensing: only public elements are used: the six dimension names, a 0–4 risk rating per dimension, and the DMC-ODS level-of-care list (a draft, editable reference list). No ASAM questions, no placement logic. Each dimension has an empty "licensed content" slot (prompts and guidance) that can be filled later under a license.
- The clinician picks the level of care. The system never calculates, suggests, or pre-fills one.
- Part 2: every ASAM task, record, and output goes through the same check as AUDIT/DAST-10: `canAccess(role, "screeners_sud", patient)` plus the author exception. It is never shown to advocates or Part 2-restricted staff.
- Every draft value (due dates, reassessment intervals, who may sign, level list, medical necessity rule) is labelled "Draft — pending clinical sign-off".

**1. Triggers** (one function, `asamTriggers(patient)`, called from each path)
| Trigger | Where it fires |
|---|---|
| Positive AUDIT or DAST-10 (draft cutoffs) | `recordScreener` after scoring (intake, re-screen, pre-release) |
| Patient selects substance use treatment | `recordSeeking` (with or without Part 2 consent) |
| Referral names a substance use need | Pre-release import and public/partner referral acceptance |
| Clinician decision | "Start ASAM" button on the chart, and a note action |
| Existing DMC-ODS episode or CALOMS SUD record on entry | Enrollment / episode import |
- Justice involvement is never passed to `asamTriggers`. For pre-release, the task's due date is on or before the release date, and it adds a warm-handoff checklist item.

**2. The Part 2 change**
- `recordSeeking`: a substance use treatment selection is always saved to `needs.substanceUse` (already Part 2-masked) with a new `part2ConsentAtSelection` flag. It is no longer dropped.
- Without consent: the patient's own screens are unchanged (no Recovery Journey, no substance-use tools, because the visibility rule still requires consent). The task is created and masked.
- Masking: no new rule. The task, the record, and every output are marked `part2: true` and read through `canAccess(..., "screeners_sud", ...)`. For consent-gated roles (case manager, peer) the answer is no without consent. Treating clinicians (therapist, PMHNP) can see it. The sharing consent decides who else can see it.

**3. "ASAM assessment needed" task**
- Goes to: the assigned treating clinician (therapist or PMHNP). If there is none, the clinical supervisor queue. Never case manager or peer unless consent allows it.
- Draft due date: 7 days after the trigger. Pre-release: by the release date. Existing DMC-ODS episode: 30 days.
- Reason text lists the facts behind it, e.g. "Positive DAST-10 at intake (6/12/2026)" or "Selected substance use treatment at intake". Never a level.
- De-duplication: one open task per patient. A new trigger adds its reason to the open task. A signed ASAM within the reassessment window closes the task and stops new ones, except a clinician decision.
- Shows in: My Work (masked row), the chart (new ASAM section on the Clinical tab), and Ask Adel ("Who needs an ASAM?"), all filtered by the same check.

**4. Assessment record (`AsamAssessment`)**
- Six dimensions, each with free-text documentation, a 0–4 rating, and the empty licensed-content slot.
- `recommendedLevel` and `actualLevel`, both chosen by the clinician from the draft list. A reason is required when they differ (e.g. patient preference, level not available).
- Link to diagnoses (existing problem list ICD-10 codes).
- Signing uses the existing attestation ceremony (`buildAttestationRecord`, new statement `asam_sign` v1). If the author is a trainee or registered clinician, a co-signature is required (`asam_supervisor_sign`) through the existing cosign inbox. Who may sign is a draft setting.
- Signed records are locked. Changes are amendments: a new version linked to the previous one, with a reason, signed again. Old versions are kept.
- Audit entries for create, edit, sign, cosign, amend, and view (redacted by the existing audit rules).
- Fields `episodeId` and `dmcOdsLevel` are ready for 10d.

**5. Outputs (only after signature, each one audited)**
- Medical necessity recorded. Draft rule: a signed ASAM plus a linked SUD diagnosis. Labelled draft.
- DMC-ODS episode opened, or updated to the actual level.
- CALOMS admission prompt shown to staff (not auto-submitted).
- H0001 claim created through the existing claim path (same validation and billing lane).
- Care plan: a suggested goal the clinician can accept or dismiss (same as B2). Problem list: diagnosis linked. Nothing is added automatically.
- Referral out task if the actual level isn't offered here.
- Reassessment scheduled (draft: level-dependent, default 90 days) in the same schedule table as the screeners.
- Patient view: "Your care team completed a treatment planning assessment with you" and next steps. No scores, dimensions, or level numbers.

**6. Where it fits the EHR**
| Action | Roles (draft) |
|---|---|
| Start / edit draft | Therapist, PMHNP, trainee (cosign needed) |
| Sign | Licensed therapist, PMHNP (LPHA) |
| Co-sign | Clinical supervisor |
| View | Anyone who passes `screeners_sud`, plus the author exception |
- Chart: ASAM section on the Clinical tab (history, versions, status). The task and a summary also show on Tracking.
- Guided Chart Review: facts only (date, signer, ratings, level chosen by the clinician, differing reason). Part 2 hiding applies.
- Ask Adel: lists who needs one, who's overdue, and the last signed level as recorded. Adel never suggests or assigns a level. It refuses if asked.

**7. Demo data** (real store API, no pushed rows)
- Luis C. (2c): a completed, signed ASAM with a DMC-ODS episode and H0001 claim.
- Jasmine H. (2d): an unsigned draft waiting for cosign (trainee author).
- Daniel (p1): ASAM reassessment due (from his existing DMC-ODS/CALOMS record).
- New scenario: a patient who selected substance use treatment without Part 2 consent, to show the masked task (visible to the therapist, hidden from the case manager and advocate).
- No other personas change. The switcher descriptions get updated.

**8. Model decisions (draft defaults)**
- Dimension 3 and C-SSRS: show the latest C-SSRS risk level as a read-only reference next to dimension 3. It never sets the rating.
- Signing an ASAM does not sign its related screeners. It links to them by ID. Screener sign-off stays separate.
- AUDIT/DAST results get an optional `episodeId`. Results from a DMC-ODS episode are grouped under it, and the results stay on the patient record.

**9. Out of scope**
- 10d: full DMC-ODS reporting (clinical and population), CALOMS submission, level-of-care utilization reports, and timeliness measures.
- 10e: Adel/agent integration beyond read-only facts (drafting dimension text, scribe prefill).
- Not in 10c either: licensed ASAM content, any automated placement, patient self-administered ASAM.

**Tests**
- Each trigger creates one task. Justice alone creates none. De-duplication works.
- Declining consent keeps the selection. The task is visible to the therapist and hidden from the case manager, peer, advocate, and billing.
- The level is never set without a clinician choice. A differing level needs a reason.
- Nothing is output before signing. Cosign is enforced. An amendment keeps the old version.
- Adel never outputs a level. The patient view has no numbers.
- Crisis-first path and existing Part 2 tests unchanged.

**Open decisions for 10c**
1. Draft AUDIT/DAST-10 positive cutoffs that trigger an ASAM.
2. Task due dates (7 / by release / 30 days) and who receives it when there is no assigned clinician.
3. Who may sign and cosign (LPHA list).
4. DMC-ODS level list wording and which levels Adelante offers.
5. Medical necessity rule and reassessment intervals per level.
6. Whether a clinician decision may override the de-duplication window.
7. Who gets and fills the licensed ASAM content, and when.
