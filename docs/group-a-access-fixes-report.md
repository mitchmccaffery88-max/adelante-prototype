# Group A access-hardening fixes — report (Oct 19 2026)

Rollback SHA: `b482f1ab6a5f7ae51ffbd3da9e9813b23476739c`. Not published. Phase 9 not started.
All fixes narrow only; no permission matrix, role list, Part 2 rule, status mapping or registry gate changed.

| # | Before (file:line at rollback) | After | Roles affected | Evidence |
|---|---|---|---|---|
| 1 | `unsignedWork.ts:56-111` listed every draft/attended visit; `notes-queue.tsx:125` unscoped, inbox/clinician tile author-only. Any role reaching `/notes-queue` saw every patient name, including other sites and SUD-category drafts. | `listUnsignedWork({ viewer })` keeps a row only when `chartEntryFor` allows entry (restricted records: care team or unlocked) and the note's existing `noteGateClass` is not none/locked. Applied to notes queue, inbox Unsigned tab, clinician tile (counts follow). Omitted, not placeholders. Store/default derivation unchanged. | Roles without chart entry (billing, sys_admin, etc.) see none; consent-gated roles (peer, ECM, trainee) lose SUD drafts without consent; staff lose other-site rows. Therapist/PMHNP/SUD counselor keep in-site rows. | unit `groupAAccessFixes.test.ts` (#1 x4); browser `groupAAccessFixes.spec.ts` therapist count parity |
| 2 | `CaseloadTable.tsx:149-155` offered "SUD (DMC-ODS)" to every role; filtering revealed SUD enrolment. (No SUD label renders in rows — the row column is the patient ID.) | Option shown only when `canAccess(role,"screeners_sud")` is unconditional; matching also keeps the per-patient check. Chosen option: **hidden entirely**, matching the chart's ASAM section (`recordSectionGate.ts`). | Hidden for peer, ECM, trainee, CF care manager, medical assistant and other non-read roles. Kept for therapist, PMHNP/physician, SUD counselor. | unit #2 x2 |
| 3 | `TaskQueueCard.tsx:37-52` returned every task for the source. | `outpatientQueueTasks` drops `isInFacilityTask` tasks (med pass, custody, protocol rounds). | All roles using My tasks / Follow-ups. | unit #3 (ordinary task stays) |
| 4 | `admin-permissions.tsx` feed column 6 showed raw `detail.reason/outcome`. | Display passes through `displayAuditDetail` → existing `auditSafeReason` (Part 2 terms incl. SUD meds, ICD codes, patient name). Stored events unchanged. | Everyone who can open the permissions page. | unit #4 (scrubbed + plain text unchanged) |
| 5 | `data-exchange.tsx:176,184` showed full names to sys_admin and clinical coordinator. | `staffPatientLabel`: full name only if the viewer could open that chart; otherwise program ID. | sys_admin (no chart entry) now sees program IDs; clinical coordinator keeps names for in-site, non-restricted (or care-team) patients. | unit #5 x2 |
| 6 | `admin-claims.tsx:439` "Move to…" called `transitionClaim` directly — no reason, no registry event. | Opens the existing ConfirmDialog with "Reason (saved to the audit log)"; runs `confirmedAction("claim_status", …)` → one registry audit. Store refusals show in the dialog and nothing moves. | Billing write roles. | browser #6: no reason = no change; one `claim_status` event; only that claim changes; other claims' money identical |
| 7 | `admin-staff.tsx:135-139` kept prior member's role/sites/reason. | Form resets when a different staff member is selected. | sys_admin. | browser #7 |

## Existing-test conflicts
- None asserted old leaky behaviour. One near-conflict avoided: `adminTables8b3.test.tsx` requires the disclosure CSV download function to stay byte-identical, so the **download file name still contains the patient name** (recorded gap, not changed).
- `src/lib/__tests__/cleanupReschedule.test.ts` (2 tests) fails identically on the untouched rollback tree (clock-dependent overlap with an Oct 20 5:15 PM visit). Pre-existing; not edited.

## Gaps found, not changed
- Staff roster: after the "More → Change roles/sites" sheet closes, the page stays unclickable by mouse (Radix menu→dialog pointer lock); keyboard works. Pre-existing from 8b-2.
- Disclosure export file name includes the patient's full name (see above).
- Data-exchange "incoming events" list still links names (chart-link column, out of scope).

## Validation
- Units: 2,720 passed of 2,723 listed (338 files); the 3 failures were the clock-dependent `cleanupReschedule` pair (fails identically at rollback) and one `adminTables8b3` check that drove reverting the download file name (24/24 passing after the revert).
- New tests: unit 12/12, browser 3/3.
- Full browser suite, run last after the final source change (--workers=1, :8080): 177 passed / 177 listed, 0 failures.
- All 20 tracked screenshots restored to the rollback versions; hashes verified.
