# Privacy P1 — stopped at final browser run

Rollback: `f8a650cfdc77ff6a3c2bbaadfc243bef87ed92ba`. No publishing, 9a, 9c or P2 work.

## Oct 20 final continuation

- Approved destination setup (`cleanupReschedule.test.ts`, helper `patientFreeDestination`): reschedule target excludes the moved visit and any overlapping active patient appointment. Used at the p1 reschedule case and (pre-approved slot-selection setup, reported) the advocate-tier loop. No assertions, clocks, retries, timeouts or overlap rules changed. File 6/6.
- NEW `src/lib/__tests__/privacyP1Owner.test.ts` (4 tests): clinical_coordinator generates CalOMS with one disclosure audit per disclosure check; DMC-ODS export writes a disclosure audit; tps_mark/tps_send_link allowed via runAction; billing and billing_coordinator refused for CalOMS, DMC-ODS export, TPS rows and both TPS actions.
- State SUD reporting owners now: clinical_coordinator (CalOMS file, TPS actions, client-level rows); DMC-ODS export also roles passing roleSeesAsam.
- County TPS totals "<11": already in place (countyReporting.ts:458-461).
- Full units: **2,757 passed / 2,757** (342 files).
- Full browser suite: **178 passed / 179; 1 failed** (33.4 min, --workers=1, :8080, EXIT 1). Failure: `e2e/staffNewAudit8a2.spec.ts:29` therapist /clinician + New options — 30s test timeout, no assertion mismatch. Standalone rerun passed (24.7s). Not the documented contentWiring:47 exception, so P1 STOPS here. Proposed (not applied): delegate treating :29 as a load-timing flake like contentWiring:47, or approve a full-suite rerun. 16 regenerated tracked screenshots restored to rollback; 0 differ.
- Final SHA: reported in chat at end of turn (commit made by platform after this edit).

## Oct 19 delegated stop-item continuation

- Both selected booking cases were run first on a non-destructive `git archive` copy of rollback `f8a650cfdc77ff6a3c2bbaadfc243bef87ed92ba` under `/tmp/privacy-p1-rollback`, using the current dependencies. **0 passed / 2 selected; both failed** at `bookFor` with the same patient overlap message (Oct 20, 4:00 PM, Marisol Reyes). The same two current cases failed identically before edits. Evidence: `/tmp/privacy-p1-rollback-cases.log`, `/tmp/privacy-p1-current-cases.log`.
- Conditional approval therefore applied: `cleanupReschedule.test.ts` booking setup now chooses a real available slot with no active patient appointment interval overlap. No assertions, retries, timeouts, clocks or production overlap rules changed for this repair.
- Approved former `cleanupReschedule.test.ts:86`: null export CSV-header dereference → `expect(out).toBeNull()`; existing null assertion retained.
- Approved `dmcOdsReadiness.ts:228-231`: `exportColumnsFor` now returns `[]` when neither ASAM nor state-reporting access exists. `crossRoleJourneys.test.ts` assertion unchanged.
- Approved former `dmcOdsReadiness.test.ts:69-70`: null roles now `ecm_provider`, `billing`, `billing_coordinator`; clinical coordinator worklist explicitly non-null.
- Validation: `cleanupReschedule`, `dmcOdsReadiness`, `crossRoleJourneys`: **28 passed / 29 total**, 2 files passed / 1 failed. Evidence: `/tmp/privacy-p1-approved.log`.

### New stop signal — no further implementation or suites

`src/lib/__tests__/cleanupReschedule.test.ts:54` (formerly :40): current `expect(r.ok).toBe(true)` receives `false`. The setup no longer fails before the assertion; the existing reschedule case now reaches it. The destination selector at current :50 (formerly :36) chooses the first clinician slot other than the newly booked start and does not exclude the patient's other appointments; its previously overlapping first slot can be selected again. This destination cause is source-based, not yet confirmed by a separate runtime reason capture.

Proposed, **not applied**: authorize a destination-setup-only change at current :50 that selects a genuinely patient-free interval, excluding the visit being moved. Preserve `expect(r.ok).toBe(true)`, the audit-count assertion, the persisted-start assertion, every clock and production overlap rule. The delegated approval covered only initial booking setup, so this newly exposed assertion triggers STOP.

Pending NEW coordinator CalOMS/TPS and disclosure-audit tests were not added after this stop. Full units and full browser suite were not started; there is no final completion SHA or completed P1 validation. No claim-workflow end-to-end re-verification this continuation. Earlier inventory/capability table and reported-not-built boundaries remain below.

## Changes

- `sudReportingAccess.ts:16`: sole state-reporting role is clinical_coordinator; billing roles remain denied. No chart grants changed.
- `countyReporting.ts:35`: CalOMS preparer/error owner billing_coordinator → clinical_coordinator. General reminder owner and hub role list unchanged.
- `myWork.ts:385-387`: absent viewer, locked access or none access omits SUD re-screen rows.
- `part2Disclosure.ts:119-121,180-237`: required trimmed emergency reason retained as emergencyReason in disclosure entry and audit detail. No new emergency SUD chart route.
- `countyReporting.ts:458-461`: TPS totals already suppress 1–10 via suppressCell; no change needed.

## Stop signals and proposed resolution

- `cleanupReschedule.test.ts:17` called at `:35` and `:46`: both existing cases fail before assertions because slots[0] overlaps p1's existing appointment. No P1 booking logic changed. Proposed separate setup repair: select a genuinely patient-free slot; no assertion weakening. This needs delegated approval before continuing.
- `cleanupReschedule.test.ts:86`: current reads null export's csv header; proposed `expect(out).toBeNull()`. :83 was approved but this follow-on exact line remains unresolved.
- `crossRoleJourneys.test.ts:262`: current expects billing coordinator's schema to exclude ASAM fields, but exportColumnsFor returns the full schema even though rows/export are denied. Proposed source narrowing: return [] for roles with neither ASAM nor state-reporting access, preserving this assertion.
- `dmcOdsReadiness.test.ts:69-70`: clinical coordinator's CalOMS worklist currently expected null; under Mitch's new owner decision it must succeed. Proposed split: billing roles/case manager null, clinical coordinator non-null. This is covered by Mitch's coordinator-success instruction, but not applied after the stop.

## Approved expectation changes applied

- adminNavParity:72 billing population-health read → none; dashboardMetrics:148 expects none for both billing roles, read for existing clinical readers.
- batchG snapshot: sole billing coordinator → clinical coordinator. :33-39 billing rows/worklists/DMC export null and readiness nav false; positive CalOMS actor now clinical coordinator. :58,65-66 preparer/error owner and authorized reader clinical coordinator.
- countyReporting:30,37,42 positive actor/CalOMS rows now clinical coordinator; denied-role loop substitutes billing coordinator for clinical coordinator.
- crossRoleJourneys:259-260 billing coordinator CalOMS throws / blocker rows null.
- cleanupReschedule:83 export rows null; :87 null export; :86 unresolved above.
- runAction snapshot:381-382 billing coordinator TPS allowed → hidden; :747-748 clinical coordinator TPS hidden → allowed.
- asamReporting:93 and follow-on accesses: no-consent coordinator report null/absent; dmcOdsReadiness:92 and follow-ons absent; populationHealth:20-21 no-consent SUD mode null and DAST tile absent. Positive 11-consented-patient case remains in privacyP1.test.ts:71-80.
- section4part2:14-15 passes roster case-manager identity and still expects one day.
- engagementSection:37-39 Craving logs absent; small-cohort assertion replaced by self-tracking/warning absence, no net loss of assertions.

## Capability before/after

| Capability | Rollback | Current |
|---|---|---|
| Billing claims write | Allowed | Preserved |
| Billing population health | Read | None |
| Billing coordinator state reporting | Granted | Denied |
| Clinical coordinator state reporting | Denied | Sole owner |
| Clinical coordinator SUD chart | Denied | Unchanged, P2 |
| Coordinator aggregate cohort | All patients | Consent-marked only, hidden below 11 |
| Staff check-in participation | Role-only | Chart access plus care-team identity |
| Dashboard self-tracking | Rendered | Removed |
| Generated signed-note plan | Latest note | Viewer note-class-filtered |
| Emergency disclosure reason | Not retained | Retained |

## Inventory evidence (partial, not full closeout)

- Billing access: roles.ts:503-522; claims/nav checks privacyP1.test.ts:20-35. /billing and /admin-claims remain available. Chart/search denies billing: chartAccess.ts:23-27,62-82. Inbox Documents hidden: inbox.tsx:97,134-136.
- County rows/actions/disclosures: countyReporting.ts:35-54,125-135,450-482,537-553; DMC export: dmcOdsReadiness.ts:224-238,290-322.
- Self-tracking: careTeamTrackingGate.ts:10-22; care-team identity chartAccess.ts:52-56; caseload-review.tsx:113-145; Adel Brief adelBrief.ts:188-197,336-337,390-391; aggregate block removed from EngagementSection.tsx.
- SUD aggregate consent: asamReporting.ts:89-129; reporting.tsx CalOMS gate; optional deny-default consent marker ehr.ts:1661-1669.
- Generated-note input: adelDrafts.ts:84-91; privacyP1.test.ts:89-110.

## Reported, not built / unverified

Coordinator B-item clinical access and emergency SUD-detail route are deferred to P2. Optional coordination-consent marker is not a complete signed recipient/scope/provenance/revocation/counseling-release workflow. New owner/disclosure-audit tests remain pending. Complete nested billing payload/export and all-generator inventory, end-to-end claim workflow, full units, browser suite to EXIT, screenshot restoration and final closeout SHA remain pending stop resolution. Current evidence is path-specific, not comprehensive P1 verification.