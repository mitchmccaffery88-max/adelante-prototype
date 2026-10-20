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

Held — STOP items (existing parity tests lock these files byte-for-byte or binding-for-binding; proposed diffs in `docs/privacy-p3-evidence/`):

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

### Results
- Units: 2,891/2,891 (358 files), EXIT 0. An earlier run had one time-of-day collision in `cancelNoShow.test.ts` (`ehr.ts:9265`, same class as the DMC pair); it passed 3/3 on its own and in the final run.
- Production bundle: hook absent (new test passes; the hook was present before the change).
- Browser runs: run 1 210/211 (`statTiles9a3.spec.ts:39` billing_coordinator, page reloaded during axe; 3/3 standalone). Run 2 208/211 and run 3 interrupted — the dev-server log shows the platform re-touched every edited file mid-run (HMR "page reload" at 20:12), which created duplicate module copies for bare `/src/...` imports. A dev-server restart cleared it (identity check confirmed).
- Final clean run: **210/211, EXIT 1**. Sole failure: `e2e/staffNewAudit8a2.spec.ts:93` (sys_admin + New toggles a flag; the menu item was detached during click, 30s timeout). This is NOT an approved exception (only `:29` is approved). **STOPPED** here — not re-run standalone this turn, and no change was made for it.
- Tracked screenshots restored against the rollback.
