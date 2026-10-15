# Phase 8 — Batch 8a-2: approval review

**Review only. Approval of this plan is required before application, test, report, roadmap or AGENTS writes.** This planning artifact is the only new write for this review. “Continue” is not approval.

## Scope and preserved rollback

The original six-item 8a-2 scope, not a live-data integration. Use existing record projections; retain Simulated labels. No new records, clinical rules, permissions, status mappings, backend connection, Phase 9 restyle or 8c-2 implementation.

- **Preserved rollback:** `e231f0dd8e26acd460acee64ee0f1535480d687c`. Do not replace this reference or reset/discard history.
- **Current review HEAD:** `6f2cde8ba5bbb506c49de52cdf26243042b90d8e`. Before this plan write, working tree was clean.
- **Differences from rollback:** 37 paths, 563 insertions, 299 deletions. Earlier unapproved 8a-2 work and stopped 8c-2 work are already present; neither is treated as approved or verified by this review.
- Approval would authorize reviewing/correcting the existing **8a-2** changes only within the six items below. Keep **8c-2** changes separate and untouched. A shared file may receive only a clearly isolated 8a-2 change.

### All pre-existing differences from the preserved rollback

**Planning/governance:** `.lovable/plan.md` deleted; `.lovable/plan/phase-8-batch-8a-2-2026-10-15.md` added; `AGENTS.md`, `roadmap.md` modified. The roadmap incorrectly calls earlier 8a-2 work Approved; correct this only after plan approval.

**8a-2 presentation and tests:** `src/components/StaffShell.tsx`, `src/styles.css`, `src/components/clinician/WorkspaceDashboard.tsx`, `src/routes/my-work.tsx`, `src/routes/nurse.tsx`, `src/routes/admin-coordination.tsx`, `src/routes/case-manager.tsx` modified. Added `src/components/staff/StaffCrisisBanner.tsx`, `WorkspaceSectionOrder.tsx`, `workspaceOwnership.ts`, `src/components/__tests__/staffWorkspace8a2.test.tsx`, `e2e/consentSigningClearance8a2.spec.ts`, `e2e/staffShell8a2.spec.ts`.

**Stopped 8c-2 work:** modified `src/components/advocate/AdvocateDesignationPanel.tsx`, `StaffAdvocatesTab.tsx`; `src/components/billing/PatientBalance.tsx`; `src/components/careplan/CarePlanEditor.tsx`; `src/components/clinical/GroupEligibilityEditor.tsx`, `RecordTabs.tsx`; `src/components/consent/ConsentRecordsPanel.tsx`; `src/components/scribe/ScribeWorkspace.tsx`; `src/components/staff/confirm-dialog.tsx`; `src/lib/actions/runAction.ts`, `src/lib/chartActions.ts`, `src/lib/drawer-drafts.ts`; `src/routes/admin-catalog-governance.tsx`, `admin-claims.tsx`, `admin-note-templates.tsx`, `billing.tsx`, `clinician.tsx`, `group-sessions.tsx`. Added `src/components/staff/confirmed-action.ts`, `use-confirm-dialog.tsx`. AGENTS/roadmap also contain 8c-2 changes.

No existing test file or snapshot was changed. No consent-layout/shell change or public-website application change is among these differences. Restoring this review plan is an additional planning-only difference.

## Work by item: evidence first, then conditional implementation

### 1. Consent signing clearance

**Files:** existing new `e2e/consentSigningClearance8a2.spec.ts`; conditional changes in `src/components/consent/ConsentFormsPanel.tsx`, `FormsToSign.tsx`, `src/components/AppShell.tsx`, `src/styles.css`.

**First evidence:** review and run the existing unapproved regression before any consent-layout edit. At 390×844, 768×1024 and 1280×900, send a form through real store functions to a synthetic patient, sign through the actual UI, and read back its frozen signed version. Test both Sign and “I'm done,” intermediate and maximum scrolling, bounding boxes, all mounted bottom sticky/fixed layers, and center/corner hit testing. Use ordinary clicks, not force or signed-looking DOM fixtures. Inspect the member signing host as well.

**Approach:** only if overlap reproduces, add measured bottom-layer/safe-area clearance on the actual scrolling host, or narrowly correct stacking. Keep the crisis bar visible and native 988 reachable; do not change signing, locking, legal copy or member density. If it does not reproduce, retain evidence and coverage with **no consent-layout change**.

### 2. Workspaces: Needs you → Waiting on others → Today

**Files:** `src/routes/my-work.tsx`, `clinician.tsx`, `case-manager.tsx`, `admin-coordination.tsx`, `nurse.tsx`; `src/components/clinician/WorkspaceDashboard.tsx`; existing `src/components/staff/WorkspaceSectionOrder.tsx`, `workspaceOwnership.ts`, `StaffCrisisBanner.tsx`. `src/components/ops/OpsWorkspace.tsx` only if an existing Today strip needs moving.

**First evidence:** compare role-visible record IDs, owners, counts, statuses, links and actionable controls against the preserved baseline. Cover Cathy (`clinical_coordinator`, `s-cc2`), clinicians/prescribers, care roles, RN/LVN and operations through their existing destinations. Audit the existing unapproved grouping rather than assuming it is correct.

**Approach:** presentation-only ordering, preserving within-group priority, filters/collapse preferences, supporting sections and every existing row. Use authoritative structured ownership; a task waiting for Cathy to review belongs in Needs you. Ambiguous ownership keeps a neutral supporting placement, not an invented “waiting” label or default classification. No duplicate rows or new store selectors that widen visibility.

Keep a non-dismissible My work safety banner above the groups while authorized crises exist. Reuse the header's acting-person/role-scoped escalation projection, existing queue link and ShieldAlert; no patient/SUD detail or global count. Preserve header count, detailed crisis rows and 988. Verify zero state, actor switches, toast dismissal and navigation back.

### 3. Staff shell for `/consent`: blocked until member-access proof

**Files if proof passes:** `src/components/AppShell.tsx`, `src/routes/consent.tsx`; new focused guard tests and member deep-link browser coverage.

**Guard evidence:** staff navigation registers `/consent` under `consent_ledger`; RouteAccessGuard → resolveNavAccess → canSeeNavEntry checks acting staff roles. AppShell still lists `/consent` in both member exceptions (:49 and :111). These checks do not establish patient/advocate-session denial.

**Known blocker:** an earlier patient session reached `/consent`. Reproduce and document before migration. Test actual patient and advocate sign-in, supported persisted/session-only states, stale privileged staff state, reload/back and member link paths. Assert no ledger, patient picker, staff controls or data renders before denial. Do not cast a member into StaffRole as proof.

**Approach:** if any member reaches it, stop this item and request separately scoped access-fix approval; no permission/auth rewrite here. Independent items may continue subject to the global assertion stop rule. Only if proof passes, remove the two member exceptions so the existing registry chooses StaffShell/compact density/English. Preserve query parameters, frozen copies, all ledger contents and role gates. Cathy stays read-only. Member signing remains unchanged. Complete missing leaf metadata only on this touched route.

### 4. Complete 8a-1 audit/tablet/touch checks

**Files:** `e2e/staffShell8a2.spec.ts`, new focused units; conditional `src/components/StaffShell.tsx`, `StaffNavSidebar.tsx`, `DemoControlsBar.tsx`, `src/styles.css`. Existing chart/dashboard/operations launcher files change only upon a demonstrated defect.

**First evidence:** finish real permitted + New actions in chart, clinician and operations, read records back, and count exactly one standard `action.*` event per action with correct actor. Keep existing domain lifecycle events; opening/canceling writes no mutation audit. Cover repeated clicks and blocked attempts, including Cathy.

At 768 test expanded/collapsed navigation, header, breadcrumbs, overlays, scrolling below the measured demo bar and crisis/988 visibility. At 390 and 768 coarse-pointer emulation measure actual **48×48 minimum hit rectangles**, not computed CSS height: header/brand links, sidebar anchors/group headers, collapse/search/clear, + New and mobile navigation. Preserve 36px mouse controls and 14px floor. Correct only proven staff-scoped sizing/clearance defects.

### 5. `/admin-content` phone overflow

**Files only as implicated:** `src/components/admin/ContentAdminWorkspace.tsx`, `ContentInventoryTable.tsx`, `ResourceVerificationQueue.tsx`; `src/routes/admin-content.tsx`; staff sizing CSS.

**First evidence:** at actual 390px mobile emulation capture document/body scrollWidth, innerWidth, visualViewport width/scale and overflowing ancestor rectangles. Cover Cathy/admin, Browse/Manage/Review/Audit/Legal tabs, editors and confirmations. Distinguish local table scrolling from document expansion.

**Approach:** correct the first proven min-width/wrapping/scroll-containment defect. No global overflow hiding, table-card redesign or permission change. Keep History RemoveControl mounted. Recheck document width and real 48px targets, including the prior 46px-on-screen dialog result.

### 6. Public early taps: investigate, fix only with evidence

**Files if proven:** `src/components/website/WebsiteLayout.tsx`, `WebsiteNavigation.tsx` (confirm actual paths before editing), homepage/start or language source only if directly responsible; new `e2e/publicHydration8a2.spec.ts`. `DemoControlsBar.tsx` only if the captured mismatch proves responsible for early interactions.

**First evidence:** fresh ordinary and delayed-script loads at 390 and 1280. Capture console warnings/errors, uncaught errors, failed requests, timestamps, intercepting layers, first-visible controls and click results for EN/ES, menu, Get started and Help/988. Compare early versus post-hydration behavior; blocked JS alone does not establish the reported normal-load defect. Verify native links without placing a call.

**New signal:** current preview telemetry reports a hydration mismatch in the demo-role trigger: server “ECM Provider,” client “Therapist.” This is not yet proof of a public missed-tap cause. Reproduce and attribute it; do not describe the homepage as hydration-clean based on prior runs.

**Approach:** only a demonstrated defect gets a minimal deterministic-render/readiness or native fallback correction. Do not disable/inert 988, gate its rendering, use suppressHydrationWarning, or broadly replace language/menu architecture. Keep exact public copy and destinations.

## Exact existing-test changes and stop rule

**None requested.** No deleting/skipping tests, snapshot updates, retries, timeout or threshold changes.

- Retain `src/lib/__tests__/clinicianWorkspace.test.ts:16–19` and its current workspaceTileOrder arrays; reorder presentation, not that model helper.
- Retain the existing staff-shell source-shape assertion, ledger read-only checks (`e2e/group2Pathways.spec.ts:63–65`) and signing/locking checks (`e2e/consentWorkflow.spec.ts:129–138`); recheck exact current lines before reporting any necessary change.
- **Outstanding 8c-2 blocker:** `src/lib/__tests__/runAction.test.ts:15`: current `expect(permissionSnapshot()).toMatchSnapshot();`. Proposed replacement: **none**. Eight new 8c-2 registry actions changed its snapshot output; last focused run had 10 pass/1 fail. Snapshot additions need separate Mitch approval and are not authorized by this 8a-2 plan. Full-suite verification is blocked if this remains failing.

Any other existing assertion failure stops work; report file, line, exact current/proposed line and why before edits. Do not conceal a known failing snapshot by filtering it out.

## New tests, completion evidence and risks

**Units:** conserving row identities/statuses/actions during grouping; Cathy and Part 2 parity; structured ownership/ambiguous cases; crisis zero/authorized/actor-switch states; consent guard/session boundary; permitted + New audit count/attribution. Review the unapproved new tests before extending them.

**Browser + axe:** real signing/readback/clearance; order/crisis persistence; Cathy/denied roles; actual member ledger denial; + New readback; 768 scroll/header/navigation; actual coarse targets; phone overflow; public first taps/native 988. Axe on workspaces, signing/locked state, navigation overlays, admin-content/public menus and ledger only if migration passes, with existing standards unchanged.

After approval and resolution of assertion blockers: full unit pass count beside `vitest list` total; every browser spec including axe, units first then browsers, exhaustive non-overlapping batches if needed. Visually inspect 390/768/1280 light/dark My work, ledger and real signed-form captures (18), label blocked/non-migrated evidence honestly, and keep unrelated tracked screenshots unchanged unless normally regenerated by their suite. Update `docs/phase8a2-report.md`, lean roadmap and architecture rules only within approved work.

**Risks:** Cathy must not gain consent/review/crisis rights or lose actionable rows; acting and viewed identities stay distinct. Safety layers must never obscure 988 or signing controls. Mask Part 2 before grouping; no newly exposed stubs, raw notes or sensitive banner/audit/notification text. Preserve outbound disclose(), cohort 11, outpatient-only and Draft/Simulated rules. Patient-access failure blocks migration, not an unapproved security redesign. Stopped 8c-2 changes and their snapshot remain separately disclosed, not silently repaired.