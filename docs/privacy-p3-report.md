# Privacy P3 — referrer updates, name policy, sys-admin reporting, inspection hook, End access now

Approved by Mitch, Oct 20 2026. Not published. Rollback `8ce8a6343e53917d7473af94e2006583c9e342b7` (9c-2 final). Starting HEAD `4d2723e7` had no content diff from the rollback.

## Inventory before editing (file:line at rollback)

- Referrer texts: `src/lib/referrerUpdate.functions.ts:25-45` (first name + last initial, contacted/enrolled/declined bodies); dispatch `src/lib/referrerUpdateDelivery.ts:14-41` (no consent or Part 2 gate); call sites `src/components/referral/ReferralSubmissionForm.tsx:284` (received) and `src/components/ReferralTimelineDrawer.tsx:293-311` (contacted/enrolled/declined). Referral model `src/lib/ehr.ts:943-1028` had no referrer type. The public "your referrals" tracker had already been removed (`ReferralSubmissionForm.tsx:168-178`); the remaining shared view is the public confirmation (reference + text status only).
- Disclosure: `src/lib/part2Disclosure.ts:185` `disclose()`; no referrer channel; emergency end time not updatable (only `markEmergencyReviewed`).
- Emergency: `src/lib/chartActions.ts:135` `coordinator_emergency_unlock`; banner `src/components/chart/CoordinatorSudPanel.tsx:33`.
- Incoming events: `src/routes/data-exchange.tsx:41-44` `nameOf()` full name + unconditional chart link at `:136`.
- Reporting: `src/lib/asamReporting.ts:85-100` (coordinator totals only); `src/routes/reporting.tsx:321`; county downloads unfiltered `src/routes/county-reporting.tsx:237-239`.
- Inspection hook: static import `src/routes/__root.tsx:21`, installed at `:222`; the production build contained the `installDevInspect` function body (`dist/server/_ssr/router-*.mjs`), guarded only at runtime.

## 1. Patient-name policy

Fixed with the existing `staffPatientLabel` / `viewerCanOpenChart` rule (full name only with chart access, otherwise the program ID):

| Surface | File | Change |
|---|---|---|
| Data exchange — incoming events (name + chart link) | `src/routes/data-exchange.tsx` Events | Label via `staffPatientLabel`; chart link only when `viewerCanOpenChart`, otherwise program ID as plain text |
| Worklist patient column | `src/routes/worklist.tsx` `nameFor` | `staffPatientLabel` |
| Team calendar reschedule list | `src/routes/team-calendar.tsx` | `staffPatientLabel` |
| Consent page patient selector | `src/routes/consent.tsx` | program ID only without chart access |
| Consent audit patient selector | `src/routes/consent-audit.tsx` | program ID only without chart access |
| Team messages list + thread header link | `src/components/team/TeamThreads.tsx` | label; link only with chart access |
| Ops claim picker / patient picker / merge reconfirm | `src/components/ops/OpsActionLauncher.tsx` | label; name and DOB hidden, and name search disabled, without chart access |
| Referrer texts | `src/lib/referrerPolicy.ts` | no patient name in any text |

Previously held — now APPLIED (delegated approval, Oct 20 continuation) (existing parity tests lock these files byte-for-byte or binding-for-binding; proposed diffs in `docs/privacy-p3-evidence/`):

| File | Existing test | Current | Proposed |
|---|---|---|---|
| `src/components/tasks/TaskQueueCard.tsx:140` | `roleDashboardParity9c2.test.ts:26-27` (bindings vs aff263ff) | `{p.firstName} {p.lastName}` button | label via `staffPatientLabel`; program ID text without chart access (`held-TaskQueueCard.tsx.diff`) |
| `src/components/ops/OpsWorkspace.tsx:50` | same test | `name()` returns full name | `staffPatientLabel` (`held-OpsWorkspace.tsx.diff`) |
| `src/routes/quality-compliance.tsx:45` | same test | full name in restricted-chart picker | `staffPatientLabel` (`held-quality-compliance.tsx.diff`) |

Applying these also makes `staffTable8b1Closeout.test.tsx` fail to load (its partial `@/lib/roles` mock lacks `supervisorCandidates`, reached through the new `staffPatientLabel` import). Approval needed for the parity lines (and that mock) before applying.

Not yet traced to a definite gated/ungated verdict (names render; upstream selectors were not fully followed this batch): admin-audit `:224`, admin-documents-audit `:147`, group-audit `:134`, disclosure-log `:76,98`, cosign-inbox, caseload-review `:121`, case-manager `:413,506,589`, clinician `:574–1182`, CrisisQueueDetails `:151,192`, GroupJoinRequestsQueue `:68`, clinical-referrals `:42`, PostEnrollmentSetupCard, ClientRecordDrawer `:55`, AfbiContactForm, PatientMatchingQueue, ExistingPersonStep, WorkspaceDashboard, DashboardActionLauncher, agentic list/review/scribe. Most are care-team or compliance surfaces; listed for the next batch. File names already use program ID (`exportFilenames.ts`). Patient-directed welcome text uses the person's own first name (patient surface).

## 2. Referrer status updates (Draft — pending clinical sign-off)

- `src/lib/referrerPolicy.ts` (new, pure): types covered_provider / community_org / family / self; missing type = `unknown` (non-covered, deny by default). `Referral.referrerType` is added by declaration merging so `ehr.ts` stays byte-identical.
- Matrix: received → generic receipt for everyone ("Thank you for your referral. We received it and will follow up per our standard outreach process."). Covered provider → "outreach completed" and "enrolled on <date>"; declined never shared. Non-covered/unknown → held ("Held: no authorization on file") unless a non-revoked "yes" naming that exact referrer is on file; with it, "enrolled on <date>" only (the question asks about enrollment; "outreach completed" is held as "Held: the authorization covers enrollment only"). SUD (`substanceUseNeed`, an `outpatient_sud` episode or an SUD problem) → generic receipt only for everyone unless a non-revoked Part 2 legal-disclosure consent names that referrer (name or organization); then the provider's minimum-necessary updates only.
- Authorization: `src/lib/referrerAuthorizationStore.ts` records yes/no, who, when and the referrer named; revocable; both audited (`referrer_authorization_recorded` / `_revoked`). UI: `ReferrerAuthorizationCard` in the referral timeline asks "Is it OK if we let <referrer> know you've enrolled with us?", gated by the existing outreach permission, and shows the latest held reason.
- Sending: `referrerUpdateDelivery.ts` checks the policy first; held updates are recorded with the reason, nothing sent. The server payload now carries only the message kind and enrollment date (no name). Each SENT message writes one disclosure-log entry (new channel `referrer_update`) and one audit event (`referrer_status_disclosure`).
- Referral form: "Who is referring?" select (EN/ES draft).
- Old first-name composer `composeReferrerUpdate` is kept (its existing test still passes) but no longer used to send.
- Decision for Mitch: authorization record/revoke are audited store calls like the existing referral dispositions, not registry actions — adding registry keys would change the permission snapshot beyond the one approved key.

## 3. sys_admin reporting — capability table

| Capability | sys_admin before | sys_admin after | clinical_coordinator | all other roles |
|---|---|---|---|---|
| /reporting CalOMS completeness / substance / prior / discharge / justice cards | Hidden | Totals over consent-permitted cohort, hidden below 11 (`sysAdminReporting.ts`, `reporting.tsx:321`) | unchanged (totals) | unchanged |
| De-identified totals CSV export from /reporting | None | Yes, `<11` suppressed, no IDs/names, audited `reporting_totals_exported` | none (unchanged) | none |
| ASAM (clinical) section and Population-health SUD slices | Hidden | Hidden — HELD: needs `asamReporting.ts` `TOTALS_ONLY_ROLES` (locked by `statTileParity9a2.test.tsx`, `roleDashboardParity9c2.test.ts:29-30`); proposed diff `held-asamReporting.ts.diff` | unchanged | unchanged |
| CalOMS / TPS client-level rows, TPS list, CalOMS generation | No | No | Yes (owner) | unchanged |
| Download already-generated CalOMS/TPS files | Yes (gap) | No — "Client-level file — state-reporting owner only" (`countyDownloadAccess.ts`) | Yes | narrowed for any role without client-level SUD access |
| Chart access, names, SUD detail | No | No | unchanged | unchanged |

Only sys_admin gained anything. The county download change narrows only.

## 4. Inspection hook

- `__root.tsx` now loads `devInspect` with a dynamic import inside `if (import.meta.env.DEV || import.meta.env.VITE_E2E === true)`; both are compile-time constants, so production drops the module.
- Before: production bundle contained `installDevInspect` (1 file). After: production build searched for `installDevInspect`, `window.__adelante`, `__adelante =`, `__adelante:`, `checkAllBriefs`, `devJourneys`, `setInFacilityEnabled` — 0 hits. NEW test `privacyP3Bundle.test.ts` builds and fails on any hit. (`__adelante_screener_drafts` / `__adelante_chunk_reload_at` are storage keys, not the hook.)
- Demo/test-only exposures to remove at real login (not removed): `DemoControlsBar` in `AppShell.tsx:166-167` and `WebsiteLayout.tsx:54` (not dev-gated); `StaffRoleSwitcher` (`setActingStaff`, role redirect); AppShell staff picker `AppShell.tsx:278`; `DemoStateSwitcher` (demo patient names `:439`); `setActingRole`/`setActingStaff` in `roles.ts`; `VITE_E2E` build mode (`vite.config.ts:20`, `build:e2e`); `devJourneys`, `adelBriefCheck` dev entry; `setInFacilityEnabled` runtime toggle.

## 5. End access now

- `coordinator_emergency_end` registry action (`chartActions.ts`), `endCoordinatorEmergencyNow` (`coordinatorSudEmergency.ts`): only the coordinator whose window is active; deletes the grant at once; writes one audit entry `part2_emergency_ended_early` (who, patient ID, start, scheduled end, actual end, endedEarly, optional note); shortens the disclosure entry's `accessEnd` (`recordEmergencyAccessEnded`); the compliance review item is kept.
- Banner button "End access now" + ConfirmDialog with optional note. Four-hour expiry, reasons, counseling block and other roles unchanged.
- Permission snapshot: +17 lines, `"coordinator_emergency_end": "hidden"` for every role, nothing else.

## Tests (new files only)

`privacyP3Referrer.test.ts` (22), `privacyP3Names.test.ts` (2), `privacyP3SysAdmin.test.ts` (5), `privacyP3EndAccess.test.ts` (4), `privacyP3Bundle.test.ts` (1). Existing snapshot updated only by the approved key.

## Validation

See the bottom of this file.

## Continuation (Oct 20, 21:09 UTC) — approved items applied

- Names: `TaskQueueCard.tsx:140` (program ID text, no link, without chart access), `OpsWorkspace.tsx:50`, `quality-compliance.tsx:45` now use `staffPatientLabel` / `viewerCanOpenChart`.
- sys_admin ASAM and population-health totals: `asamReporting.ts` `TOTALS_ONLY_ROLES` now includes `sys_admin` (same consent cohort, hidden below 11, no named rows). New test `privacyP3SysAdminCohort.test.ts` proves at 11 consented patients sys_admin's ASAM report and population-health report equal the coordinator's totals exactly, with no names or rows.
- DECIDED by Mitch (Oct 20): an authorized non-covered referrer gets "enrolled on <date>" only; "outreach completed" stays held for them. Current behaviour kept; no longer held.
- DMC Date freeze: approved for its own batch; NOT applied here.

### Changed existing test lines (old → new)

All approved substitutions live in one new helper, `src/test/privacyP3Approved.ts` (`withApprovedP3`). It applies only the exact approved source changes to the rollback text, and fails if an anchor is not found exactly once. Every other file and assertion in these tests is unchanged.

`src/components/__tests__/roleDashboardParity9c2.test.ts`
- added import (line 5): `import { withApprovedP3 } from "@/test/privacyP3Approved";`
- :28 (was :27) old `expect(inventory(readFileSync(path, "utf8"))).toEqual(inventory(old(path)));`
  new `expect(inventory(readFileSync(path, "utf8"))).toEqual(inventory(withApprovedP3(path, old(path))));`
- :31 (was :30) old `expect(readFileSync(path, "utf8")).toBe(old(path));`
  new `expect(readFileSync(path, "utf8")).toBe(withApprovedP3(path, old(path)));`

`src/lib/__tests__/statTileParity9a2.test.tsx`
- added import (line 14): `import { withApprovedP3 } from "@/test/privacyP3Approved";`
- :37 old `expect(readFileSync(path, "utf8")).toBe(old);`
  new `expect(readFileSync(path, "utf8")).toBe(withApprovedP3(path, old));`

`src/components/__tests__/staffTable8b1Closeout.test.tsx` — setup only, no assertion change:
```diff
 vi.mock("@/lib/roles", () => ({ useActingStaff: () => ({ staffId: "staff-one", role: "ecm_provider", staffName: "Test owner" }) }));
+vi.mock("@/lib/staffPatientLabel", () => ({ staffPatientLabel: () => "Client", viewerCanOpenChart: () => false }));
 vi.mock("@/lib/actions/act", () => ({ act: vi.fn(), actFor: vi.fn() }));
```
The chart-access label module is mocked in place of the real one. Through `chartAccess` → `ehr-ext`, the real module needs `supervisorCandidates`, which the test's partial roles mock does not supply. The test's mocked patient list is empty, so the label is never rendered.

`src/lib/__tests__/__snapshots__/runAction.test.ts.snap`: +17 lines `"coordinator_emergency_end": "hidden"` (one per role), nothing else.

### Pinned-clock parity: every other role identical

Same method as 9c-2. The current tree and a `git archive` of `8ce8a634` (node_modules symlinked, no stash) each ran one dump with Date pinned to 2026-10-20T15:00Z and a seeded `Math.random`. The dump covered `asamAccessMode`, `aggregatePatients`, `asamClinicalReport`, `populationHealthReport`, and CalOMS completeness / substance / justice for all 17 staff roles. Result: **all 17 roles byte-identical**, including sys_admin, because the demo seed has 0 consent-permitted patients (<11, so hidden in both). The ≥11 behaviour is proven by the new cohort test above.

### Clean validation (continuation)
Order: all edits done → dev-server restart → units **2,893/2,893 (359 files), EXIT 0** → full browser suite `--workers=1` on :8080, nothing else running → **210/211, EXIT 1 (40.1 min)**.

**STOP (stop rule: an existing test asserts the old name display).** `e2e/access.spec.ts:50`. sys_admin opens `/quality-compliance` → "Client to restrict" and picks the option by patient name (`ids.otherName`, built at `:24` from first name + last initial). sys_admin has no chart access, so under the approved name policy (`quality-compliance.tsx:45`) the option now shows the program ID. The click timed out after 180 s.
- Current: `await page.getByRole("option", { name: new RegExp(ids.otherName) }).first().click();`
- Proposed: pick by program ID. Add `otherProgramId` to the `ids` evaluate at `:24` (`ps.find(p => p.id === other).programId`) and change `:50` to `{ name: new RegExp(ids.otherProgramId) }`. No other assertion changes.
- Not applied; awaiting approval. `staffNewAudit8a2:93` did not fail in this run.
Tracked screenshots restored against 8ce8a634.


## Closeout (Oct 20, final)
- Approved test edit `e2e/access.spec.ts` (encodes the name policy: sys_admin has no chart access, so the option shows the program ID). Nothing else in the file changed.
  - `:24` old: `return { luis: …, other: …, otherName: (() => { … })() };` → new: same, plus `otherProgramId: (ps.find((p) => p.firstName !== "Luis")! as unknown as { programId: string }).programId`
  - `:50` old: `page.getByRole("option", { name: new RegExp(ids.otherName) })` → new: `page.getByRole("option", { name: new RegExp(ids.otherProgramId) })`
- access.spec.ts standalone: 1/1 passed.
- Dev server restarted; FULL browser suite `--workers=1`, `E2E_BASE_URL=http://localhost:8080`, background, nothing else running: **211/211, 37.6m, EXIT 0**. No flake exceptions used.
- Units (previous run, no source change since): 2,893/2,893.
- Screenshots: 16 tracked images restored; all 244 rollback PNGs byte-identical to 8ce8a634.
- Referrer decision recorded above. DMC Date freeze approved but not applied here (own batch). ~20 untraced name surfaces remain listed for a later batch.
- Status: Privacy P3 COMPLETE. Not published.
