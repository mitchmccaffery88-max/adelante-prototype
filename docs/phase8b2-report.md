# Phase 8b-2 — remaining staff tables

Completed October 17, 2026. Not published. Phase 8b-3 not started.

**Rollback:** `064533e3ba01fd425d1a66959495ef49a7f27406`.
**Validated code checkpoint:** `68c467cc03725fe5c9c2520c9a2837473ffd00a2` (before closeout documentation).

## Scope and converted surfaces

26 table surfaces now use the Phase 8b-1 shared StaffTable:

| Area | Tables | Source files |
| --- | --- | --- |
| Content | Content inventory, retaining all eleven columns and Cathy's existing filters | `src/components/admin/ContentInventoryTable.tsx` |
| Staff | Staff roster | `src/routes/admin-staff.tsx` |
| Credentialing | All credentials, payer enrollments, own/authorized-assist credentials | `src/routes/admin-credentialing.tsx`, `src/routes/clinician-credentials.tsx` |
| Messaging | Unread patient messages | `src/routes/message-queue.tsx` |
| Cosign | Own notes, pool notes, ASAM, metadata-only routing | `src/routes/cosign-inbox.tsx` |
| Escalations | Unified escalation list; open crisis details; anonymous front-door alerts; personally flagged crises | `src/routes/escalations.tsx`, `src/components/escalations/CrisisQueueDetails.tsx` |
| Inbox | Non-billing addressed items, unsigned notes, provider requests, void requests, community inquiries, advocate contributions and eligibility attestations, document verification | `src/components/inbox/{InboxActionQueue,UnsignedNotesQueue,ProviderRequestQueue,VoidRequestQueue,CommunityInquiryQueue,AdvocateReviewQueue}.tsx`, `src/components/documents/DocumentVerifyQueue.tsx` |
| Referrals | Referral tracker, missing-details chase, post-enrollment setup | `src/components/admin/ReferralTrackerCard.tsx`, `src/components/referral/ReferralChasePanel.tsx`, `src/components/PostEnrollmentSetupCard.tsx`, `src/routes/referral-queue.tsx` |
| Nursing | Needs-you nursing queue | `src/components/nursing/NursingSection.tsx`, `src/routes/nurse.tsx` |

Shared changes: `src/components/staff/StaffTable.tsx` supports preserved cell test IDs, host-owned expanded details and row-specific More labels. Detail content spans the phone grid to avoid splitting “Unclaimed”; the action column reserves enough desktop width. `src/components/ReferralProgressStrip.tsx` opts into valid named image semantics only in the converted referral table. Its existing dashboard presentation remains unchanged.

Shared dashboard/chart components explicitly opt into table presentation only at approved queue hosts. Billing feeds, claims/admin/reference/audit and matching review tables, dashboards/stat tiles/charts, patient/advocate screens, printed records and dormant in-facility screens remain excluded. Existing framing and non-table screen content were not broadly restyled.

## Parity and privacy evidence

Pre-edit source/filter/hidden-data inventory: `docs/phase8b2-evidence/target-inventory.md`.
Rollback source inventory: `docs/phase8b2-evidence/rollback-files.json`.
File list: `docs/phase8b2-evidence/changed-files.txt`.

Comparisons used `git show` source projections only, never stash/revert or source rollback. New browser checks reproduce rollback source/filter/ordering projections against the real live stores and compare displayed `data-row-key` values. Existing projection modules were independently confirmed byte-unchanged against rollback: roles, chartActions, ehr, contentStaff, notes, escalations, postEnrollment, referralChase and inboxActions.

- Content caller visibility and local filters retained; staff denied-role inventory absent.
- Staff roster remains system-admin-only; own credentials exclude another clinician's file.
- Provider ownership excludes another person's claimed rows; rollback's last-five completed cap remains.
- Cosign mine/pool/ASAM owner partitions retained; supervisor-owned/needs-supervisor notes remain absent for other clinicians. Coordinator routing remains metadata-only.
- Crisis lane sources retained; peer cross-patient detail and anonymous tables absent, with only personally raised flags shown. New fixture flag uses the existing registry/runAction path.
- Referral limits retained: tracker 100, chase first 12 existing-referral rows, setup first five in existing staleness order.
- Document mine/all, advocate review role gates, nursing source and unread-message masking retained.
- Unsigned author projection, void approver metadata, community sorting and addressed inbox projections retained. Inbox More opens the existing assignment editor without mutation.
- Existing action handlers, reasons, dialogs, audit/store paths and registry gates retained. Frozen Deactivate and Discuss/More labels remain. No existing test or test configuration changed.

Some review streams are empty in the default demo: document, advocate, community, pool cosign and physician ASAM. Their empty-state parity/axe was checked; populated stream behavior is additionally exercised where covered by the unchanged existing browser suite. This is not a claim of exhaustive populated-state/action coverage for every stream.

### Existing gaps retained for Mitch — not repaired

1. Document “all queues” uses the pre-existing broad source; table migration does not narrow it.
2. Full credential roster relies on the existing route/access boundary, not table-level row filtering; signing does not consult credential expiry.
3. Referral and setup sources are broad after existing care-coordination route access; setup has no additional blanket source gate. Assignment controls remain individually gated.
4. Coordinator cosign routing shows existing cross-patient metadata, and void review shows the author's existing reason. Neither adds note bodies.
5. Open crisis details retain their existing cross-patient source and action gates, separate from unified escalation projection.
6. Staff EditDrawer initialization can retain role/sites across selected people because it remains mounted; confirmed identical to rollback and left unchanged.

These are boundary-review findings, not newly introduced disclosures. No permission, Part 2, chart-access or status-mapping change was made.

## Content export invariance

Exporter source unchanged. Before/after outputs byte-identical:

| Output | SHA-256 |
| --- | --- |
| `docs/content-inventory.csv` | `f41b9c8c3979f4275e8f45acf2d70834dee9f04df4e1fd39e91576b315387b9f` |
| `docs/resource-inventory.csv` | `ef1134827e3dbe6252ee5f0d277f43bf4f94b80831f1ff162f07bff085a41265` |
| `docs/content-vocabulary.json` | `880e0e1afac6625fde329999910617f72cfdcef46cfa997708d36d02c25b4bf2` |

## Validation

- **Units: 2,696 passed / 2,696 listed, 334 files.** Final complete run after the width correction: 84.33 seconds.
- **Full browsers: 155 passed / 155 listed, 40 files, 30.7 minutes.** Background run to completion, `E2E_BASE_URL=http://localhost:8080`, `--workers=1`, no retries/settings changes. No existing assertion failure; contentWiring passed, so no flake exception used.
- **Final focused browsers: 10/10**, all four new area specs, after the final source changes. Initial new-only referral axe finding was fixed with table-only semantics; no threshold/rule disabled.
- Earlier complete checkpoint: units 2,696/2,696 and browsers 151/151 before four additional queue tests and final presentation refinements.
- Build telemetry: latest checked entry **build OK**; no runtime errors in final captures.
- **156 matrix captures:** 26 table surfaces × 390/768/1280 × light/dark. All present, table and document widths fit, zero captured page errors. Reviewed all six size/theme sheets plus detailed phone inbox and desktop referral captures. Empty streams explicitly appear as empty states.
- Final screenshot restoration: **16 regenerated tracked images restored**, all **20 baseline tracked hashes matched**. No source stash/revert used.
- Matrix measurements and IDs: `docs/phase8b2-evidence/matrix.json`; totals: `docs/phase8b2-evidence/validation-summary.json`. Screenshots/logs remain under `/tmp/browser/phase8b2/` and `/tmp/phase8b2/`.

The complete suite began before a final action-column minimum-width adjustment; all new area browsers and shared-table pilot browsers subsequently passed with that adjustment, and units plus the 156-capture matrix were rerun afterward.

New tests only: `src/components/__tests__/staffTables8b2.test.tsx` (3 tests), `e2e/{contentInventoryTables8b2,staffRosterCredentialTables8b2,queueTables8b2,remainingQueueTables8b2}.spec.ts` (10 tests), shared new helper `e2e/helpers/staffTables8b2.ts`.

App content-route metadata was inspected, including index; converted leaf routes retain app-specific metadata. Existing unrelated metadata exceptions and historical roadmap tasks remain outside this batch.