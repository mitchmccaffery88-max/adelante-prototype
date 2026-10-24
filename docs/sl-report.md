# Batch SL — hard stop before label implementation

Mitch approved Oct 24, 2026. No publishing. Rollback recorded before edits: `0eff6798065e7362df8141759a99463e06005c9c` (Friday final).

## Status and stop evidence

**STOP: existing exact-source test pins a screen that needs a label.** No label, integration, audit, permission, behavior, fixture, assertion, adapter or screenshot changes were made. No restart, unit run or full browser run was started after this discovery. `/tmp/sl-browser.log` has not been produced by this batch. This is a source-inspection stop, not a claimed test failure.

`src/lib/__tests__/billingProjectionB3b.test.ts:95–96` compares the entirety of `src/routes/clinician.tsx` against `b1d3c414`, with only `withApprovedConsentB2` transforms. It runs for therapist and sys_admin. `src/test/consentB2Approved.ts:218–278` permits only the already-approved 11 Friday name-label substitutions for this screen; Batch SL has no adapter exception.

The `/clinician` refill surface directly invokes `actFor("refill_decision", "reviewRefill", …)` at `src/routes/clinician.tsx:1213,1267`. The action is tied to **both** `cures_placeholder` and `erx_simulated` (`src/lib/chartActions.ts:261–268`). This screen has no unconditional Simulated label; its CURES child mounts only for `canWrite && refillNeedsCures(r)` at :1238. Adding a label in that child alone cannot label non-controlled refills or the history view.

| File:line | Current | Proposed (NOT applied) |
|---|---|---|
| src/routes/clinician.tsx:1171 | `<h3 className="font-display text-base text-navy">Refill requests</h3>` | Retain heading; append `<Badge variant="outline">{simulatedSurfaceLabel("erx_simulated")}</Badge>` beside it, with required import. Label: “Simulated — not sent to a pharmacy”. |
| src/routes/clinician.tsx:1155–1157 | Separate history-only refill card/heading without a simulation label | Same eRx badge alongside this heading so results remain labelled when no requests are pending. |
| src/lib/__tests__/billingProjectionB3b.test.ts:95–96 | Whole clinician source must exactly equal existing approved adapter output | Would require an explicitly approved, additive exact-once presentation-only adapter; assertion must stay unchanged. |

Even one inserted badge changes that exact comparison. No workaround, source stripping, adapter addition, baseline regeneration or existing assertion change was made. Resume requires approval covering the precise label/import substitutions for both refill branches and any further exact-source conflicts found during implementation.

## Mitch-approved timeout change (Oct 24)

- `e2e/staffNewAudit8a2.spec.ts:29–30`: the “every /clinician + New option opens without a stray audit entry” test now contains `test.setTimeout(60_000)` as its first statement (new :30). Inherited limit **30s → 60s** only for this test body, instantiated for clinical_coordinator and therapist.
- Every assertion, wait, retry, other test and global setting is unchanged. Diff against rollback is exactly **one added line**.
- Evidence: `docs/friday-cleanup-report.md:58` records therapist **26.6s of 30s** and clinical_coordinator **17.1s** in the Friday full run. Therapist used about 89% of the old limit. Historic five-run investigation is summarized at :56; the old cold outlier predates this batch.
- It stays on the named-flake list. Acceptance still requires sole named failure plus 3/3 standalone passes; no new exception was added.
- This timeout edit has been inspected against rollback, but has **not** been exercised by a new test run because the label stop was found first.

## Flag × surface × label trace (source evidence, not rendered verification)

The table records the investigation so far. “Existing” means found in source, not a new browser-render check. The complete every-surface inventory, Spanish copy, rendered tests and action-by-action audit execution remain unfinished.

| Flag | Traced surfaces | Existing / proposed label |
|---|---|---|
| hie_simulated | OutsideRecords.tsx:29–34,103–108; BriefTab.tsx:260–270; ChartTabView.tsx:113,140; my-work.tsx:288,301; data-exchange.tsx:30–32 | Existing HIE_LABEL: “Simulated HIE feed — demo data, no live connection”; derived counts/alerts need review. |
| placeholder_lab | LabsAndMeasures.tsx:70–73,218–223 | Existing “Placeholder lab — not sent”; proposed “Simulated — not sent to a lab”. |
| cures_placeholder | OrderSafetyPanel.tsx:83–92; RefillCuresStep.tsx:22–30; clinician.tsx:1238 conditional host | Existing “CURES integration placeholder — no live query”; proposed “Simulated — no live CURES query”. |
| eligibility_simulated | eligibility-worklist.tsx; electronic eligibility action; eligibility/eligibility.ts:1–21 | Proposed “Simulated — no live eligibility check” beside electronic action/results only. Manual recorded verification is real staff input and must not be relabelled simulated. |
| erx_simulated | NoteOrdersSection.tsx:61,88; OrdersTab.tsx:585–596; clinician.tsx:1155–1291; admin-vendors.tsx:75–88 | Proposed “Simulated — not sent to a pharmacy”; clinician source pin triggers STOP. Member medication surfaces still need exhaustive tracing. |
| caloms_export_simulated | OpsActionLauncher.tsx:319–326; county-reporting.tsx:117,170–175 | Existing county simulated header / ISL simulated toast; proposed persistent “Simulated — nothing submitted to the state”. |
| notifications_simulated | Chart message action; OpsActionLauncher resend; group enrollment end | Proposed “Simulated — no message is actually sent”; exhaustive sender/result inventory remains open. |
| payments_simulated | OpsWorkspace.tsx:108–115; OpsActionLauncher.tsx:263–279,310–315; PatientBalance.tsx:105–136 | Existing ops simulated confirmations; balance says “No card processing here”. Proposed “Simulated — no payment processed”; full claim-submit inventory remains open. |
| voice_intake | voice/AdelVoice.tsx:59 | Existing simulatedSurfaceLabel voice label. |
| adel_drafts | chart/AdelDrafts.tsx:51 | Existing simulatedSurfaceLabel rule-based draft label. |
| telehealth_simulated | patient/AppointmentsSummary.tsx:145 | Existing simulated video label. |
| scribe_simulated | ScribeWorkspace.tsx:94,175; agentic.scribe.$patientId.tsx:53 | Existing simulated scribe label. |
| llm_simulated | chart/AdelBriefSections.tsx:67 | Existing simulated template-summary label. |
| calendar_sync_simulated | calendar/CalendarSyncCard.tsx:20 | Existing outline Badge with simulatedSurfaceLabel. |
| consent_upload_simulated | consent/ConsentCapturePanel.tsx:147,232; consentCapture.ts:25 | Existing “Simulated — paper copy is not stored in a real document system”. |

## Audit check (source inspection only)

`actionIsSimulated` in `src/lib/actions/runAction.ts:96–99` derives simulation from action metadata or simulated flags. Successful flagged calls write outcome `simulated` and `detail.simulated: true` at :192–203, through write at :122–146. No audit code changed.

Traced bindings in `src/lib/chartActions.ts`: med_order :253; refill_decision :262; cures :275; lab_order :405; consent upload :158; scribe :577,599,610,622,633,644; message_patient :745; notification_resend :983; group_enrollment_end :1155; claim/payment actions :867,879,890,902; eligibility_check :914; state exports :929,1267,1298; calendar_sync_run :1057; hie_match_decide :1120. Voice, rule-based drafts, telehealth and template summaries have surface-only flags in this traced registry map; an exhaustive audit-path check is not complete.

Existing guard `src/lib/__tests__/part2SimulatedHardening.test.ts:118–127` additionally requires a literal `simulatedSurfaceLabel("<id>")` use in a component whenever its map entry is defined. Any new map entries must retain this assertion, not modify it. Existing simulation tests are not a substitute for the requested NEW rendered/audit tests.

## Remaining work / artifacts

Blocked by the immutable clinician source pin: missing EN/ES labels, complete flag/surface/audit inventory, NEW 15-flag rendered/audit test coverage, NEW 390px axe spot checks, restart/full units/full browser suite, screenshot restoration and successful final SHA. No screenshots were generated or changed, so no restoration is needed at this stop. No publishing, database or connector change.