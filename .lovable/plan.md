# Phase 8 — Staff compact-density migration

**Plan only. No application code, tests, permissions, data or settings changed. Approve one batch at a time.**

## 1. Verified inventory and boundaries

### Shells today

There is **no `StaffShell.tsx` or compact-density attribute** in the current source. `src/routes/__root.tsx:240` mounts `AppShell`; its staff branch mounts `StaffNavSidebar` and `StaffBreadcrumbs` (`AppShell.tsx:377–381`). `styles.css` has member sizing but no compact staff sizing. The earlier summary suggesting these already existed was incorrect.

- 57 distinct destinations in `STAFF_NAV`; 63 route files match that registry or the record/agentic/import exceptions. **61 actually receive the staff classification** after the two precedence exceptions below. Appendix A enumerates every matching route and its actual shell.
- `/assisted-signup` is registered for staff access but uses `WebsiteLayout`; preserve its guard and public entry experience.
- `/consent` is registered as staff consent-ledger content but is explicitly classified as a member surface (`AppShell.tsx:47,104–110`). Do not silently reclassify it. For Phase 8, migrate staff consent controls in the chart; `/consent` needs a separate explicit decision because changing its shell conflicts with “do not touch member portals.”
- `/provider-reference` has no `STAFF_NAV` destination and falls through to the generic AppShell content without the staff rail/English override. Do not invent a new permission gate; include it only after verifying the intended existing access boundary during 8a.
- `/record/$patientId`, `/pre-release-import`, and all four `/agentic/*` routes are explicit staff exceptions. Agentic banners are inner notices, not replacement shells; preserve their Simulated/prototype honesty and fix their sticky clearance, not their functionality.
- `/print/patient-records/$patientId` falls through to generic AppShell chrome, with print-specific rendering in the leaf. Do not add interactive staff navigation to printed output.
- Staff sidebar is conditional on having at least one permitted nav entry. Preserve denied-route behavior; never turn filename prefixes into new authorization rules.

**Current shell details:** sidebar 240px / collapsed 56px, quick jump in sidebar, native title tooltips, selected navy alias fill without a path bar (`StaffNavSidebar.tsx:219–330`). Eight requested groups already exist (`navSections.ts:70–100`). Header has 32px logo, a teal-tinted 11px role indicator, bell and account; no open-crisis counter. Mobile uses a scrolling navigation strip (`AppShell.tsx:317–340`). Staff already uses an English context override, with no EN/ES toggle. Demo bar is gold/dashed (`DemoControlsBar.tsx:14–20`). New launchers are page/chart-specific, including floating controls (`OpsActionLauncher.tsx:92`, `DashboardActionLauncher.tsx`, `ChartActionLauncher.tsx`); reuse their registry and event buses, not new action lists.

**Workspace ordering:** clinician workspace initially opens Schedule and Needs my action, with schedule segment `up_next` and action group `all` (`WorkspaceDashboard.tsx:32–36`). Billing opens its action tile and restores per-person tile preferences (`OpsWorkspace.tsx:44–48`). There is no common “Needs you / Waiting on others / Today” view. Introduce presentation-only projections from existing ownership and authoritative dates; preserve saved preferences unless the user selects a new view. Never invent waiting dates or owners.

### Tables and repeated lists

**Exact syntactic census:** 58 `<table>`/`<Table>` render sites in 47 application files, excluding UI primitives and tests. Staff-route import reachability accounts for **56 sites in 45 files**; the other two are `/consent` and print. These totals include dormant facility tables and Phase 9 dashboard tables; they are an inventory, not permission to migrate all 56. Appendix B gives every site and line.

`ui/table.tsx` is a presentational primitive, not a DataTable. There is no reusable DataTable with the requested view/sort/selection/pagination behavior. Existing claim sort/filter exports are already tested; preserve them. Do not replace report data, clinical algorithms or store ownership rules.

Additional non-table lists include the six `inbox/*Queue` components, `TaskQueueCard`, `PatientOpenItemsCard`, `TaskWorkRow`, `GroupJoinRequestsQueue`, `DocumentVerifyQueue`, `ResourceVerificationQueue`, `ReferralTrackerCard`, `ReferralsTab`, `TaskList`, `NotesTab`, `CareEpisodesPanel`, `OrdersTab`, `NoteOrdersSection`, `MedReconTab`, `ConsentFormsPanel`, `ConsentRecordsPanel`, `ChartDocumentsList`, `EligibilityHistoryCard`, `CoveragePlansCard`, `OutsideRecords`, `ScribeWorkspace`, `TeamThreads`, `WorkspaceDashboard` and `OpsWorkspace`. Appendix D includes a reproducible broad file-level checklist of repeated-list hosts; **106 import-reachable component candidates is not an exact count of distinct data-list components**: wrappers, menus, content previews and shared member renderers must be separated before conversion. No “approximately 84 lists” claim is used.

### Audited forms

Appendix E inventories source hosts with fields and mutation handlers; field occurrences are not a count of distinct forms. Particular audited workflows to migrate:

| Domain | Files / forms | Reason / confirmation today |
|---|---|---|
| Content | `admin/ContentAdminWorkspace`, `ContentForm`, `StructuredPracticeEditor`, `ContentInventoryTable`, `ContentAudit`, `ResourceVerificationQueue`, `ContentBackupBar` | Content change/review notes; withdraw/discard prompts; publish controls. Preserve exact backup/revision semantics. |
| Legal forms | `admin/ConsentFormLibrary` | Version edit, legal-review, approve and Publish are registry actions; Publish is direct, with no reason field. |
| Staff identity / credentials | `admin-staff`, `admin-credentialing`, `clinician-credentials`, `clinician-profile`, `PatientProfileDialog`, `clinical/DemographicsCard` | Staff lifecycle has reason drawers; credential edits/expiry/follow-ups and demographics have existing gates. |
| Operations configuration | `admin-kpi-targets`, `admin-catalog-governance`, `admin-scheduling-rules`, `admin-facilities`, `admin-note-templates`, `admin-supervision`, `admin`, `provider-reference` | Several existing edit/deactivation dialogs; note-template save has native confirmation; supervision assignment is immediate. KPI create/edit does not have the same explicit reason control as deactivation. |
| Permissions / vendors | `admin-permissions`, `admin-vendors` | Permissions page is a read-only matrix/export/audit view, not an editable permission form. Vendor page has a Simulated test action. Do not add permission editing. Feature-flag writes retain their existing registry reason gate. |
| Revenue | `billing`, `admin-claims`, `billing/RatesPanel`, `PatientBalance`, `ops/OpsActionLauncher`, `admin/CalaimCodesSection` | Denial/write-off/reversal and payment void require existing reasons. Denied status presentation stays unchanged. |
| Consent / advocate access | `consent/ConsentFormsPanel`, `ConsentRecordsPanel`, `advocate/AdvocateDesignationPanel`, `StaffAdvocatesTab`, `AdvocateInviteForm` | Revoke has mandatory reason; capture/send/sign/copy have distinct existing gates; document verification reference is optional. Only staff-hosted branches are in scope. |
| Coordination / calendar / groups | `admin-coordination`, `my-calendar`, `location-calendars`, `group-sessions`, `scheduling/BookVisitDrawer`, `VisitActions`, `AppointmentRequestsCard`, `clinical/GroupEligibilityEditor` | Reassign/cancel/freeze/end-enrollment/remove-closed-day/remove-eligibility reasons; keep booking/consent rights. |
| Clinical record | `clinical/ClinicalRecordTabs`, `OrdersTab`, `OrderSafetyPanel`, `NoteRevisionPanel`, `RecordTabs`, `CareEpisodesPanel`, `SdohActivityLog`, `StaffContactsEditor`, `careplan/CarePlanEditor`, `AsamSuggestions`, `chart/AdelDrafts`, `DrawerForms`, `LabsAndMeasures` | Existing local reason dialogs and inline fields. Note amendment/void, removals, goal closure, prescription safety and refill denial retain their store checks. |
| Other care work | `inbox/InboxActionQueue`, `VoidRequestQueue`, `tasks/TaskWorkRow`, `escalations`, `clinical/CrisisPanel`, `nursing/NursingSection`, `scribe/AiConsentCard`, `ScribeWorkspace`, `referral/ReferralSubmissionForm`, `ReferralChasePanel`, `carePartners/CarePartnersSection`, `coverage/*`, `documents/DocumentVerifyQueue`, `team/TeamThreads`, `afbi/AfbiContactForm`, `caseload-review`, `county-reporting`, `quality-compliance` | Preserve every existing mutation, recipient, role, audit event and reason requirement; reuse rather than duplicate confirmations. |
| Dormant facility | `pre-release`, `clinical/CustodyTabs`, `MarTab`, refusal forms, `prerelease/*` | Leave off behind `inFacilityEnabled()`. MOUD plan/confirmation remains explicitly reason-free. |

A generic “every audit needs a reason” rule would wrongly change task claiming, order resumption, MOUD continuity and optional verification references. Phase 8 adds reasons only to the explicitly requested high-consequence configuration/publish/withdraw/denial/write-off/consent decisions, preserving existing exceptions and store rules. If a missing reason requires a new store argument or audit payload, that is a separately identified, narrowly approved change—not a presentation refactor disguised as one.

### Every native browser dialog

**17 source call sites: 13 prompts, 4 confirms, 0 `window.alert` calls.** There are no additional bare browser-dialog calls in the scan. PWA `prompt.prompt()` and local callbacks named `confirm` are not browser dialogs.

| File:line | Call / purpose |
|---|---|
| `components/admin/ContentAdminWorkspace.tsx:33` | prompt: fallback content-change reason |
| `components/admin/ContentAdminWorkspace.tsx:308` | prompt: withdraw/discard reason |
| `components/advocate/AdvocateDesignationPanel.tsx:72` | prompt: staff removes advocate access |
| `components/advocate/StaffAdvocatesTab.tsx:92` | prompt: optional document-verification reference |
| `components/billing/PatientBalance.tsx:163` | prompt: void payment |
| `components/careplan/CarePlanEditor.tsx:163` | prompt: dismiss suggestion |
| `components/careplan/CarePlanEditor.tsx:252` | prompt: close goal reason |
| `components/careplan/CarePlanEditor.tsx:253` | confirm: goal met versus closed, actually a binary field |
| `components/clinical/GroupEligibilityEditor.tsx:56` | prompt: remove group eligibility |
| `components/clinical/RecordTabs.tsx:2308` | confirm: clear care-plan summary note |
| `components/consent/ConsentRecordsPanel.tsx:109` | prompt: revoke consent record |
| `lib/drawer-drafts.ts:19` | confirm: unsaved drawer edits; called by `clinician.tsx:212,354` |
| `routes/admin-claims.tsx:489` | prompt: claim denial |
| `routes/admin-note-templates.tsx:476` | confirm: version-changing save |
| `routes/billing.tsx:205` | prompt: reason-required claim transition |
| `routes/group-sessions.tsx:510` | prompt: end enrollment |
| `routes/location-calendars.tsx:85` | prompt: remove closed day |

**Important correction:** passing an empty string from a prompt does not make the reason optional. Store reads confirmed mandatory reasons for payment void, goal dismissal/closure, consent/access revocation, eligibility removal, enrollment ending and closed-day removal. Keep those checks unchanged. The verification reference is genuinely optional.

### The five unconfirmed destructive controls

Source verification agrees with `docs/phase3-red-cleanup-report.md:21–23`:

1. Frequency deletion — `admin-catalog-governance.tsx:274`; direct action, signed/held-order deletion guard retained.
2. Obligation removal — `reentry/ObligationsCard.tsx:159`; **member surface, excluded**.
3. Toolkit removal — `library/LibraryBrowser.tsx:391–392`; **member surface, excluded**.
4. Delete AI sentence — `scribe/ScribeWorkspace.tsx:311`; direct registry action.
5. Deny refill — `chart/AdelDrafts.tsx:179–180`; inline required reason, no separate confirmation.

Phase 3 deliberately did not add confirmations because that phase was presentation-only. This Phase 8 request supersedes that scope decision for the three staff controls only. The two member controls remain unchanged; do not use this list to broaden Phase 8.

### Crisis-bar overlap

Historical mouse obstruction is documented in the Phase 3 report, line 12. The current source still has `AppShell`'s later-rendered `sticky bottom-0 z-50` 988 bar (`:390–410`) and the chart signing takeover's `fixed inset-0 z-50` (`ConsentFormsPanel.tsx:134–139`). This supports a stacking/clearance risk, not a newly verified pixel-level cause.

The read-only browser inspection reached the real demo chart but did not successfully open its signing takeover; **fresh obstruction reproduction is unverified**. Do not claim it fixed or reproduced. First 8a test must reproduce the reported state with a legitimate staff actor and an actual sent form, then verify completion by mouse—not force-click or keyboard alone. Keep crisis access available during signing; do not hide 988 just to clear the button.

### Text under 14px

Appendix C gives **every file and count** for the syntactic census. Standard scan: 2,676 occurrences / 315 files. Broader scan adds three `text-[0.8rem]` occurrences (`ui/calendar.tsx:79,85`, `ui/form.tsx:133`) and one print `text-[8px]` (`print.patient-records.$patientId.tsx:166`). Including the CSS selector occurrence in `styles.css`, the broad non-test census is **2,681 / 317 files**. These are source occurrences, not rendered elements: member CSS already raises several classes, and duplicated selectors/branches do not equal visible violations.

Seven additional explicit chart font-size declarations: `chart/LabsAndMeasures.tsx:294–295`; `clinical/RecordTabs.tsx:3320–3321,3465–3466,3475`. They belong to charts and are listed but deferred to Phase 9. Do not globally override charts, member previews, print or hidden facility views.

## 2. Proposed batches

### 8a-1 — Shell and staff density foundation

**Files:** new `components/StaffShell.tsx`; `AppShell.tsx`, `StaffNavSidebar.tsx`, `StaffBreadcrumbs.tsx`, `DemoControlsBar.tsx`, `StaffRoleSwitcher.tsx`, `DemoStateSwitcher.tsx`, `NotificationBell.tsx`, `StaffPatientSearch.tsx`, `styles.css`; existing three launchers and their existing buses as necessary for a single mounted launcher. Root `AGENTS.md` records ownership after approval.

- Staff-only `data-density="compact"`; body 16/24, heading 24/30, caption/table 14/20; 36px mouse controls and 48px touch. Density also reaches staff-owned portalled overlays, without changing member overlays.
- 56px surface header, 32px home-linked compact logo, permission-filtered Quick jump, neutral Acting as chip, existing bell/account, urgent open-crisis count only when permitted real rows exist. No language toggle or patient account identity substituted for the acting staff identity.
- Sidebar surface-sunk, width tokens preserving current 240/56 dimensions unless Mitch chooses others, 40px items, path-soft selection and 3px bar, collapsed accessible tooltips; phone sheet replaces strip. Requested group names/order retain registry gates.
- One shell New trigger from existing registry launchers; preserve chart patient context, ops pending actions and existing event handlers; remove duplicate floating triggers only after proving equivalent access.
- Neutral Simulated demo controls treatment, scoped to staff; public/member layout and copy unchanged.
- Floor via staff-scoped rules plus targeted class fixes, including portals. Do not use `body:not(.patient-theme)`; members are nested beneath body too. Do not edit StatusChip mappings or globally resize primitives.

**Risk: high** — shell classification, launcher duplicates, portals, collapsed hydration and member isolation. **Add tests:** every Appendix A staff path under correct density; 390/768/1280px mouse/touch and dark mode; computed sizes and contrast; keyboard Quick jump/sheet/tooltips; zero crisis rows versus permitted crisis count; registry action parity and exactly one audit on a real create action; stored member language unchanged; patient/advocate/public screenshots unchanged. Preserve existing nav RBAC suite.

### 8a-2 — Staff signing clearance and workspace entry

**Files:** `consent/ConsentFormsPanel.tsx`, `AppShell.tsx`/`StaffShell.tsx`, `clinician/WorkspaceDashboard.tsx`, `ops/OpsWorkspace.tsx`, `routes/my-work.tsx`; `agentic/PrototypeChrome.tsx` for measured sticky clearance. Use existing workspace projections; no new clinical/store logic.

- Reproduce the reported obstruction, then give the staff signing takeover its own safe viewport/layer and bottom clearance, with reachable 988 and unlock; no member-portal change.
- Staff workspaces start with Needs you, Waiting on others, then Today using existing ownership/dates. Where a read-only/configuration list has no turn owner, use its real views (All, Active, History), not fabricated Needs you counts.
- Urgent My work banner from existing open crisis rows, plus header count; no crisis toast. Leave dashboard StatTiles/charts untouched.

**Risk: medium/high** — signing hand-back privacy, crisis visibility, saved preferences. **Add tests:** actual form send/sign/complete/unlock by mouse at short desktop and 390px; button center hit-testing at maximum scroll; EN/ES signing, with staff chrome English; crisis access; no ownership/date or clinical-window changes.

### 8b-1 — DataTable foundation and care-work pilot

**Files:** new `ui/data-table.tsx` and focused helpers; reuse `ui/table`, `skeleton`, `pagination`, `EmptyState`, `StatusChip`; first adapters in `admin/CaseloadTable.tsx`, `routes/case-manager.tsx`, `eligibility-worklist.tsx`, `notes-queue.tsx`, `inbox/UnsignedNotesQueue.tsx`, `tasks/TaskQueueCard.tsx`.

Toolbar real view segments/counts, sortable aria-sort headers, 40px minimum single-line rows that may grow for readable wrapping, mono IDs, right/tabular numbers, existing chips, one quiet action + More, path-faint hover/path-soft selection/inset bar, skeleton/empty/no-match-clear states, pagination above 50 and bulk controls only when selected. Under 768px render equivalent stacked rows. Default viewer-owned then oldest authoritative date where those concepts exist. Do not add a bulk mutation without existing per-row permission checks and audit semantics.

Restricted cells retain existing authorized lock/reason masks. **Part 2 items currently hidden remain hidden, never newly emitted as placeholders.** DataTable receives already-authorized data; sort/search/export/counts must not retain restricted raw values.

**Risk: high** — hidden data, ownership order and selection. **Add tests:** role parity, hidden values absent from DOM/search/sort/export, identical records before/after adapters, sort and aria-sort, 51-row pagination, empty/reset/loading, responsive parity, selected-only bulk controls, unchanged action/audit behavior.

### 8b-2 — Queues, content, staff and credentialing

**Files:** remaining `inbox/*Queue`, `groups/GroupJoinRequestsQueue`, `documents/DocumentVerifyQueue`, `routes/worklist`, `escalations`, `message-queue`, `cosign-inbox`, `clinical-referrals`, `group-audit`; `admin/ContentInventoryTable`, `ContentAudit`, `ResourceVerificationQueue`, `routes/admin-staff`, `admin-credentialing`, `clinician-credentials`, `caseload-review`.

Migrate small domain groups independently with matching full records and existing status mappings. Keep bespoke clinical detail panels, timelines and conversations as panels; they do not become artificial spreadsheets. **Risk: medium/high. Tests:** each queue's existing action flow plus selection/filter/order/mobile; CMS author/publisher/Part 2 parity, backup revision preservation; staff lifecycle and credential follow-up; caseload markup validity. No generic table-in-card-in-card wrappers.

### 8b-3 — Billing and administrative/reference/audit lists

**Files:** `routes/billing`, `admin-claims`, `billing/RatesPanel`, `ManagedCarePlansPanel`; remaining active non-dashboard sites in Appendix B (`admin-audit`, `admin-documents-audit`, `consent-audit`, catalog/KPI/scheduling/supervision/vendor/permissions, county reporting, data exchange, readiness, quality compliance and team-calendar list). Treat `provider-reference` access as the separate 8a decision; dormant facility tables remain deferred.

Preserve claim `SegmentedFilter`, `sortClaimRows`, `nextSort` exports and pinned behavior; new default ordering must not redefine explicit user column sorts. Denied claims keep exactly their current appearance. Read-only matrices/logs use appropriate existing views rather than invented owner-relative states. **Risk: high for revenue, medium for reference lists. Tests:** claims helpers unchanged, billing/denial/write-off/reversal audit parity, disclosure/export/cohort-11 checks, >50 rows and filter reset. Phase 9 dashboard sections are not included.

### 8c-1 — FormField and ConfirmDialog foundation; content/calendar prompts

**Files:** new staff `form-field.tsx` without colliding with the existing react-hook-form `FormField` export; new `confirm-dialog.tsx` built on Radix AlertDialog; `ContentAdminWorkspace`, `ContentForm`, `ConsentFormLibrary`, `location-calendars`, `group-sessions`, `GroupEligibilityEditor`, `styles.css`. Preserve member/global primitives.

Labels above, 14px ink-muted help, radius-sm/1.5px line-strong input edges; touched-or-continue validation, attention CircleAlert with corrective words and aria-invalid. Staff focus-safe confirmation: action question, verified one-sentence consequence, required audited reason where applicable, Keep [thing] safe focus, teal verb button—not red. Reuse existing dialog steps; do not confirm twice. Publish and withdraw require a reason saved through the existing audit path; legal form publishing may need a narrowly approved reason argument/audit extension. No new clinical/legal promises in consequence copy.

**Risk: medium/high** — synchronous prompt replacement becomes asynchronous; unsaved navigation must resume only after confirmation. **Tests:** untouched/blur/continue validation, keyboard safe focus/cancel, no mutation/audit on cancel, one on confirm, exact stored reason and existing minimum lengths, publishing gates/Spanish requirements unchanged.

### 8c-2 — Remaining prompts, staff confirmations and clinical/admin forms

**Files:** every remaining call site in the native-dialog table; `clinician.tsx` with `lib/drawer-drafts.ts`; staff `ClinicalRecordTabs`, `OrdersTab`, `NoteRevisionPanel`, `OrderSafetyPanel`; admin configuration/lifecycle forms and other staff form hosts in Appendix E, in domain-sized sub-batches.

Replace goal-met confirm with a proper binary field; optional verification reference remains optional. Shared `PatientBalance`/advocate designation host branches require explicit staff scoping—do not force a member restyle. Three staff unconfirmed actions get confirmation or a proven equivalent undo; obligation/toolkit removals remain out of scope. Prefer undo only when an existing reversal really restores the record; never manufacture one.

**Risk: high** — clinical safety, signing, cross-host components and drawer navigation. **Tests:** each replaced dialog through real UI; required reason persistence and one registry audit, cancel-safe focus, unsaved stay/discard navigation, refill denial/CURES safety, AI sentence deletion, catalog guard, note amendment/void; MOUD/task-claim/order-resume exceptions unchanged. No window.prompt/confirm/alert remaining on migrated staff branches; document any member-only exception rather than changing it silently.

## 3. Exact existing test-line approvals requested

No tests changed or executed in this plan-only turn. Three source-string assertions encode the old staff dropdown, which the proposed StaffShell replaces. Keep current AppShell member/public classification statements, bell branch and WebsiteLayout return spelling so their other source assertions remain valid.

| File:line | Proposed replacement |
|---|---|
| `src/components/__tests__/userNavigationShell.test.ts:19` | `expect(shell).toContain(") : showStaffShell ? (");` |
| `src/components/__tests__/userNavigationShell.test.ts:20` | `expect(shell).toContain("<StaffShell>");` |
| `src/components/__tests__/publicReferralShell.test.ts:18` | `expect(appShell).toContain(") : showStaffShell ? (");` |

These retain the staff-only branch check; add new rendered boundary tests rather than relying on strings alone. No other existing assertion replacement is currently justified. Preserve `claimsWorklistUi.test.tsx:38–89`, `caseloadReviewMarkup.test.ts`, member navigation tests and all permission/action snapshots.

**Existing flow needing new steps, not weaker assertions:** legal Publish in `e2e/consentWorkflow.spec.ts:104` is currently one direct click. If 8c adds its mandated reason/confirmation, propose replacing that line with:

```ts
await row.getByRole("button", { name: "Publish", exact: true }).click();
const publishDialog = page.getByRole("alertdialog", { name: "Publish this consent form?" });
await publishDialog.getByRole("textbox", { name: "Reason (saved to the audit log)", exact: true }).fill("Reviewed consent version for publication — Draft");
await publishDialog.getByRole("button", { name: "Publish", exact: true }).click();
```

Mitch must approve these lines and the associated consent-publication reason support separately. Existing assertions at :105 and :108 stay unchanged. Add completion/clearance assertions to the current tablet scenario at :126–136 without changing its selectors, expectations, retries or timeout. Preserve content-change reason labels already used by `staffContent.spec.ts:26` while adding the audit explanation as connected help.

**Build stop rule:** if any other existing assertion fails, stop and report file:line, current assertion and proposed exact line before editing it. No deleted/skipped tests, retry/threshold changes or blanket snapshots. Each batch gets focused tests and complete units/browser specs including axe; quote vitest-list total next to pass count. Harness checks builds; no manually requested production build in this plan.

## 4. What differs / what waits

- Prefer smaller 8a-1/8a-2 and 8b-1/2/3 rollouts over a sweeping shell/table/form rewrite.
- Fixed 40px rows mean a minimum for short rows, not clipping at 40px. Touch controls stay 48px.
- No fake Needs you on audit/config/reference lists, fake loading state on synchronous reads, fake waiting ages, fabricated saved views, or bulk actions bypassing registry/audits.
- Do not hide 988 to solve signing overlap; reproduce then reserve safe space and layering.
- Keep Part 2 hiding stronger than the general masked-cell design request.
- Leave member-only obligation/toolkit confirmations, `/consent` shell reclassification, public entry changes and printed chrome out pending explicit scope approval.
- Dormant facility/custody/MAR/refusal/pre-release content remains disabled and gets its own later batch; do not enable it for this migration.
- All dashboard StatTiles/charts, their palettes and seven small chart-font declarations wait for Phase 9. Denied-claim appearance waits for billing's decision.
- Inventory appendices are intentionally broad source checklists. Distinct semantic list/form counts beyond the exact table census remain unconfirmed; do not present candidate-file counts as finished component counts. Before 8b/8c approval, validate the chosen domain's checklist against its rendered staff branch and provide its exact adapter/form count.


## Appendix A — Route-to-shell matrix

Paths map to `src/routes` filenames; all staff rows use AppShell → StaffNavSidebar + StaffBreadcrumbs, with English override. Facility rows remain flag-gated.

| Route | Route file | Shell today |
|---|---|---|
| `/admin-audit` | `admin-audit.tsx` | Staff AppShell |
| `/admin-catalog-governance` | `admin-catalog-governance.tsx` | Staff AppShell |
| `/admin-claims` | `admin-claims.tsx` | Staff AppShell |
| `/admin-content` | `admin-content.tsx` | Staff AppShell |
| `/admin-coordination` | `admin-coordination.tsx` | Staff AppShell |
| `/admin-credentialing` | `admin-credentialing.tsx` | Staff AppShell |
| `/admin-documents-audit` | `admin-documents-audit.tsx` | Staff AppShell |
| `/admin-facilities` | `admin-facilities.tsx` | Staff AppShell |
| `/admin-kpi-targets` | `admin-kpi-targets.tsx` | Staff AppShell |
| `/admin-note-templates` | `admin-note-templates.tsx` | Staff AppShell |
| `/admin-permissions` | `admin-permissions.tsx` | Staff AppShell |
| `/admin-scheduling-rules` | `admin-scheduling-rules.tsx` | Staff AppShell |
| `/admin-staff` | `admin-staff.tsx` | Staff AppShell |
| `/admin-supervision` | `admin-supervision.tsx` | Staff AppShell |
| `/admin-vendors` | `admin-vendors.tsx` | Staff AppShell |
| `/admin` | `admin.tsx` | Staff AppShell |
| `/agentic/chart-review/$patientId` | `agentic.chart-review.$patientId.tsx` | Staff AppShell |
| `/agentic/dictation/$patientId` | `agentic.dictation.$patientId.tsx` | Staff AppShell |
| `/agentic/` | `agentic.index.tsx` | Staff AppShell |
| `/agentic/scribe/$patientId` | `agentic.scribe.$patientId.tsx` | Staff AppShell |
| `/assisted-signup` | `assisted-signup.tsx` | WebsiteLayout + registered access guard |
| `/billing-calaim-codes` | `billing-calaim-codes.tsx` | Staff AppShell |
| `/billing` | `billing.tsx` | Staff AppShell |
| `/care-partners` | `care-partners.tsx` | Staff AppShell |
| `/case-manager` | `case-manager.tsx` | Staff AppShell |
| `/caseload-review` | `caseload-review.tsx` | Staff AppShell |
| `/clinical-referrals` | `clinical-referrals.tsx` | Staff AppShell |
| `/clinician-credentials` | `clinician-credentials.tsx` | Staff AppShell |
| `/clinician-profile` | `clinician-profile.tsx` | Staff AppShell |
| `/clinician` | `clinician.tsx` | Staff AppShell |
| `/consent-audit` | `consent-audit.tsx` | Staff AppShell |
| `/consent` | `consent.tsx` | Member-classified AppShell (staff ledger content) |
| `/content-library` | `content-library.tsx` | Staff AppShell |
| `/cosign-inbox` | `cosign-inbox.tsx` | Staff AppShell |
| `/county-reporting` | `county-reporting.tsx` | Staff AppShell |
| `/coverage-release` | `coverage-release.tsx` | Staff AppShell |
| `/crisis-queue` | `crisis-queue.tsx` | Staff AppShell |
| `/dashboards` | `dashboards.tsx` | Staff AppShell |
| `/data-exchange` | `data-exchange.tsx` | Staff AppShell |
| `/dmc-ods-readiness` | `dmc-ods-readiness.tsx` | Staff AppShell |
| `/eligibility-worklist` | `eligibility-worklist.tsx` | Staff AppShell |
| `/escalations` | `escalations.tsx` | Staff AppShell |
| `/group-audit` | `group-audit.tsx` | Staff AppShell |
| `/group-sessions` | `group-sessions.tsx` | Staff AppShell |
| `/inbox` | `inbox.tsx` | Staff AppShell |
| `/location-calendars` | `location-calendars.tsx` | Staff AppShell |
| `/message-queue` | `message-queue.tsx` | Staff AppShell |
| `/my-calendar` | `my-calendar.tsx` | Staff AppShell |
| `/my-work` | `my-work.tsx` | Staff AppShell |
| `/notes-queue` | `notes-queue.tsx` | Staff AppShell |
| `/nurse` | `nurse.tsx` | Staff AppShell |
| `/pre-release-import` | `pre-release-import.tsx` | Staff AppShell |
| `/pre-release` | `pre-release.tsx` | Staff AppShell |
| `/print/patient-records/$patientId` | `print.patient-records.$patientId.tsx` | Generic AppShell + leaf print rendering |
| `/provider-reference` | `provider-reference.tsx` | Generic AppShell; not staff-classified |
| `/quality-compliance` | `quality-compliance.tsx` | Staff AppShell |
| `/record/$patientId` | `record.$patientId.tsx` | Staff AppShell |
| `/referral-queue` | `referral-queue.tsx` | Staff AppShell |
| `/refusal-queue` | `refusal-queue.tsx` | Staff AppShell |
| `/released-search` | `released-search.tsx` | Staff AppShell |
| `/reporting` | `reporting.tsx` | Staff AppShell |
| `/shift-count` | `shift-count.tsx` | Staff AppShell |
| `/team-calendar` | `team-calendar.tsx` | Staff AppShell |
| `/team-messages` | `team-messages.tsx` | Staff AppShell |
| `/worklist` | `worklist.tsx` | Staff AppShell |

## Appendix B — Every native/composed table render site

47 files / 58 sites. `components/dashboards/*` waits for Phase 9; facility/custody/MAR/protocol/import/shift tables remain dormant; `/consent` and print are excluded exceptions.

| File (under src) | Sites | Source lines |
|---|---|---|
| `components/CaseloadUploadDialog.tsx` | 1 | 332 |
| `components/admin/CalaimCodesSection.tsx` | 1 | 103 |
| `components/admin/CaseloadTable.tsx` | 1 | 210 |
| `components/admin/ContentAudit.tsx` | 1 | 18 |
| `components/admin/ContentInventoryTable.tsx` | 1 | 53 |
| `components/billing/RatesPanel.tsx` | 1 | 166 |
| `components/clinical/CustodyTabs.tsx` | 2 | 148, 313 |
| `components/clinical/ProtocolsTab.tsx` | 1 | 221 |
| `components/clinical/RecordTabs.tsx` | 1 | 3332 |
| `components/coverage/CoverageAtReleasePanel.tsx` | 1 | 56 |
| `components/dashboards/DrillDownDialog.tsx` | 1 | 103 |
| `components/dashboards/EngagementSection.tsx` | 1 | 99 |
| `components/dashboards/FacilityCustodySection.tsx` | 1 | 64 |
| `components/identity/PatientMatchingQueue.tsx` | 2 | 67, 128 |
| `components/reporting/PopulationHealthSection.tsx` | 1 | 35 |
| `components/reporting/TimelyAccessReport.tsx` | 1 | 40 |
| `routes/admin-audit.tsx` | 1 | 271 |
| `routes/admin-catalog-governance.tsx` | 2 | 196, 338 |
| `routes/admin-claims.tsx` | 2 | 368, 401 |
| `routes/admin-credentialing.tsx` | 2 | 558, 660 |
| `routes/admin-documents-audit.tsx` | 1 | 172 |
| `routes/admin-facilities.tsx` | 1 | 191 |
| `routes/admin-kpi-targets.tsx` | 1 | 275 |
| `routes/admin-permissions.tsx` | 2 | 112, 197 |
| `routes/admin-scheduling-rules.tsx` | 1 | 233 |
| `routes/admin-staff.tsx` | 1 | 66 |
| `routes/admin-supervision.tsx` | 1 | 141 |
| `routes/admin-vendors.tsx` | 1 | 147 |
| `routes/admin.tsx` | 1 | 324 |
| `routes/billing.tsx` | 3 | 413, 512, 553 |
| `routes/case-manager.tsx` | 1 | 387 |
| `routes/caseload-review.tsx` | 1 | 230 |
| `routes/consent-audit.tsx` | 1 | 166 |
| `routes/consent.tsx` | 1 | 212 |
| `routes/county-reporting.tsx` | 2 | 165, 184 |
| `routes/data-exchange.tsx` | 2 | 74, 181 |
| `routes/dmc-ods-readiness.tsx` | 1 | 115 |
| `routes/eligibility-worklist.tsx` | 1 | 201 |
| `routes/group-audit.tsx` | 1 | 193 |
| `routes/pre-release-import.tsx` | 1 | 270 |
| `routes/print.patient-records.$patientId.tsx` | 1 | 215 |
| `routes/quality-compliance.tsx` | 1 | 67 |
| `routes/released-search.tsx` | 2 | 187, 247 |
| `routes/reporting.tsx` | 1 | 807 |
| `routes/shift-count.tsx` | 1 | 244 |
| `routes/team-calendar.tsx` | 1 | 57 |
| `routes/worklist.tsx` | 1 | 351 |

## Appendix C — Sub-14px source counts per file

Broad source census, not computed/rendered violations. Includes shared/member/public/print and deferred charts so omissions are visible; only staff hosts/overlays may change in Phase 8. Numbers count utility occurrences. CSS selector occurrences and source branches are not separate visible elements. Atkinson chart-font declarations are listed separately above.

| File (under src) | Occurrences |
|---|---|
| `components/AdvocateSidebar.tsx` | 1 |
| `components/AppShell.tsx` | 16 |
| `components/AskAdelPanel.tsx` | 13 |
| `components/AssignClinicianButton.tsx` | 5 |
| `components/CarePlanCard.tsx` | 41 |
| `components/CaseloadUploadDialog.tsx` | 4 |
| `components/ClientRecordDrawer.tsx` | 2 |
| `components/CrisisNotice.tsx` | 1 |
| `components/DemoControlsBar.tsx` | 1 |
| `components/DemoStateSwitcher.tsx` | 6 |
| `components/GatedCard.tsx` | 1 |
| `components/Landing.tsx` | 1 |
| `components/MobileNav.tsx` | 2 |
| `components/NotificationBell.tsx` | 7 |
| `components/PatientGroupScheduling.tsx` | 8 |
| `components/PatientHelpLink.tsx` | 1 |
| `components/PatientHome.tsx` | 27 |
| `components/PatientProfileDialog.tsx` | 4 |
| `components/PostEnrollmentSetupCard.tsx` | 5 |
| `components/ProvenanceBadge.tsx` | 1 |
| `components/ReferralProgressStrip.tsx` | 6 |
| `components/ReferralStatusTimeline.tsx` | 9 |
| `components/ReferralTimelineDrawer.tsx` | 26 |
| `components/ReleaseDateProvenance.tsx` | 1 |
| `components/StaffBreadcrumbs.tsx` | 4 |
| `components/StaffNavSidebar.tsx` | 3 |
| `components/StaffPatientSearch.tsx` | 3 |
| `components/StaffRoleSwitcher.tsx` | 3 |
| `components/TimePicker.tsx` | 1 |
| `components/UserNavigationDrawer.tsx` | 1 |
| `components/admin/CalaimCodesSection.tsx` | 7 |
| `components/admin/CaseloadTable.tsx` | 14 |
| `components/admin/CatalogResolutionMetricsCard.tsx` | 8 |
| `components/admin/ClinicalContentReviewCard.tsx` | 4 |
| `components/admin/ConsentFormLibrary.tsx` | 4 |
| `components/admin/ContentAdminWorkspace.tsx` | 48 |
| `components/admin/ContentAudit.tsx` | 1 |
| `components/admin/ContentBrowse.tsx` | 1 |
| `components/admin/ContentForm.tsx` | 13 |
| `components/admin/ContentPreview.tsx` | 3 |
| `components/admin/ReferralTrackerCard.tsx` | 15 |
| `components/admin/ResourceVerificationQueue.tsx` | 7 |
| `components/admin/RiskTextReviewPanel.tsx` | 8 |
| `components/admin/SafetyReference.tsx` | 3 |
| `components/admin/StructuredPracticeEditor.tsx` | 5 |
| `components/advocate/AdvocateAppointmentsPanel.tsx` | 10 |
| `components/advocate/AdvocateDesignationPanel.tsx` | 5 |
| `components/advocate/AdvocateDocumentChecklist.tsx` | 5 |
| `components/advocate/AdvocateIdentityBanner.tsx` | 1 |
| `components/advocate/AdvocateInviteForm.tsx` | 2 |
| `components/advocate/AdvocateMessagesPanel.tsx` | 2 |
| `components/advocate/AdvocateNextStepsPanel.tsx` | 6 |
| `components/advocate/AdvocatePoAwarenessPanel.tsx` | 2 |
| `components/advocate/AdvocateSection.tsx` | 4 |
| `components/advocate/AdvocateStatusList.tsx` | 2 |
| `components/advocate/AdvocateViewParts.tsx` | 1 |
| `components/advocate/AdvocateWorkspace.tsx` | 15 |
| `components/advocate/AhcdValidationChecklist.tsx` | 8 |
| `components/advocate/StaffAdvocatesTab.tsx` | 5 |
| `components/afbi/AfbiContactForm.tsx` | 7 |
| `components/agentic/NotePeekSheet.tsx` | 2 |
| `components/agentic/PrototypeChrome.tsx` | 5 |
| `components/billing/BillingStatusSummary.tsx` | 3 |
| `components/billing/ClaimSignatureLine.tsx` | 2 |
| `components/billing/ManagedCarePlansPanel.tsx` | 4 |
| `components/billing/PatientBalance.tsx` | 3 |
| `components/billing/PaymentArrangementCard.tsx` | 4 |
| `components/billing/RatesPanel.tsx` | 25 |
| `components/calendar/CalendarSyncCard.tsx` | 1 |
| `components/carePartners/CarePartnersSection.tsx` | 3 |
| `components/careplan/AsamSuggestions.tsx` | 15 |
| `components/careplan/CarePlanEditor.tsx` | 25 |
| `components/careplan/MyPlan.tsx` | 3 |
| `components/chart/AdelBriefSections.tsx` | 13 |
| `components/chart/AdelDrafts.tsx` | 15 |
| `components/chart/BriefTab.tsx` | 17 |
| `components/chart/ChartActionLauncher.tsx` | 11 |
| `components/chart/ChartDocumentsList.tsx` | 4 |
| `components/chart/ChartExtraSections.tsx` | 8 |
| `components/chart/ChartHeader.tsx` | 11 |
| `components/chart/ChartTabView.tsx` | 3 |
| `components/chart/CoverageExtras.tsx` | 7 |
| `components/chart/DrawerForms.tsx` | 1 |
| `components/chart/LabsAndMeasures.tsx` | 12 |
| `components/chart/RestrictedChartGate.tsx` | 1 |
| `components/chart/SeverityFlagsPanel.tsx` | 2 |
| `components/chart/TimelyAccessLine.tsx` | 4 |
| `components/clinical/AsamPanel.tsx` | 17 |
| `components/clinical/AsamTaskWorkItem.tsx` | 3 |
| `components/clinical/AutomationTrace.tsx` | 3 |
| `components/clinical/CalomsProfileCard.tsx` | 16 |
| `components/clinical/CareEpisodesPanel.tsx` | 18 |
| `components/clinical/ClinicalRecordTabs.tsx` | 23 |
| `components/clinical/CrisisPanel.tsx` | 15 |
| `components/clinical/CustodyTabs.tsx` | 11 |
| `components/clinical/DemographicsCard.tsx` | 5 |
| `components/clinical/DiagnosisPicker.tsx` | 8 |
| `components/clinical/FacilityCombobox.tsx` | 4 |
| `components/clinical/FacilityContactCell.tsx` | 6 |
| `components/clinical/GroupEligibilityEditor.tsx` | 5 |
| `components/clinical/IssueSignInCodeButton.tsx` | 1 |
| `components/clinical/MarTab.tsx` | 27 |
| `components/clinical/MedCheckInCard.tsx` | 13 |
| `components/clinical/MedReconTab.tsx` | 25 |
| `components/clinical/NoteAutofillCard.tsx` | 4 |
| `components/clinical/NoteOrdersSection.tsx` | 12 |
| `components/clinical/NoteRevisionPanel.tsx` | 2 |
| `components/clinical/NoteTemplatePicker.tsx` | 7 |
| `components/clinical/OrderSafetyPanel.tsx` | 8 |
| `components/clinical/OrdersTab.tsx` | 35 |
| `components/clinical/PathwayChip.tsx` | 1 |
| `components/clinical/ProtocolsTab.tsx` | 12 |
| `components/clinical/QuickCheckCard.tsx` | 9 |
| `components/clinical/RecordSafetyBadges.tsx` | 8 |
| `components/clinical/RecordTabs.tsx` | 140 |
| `components/clinical/ReentryHandoffTab.tsx` | 9 |
| `components/clinical/ReferForNeedDialog.tsx` | 6 |
| `components/clinical/RefillCuresStep.tsx` | 4 |
| `components/clinical/SafetyPlanPanel.tsx` | 11 |
| `components/clinical/SdohActivityLog.tsx` | 25 |
| `components/clinical/StaffContactsEditor.tsx` | 5 |
| `components/clinical/SupervisionBanner.tsx` | 1 |
| `components/clinical/TemplateForm.tsx` | 8 |
| `components/clinical/refusal/NurseRefusalWorklist.tsx` | 2 |
| `components/clinical/refusal/RefusalEscalationDialog.tsx` | 4 |
| `components/clinical/refusal/RefusalFormDialog.tsx` | 12 |
| `components/clinical/refusal/RefusalRiskTextRecord.tsx` | 5 |
| `components/clinical/refusal/SignaturePad.tsx` | 6 |
| `components/clinician/DashboardActionLauncher.tsx` | 7 |
| `components/clinician/WorkspaceDashboard.tsx` | 10 |
| `components/consent/AdvocateConsentStatus.tsx` | 1 |
| `components/consent/ConsentFormsPanel.tsx` | 14 |
| `components/consent/ConsentRecordsPanel.tsx` | 9 |
| `components/consent/FormsToSign.tsx` | 3 |
| `components/consent/PatientConsentStatusCard.tsx` | 7 |
| `components/consent/PoDisclosureCard.tsx` | 9 |
| `components/coverage/CalaimEligibilityComparison.tsx` | 2 |
| `components/coverage/CoverageAtReleasePanel.tsx` | 2 |
| `components/coverage/CoverageCheckDialog.tsx` | 3 |
| `components/coverage/CoveragePlansCard.tsx` | 16 |
| `components/coverage/EligibilityHistoryCard.tsx` | 4 |
| `components/coverage/VerificationSourceBadge.tsx` | 1 |
| `components/dashboards/CalAimSection.tsx` | 6 |
| `components/dashboards/EngagementSection.tsx` | 8 |
| `components/dashboards/FacilityCustodySection.tsx` | 4 |
| `components/dashboards/GroupUtilizationSection.tsx` | 12 |
| `components/dashboards/KpiVsTargetSection.tsx` | 6 |
| `components/dashboards/PeriodSelector.tsx` | 2 |
| `components/documents/DocumentUploadForm.tsx` | 3 |
| `components/documents/DocumentVerifyQueue.tsx` | 3 |
| `components/documents/PatientDocumentsCard.tsx` | 2 |
| `components/escalations/CrisisQueueDetails.tsx` | 6 |
| `components/frontdoor/QuestionCard.tsx` | 2 |
| `components/frontdoor/SignupFlow.tsx` | 10 |
| `components/groups/GroupJoinRequestsQueue.tsx` | 6 |
| `components/hie/OutsideRecords.tsx` | 21 |
| `components/identity/PatientMatchingQueue.tsx` | 13 |
| `components/inbox/AdvocateReviewQueue.tsx` | 7 |
| `components/inbox/CommunityInquiryQueue.tsx` | 4 |
| `components/inbox/InboxActionQueue.tsx` | 5 |
| `components/inbox/ProviderRequestQueue.tsx` | 4 |
| `components/inbox/UnsignedNotesQueue.tsx` | 4 |
| `components/inbox/VoidRequestQueue.tsx` | 4 |
| `components/intake/AdelGuidedIntake.tsx` | 3 |
| `components/intake/BenefitsStep.tsx` | 6 |
| `components/intake/ReportedBenefitsCard.tsx` | 2 |
| `components/library/ExercisePlayer.tsx` | 2 |
| `components/library/LibraryBrowser.tsx` | 10 |
| `components/library/ModuleTemplate.tsx` | 27 |
| `components/messages/CareMessageThread.tsx` | 4 |
| `components/messages/StaffMessagesTab.tsx` | 2 |
| `components/nursing/NursingSection.tsx` | 3 |
| `components/ops/OpsActionLauncher.tsx` | 8 |
| `components/ops/OpsWorkspace.tsx` | 11 |
| `components/orders/CatalogPicker.tsx` | 6 |
| `components/orders/MedicationDoseSection.tsx` | 21 |
| `components/patient/AdelChat.tsx` | 4 |
| `components/patient/AdelHistoryPanel.tsx` | 4 |
| `components/patient/AppointmentsSummary.tsx` | 6 |
| `components/patient/ApptRequestStates.tsx` | 1 |
| `components/patient/AskAdelHelp.tsx` | 2 |
| `components/patient/DailyCheckInSummaryCard.tsx` | 1 |
| `components/patient/GetHelpNowModal.tsx` | 1 |
| `components/patient/HomeDashboard.tsx` | 11 |
| `components/patient/MyCareTiles.tsx` | 7 |
| `components/patient/MyMedicationsCard.tsx` | 11 |
| `components/patient/NeedConnect.tsx` | 3 |
| `components/patient/NeedThreadList.tsx` | 5 |
| `components/patient/NotifyCareTeamCard.tsx` | 2 |
| `components/patient/PatientPage.tsx` | 1 |
| `components/patient/PostIntakeResources.tsx` | 1 |
| `components/patient/ProfilePanels.tsx` | 8 |
| `components/patient/RecoveryDateCard.tsx` | 3 |
| `components/patient/RefillRunwayCard.tsx` | 4 |
| `components/patient/SafetyPlanSummaryTile.tsx` | 1 |
| `components/patient/SharedWithCard.tsx` | 1 |
| `components/patient/SlipSupportFlow.tsx` | 1 |
| `components/patient/ToolkitPage.tsx` | 6 |
| `components/patient/WeeklyRecap.tsx` | 4 |
| `components/prerelease/CapacityAuthorityStep.tsx` | 9 |
| `components/prerelease/MatOrderCard.tsx` | 5 |
| `components/prerelease/PreReleaseAppointmentCard.tsx` | 8 |
| `components/prerelease/PreReleaseScreenerDialog.tsx` | 3 |
| `components/prerelease/PreReleaseTimelineCard.tsx` | 5 |
| `components/reassessment/RescreenForm.tsx` | 1 |
| `components/recovery/GuidedToolFlow.tsx` | 5 |
| `components/recovery/RecoveryCheckInNote.tsx` | 2 |
| `components/recovery/RecoveryLessonView.tsx` | 3 |
| `components/recovery/RecoveryModuleBrowser.tsx` | 6 |
| `components/recovery/RecoveryStagePanel.tsx` | 9 |
| `components/reentry/CommunityResourceCenter.tsx` | 2 |
| `components/reentry/ObligationsCard.tsx` | 5 |
| `components/reentry/ReentryDayZeroModule.tsx` | 6 |
| `components/reentry/ResourceCard.tsx` | 4 |
| `components/reentry/ResourceDetail.tsx` | 3 |
| `components/referral/ReferralChasePanel.tsx` | 2 |
| `components/referral/ReferralSubmissionForm.tsx` | 5 |
| `components/reporting/PopulationHealthSection.tsx` | 24 |
| `components/reporting/TimelyAccessReport.tsx` | 6 |
| `components/scheduling/AppointmentRequestsCard.tsx` | 4 |
| `components/scheduling/BookVisitDrawer.tsx` | 5 |
| `components/scheduling/SchedulingTile.tsx` | 2 |
| `components/scheduling/VisitActions.tsx` | 10 |
| `components/screeners/CssrsForm.tsx` | 2 |
| `components/screeners/ScreenerItems.tsx` | 1 |
| `components/scribe/AiConsentCard.tsx` | 5 |
| `components/scribe/ScribeWorkspace.tsx` | 28 |
| `components/signature/AttestationSignatureBlock.tsx` | 2 |
| `components/signature/SignBlockerList.tsx` | 1 |
| `components/tasks/PatientOpenItemsCard.tsx` | 3 |
| `components/tasks/TaskQueueCard.tsx` | 3 |
| `components/tasks/TaskWorkRow.tsx` | 22 |
| `components/team/TeamThreads.tsx` | 13 |
| `components/ui/badge.tsx` | 1 |
| `components/ui/button.tsx` | 1 |
| `components/ui/calendar.tsx` | 3 |
| `components/ui/chart.tsx` | 2 |
| `components/ui/command.tsx` | 2 |
| `components/ui/context-menu.tsx` | 1 |
| `components/ui/dropdown-menu.tsx` | 1 |
| `components/ui/form.tsx` | 1 |
| `components/ui/menubar.tsx` | 1 |
| `components/ui/sidebar.tsx` | 4 |
| `components/ui/tooltip.tsx` | 1 |
| `components/voice/AdelVoice.tsx` | 9 |
| `components/voice/VoiceGuardrailNotice.tsx` | 1 |
| `routes/__root.tsx` | 1 |
| `routes/admin-audit.tsx` | 13 |
| `routes/admin-catalog-governance.tsx` | 21 |
| `routes/admin-claims.tsx` | 18 |
| `routes/admin-coordination.tsx` | 8 |
| `routes/admin-credentialing.tsx` | 22 |
| `routes/admin-documents-audit.tsx` | 10 |
| `routes/admin-facilities.tsx` | 10 |
| `routes/admin-kpi-targets.tsx` | 13 |
| `routes/admin-note-templates.tsx` | 72 |
| `routes/admin-permissions.tsx` | 17 |
| `routes/admin-scheduling-rules.tsx` | 13 |
| `routes/admin-staff.tsx` | 3 |
| `routes/admin-supervision.tsx` | 4 |
| `routes/admin-vendors.tsx` | 18 |
| `routes/admin.tsx` | 55 |
| `routes/advocate.documents.tsx` | 1 |
| `routes/advocate.index.tsx` | 1 |
| `routes/advocate.my-documents.tsx` | 1 |
| `routes/advocate.my-profile.tsx` | 3 |
| `routes/advocate.tsx` | 3 |
| `routes/agentic.chart-review.$patientId.tsx` | 7 |
| `routes/agentic.index.tsx` | 1 |
| `routes/agentic.scribe.$patientId.tsx` | 2 |
| `routes/auth.tsx` | 14 |
| `routes/billing-calaim-codes.tsx` | 1 |
| `routes/billing.tsx` | 41 |
| `routes/care-partners.tsx` | 1 |
| `routes/case-manager.tsx` | 33 |
| `routes/caseload-review.tsx` | 2 |
| `routes/clinical-referrals.tsx` | 2 |
| `routes/clinician-credentials.tsx` | 9 |
| `routes/clinician-profile.tsx` | 4 |
| `routes/clinician.tsx` | 38 |
| `routes/consent-audit.tsx` | 15 |
| `routes/consent.tsx` | 14 |
| `routes/cosign-inbox.tsx` | 23 |
| `routes/county-reporting.tsx` | 16 |
| `routes/dashboards.tsx` | 2 |
| `routes/data-exchange.tsx` | 8 |
| `routes/disclosure-log.tsx` | 3 |
| `routes/dmc-ods-readiness.tsx` | 8 |
| `routes/eligibility-worklist.tsx` | 12 |
| `routes/escalations.tsx` | 4 |
| `routes/group-audit.tsx` | 14 |
| `routes/group-sessions.tsx` | 67 |
| `routes/inbox.tsx` | 1 |
| `routes/intake.tsx` | 28 |
| `routes/location-calendars.tsx` | 2 |
| `routes/message-queue.tsx` | 3 |
| `routes/my-calendar.tsx` | 7 |
| `routes/my-work.tsx` | 32 |
| `routes/naloxone.tsx` | 3 |
| `routes/notes-queue.tsx` | 4 |
| `routes/nurse.tsx` | 3 |
| `routes/pre-release-import.tsx` | 4 |
| `routes/pre-release.tsx` | 13 |
| `routes/print.patient-records.$patientId.tsx` | 18 |
| `routes/profile.tsx` | 2 |
| `routes/provider-reference.tsx` | 13 |
| `routes/quality-compliance.tsx` | 3 |
| `routes/record.$patientId.tsx` | 2 |
| `routes/refusal-queue.tsx` | 1 |
| `routes/released-search.tsx` | 8 |
| `routes/reporting.tsx` | 38 |
| `routes/schedule.tsx` | 13 |
| `routes/shift-count.tsx` | 10 |
| `routes/start.other-help.tsx` | 2 |
| `routes/team-calendar.tsx` | 1 |
| `routes/worklist.tsx` | 6 |
| `styles.css` | 1 |

