# Batch SL — COMPLETE: accepted closeout validation

Mitch approved labels and delegated additive presentation-only adapters Oct 24. No publishing. Original rollback: `0eff6798065e7362df8141759a99463e06005c9c`. Resume HEAD observed before work: `1da5f8c066dd0b5ea9dd8cc2b7f295e186937c3e`.

## Latest closeout validation (Oct 24, authorized 19:48 UTC)

- Starting code HEAD: `fe95a8318aa65ca48c5ca65c765b5ca0f59496ad`. No application, test or config changes in this validation continuation; `contentInventoryTables8b2.spec.ts` remains byte-identical to rollback. Nothing published.
- Supervised dev-server restart completed; full units **3,037/3,037**, **378/378 files**, **208.93s**, literal **EXIT 0**. Preserved in `docs/sl-evidence/closeout-units.txt`.
- Launched the exact approved setsid command with `E2E_BASE_URL=http://localhost:8080`, `--workers=1`, alone. Polled in nine-minute chunks without ending before the literal result. Full browser suite: **227 passed / 1 failed**, **48.6m**, literal **EXIT 1**.
- Immediately after EXIT, copied `/tmp/sl-browser.log` to `docs/sl-evidence/closeout-browser.txt` and all retained test results (including failure trace and error context) to `docs/sl-evidence/closeout-failures/`.
- **STOP:** `e2e/roleDashboards9c.spec.ts:15:5`, “9c-2 billing action and summary above fold 390”; actual assertion failure at **:27:36**. Current requirement: `expect(box.y + box.height).toBeLessThanOrEqual(height)`. Expected **<=844**, received **945** at the 390×844 viewport. This is a failed layout check, not a timeout, and is not a named flake. No standalone rerun or fix was attempted. Proposed next step, subject to authorization: inspect the preserved trace to identify which billing action/summary region exceeds the screen and scope a presentation-only correction; preserve the existing assertion, viewport, timeouts and config. No exact source fix proposed without that investigation.
- Failure trace: `docs/sl-evidence/closeout-failures/roleDashboards9c-9c-2-bill-7a07d--and-summary-above-fold-390-chromium/trace.zip`; adjacent `error-context.md` retained. No Playwright/preview process remained after EXIT.
- Inventory test **passed (21.4s)**; no timeout change, and it remains outside the named-flake list. The four NEW simulation-label/390px axe checks passed (**10.9s, 9.1s, 7.2s, 8.9s**). Approved staff New test passed for coordinator **20.5s** and therapist **25.9s**; action-audit-feed passed **30.4s**. No named-flake exception was exercised.
- Screenshot restoration and successful batch closeout were conditional on acceptance and therefore **not performed**. Previous 248-image comparison below is historical, not a post-run restoration. Batch remains open; only a stop checkpoint SHA can be recorded. Latest harness signal: build OK.

### Mitch-approved test edit (Oct 24): batchBIntake literal generated ID

`src/lib/__tests__/batchBIntake.test.ts`, rollback :124/:127 → current :123–135: before, audit details and notification text were scanned directly by `banned`; after, `const stripId = (s: string) => s.split(r.id).join("")` removes only the literal store-generated referral ID before those same regex checks. Nonempty scanned text is also asserted. The regex `/charge|substance|sud|opioid|alcohol|treatment|2026-10-01/i` remains unchanged; no word boundaries or broader scrubber were introduced.

```ts
// Before
for (const e of audits) expect(JSON.stringify(e.detail)).not.toMatch(banned);
for (const n of notes) expect(`${n.subject} ${n.body}`).not.toMatch(banned);
// After (both loops use this exact literal-ID removal)
const stripId = (s: string) => s.split(r.id).join("");
const scanned = stripId(JSON.stringify(e.detail)); // notification loop: stripId(`${n.subject} ${n.body}`)
expect(scanned.length).toBeGreaterThan(0);
expect(scanned).not.toMatch(banned);
```

Mitch explicitly accepted both historical proofs **13/13**: generated ID `317ksud2` no longer causes a false privacy match, while actual `SUD` text still fails the unchanged check. The original proof file/log is not retained in this sandbox; these results are **user-accepted historical evidence**, not independently rerun or reproduced in this continuation. Fresh full units above passed the current test without any further edits.

### Two failed browser launches: missing E2E_BASE_URL

Prior chat records two unsuccessful launches without `E2E_BASE_URL`. `playwright.config.ts:24` defaults to :4173; **:29–32** starts `bun run preview:e2e` when the variable is absent, instead of using the already-running :8080 dev server. `e2e/global-setup.ts:18` waits for `window.__adelante`. Original failed-launch logs are not retained; the config verifies the wrong-server selection, not every historical runtime detail. This closeout used the explicit :8080 setting and completed global setup and all 228 tests.

### Timing evidence substitution and no-change outcome

Mitch authorized fresh 5× current / 5× archive evidence with traces in place of the unavailable original failure trace. The table at the end records 10/10 passes, medians **17.1s / 17.2s**, maxima **23.0s / 18.9s**; the conditional 60s rule was not met. The original timing report references `ci-timing/`, which is not present in this sandbox; table values are historical accepted evidence, not this run's timing. At 19:48 Mitch accepted the no-change outcome and authorized current-code closeout with no test/config changes. Current full-suite inventory result is freshly preserved above. No archive server was started in this continuation.

## Historical validation stops (Oct 24)

### Oct 24 18:37 UTC conditional timeout investigation — evidence stop

- Starting HEAD observed: `8aca8e2f1eb08dd69f57b6508585c03bbf04e188`.
- No previous browser run remains: process inspection found only the supervised project Vite dev server on :8080, with no Playwright, preview or wrangler process. No process needed termination; the project dev server was preserved.
- `/tmp/sl-browser.log`, project `test-results/`, and temporary browser artifacts are absent in this sandbox. The retained `docs/sl-evidence/` files contain only the earlier unit and four spot-check results, not the failed inventory-test trace. Independent read-only evidence inspection confirmed this absence.
- The previous chat reports `contentInventoryTables8b2.spec.ts:5` failing at **32.6s**, but explicitly says the trace was not read and the timeout was unconfirmed. A duration alone does not establish timeout-only or prove that no check failed. No literal EXIT for that run is available.
- Mitch's prerequisite (read the original failure trace and confirm timeout with no failed check) therefore cannot be satisfied. **STOP: no timing runs, archive server, timeout edit, restart, full units or full browser rerun were performed in this continuation.** The conditional 60s approval has not been exercised; the named-flake list is unchanged.
- The accepted `batchBIntake` edit and **13/13 proof / 3,037/3,037 unit** results are user-accepted historical evidence, not newly rerun results. The current test contains the exact-ID literal removal; the temporary proof file is not present. Earlier report statements below describe the original checkpoint, not current completion.
- Needed to resume this conditional decision: the original failed-test trace/log, or explicit authorization to reproduce the failure and use new evidence instead. Nothing published; no application or test source changed in this continuation. Full-suite validation, screenshot restoration, final successful SHA and closeout remain incomplete.

- New tests: **34/34 unit**; four 390px browser/axe spot checks **4/4** (56.4s), covering prescriber refill dialog, billing workspace, vendor label and Spanish member medications with exactly one shell translation-review notice.
- Initial full units: **3,037/3,037**, 378 files, EXIT 0 (225.26s).
- Requested supervised restart: Vite ready, localhost :8080 responding. Post-restart full units: **3,036 passed / 1 failed**, 378 files, **EXIT 1** (123.79s).
- **STOP**: `src/lib/__tests__/batchBIntake.test.ts:124` (“uses neutral wording in task, notification and audit text”). Its unchanged `banned` regex at :121 matches `sud` inside randomly generated **referralId `317ksud2`**, not clinical wording. Received metadata: `{"referralId":"317ksud2","missing":["Medi-Cal ID","preferred language","address","prior records","emergency contact"]}`. The assertion serializes the entire detail, including the ID. Test, referral store and ehr.ts are byte-identical to rollback; no existing assertion, fixture, ID generator or retry was changed.
- No named-flake exemption covers this unit case. No re-run used to reinterpret this red result. Resuming needs Mitch’s decision on the random-ID collision under the new-tests-only constraint.
- **Full browser suite NOT launched**; `/tmp/sl-browser.log` does not exist. Do not mistake spot checks for full validation. The requested literal EXIT/full-suite closeout remains blocked by this stop.
- All **248 actual rollback PNG/JPG/JPEG/WebP assets** verified byte-identical; zero needed restoration. Prior report’s “265” count is not reused as evidence. New spot checks do not write baseline screenshots. Manifest in `docs/sl-evidence/screenshot-restoration.json`.
- Harness latest signal: build OK. No Supabase, database, connector, permission, clinical/policy or integration behavior changes. Nothing published.

## Flag × surface inventory (source coverage; spot-check rendering scoped above)

| Flag | Trigger/result surfaces and label treatment | Audit path |
|---|---|---|
| hie_simulated | OutsideRecords/HieNotice, HieStatusCard, BriefTab and my-work retain HIE_LABEL; data-exchange retains its existing simulated label. ChartTabView labels outside-records/med-recon summaries outside the open-body conditional. | HIE category auto-stamped in appendAudit; hieAudit real helper regression passes; matching registry flagged. |
| placeholder_lab | LabOrderForm, LabsAndMeasuresTracking and chart collapsed lab summaries; my-work pending lab section. Existing “Placeholder lab — not sent” preserved; adjacent Simulated lab badge. Manual result values unchanged. | lab_order flag; registry action audit verified. |
| cures_placeholder | OrderSafetyPanel and RefillCuresStep show adjacent no-live-query badge while preserving CURES_PLACEHOLDER_LABEL. | cures and refill_decision flags; CURES audit regex stamps direct events. |
| eligibility_simulated | EligibilityHistoryCard electronic control and result notice; VerificationSourceBadge ONLY when record.electronic; OpsActionLauncher electronic run; existing CoverageAtRelease simulated check. Manual CoverageCheckDialog and worklist staff checks are real, untouched. | real electronic click regression confirms not_connected, no verification created, one registry audit + simulated attempted-check audit. |
| erx_simulated | OrdersTab, NoteOrdersSection, Adel Refills, both clinician refill branches, member MyMedicationsCard, my-work refill section, admin/vendor status. | med_order/refill_decision flags; rx category auto-stamped. |
| caloms_export_simulated | County reporting header and existing per-report labels; billing header/ISL download context; ops export panel. Actual CSV generation unchanged; claims CSV stays its own workflow. | isl_export/county actions flagged, direct export audit regex. |
| notifications_simulated | StaffMessagesTab, PatientHome member composer, NotificationBell, Adel outreach, ops resend, admin reminders, group standing roster. Existing ConsentFormsPanel SMS label and group-end confirmation preserved. Labels explicitly say EXTERNAL messages; local in-app storage remains real. | message_patient/resend/group end flags; sender notification/SMS/email audit stamping. |
| payments_simulated | Billing header/workspace, admin-claims header, PatientBalance/payment popup, ops status/payment forms. Label specifies no payment processed or claim transmitted; real manual recording remains unchanged. | claim/payment/arrangement flags; payment audit stamping. |
| voice_intake | Existing VoiceBar label preserved plus Spanish explanation; LessonReadAloud shared bilingual badge; existing EmotionCheckIn and FormsToSign bilingual copy retained. | Private browser speech has no chart audit sink; no action invented. Flag-only test explicitly proves no tied registry actions. |
| adel_drafts | Existing AdelDraftLabel rule-based/not AI wording retained. | real adelDraftAudit helper regression proves simulated metadata via adel_draft category. |
| telehealth_simulated | Existing JoinCallButton embedded wording retained, bilingual adjacent badge for non-real early/open branches; clinician vendor launch and admin/vendor status badges. Manual group URLs from setGroupVirtualRoom/groupJoinLink stay real/unlabelled. | telehealth/vendor category auto-stamped; no registry mutation invented. |
| scribe_simulated | ScribeWorkspace capture and result, agentic scribe route, admin-vendors retain established badges. | all flagged scribe registry actions verified. |
| llm_simulated | AdelBriefSections existing summary badge retained. | real adelSummary/getAdelBrief regression confirms adel_summary_generated simulated true. |
| calendar_sync_simulated | CalendarSyncCard established badge retained. | calendar_sync_run flagged; audit transport verified. |
| consent_upload_simulated | ConsentCapturePanel upload and paper-copy viewing retain UPLOAD_SIMULATED_LABEL; shared dictionary now has same explicit explanation. Real typed signatures not labelled uploads. | consent_record_upload flag and existing real upload tests passed unmodified. |

## Bilingual presentation and boundaries

`SimulatedBadge` uses the existing outline Badge and explicit simulatedSurfaceLabel calls for all 15 flags. Added English entries contain “Simulated”; Spanish draft copy contains “Simulado.” Member hosts pass language; the existing member shell owns the one review marker. Staff remains English; Spanish outreach preview retains its existing local review notice. All labels wrap, use 14px shared presentation and semantic tokens. No stored statuses, existing messages or button words rewritten. Existing HIE/lab/CURES strings preserved rather than aligned. `part2SimulatedHardening.test.ts:118–127` unchanged and passing.

## Audit confirmation scope

No missing successful tied-action simulation metadata found; no app audit fix required. NEW registry transport tests require success (never silently skip) and exactly one simulated standard event for every flagged action, restoring temporary test store stubs. Real electronic click, HIE audit helper, rule-based draft helper and template summary paths additionally exercised. Surface-only voice has no audit by design; no private transcript audit invented. This is not a claim that every integration UI flow was executed end-to-end: full suite is blocked. Existing full unit integration/store suites passed initially; the post-restart sole unit failure above controls closeout.

## Mitch-approved timeout change (Oct 24)

`e2e/staffNewAudit8a2.spec.ts:29–30`: only the “every /clinician + New option” test adds `test.setTimeout(60_000)` at :30; inherited 30s → 60s. Friday therapist evidence 26.6s/30s (`docs/friday-cleanup-report.md:58`), coordinator 17.1s. Diff exactly one line; all assertions, waits, retries and other timeouts unchanged. Full-suite exercise remains pending. Sole named failure + 3/3 standalone rule unchanged; unit failure is not covered.

## Exact-once adapter ledger

Only `src/test/consentB2Approved.ts` per-path FRI map extended. No baseline or existing test assertion edits. Exact current/before/after source lines follow; the full rollback-to-current app diff is in `docs/sl-evidence/presentation-ledger.md`.

```ts
const FRI: Record<string, [string, string][]> = {
  "src/routes/billing.tsx": [
    ["import { StatusChip } from \"@/components/ui/status-chip\";", "import { StatusChip } from \"@/components/ui/status-chip\";\nimport { Badge } from \"@/components/ui/badge\";\nimport { simulatedSurfaceLabel } from \"@/lib/features\";"],
    ["          <h1 className=\"font-display text-2xl text-navy\">Billing coordinator</h1>", "          <h1 className=\"font-display text-2xl text-navy\">Billing coordinator</h1>\n          <Badge variant=\"outline\" className=\"max-w-full whitespace-normal text-sm\">{simulatedSurfaceLabel(\"payments_simulated\")}</Badge>\n          <Badge variant=\"outline\" className=\"max-w-full whitespace-normal text-sm\">{simulatedSurfaceLabel(\"caloms_export_simulated\")}</Badge>"],
  ],
  "src/routes/admin.tsx": [
    ["          Reminders check automatically while the app is open; send now to run a check\n          immediately.\n        </p>", "          Reminders check automatically while the app is open; send now to run a check\n          immediately.\n        </p>\n        <Badge variant=\"outline\" className=\"max-w-full whitespace-normal text-sm\">{simulatedSurfaceLabel(\"notifications_simulated\")}</Badge>"],
    ["import { Badge } from \"@/components/ui/badge\";", "import { Badge } from \"@/components/ui/badge\";\nimport { simulatedSurfaceLabel } from \"@/lib/features\";"],
    ["          <ShieldCheck className=\"h-4 w-4 shrink-0 text-teal\" /> Integrated vendors\n        </h3>", "          <ShieldCheck className=\"h-4 w-4 shrink-0 text-teal\" /> Integrated vendors\n        </h3>\n        <Badge variant=\"outline\" className=\"max-w-full whitespace-normal text-sm\">{simulatedSurfaceLabel(\"erx_simulated\")}</Badge>\n        <Badge variant=\"outline\" className=\"max-w-full whitespace-normal text-sm\">{simulatedSurfaceLabel(\"telehealth_simulated\")}</Badge>"],
  ],
  "src/components/ops/OpsWorkspace.tsx": [
    ["import { Badge } from \"@/components/ui/badge\";", "import { Badge } from \"@/components/ui/badge\";\nimport { simulatedSurfaceLabel } from \"@/lib/features\";"],
    ["    <section className=\"space-y-3\" data-testid=\"billing-workspace\">", "    <section className=\"space-y-3\" data-testid=\"billing-workspace\">\n      <Badge variant=\"outline\" className=\"max-w-full whitespace-normal text-sm\">{simulatedSurfaceLabel(\"payments_simulated\")}</Badge>"],
  ],
  "src/routes/clinician.tsx": [
    ["                <Video className=\"h-4 w-4 mr-1.5\" /> {(t as (k: string) => string)(\"clinJoin\")}\n              </Button>", "                <Video className=\"h-4 w-4 mr-1.5\" /> {(t as (k: string) => string)(\"clinJoin\")}\n              </Button>\n              <Badge variant=\"outline\" className=\"max-w-full whitespace-normal text-sm\">{simulatedSurfaceLabel(\"telehealth_simulated\")}</Badge>"],
    // Batch SL: Mitch-approved Oct 24, presentation only, exact-once.
    ['import { Badge } from "@/components/ui/badge";\n', 'import { Badge } from "@/components/ui/badge";\nimport { simulatedSurfaceLabel } from "@/lib/features";\n'],
    ['          <Video className="h-4 w-4" aria-hidden="true" /> Refill requests\n        </h3>', '          <Video className="h-4 w-4" aria-hidden="true" /> Refill requests\n        </h3>\n        <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("erx_simulated")}</Badge>'],
    ['      <h3 className="font-display text-base text-navy">Refill requests</h3>', '      <h3 className="font-display text-base text-navy">Refill requests</h3>\n      <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("erx_simulated")}</Badge>'],

```

### src/routes/clinician.tsx before/after file:line
```diff
diff --git a/src/routes/clinician.tsx b/src/routes/clinician.tsx
index a8bc8e2b..6dfb203b 100644
--- a/src/routes/clinician.tsx
+++ b/src/routes/clinician.tsx
@@ -20,2 +20,3 @@ import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
+import { simulatedSurfaceLabel } from "@/lib/features";
 import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
@@ -773,2 +774,3 @@ function ApptCard({
               </Button>
+              <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("telehealth_simulated")}</Badge>
               {(() => {
@@ -1158,2 +1160,3 @@ function RefillReviewCardInner() {
         </h3>
+        <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("erx_simulated")}</Badge>
         <p className="mt-2 text-xs text-muted-foreground">
@@ -1171,2 +1174,3 @@ function RefillReviewCardInner() {
       <h3 className="font-display text-base text-navy">Refill requests</h3>
+      <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("erx_simulated")}</Badge>
       {scopeToggle}
```

### src/routes/admin.tsx before/after file:line
```diff
diff --git a/src/routes/admin.tsx b/src/routes/admin.tsx
index dd39c4b8..7a76063d 100644
--- a/src/routes/admin.tsx
+++ b/src/routes/admin.tsx
@@ -20,2 +20,3 @@ import { Card } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
+import { simulatedSurfaceLabel } from "@/lib/features";
 import { Button } from "@/components/ui/button";
@@ -560,2 +561,3 @@ function NotificationHealthCard() {
         </p>
+        <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("notifications_simulated")}</Badge>
         <Button
@@ -634,2 +636,4 @@ function VendorStatusCard() {
         </h3>
+        <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("erx_simulated")}</Badge>
+        <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("telehealth_simulated")}</Badge>
         <div className="flex flex-wrap items-center gap-2">
```

### src/routes/billing.tsx before/after file:line
```diff
diff --git a/src/routes/billing.tsx b/src/routes/billing.tsx
index 773b8a5c..7644aca2 100644
--- a/src/routes/billing.tsx
+++ b/src/routes/billing.tsx
@@ -5,2 +5,4 @@ import { StaffTable } from "@/components/staff/StaffTable";
 import { StatusChip } from "@/components/ui/status-chip";
+import { Badge } from "@/components/ui/badge";
+import { simulatedSurfaceLabel } from "@/lib/features";
 const tableCopy = { claims: "Claims worklist", isl: "ISL encounters", credentials: "Credentialing" };
@@ -276,2 +278,4 @@ function BillingPage() {
           <h1 className="font-display text-2xl text-navy">Billing coordinator</h1>
+          <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("payments_simulated")}</Badge>
+          <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("caloms_export_simulated")}</Badge>
           <p className="text-sm text-muted-foreground">
```

### src/components/ops/OpsWorkspace.tsx before/after file:line
```diff
diff --git a/src/components/ops/OpsWorkspace.tsx b/src/components/ops/OpsWorkspace.tsx
index 9052f3a2..1d868c9c 100644
--- a/src/components/ops/OpsWorkspace.tsx
+++ b/src/components/ops/OpsWorkspace.tsx
@@ -16,2 +16,3 @@ import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
+import { simulatedSurfaceLabel } from "@/lib/features";
 import { countyReminders } from "@/lib/countyReporting";
@@ -58,2 +59,3 @@ export function BillingWorkspaceTiles({ summary }: { summary?: ReactNode }) {
     <section className="space-y-3" data-testid="billing-workspace">
+      <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("payments_simulated")}</Badge>
       <div className="flex gap-2 overflow-x-auto [&>button]:shrink-0" data-testid="billing-today-strip">
```

## Remaining tasks

Full browser suite via setsid alone --workers=1 :8080 to /tmp/sl-browser.log literal EXIT, named-flake adjudication if needed, rendered desktop evidence, final successful SHA and closeout remain unperformed. Stop checkpoint SHA recorded separately in chat; this is NOT successful completion. New spot-check setup initially used an absent/unreachable old refill card and wrong language aria-label; only NEW test setup was corrected to existing Review refill dialog, billing role and actual Spanish control. No app behavior changed to satisfy those tests.

## contentInventoryTables8b2:5 — reproduced evidence (Oct 24, authorized substitution for missing original trace)
Standalone, --workers=1 --trace=on --retries=0, config unchanged. Logs: docs/sl-evidence/ci-timing/.
| Run | Current :8080 (HEAD 47732788) | Archive 0089ca4f :8091 |
|---|---|---|
| 1 | 23.0s pass | 17.8s pass |
| 2 | 19.4s pass | 17.2s pass |
| 3 | 17.1s pass | 15.1s pass |
| 4 | 15.4s pass | 17.1s pass |
| 5 | 15.2s pass | 18.9s pass |
| Median | 17.1s | 17.2s |
No failures, so no trace to classify. Decision rule (median ≥20s or any run ≥25s on both builds) NOT met: STOP. No timeout change applied; no full suite, screenshot restore or closeout run. Archive server stopped.

## roleDashboards9c:27 fix (Mitch decision, Oct 24) — HARD STOP
Rollback for this step: 7c2de144. Applied presentation-only fix:
- `src/components/ops/OpsWorkspace.tsx`: import `simulatedSurfaceLabel` → `SIMULATED_LABEL`; new `billingHomeSimulatedLabel()` ("Simulated — no payment processed, claim transmitted, or report sent to the state"); workspace badge now shows it (was payments label).
- `src/routes/billing.tsx`: two header badges (payments, caloms) → one combined badge shown only when the tile workspace is not rendered (`!canWrite`), so every viewer sees exactly one label; `simulatedSurfaceLabel` import removed; OpsWorkspace import adds `billingHomeSimulatedLabel`.
- `src/test/consentB2Approved.ts` FRI block: billing.tsx and OpsWorkspace.tsx entries updated to the new exact-once substitutions (this-session adapter). Helper is a function, not a const, so roleDashboardParity9c2 expression inventory stays unchanged.
- `e2e/simulatedLabelsSL.spec.ts:8`: expected text "Simulated — no payment processed or claim transmitted" → combined label (still proves payments + state export labelled Simulated). No unit-test line needed changing.
Validation: full units 3,037/3,037 (EXIT 0). Standalone roleDashboards9c + simulatedLabelsSL: 14 passed, **1 failed** — `e2e/roleDashboards9c.spec.ts:27` billing 390: received **873** > 844 (was 945). Evidence: `docs/sl-evidence/rd9c-fix/`. Full browser suite, screenshot restore and final SHA not run. Proposed (needs Mitch): move the single label below billing-kpis on phone, or shorten it to one line (e.g. "Simulated — no payments, claims or state reports sent").


## Oct 24 22:55 — Mitch decision: Shorten, else move

Step rollback observed before edits: `1b8717718da5c27256905e50388e0edd51e307ee`. No publishing.
Changed lines (initial shortening): `src/components/ops/OpsWorkspace.tsx:20`, `src/test/consentB2Approved.ts:235`, `e2e/simulatedLabelsSL.spec.ts:8`: “Simulated — no payment processed, claim transmitted, or report sent to the state” → exactly “Simulated — no payments, claims or state reports sent”. Placement unchanged pending all 10 dashboard cases. Existing dashboard tests, other tests, timeouts and config unchanged.

### Accepted final validation — Shorten, else move

- Shortening alone: all 10 role/width cases plus the unchanged billing-denial case ran; 10 passed / 1 failed, EXIT 1. Billing 390 still failed only the y-bound at `roleDashboards9c.spec.ts:27` (873 > 844). This triggered Mitch's already-approved phone-only move, not a flake exemption.
- Phone-only move: below `sm`, the single badge follows `billing-kpis`; at `sm` and above, its original above-strip placement remains. A presentation-only tile wrapper retains existing handlers and gates. No label duplication: one badge in the workspace; the existing `!canWrite` header fallback remains untouched.
- After the move: all 10 role/width cases plus the unchanged billing-denial case **11/11**, and this-session label spot checks **4/4**; combined **15/15, EXIT 0**. No position assertion needed changing.
- Supervised dev-server restart followed by full units: **3,037/3,037**, **378/378 files**, **186.07s**, **EXIT 0**.
- Full browser suite launched alone via setsid, `E2E_BASE_URL=http://localhost:8080`, `--workers=1`; polled through literal **EXIT 0** without ending the turn: **228/228 passed**, **42.0m**. No named-flake exemption exercised. Logs and retained results copied immediately after EXIT to `docs/sl-evidence/shorten-else-move/full-browser.txt` and `full-browser-results/`. Initial shortening failure trace preserved separately in `shortened-failure/`.
- Named-flake policy remains sole failure + 3/3 standalone for contentWiring:47, staffNewAudit8a2:29, auditTables8b3:13, and contentInventoryTables8b2:5 **timeout only**. The inventory timeout remains unchanged; a failed check remains a stop.
- Readback through the live billing UI: 390×844 KPI bottom **815**, badge y **827**; 1280×1800 badge y **272**, KPI y **374**. Exactly one matching label at both widths. Phone label is directly after the summary and can be scrolled into full view; desktop placement unchanged. Screenshots inspected; `visible-placement.json` retains concrete bounds.
- Restored screenshots against `0eff6798065e7362df8141759a99463e06005c9c`: **17 restored**, **248 verified byte-identical**, manifest `shorten-else-move/screenshot-restoration.json`. Newly retained evidence is not a rollback screenshot.
- Existing `roleDashboards9c.spec.ts`, all other existing tests, timeouts and config are byte-identical to step rollback `1b871771`. Only the explicitly authorized this-session `simulatedLabelsSL.spec.ts:8` text changed. Full units also verify the exact-once FRI adapters and source parity.
- Existing report sections retain label inventory, batchBIntake before/after + user-accepted 13/13 proofs, missing-E2E_BASE_URL launches (`playwright.config.ts:29`), and the accepted timing/no-timeout-change outcome; those historical proofs are not misrepresented as newly reproduced.
- Latest harness signal: build OK. No publishing, database, connector, permission, clinical/policy, mutation or audit changes.

### Every changed app/test/adapter line in this step (against 1b871771)

| File / current lines | Before → after |
|---|---|
| `src/components/ops/OpsWorkspace.tsx:20` | Old combined text → exactly `Simulated — no payments, claims or state reports sent` via unchanged SIMULATED_LABEL prefix. |
| `src/components/ops/OpsWorkspace.tsx:62` | `space-y-3` → `flex flex-col gap-3 sm:block sm:space-y-3`. |
| `src/components/ops/OpsWorkspace.tsx:63` | Badge classes gain `order-1` and `sm:order-none`; same one badge. |
| `src/components/ops/OpsWorkspace.tsx:72` | Insert `<div className="order-2 space-y-3 sm:contents">` after `{summary}`. |
| `src/components/ops/OpsWorkspace.tsx:126` | Insert closing `</div>` after the existing tiles; no tile content/handlers changed. |
| `src/test/consentB2Approved.ts:235` | Exact-once import/helper substitution updates only approved combined text. |
| `src/test/consentB2Approved.ts:236` | Exact-once section/badge substitution mirrors approved responsive classes. |
| `src/test/consentB2Approved.ts:237` | Add exact-once `{summary}` → `{summary}` + wrapper opening substitution. |
| `src/test/consentB2Approved.ts:238` | Add exact-once final Tile/section boundary → same boundary with wrapper closing substitution. |
| `e2e/simulatedLabelsSL.spec.ts:8` | Matching combined text updated; still proves visible billing-home label at 390px; no other assertion changed. |

Docs, roadmap and memory record this decision; retained logs/traces are evidence only. Final managed SHA is reported in the closing response (read after these documentation writes).
