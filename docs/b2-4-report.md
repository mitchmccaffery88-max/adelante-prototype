# B2-4 — consent enforcement switch (Option A)

Rollback 0089ca4fda285ead2c0632f8cf16c30c53f732c4 (HEAD 4032f64f appended only the plan section, kept). Draft — pending clinical sign-off and counsel. Not published. B2-5 not started.

## 1. Probe (step 1, read-only, scratch file under /tmp, deleted)
15 seeded patients.
- Option A, patients whose access changes in B2-4: **0** (confirmed by the matrix, §4).
- Option B, patients that would have lost access (legacy `part2Sud` flag, no untyped record): **7**: p3 Marcus L., p4 Alicia Serrano, p-demo-refusal Alicia R., p-demo-mar-seed Marcus Whitfield, p-demo-mar-seed-es Lucía Moreno, Luis Camacho, Jasmine Holt. The plan estimated about 5, but the probe found 7: the two MAR demo seeds are the in-facility-named fixtures, and Jasmine Holt is also a `sud: true` persona. This does not affect Option A.
- Seeded patients with a typed record: **0**. Nothing newly granted.
- Seeded coordinator flags (`sudCoordinationConsent` / `sudCounselingNotesRelease`): **0**. The ASAM coordinator cohort is empty, so totals stay hidden below 11.
- p1 keeps its untyped seed record (`cr-seed-1`). Untyped records are not legacy flags and keep answering until B2-5.

## 2. Precedence (src/lib/consentGate.ts)
A typed record **applies** to a gate only when its type, recipient and purpose match (and, for part2_specific_written, its item list contains the gate's item). If any record applies, `consentCovers` decides: expired, revoked, superseded and legacyUnverified records deny, with no fallback. If none applies, today's source answers (Option A).

| Gate | Type | Recipient (exact name or directoryRef) | Purpose | Item | Otherwise (today) |
|---|---|---|---|---|---|
| sud_treatment (wrapper: roles.ts consent_gated, screeners, HIE/county, chartOrders, rescreen, getConsentState) | part2_tpo_single | Adelante / adelante-program | treatment | — | untyped record section, then legacy flag |
| telehealth_services (booking, join, groups) | telehealth | Adelante / adelante-program | telehealth | — | untyped record section |
| group_confidentiality_ack | group_confidentiality | Adelante / adelante-program | group_confidentiality | — | untyped record section |
| Other categories (mental_health, case_coordination, billing, roi_collateral, advocate_sud_disclosure, legal_disclosure, information_sharing_disclosure, po voluntary, pre_release) | none at the category call site: callers carry no recipient, so no typed record applies | — | — | — | untyped record section |
| Coordinator SUD B items (coordinatorSudAccess.ts:32) | part2_tpo_single; part2_specific_written | Adelante care coordination team / adelante-care-coordination / Adelante / adelante-program | care_coordination | the B item (specific only) | `sudCoordinationConsent` tpo/specific; then `\|\| coordinatorEmergencyFor` (unchanged) |
| Coordinator counseling notes (:30) | counseling_notes_release only (TPO/specific never apply) | as above | care_coordination | — | `sudCounselingNotesRelease === true` |
| Referrer Part 2 named consent (referrerUpdateGate) | part2_specific_written | the referrer's own name / agency only | — | referral_status | legal-disclosure ledger naming the recipient |
| Referrer authorization (referrerUpdateGate) | referrer_authorization | the referrer's own name / agency only | enrolled: enrolled_update or status_updates; other events: status_updates | — | referrer authorization store |
| ASAM cohort (asamReporting.ts:93) | part2_tpo_single; part2_specific_written | program / care-coordination team | care_coordination | diagnoses (specific only) | `!!p.sudCoordinationConsent && p.consents.part2Sud` (Option A) |

A record naming an external recipient (for example "Valley Clinic") never applies to an internal gate. External and referrer gates match only their named recipient. Verbal-assent limits are enforced inside `consentCovers`.

## 3. Readers switched
- ehr.ts `isConsentCategoryAuthorized`: now a wrapper over `consentGate`. The pre-B2-4 body is unchanged as `_consentCategoryToday`, and the ledger is registered at the end of the file. Every existing caller follows automatically, with no caller edits.
- coordinatorSudAccess.ts:30 and :32 (`coordinatorPart2Consent` exported). The emergency term is textually unchanged.
- referrerUpdateGate.ts `referrerDecisionFor`: `decideReferrerUpdate` and the P3 messages are unchanged.
- Direct flag reads not changed: intake.tsx:590, onboarding.ts:18 and consent.tsx:142 report intake status, not access. CoordinatorSudPanel.tsx:23 and adelBrief.ts:408 are cache keys only (the panel re-reads every second). recordSections.tsx:500 is a display prop. The migration writers stay for B2-5.

## 4. Matrix (rollback vs current, pinned clock)
`src/test/consentEnforcementB2Scenario.ts` covers 15 patients x every roster role x these surfaces: 13 consent categories, getConsentState, 9 coordinator items, 7 disclosure recipient kinds (part2ConsentFor), screeners_sud access + ASAM row/section + SUD program visibility per role, the ASAM cohort and mode per role, and every referral x 4 referrer events. It runs in four states: the default seed, after the billing lifecycle QA scenario, after capturing five external-recipient typed records per patient, and through the emergency states. Fixture produced on `git archive 0089ca4f`: `src/lib/__tests__/fixtures/consentEnforcementB2-rollback-0089ca4f.json`. Result: **zero differences** (`consentEnforcementB2Matrix.test.ts`). No WIDENS cell, no narrows cell. B2-6 `consentAuditB2Parity` is still byte-identical.

## 5. Emergency path
- Source: the bodies of coordinatorEmergencyFor, validateCoordinatorEmergency, saveCoordinatorEmergencyGrant and endCoordinatorEmergencyGrant hash identically (SHA-256) to rollback. The grant Map and the 4-hour constant are unchanged, coordinatorSudEmergency.ts is identical, and the `|| !!coordinatorEmergencyFor(...)` term is present.
- Behaviour: the matrix covers no grant, active, expired, ended and after-end for every patient, identical to rollback. Active grants open the 8 B items and never counseling notes.

## 6. ASAM continuation and timing investigation (historical stops retained)
Switching this line edits src/lib/asamReporting.ts. That file is pinned byte-identical by roleDashboardParity9c2 (rollback aff263ff), statTileParity9a2 and billingParity9a3, through `withApprovedP3`. The pre-approved edits for B2-4 are limited to consentInventoryB2 pins and consentB2Approved ehr.ts substitutions, so it needs an adapter outside that list. The line is reverted to rollback and still reads today's flags. Its behaviour is identical to the switched version under Option A, because no seeded typed record applies. Approval needed: one exact-once substitution for asamReporting.ts (an import line and the `.filter` line calling `consentGate(p.id, coordinatorNeed("diagnoses"), () => <today's expression>)`) in `src/test/privacyP3Approved.ts`.

### B2-4 ASAM continuation — approved Oct 22, stopped at matrix
- Starting HEAD: `c2b3b86458e3cf0e6e71943ad13e9cf6397b7b9c`.
- Applied the delegated additive approval: one exact-once substitution in `src/test/privacyP3Approved.ts` covering the `consentGate`/`coordinatorNeed` import and the cohort filter. The reader now calls `consentGate(p.id, coordinatorNeed("diagnoses"), () => !!p.sudCoordinationConsent && p.consents.part2Sud)`. No cohort/access/suppression assertions, fixture, retries or timeouts changed; emergency code untouched.
- Required first validation: `consentEnforcementB2Matrix.test.ts:42` failed, **0/1 passed, EXIT 1**. Full log: `/tmp/b24b-matrix.log`.
- The displayed diff begins at matrix JSON line 1411: expected canonical ID `<id12>`, received `hlydgyve`; subsequent canonical ID numbers shift in the billing-scenario patient list, capture list, external-record state and emergency references. The existing canonicalizer matches only eight-character tokens containing a digit, so that all-letter generated ID remains literal. This is the observed comparison failure, not evidence of a changed permission. It has not been waived, normalized differently, retried or corrected.
- **STOP per Mitch's “Any diff → STOP.”** The approved switch remains applied but unvalidated. Restart/full units/full browser/screenshot restoration were not started. Previous §8 results belong to the earlier B2-4 validation, not this continuation. Preview diagnostic after this edit reported build OK.
- B2-5 plan was not appended and no B2-5 implementation or publishing occurred. Checkpoint after the source edits: `50518ef219a7da28f947f79816715ad6a4fe6383`; managed closeout documentation may create a later SHA.

### B2-4 ASAM continuation — diagnosis and harness fix (Oct 22, delegated)
**1. The diff is ID-only.** Current matrix (`B24_MATRIX_WRITE`) vs the old rollback fixture, with every value under `id` / `pid` / `*Id` / `*Ids` keys and the record token in `"Consent record <id>"` refs removed: 3,633 vs 3,633 lines, **0 differing lines**. Every raw difference (14 `pid`, 14 `id`, 14 `patientId`, 15 `"Consent record <id>"` refs) is a generated ID; every access, cohort, mode, category, coordinator, disclosure-decision, referrer-decision and emergency value is identical.

**Why the ID sequence changed — not the ASAM import.** The ID sequence varies between runs of identical code: the unmodified rollback (`git archive 0089ca4f`, harness copied in) produced two different raw outputs across seven runs, and current code produced two across three (MD5s in /tmp/b24c). Instrumenting `Math.random` with caller stacks (scratch copy of the rollback, deleted) showed 920 draws per run in every run, identical except for the position of draws from `src/lib/ehr.ts:9481` — the simulated SMS delivery-failure roll inside a real `setTimeout(…, 1400)` (ehr.ts:9480; the matrix pins only `Date`, not timers). That callback fires at a wall-clock moment, so it interleaves with the `uid()` ID generator (ehr.ts:4472) at varying points and shifts every later generated ID. No `node_modules` caller draws. The value only decides a simulated SMS notification's delivered/failed state; no consent, access, cohort or disclosure decision reads it or any generated ID's characters, which the zero non-ID diff above confirms. `hlydgyve` is simply one all-letter outcome of that shift; the old regex canonicalizer only caught tokens containing a digit.

**2. Harness edit (this-batch test, delegated).** `src/lib/__tests__/consentEnforcementB2Matrix.test.ts:25-31`
- Current: `canon(text)` replaced every 8-character `[a-z0-9]` token containing a digit (`/\b(?=[a-z]*\d)[a-z0-9]{8}\b/g`) with `<idN>`.
- Proposed/applied (now :25-47): `canon(text)` parses the JSON and walks it; any value under an `id` / `pid` / `*Id` / `*Ids` key (each element of an `*Ids` array) and the record ID in the `"Consent record <id>"` ref prefix (part2Disclosure.ts:196) become `<idN>` in order of first appearance; `null` stays literal; every other value is compared literally with the same `toBe` on the full serialized document. No field removed, no equality relaxed, no retries or timeouts.
- Fixture regenerated on `git archive 0089ca4f` with this harness only (never current code): `consentEnforcementB2-rollback-0089ca4f.json`, SHA-256 `c98ea8c5…c2bf0b`.
- Negative check: flipping one access category bit in the fixture makes the test fail; restored.

**3. Validation.**
- Matrix test vs regenerated fixture: 5/5 consecutive passes.
- Dev server restarted. Full units: **2,950 / 2,950 across 370 files, EXIT 0**.
- Full browser (one worker, :8080, background, nothing else running): **223 passed, 1 failed, 224 total, 47.2m, literal `EXIT 1`** (/tmp/b24b-browser.log). The failure: `e2e/auditTables8b3.spec.ts:13` (action-audit-feed on /admin-permissions as sys_admin), "Test timeout of 30000ms exceeded", no assertion mismatch. It is **not** a named flake exception. Standalone afterwards: 2 of 3 passed (29.5s pass, 32.4s timeout, 27.3s pass) — the test runs at the edge of its 30s budget. /admin-permissions does not read asamReporting. Not retried further, timeout not changed, test not edited.
- Screenshots: 17 regenerated tracked images restored from 0089ca4f; 0 differ.
- **Not fully green → B2-5 plan NOT appended**, per "only if all of that is green". Decision needed on auditTables8b3:13.

### Audit timing investigation — completed Oct 22 (docs only)

**Accepted finding:** Mitch accepted no B2 regression: the earlier five-run medians were within approximately 1 second across current / 0089ca4f / 5c335b7e, and 0089ca4f also timed out once at 33.2 seconds. This does **not** classify `auditTables8b3.spec.ts:13` as a named flake or waive its stop.

**Method:** The prior sandbox's scratch files and archive servers were absent on this request, so both archives were recreated under `/tmp/browser/b24-timing/` from `git archive`. Current source checkpoint: `84e1f95eeffe40c9387240c76347cb00b9ab40a9`. The scratch spec copied the four existing audit-table cases and added timing marks only, retaining every assertion and helper, the existing 2-second wait, 30-second test budget, 15-second assertion budget, zero retries, 1280×1800 desktop and 390×1800 phone viewports. Existing global setup warmed each server. Two repetitions per case per version ran sequentially with one worker, in version order current (:8080), 0089ca4f (:8090), 5c335b7e (:8091). No existing test, timeout or retry was edited. Temporary archive caches were separate; :8080 was neither restarted nor changed.

All **24/24 cases passed**, with **8/8 and literal EXIT 0 for each version**. These two-sample diagnostic timings are supplementary evidence, not a rerun or replacement of the stopped full suite. Boot includes navigation and waiting for the demo hook plus issuing the role/route change; the separate table-visible step includes remaining rendering and reading row IDs. Phone timing retains the existing helper as one unit (resize, visible/width checks, then axe). Total includes Playwright overhead, so it is not exactly the sum of marked steps.

#### Action-audit-feed per-step timings (seconds)

| Version | Run | Boot/navigation | Existing wait | Table visible + IDs | Source projection | Parity assertions | Desktop axe | Phone resize + checks + axe | Total | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Current | 1 | 5.985 | 2.003 | 0.810 | 0.003 | 0.003 | 4.843 | 4.886 | 18.624 | Pass |
| Current | 2 | 7.123 | 2.002 | 0.719 | 0.003 | 0.002 | 4.714 | 5.253 | 19.935 | Pass |
| 0089ca4f | 1 | 8.019 | 2.003 | 1.689 | 0.003 | 0.003 | 6.301 | 7.145 | 25.271 | Pass |
| 0089ca4f | 2 | 7.559 | 2.003 | 1.909 | 0.003 | 0.005 | 5.416 | 6.006 | 23.020 | Pass |
| 5c335b7e | 1 | 7.153 | 2.002 | 1.526 | 0.011 | 0.003 | 5.631 | 7.863 | 24.304 | Pass |
| 5c335b7e | 2 | 8.539 | 2.004 | 1.226 | 0.006 | 0.006 | 8.347 | 8.728 | 28.959 | Pass |

#### All four audit cases: two-run median total (seconds)

| Case | Current | 0089ca4f | 5c335b7e | Passes per version |
|---|---:|---:|---:|---|
| admin-audit-table | 13.984 | 14.668 | 14.696 | 2/2 each |
| documents-audit-table | 9.451 | 10.802 | 10.786 | 2/2 each |
| consent-audit-table | 11.192 | 13.713 | 12.318 | 2/2 each |
| action-audit-feed | 19.280 | 24.146 | 26.632 | 2/2 each |

The documents case used its existing empty-state branch in all six runs, so desktop/phone axe was not reached there; it was not forced to mount an empty table. Full per-step records for every case, including these branch differences, remain in `/tmp/browser/b24-timing/timings.json` and `current-timing.log`, `0089ca4f-timing.log`, `5c335b7e-timing.log` in the same directory.

**Findings:**
- Action-feed desktop and phone accessibility work together took 9.729–17.075 seconds and was the largest combined measured cost; boot/navigation took 5.985–8.539 seconds. Source projection and parity checks were milliseconds. This identifies where time is spent without proving the cause of the earlier full-suite timeout.
- Current was not materially slower: its action-feed median was 4.866 seconds below 0089ca4f and 7.352 seconds below 5c335b7e in these samples, and it had no failures. This is consistent with the accepted no-regression conclusion, not a claim of an app speedup or equal timings in this new small sample. Sequential order, environment load and only two samples limit comparisons.
- `/admin-permissions` reads action-category audit events at `src/routes/admin-permissions.tsx:68`, filters at :82, and renders `StaffTable` at :207–249. It does not call `consentCovers`, `consentCoveringRecordId` or `linkConsentDisclosure` per row or per render.
- Consent linking happens when a disclosure is created: `src/lib/part2Disclosure.ts:163–175` performs the lookup/link, invoked at :285 and :334; `src/lib/ehr.ts:12760–12765` delegates the covering-record lookup to `consentCovers`. It is not audit-feed rendering work.
- The approved ASAM filter at `src/lib/asamReporting.ts:91–93` is not read by the admin-permissions route. No app-side performance fix is justified by the requested regression criteria; none was applied or proposed for approval.

**Cleanup and stop:** Both temporary archive process groups were stopped; HTTP checks confirmed :8090 and :8091 no longer answer, while :8080 still answers. The scratch `audit-timing.spec.ts` and its temporary Playwright config were deleted. Raw logs/JSON remain only under `/tmp`. Only this report and the roadmap changed. B2-5 plan remains unappended pending Mitch's classification of `auditTables8b3:13`; no B2-5 implementation or publishing occurred.

## 7. Test edits
### Named browser flake classification — Mitch, Oct 22
`auditTables8b3:13` joins `contentWiring:47` and `staffNewAudit8a2:29`. A run is accepted under this rule only if that named test is the **SOLE failure** and then passes **3/3 standalone**. All assertions, timeouts and retries remain unchanged. Anything else is a hard stop. The earlier 2/3 standalone result does not meet this rule; a fresh full-suite run is required below. Timing investigation and cleanup in §6 are complete; B2-5 planning remains conditional on the new validation.

- consentInventoryB2.test.ts (pre-approved): ehr.ts 44 → 45 (the wrapper comment names consentCovers); new pin `src/lib/consentGate.ts: 8`. The coordinatorSudAccess.ts, referrerUpdateGate.ts and asamReporting.ts counts are unchanged.
- src/test/consentB2Approved.ts (pre-approved): three exact-once ehr.ts substitutions (B2-4.1 import, B2-4.2 wrapper hunk, B2-4.3 ledger registration).
- New: consentEnforcementB2.test.ts (13), consentEnforcementB2External.test.ts (1), consentEnforcementB2Matrix.test.ts (1) + fixture, e2e/consentEnforcementB2.spec.ts (1; external record stays locked, coordinator-team TPO opens, counseling stays hidden, revoke locks, axe).
- docs/b2-consent-inventory.md: B2-4 section added. No other existing test touched.

## 8. Validation
The bullets below describe the original pre-ASAM run. The fresh ASAM closeout attempt and its stop are recorded immediately afterward.
- Dev server restarted; build OK.
- Full units: 2,950 / 2,950 across 370 files, EXIT 0.
- New spec standalone: 1/1.
- Full browser (one worker, :8080, background, nothing else running): **224 passed / 224, 37.2m, literal `EXIT 0`**. No flake exception used.
- Screenshots: 17 regenerated tracked images restored from 0089ca4f; 0 differ.

### Fresh B2-4 closeout attempt — Oct 22, STOP (B24c)
- Requested restart completed: supervised :8080 Vite restarted and answered before launching the suite. Completed §6 timing work remained unchanged; :8090/:8091 were inactive and the scratch spec absent.
- FULL browser suite ran once, alone, in the background: `E2E_BASE_URL=http://localhost:8080 bunx playwright test --workers=1`, with `echo "EXIT $?"` appended to `/tmp/b24c-browser.log`. Waited in nine-minute chunks until the literal **EXIT 1** appeared.
- **222 passed / 2 failed / 224 total, 49.9 minutes.**

| Failure | Duration | Observed failure location | Rule disposition |
|---|---:|---|---|
| `e2e/auditTables8b3.spec.ts:13` — action-audit-feed | 35.7s | 30,000ms test timeout while `phoneTable` read the table width (`e2e/helpers/staffTables8b2.ts:28`, called at spec :30) | Named, but **not the sole failure**; cannot accept |
| `e2e/auditTables8b3.spec.ts:33` — clinical coordinator masked audit / brief-row denial / billing denial | 32.5s | 30,000ms test timeout during the phone axe scan (`e2e/helpers/staffTables8b2.ts:21`, via :30, called at spec :47) | **Not named**; stop |

- No access/privacy/a11y assertion mismatch was reported, but the unfinished checks are not passes. No classification is inferred for :33. No standalone reruns: two failures already disqualify the sole-failure exception, regardless of any later standalone result.
- **Hard stop holds. B2-4 ASAM continuation is not closed green.** No app, test, assertion, retry or timeout changes were made. No new full-unit run was requested in this closeout; the prior 2,950/2,950 result remains the last full-unit evidence.
- Cleanup only: preserved both failure traces/error contexts and regenerated images under `/tmp/browser/b24c/`, then restored 17 tracked images from 0089ca4f. All **248 rollback images checked, 0 differences**. This restoration is not a green closeout.
- B2-5 plan was **not appended**, and no B2-5 code or publishing occurred. The remaining blocker is Mitch's decision on this two-failure run, including the unclassified :33 failure. Pre-closeout-document checkpoint: `eceb29aed79eb40676a6d1e4d771ea7b43ee49e0`; managed documentation/screenshot cleanup may produce a later SHA.

### B24d authorization — Mitch, Oct 22
Rerun the full browser suite once after restart, alone, background --workers=1 on :8080, and wait for literal EXIT in `/tmp/b24d-browser.log`. `auditTables8b3:33` is explicitly **NOT** added to the named flake list. Only EXIT 0 or a sole named failure followed by 3/3 standalone passes is green. Any other failure is STOP, followed only by :33 timing investigation (5 standalone runs each on current and git-archive 5c335b7e :8091, with per-step timings). Existing tests, assertions, timeouts and retries remain unchanged. Green conditionally permits rollback screenshot restoration, B2-4 closeout and appending the docs-only B2-5 plan; no B2-5 code or publishing.

### B24d closeout — GREEN, Oct 22
- Restarted the supervised dev server; :8080 answered before launch. :8090/:8091 were inactive. §6 timing work and scratch-spec cleanup were already complete.
- Ran the **FULL browser suite once**, alone, background: `E2E_BASE_URL=http://localhost:8080 bunx playwright test --workers=1`, followed by `echo "EXIT $?"`, logging to `/tmp/b24d-browser.log`. Polled until the literal final line appeared: **224 passed / 224, 31.5 minutes, EXIT 0**. No named-flake exception, standalone rerun or :33 investigation was needed.
- `auditTables8b3:13` action-audit-feed passed in **17.6s**; `auditTables8b3:33` coordinator masked audit passed in **10.6s**. :33 remains NOT named. No test, timeout, retry, assertion or app source changed in this rerun.
- The latest full-unit evidence remains **2,950/2,950, EXIT 0** from the approved continuation; no new unit run was requested. Matrix vs independently archived 0089ca4f remains green (5/5), ID-only proof accepted, emergency source/behavior identical. Preview signal: latest observed build entry **build OK**.
- Restored **17 regenerated tracked screenshots** against `git archive 0089ca4f`; preserved generated evidence in `/tmp/browser/b24d/regenerated/`. All **248 rollback bitmap images** (246 PNG + 2 JPG), plus 17 SVGs, checked byte-identical: **0 differences**. Restoration evidence: `/tmp/browser/b24d/screenshot-restoration.json`. No archive server or timing scratch spec was created in B24d.
- **B2-4 including the ASAM continuation is closed green.** Previous STOP runs remain historical evidence, not waived successes. Conditional next step is docs-only B2-5 planning, not implementation or publishing.
- Validated pre-restoration checkpoint: `a11eaefa77d7d41d5e346e8043d96544cf19afa6`. Managed closeout SHA is reported in chat after documentation is saved; no manual Git state changes.
