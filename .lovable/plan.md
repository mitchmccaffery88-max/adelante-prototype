# Phase 8 — Batch 8a-2

**Plan only. No application or test changes until Mitch approves.**

## Scope, rollback and gates

Planning rollback point: **`e231f0dd8e26acd460acee64ee0f1535480d687c`** (verified with `git rev-parse HEAD`). Reconfirm HEAD before the first approved application edit; report any managed-history advance, never reset the working branch.

Only the six requested items. No 8c-2 pop-up replacements, table migration, Phase 9 dashboard restyle, new clinical rules, integrations or permission/status changes. Follow the Adelante tokens, Atkinson fonts, compact density, 14px floor and safety-only urgent color. Member signing retains comfortable density and EN/ES; controlled legal/clinical copy and Draft labels remain unchanged.

**Evidence gates:** consent overlap and homepage missed taps are unconfirmed runtime defects. Capture reproducible evidence before their layout/interaction fixes. If either does not reproduce, document that result and leave that layout/behavior unchanged. Consent-shell migration has a separate member-access prerequisite below.

## A. Work by item

### 1. Consent signing overlap — regression test FIRST

**Files:** new `e2e/consentSigningClearance8a2.spec.ts`; conditional application changes in `src/components/consent/ConsentFormsPanel.tsx`, `FormsToSign.tsx`, and `src/components/AppShell.tsx` / `src/styles.css` only if measurements identify those hosts as responsible.

**Evidence first:** before any application edit in this batch, write and run the new browser regression at widths **390, 768 and 1280**, with explicit representative heights (844, 1024 and 900). Use the existing UI and real store functions to create/enroll a synthetic patient, send Telehealth from the chart, enter Sign in person, sign through the actual controls, and read back the signed version/status. Do not inject a signed-looking DOM or mutate signature records directly. Also inspect the self-service signing host on `/patient`.

Measure `forms-sign` before signing and **“I'm done” after a real successful signature**, at intermediate scroll positions and the maximum scroll of the signing container. Record bounding boxes, scroll limits, all actually mounted bottom fixed/sticky layers and `elementFromPoint` at the center and inset corners. Use ordinary pointer clicks (no force) and verify the resulting locked state and signed-copy readback. Save baseline screenshots and failure evidence before layout changes; the test asserts unobscured usable controls, so a reproduced bug fails at baseline.

**Confirmed source, not runtime diagnosis:** in-person mode is `fixed inset-0 z-50 overflow-y-auto p-4` (`ConsentFormsPanel.tsx:135`), with the completion button at :139. Staff crisis support is `sticky bottom-0 z-50` (`AppShell.tsx:390–398`). `MobileNav` exists but is not mounted by AppShell (explicitly covered by `patientNavShellParity.test.tsx:23`); do not assume it causes the overlap.

**Conditional fix:** provide clearance on the actual scrolling host, including safe-area and the measured bottom layer height; adjust stacking only if needed to keep both signing controls and crisis support usable. Do not hide 988, move safety behind the full-screen overlay, change signing/locking behavior, or use an arbitrary large spacer. If only some widths fail, fix that mechanism and rerun all three. If none fail, retain the passing coverage and make no consent-layout change.

### 2. Staff workspace order and persistent My work crisis banner

**Files:** `src/routes/my-work.tsx`, `src/components/clinician/WorkspaceDashboard.tsx`, `src/routes/clinician.tsx`, `src/routes/case-manager.tsx`, `src/routes/admin-coordination.tsx`, `src/routes/nurse.tsx`; `src/components/ops/OpsWorkspace.tsx` only where its opening Today strip needs moving. A small presentation-only module under `src/components/staff/` may share section ordering and banner presentation. No changes to store selectors, role matrices, action execution or StatusChip mappings.

**Evidence first:** inventory each role's existing entry workspace and every currently rendered section, row identity, owner, count, status and action. Capture Cathy **clinical_coordinator / s-cc2** on My work, clinician workspace and coordination center. Include clinician/prescriber, care-role, RN/LVN and operations variants through their existing destinations; preserve in-facility-disabled behavior.

**Confirmed source:** My work currently opens with Today's visits (:251), with its crisis section later (:439). WorkspaceDashboard opens with `today-strip` (:67); role tile order is in `clinicianWorkspace.ts:52–58`. Nursing's Today summary precedes its action section (`nurse.tsx:63–69`). The existing bottom “Crisis support” bar is a 988 safety link, not a record-driven crisis-alert banner.

**Approach:** arrange unframed section groups **Needs you → Waiting on others → Today**, placing the existing Today strip/schedule after the work groups. Preserve every existing row/component, link, filter, due-date sub-group and within-group priority. Group from existing structured ownership/status presentation, never wording such as “waiting” or a due-date bucket. A clinical-review task waiting for *Cathy to review* remains Needs you. If a source cannot establish whose turn it is, retain its current presentation in a neutral supporting section; document the ambiguity rather than inventing ownership. Empty waiting groups use a neutral empty state, not fabricated items. Supporting caseload/history/create controls remain reachable after these groups. Existing saved collapse/filter preferences remain intact; no duplicated action rows.

On My work add a **non-dismissible, record-driven safety banner above the work groups**, present while an authorized open crisis exists and updating from the real store. It must survive toast dismissal and navigation back to My work. Use the same acting-person/role-filtered escalation projection as the StaffShell header (`filterEscalations(listEscalations(actor), actor, …)`), neutral summary plus ShieldAlert and an existing queue link. Do not add global crisis counts or patient/SUD details. Keep the header count, existing detailed crisis rows and reachable 988. Zero authorized rows means no banner; changing actor cannot leave another actor's banner behind.

### 3. `/consent` into StaffShell — access proof before migration

**Files if prerequisite passes:** `src/components/AppShell.tsx`, `src/routes/consent.tsx`; existing shared staff presentation may supply density. No new staff nav entry or permission grant is required.

**Verified guards:** `/consent` already appears in `STAFF_NAV` with `record_class: consent_ledger` (`navSections.ts:548–554`); `STAFF_ROUTES` derives from that registry (:888). `RouteAccessGuard` uses `resolveNavAccess` (:20), which checks `canSeeNavEntry` (`navGuard.ts:56–65`). However AppShell explicitly classifies `/consent` as member content in **both** checks (:49 and :111), preventing StaffShell/EnglishSurface.

**Important unproven prerequisite:** these guards consume `useActingStaff`, not a patient/advocate session. `StaffRole` contains only staff roles; patient sign-in persists `adelante.session` (`auth.tsx:91–96`), advocates use a separate link session, and RouteAccessGuard does not inspect either. Thus staff-role matrix tests alone do **not** prove members cannot reach the ledger. PatientSidebar does not contain a ledger entry; `AdvocateDesignationPanel.tsx:113` has a ledger link whose actual audience reachability must be traced.

**Evidence/tests before moving:** add a unit test naming the registry/route guard and allowed/denied staff cases, plus browser deep-link tests after actual patient and advocate sign-in, with both persistent and session-only member states where supported, and stale privileged acting-role state from a previous staff visit. Verify no ledger data, patient picker, staff shell or actions render before redirect; cover reload, back navigation and existing link paths. Do not merely cast “patient” to StaffRole.

**Stop this item if any member can reach it.** Report exact evidence and request Mitch's approval for a separately scoped access fix; do not silently add session/auth logic or claim a shell change provides security. Other independent 8a-2 work may continue unless the global test stop rule is triggered.

If proof passes, remove only the two `/consent` member exceptions, letting the existing staff registry select StaffShell and EnglishSurface. Keep ledger contents, staff read/write boundaries, query parameters, signed-copy retention and member signing routes unchanged. Verify Cathy remains **read-only** under `roles.ts:357–358`, with no new Manage/Revoke rights. Preserve controlled Part 2 visibility; do not expose a newly hidden section via the shell. Add missing `og:type` and `twitter:card` to this touched leaf's existing metadata; retain its app-specific title/description.

### 4. Finish 8a-1 checks

**Files:** new `e2e/staffShell8a2.spec.ts` and focused unit coverage; conditional fixes in `StaffShell.tsx`, `StaffNavSidebar.tsx`, `DemoControlsBar.tsx`, `src/styles.css`. Launcher files (`chart/ChartActionLauncher`, `clinician/DashboardActionLauncher`, `ops/OpsActionLauncher`) change only if the audit check proves an application defect.

**Evidence first:** exercise shell + New for chart, clinician and operations, complete real permitted actions and read back records/events. Opening/canceling a launcher writes no mutation audit; one confirmed registry action emits **exactly one standard `action.*` event**, retaining established lifecycle events. Multi-action workflows report one per action, not one total audit row by deleting domain history. Cover repeated click protection, blocked attempts and actor attribution, including Cathy.

At **768px** check expanded/collapsed sidebar, header, + New, overlays, breadcrumbs and crisis/988 visibility, including scrolling below demo controls. On real coarse-pointer emulation at 390 and 768 check actual hit rectangles **at least 48×48**, not computed height alone: header controls, logo/home link, sidebar links/group headers, collapse/search/clear controls, + New and mobile navigation sheet. Preserve 36px mouse controls and the 14px floor. Current coarse CSS targets buttons and `a[role=button]` but not ordinary sidebar anchors (`styles.css:415–417`); confirm runtime before targeted staff-only changes. The current header uses `top-12`; coarse demo-bar height may require measured clearance rather than another hardcoded offset.

### 5. `/admin-content` at 390px — locate overflow, then fix narrowly

**Files:** `ContentAdminWorkspace.tsx`, `ContentInventoryTable.tsx`, `ResourceVerificationQueue.tsx`, `src/routes/admin-content.tsx` and staff sizing CSS only where the offending DOM proves responsibility.

**Evidence first:** actual 390px mobile emulation, not only a resized desktop viewport. Capture `innerWidth`, document/body scrollWidth, `visualViewport.width/scale`, ancestor widths and rectangles extending beyond the viewport. Compare Cathy/admin and Browse/Manage/Review/Audit/Legal tabs, editor sheets and publish confirmation. Trace the first overflowing ancestor and distinguish intentionally contained table scrolling from document overflow.

Candidates—not confirmed causes—include the five-tab TabsList (`ContentAdminWorkspace.tsx:884–890`), heading/flex children and the twelve-column inventory within local `overflow-x-auto` (`ContentInventoryTable.tsx:52–54`). Fix only the actual min-width/wrapping/scroll containment defect. Keep table semantics, tabs, filters, History RemoveControl and all permissions; no mobile-card redesign or global `overflow-x:hidden` to mask clipping. Regression asserts document width ≤390 and true 48px coarse hit targets, including the previously reported dialog buttons.

### 6. Public homepage early taps — investigate, conditional fix only

**Files if proven:** `WebsiteLayout.tsx`, `WebsiteNavigation.tsx`; homepage/start or i18n files only if evidence locates the defect there. New `e2e/publicHydration8a2.spec.ts`.

**Evidence first:** fresh loads at 390 and 1280, ordinary network and deliberately delayed client scripts, capture from the first visible controls through hydration. Record console warnings/errors, uncaught errors, failed requests, timestamps, DOM state and click results for EN/ES, mobile menu, Get started and visible Help/988. Compare early taps to post-hydration taps; separately block JS to verify native destinations. A blocked-JS language/menu test alone is not evidence of the previously missed normal-load tap. Check event replay and loading/intercepting layers, not just the absence of an immediate response.

**Confirmed source:** language and Radix menu use React handlers; Get started renders a router link; 988 is already a plain `a href="tel:988"` (`WebsiteLayout.tsx:74`). Keep that anchor active from server-rendered HTML, never disabled, inert, handler-dependent or hidden behind a hydration gate. Verify native protocol activation without initiating a real call.

If reproducible, apply the smallest progressive/native fallback or event-readiness correction preserving existing names, destinations, EN/ES/Draft copy and Radix behavior where possible. Do not replace the menu/language architecture merely because it uses JavaScript; no suppressHydrationWarning workaround. If a fix necessarily changes an existing button/link selector or assertion, STOP and present its exact line for Mitch's approval first. No unrelated Date/random, inbox-link or footer cleanup.

## B. Exact existing-test edits

**None proposed; zero existing test-line changes requested.** Keep all existing tests, retries, timeouts, thresholds and snapshots unchanged.

- `src/components/__tests__/staffShell8a1.test.ts:60` currently reads `expect(app).not.toMatch(/["']\/consent["']\s*[,\]].*isStaff/);`. It forbids a particular hardcoded list shape, not an explicit behavioral consent-shell contract. The proposed removal of member exceptions uses the existing registry, so retain this line; add new behavioral coverage rather than reversing it.
- `src/lib/__tests__/clinicianWorkspace.test.ts:16–19` asserts current `workspaceTileOrder` arrays. Keep that model helper unchanged; apply the new overall section grouping in presentation, preserving its existing within-group order. New tests assert actual DOM order and membership parity.
- Existing `e2e/group2Pathways.spec.ts:63–65` read-only ledger checks and `e2e/consentWorkflow.spec.ts:129–138` signing/locking checks remain unchanged.

If implementation cannot preserve these contracts, or **any other existing assertion fails**, stop and list **file, line, exact current line, exact proposed replacement, why** for Mitch before any edit. Never delete/skip tests or modify retries/timeouts/thresholds. The consent-access prerequisite finding is reported, not worked around by changing a test.

## C. New coverage and final validation

**Units:** presentation partition/order conserves existing row identities, counts, statuses and actions across roles; ownership uses structured sources; Cathy parity and Part 2-hidden content remain hidden; crisis banner zero/authorized/actor-switch states; consent guard and shell boundaries; real-store + New event parity and attribution. Test extracted clearance/sizing helpers only if introduced—jsdom is not proof of visual occlusion.

**Browser + axe:** first consent reproduction/readback spec; workspace ordering and crisis persistence after toast disappearance; Cathy and denied-role parity; actual patient/advocate ledger denial; staff + New record/audit readback; 768 layout and scrolled-header checks; coarse targets; 390 admin-content overflow; early-tap diagnostics/regression. Axe on My work, staff consent ledger (if moved), signing/locked states, staff navigation overlays, admin-content and public control/menu states, using existing standards without weaker exclusions/thresholds.

At build end:
1. Check automated build results, then `vitest list` total next to the **full unit pass count**, with zero unreported skips.
2. Run **every browser spec including axe**, sequentially after units—never concurrently. Use exhaustive, non-overlapping halves if needed; record each half's file list/totals and combined results, with no omitted specs. Existing-test stop rule applies.
3. Capture **My work, `/consent`, consent signing** at **390/768/1280 × light/dark**: 18 screenshots under `docs/screenshots/phase8a2/`. Use Cathy for My work/ledger and a real signed synthetic form for completion; include pre-sign evidence separately. If migration is blocked, show and label current ledger shell and member-denial evidence, never imply completion. Visually inspect all captures for clipping, overlaps, 14px floor and crisis visibility. Keep unrelated tracked e2e screenshots unchanged unless normally regenerated by their suite.
4. Write `docs/phase8a2-report.md`: rollback, changes, baseline defects/non-reproductions, member-access proof/blocker, Cathy row/action parity, audit readback, full totals, screenshot index, failures and deviations. Maintain a lean 8a-2 roadmap; document structural rules in root AGENTS only when actually introduced.

## D. Risks and safeguards

- **Cathy:** grouping can mislabel a clinical-review responsibility as waiting or accidentally widen crisis/consent access. Compare exact records and actionable controls before/after; keep acting versus viewed-workspace identities separate. Consent ledger remains read-only for her; content author/reviewer permissions unchanged.
- **Safety:** fixed signing overlays, coarse demo-bar growth and sticky headers can obscure either actions or 988. Prove hit testing and ordinary pointer/keyboard access at every width; crisis banner derives only authorized records and persists independently of toasts.
- **Privacy:** no new Part 2 placeholder, raw note, SUD label or patient detail in banner/audit/notification text. Existing masking runs before presentation grouping. No new disclosures; existing outbound paths continue through `disclose()`.
- **Scope/security:** prototype staff-role filters are not member-session proof. A failed prerequisite blocks the ledger migration, not permission rewrites disguised as styling. No backend/security redesign in this batch.
