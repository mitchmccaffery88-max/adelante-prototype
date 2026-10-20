# Privacy P2 — COMPLETE

## Closeout — Oct 20, 2026
- Approved rollback: `c5c3da6af29fc6ed3a3064d84f7b9b9654c7fe28`.
- Original starting HEAD: `14fe8a744a3cb730390e39447f84b78fd3d5f054`.
- Closeout starting HEAD / validated source checkpoint: `3874f3859cfff66622b38cc4c4c73b1678679919`. Final closeout SHA is reported in chat after the managed checkpoint records these documentation and screenshot changes; this report cannot contain its own commit hash.
- No publication, no Phase 9a work, no grant beyond the approved clinical-coordinator scope.

## Validation
| Check | Result |
|---|---|
| Full unit suite (preceding implementation turn) | **2,775 passed / 2,775 total**, 344 files |
| Full browser closeout rerun | **180 passed / 180 total; 0 failed; EXIT 0**, 31.4 minutes |
| Browser configuration | `E2E_BASE_URL=http://localhost:8080 bunx playwright test --workers=1` |
| Live emergency browser test | Passed in full rerun, **7.9s** |
| Slow therapist New-menu test (`staffNewAudit8a2.spec.ts:29`) | Passed in full rerun, **28.2s**; retain slowness follow-up, unchanged 30s limit |
| Flake exceptions | Neither used; no failure, timeout or retry edits |
| Rollback screenshots | All **20** match rollback byte-for-byte; **16** regenerated images restored |
| New evidence retained | `e2e/screenshots/p2-emergency-unlock.png` |
| Latest observed preview compilation | **build OK**, 2026-10-20T05:56:12Z |

The prior `/tmp/p2/e2e-full.log` and test process were unavailable in the closeout sandbox, so no prior partial result was claimed. The FULL suite was restarted in the background before any project edits and polled through its literal **EXIT 0** line. Fresh log: `/tmp/p2/e2e-full.log`. No production-code changes occurred during closeout. Units above are the previously completed P2 run, not a new closeout rerun.

## Exact role capabilities — before / after
Only `clinical_coordinator` gains access. The generic `screeners_sud` matrix, other roles' SUD/ASAM/group/write rules, and P1 state-reporting ownership remain unchanged. The B-item column describes the new P2 projection, not a replacement for pre-existing role-specific access.

| Role | Existing SUD screener capability | P2 B-item policy before → current | Counseling before → current | State reporting before → current |
|---|---|---|---|---|
| ecm_provider | consent-gated | no new P2 grant → unchanged | none → none | none → none |
| cf_care_manager | none (stored-result author exception unchanged) | unchanged | none → none | none → none |
| sud_counselor | read | unchanged | none → none | no P1 grant → unchanged |
| clinical_trainee | consent-gated | unchanged | none → none | none → none |
| medical_assistant | none | unchanged | none → none | none → none |
| peer_specialist | consent-gated | unchanged | none → none | none → none |
| community_health_worker | none | unchanged | none → none | none → none |
| therapist | read | unchanged | none → none | no P1 grant → unchanged |
| physician | read (PMHNP inheritance) | unchanged | none → none | no P1 grant → unchanged |
| pmhnp | read | unchanged | none → none | no P1 grant → unchanged |
| nurse_rn | read | unchanged | none → none | none → none |
| lvn | read | unchanged | none → none | none → none |
| billing | none | unchanged; no P2 data | none → none | none → none |
| clinical_coordinator | none → none | none → allowlisted projection with tpo/specific_written or actor+patient-specific active emergency | none → read only with separate release | CalOMS/TPS owner → unchanged |
| credentialing_coordinator | none | unchanged | none → none | none → none |
| billing_coordinator | none | unchanged; no P2 data | none → none | none → none |
| sys_admin | none | unchanged | none → none | no P1 grant → unchanged |


## Implemented gates and surfaces
| Surface / files | Before → after |
|---|---|
| `ehr.ts`, `coordinatorSudAccess.ts`, `roles.ts` | No coordinator B-item grant → read-only, per-patient `tpo` / `specific_written` or live actor+patient emergency; absent consent hides detail. Separate `sudCounselingNotesRelease` absent/false blocks counseling; no other role changes. |
| `coordinatorSudView.ts` | New minimum-necessary projection: SUD diagnoses, treatment-plan fields, MOUD doses/adherence, labs/toxicology, attendance, discharge summaries, standard SUD progress notes. Group narrative, unrelated chart fields and screener item answers are excluded. Separately released counseling remains segregated. |
| `CoordinatorSudPanel.tsx`, `record.$patientId.tsx` | New read-only projected panel, access-view audit, ConfirmDialog/FormField unlock, active banner and automatic expiry refresh. Hidden content is not replaced by restricted-detail placeholders. |
| `coordinatorSudEmergency.ts`, `chartActions.ts`, `actions/runAction.ts` | New patient/site/actor-gated registry action. Required allowed reason and detail; audit/evaluation and court order require reference. Four hours exactly; counseling never unlocked. One domain audit per successful unlock. |
| `part2Disclosure.ts`, `chartAccess.ts`, `quality-compliance.tsx` | Emergency reason/detail/reference/start/end retained, disclosure pending compliance review, existing restricted-open review queue reused; medical-emergency follow-up supported. Boundary revalidates evidence. |
| `patientSearch.ts`, `StaffPatientSearch.tsx` | Coordinator results explicitly identifier-only, not raw clinical bodies. No note-body search introduced. |
| `notePdf.ts`, `printRecord.ts`, `print.patient-records.$patientId.tsx` | Coordinator authorized-note filter before disclosure; actor propagated; identity and bounded note output only, with disclosure/access auditing. Counseling without release and group narrative are excluded. |
| `NotePeekSheet.tsx`, `unsignedWork.ts` | Coordinator-specific authorized-note filtering, no broad SUD screener grant. |
| `agenticPrototype.ts`, `adelDrafts.ts`, `askAdel.ts`, `adelBrief.ts`, `adelBriefCheck.ts` | Coordinator summaries/drafts consume bounded sources, not raw chart/screener/private self-tracking payloads. Consent/release/emergency/actor cache partition and current-state reads prevent stale permissions; counseling requires release. |
| `devInspect.ts` | `access()` exposes `pd` (disclosure log) and `cs` (coordinator gate) using the app's actual module instances for verification. **Dev-only**: installed only for `import.meta.env.DEV` or the explicit isolated `VITE_E2E` build; not ordinary production. |

Coordinator medication/MAR **print sections are intentionally unchanged and not added**: B is a ceiling, not a requirement. No broad ASAM worksheet, aggregate, group-note, billing or state-reporting grant was added by P2. Outpatient, Draft and Simulated boundaries remain in place.

## Approved existing-test adjustments
- Permission snapshot: exactly **17** added `coordinator_emergency_unlock: "hidden"` keys; removing only those lines reproduces the original snapshot byte-for-byte. All 16 non-coordinator roles are hidden. Coordinator is also hidden in this matrix because it supplies no patient and the real unlock gate requires patient plus actor/site eligibility; the real eligible-patient unlock test succeeds. No other entry changed.
- `privacyP1.test.ts`: only counseling fixture uses `PRIVATE-P1-COUNSELING`, asserted absent for coordinator with TPO and no separate release. Standard SUD marker/fixture and other assertions retained; additional both-ways test proves standard marker absent without consent and present with `tpo`.
- Two NEW P2 group assumptions corrected to compare existing baseline role access and explicitly deny group narrative; existing production group policy unchanged.

## New test evidence
- `src/lib/__tests__/privacyP2.test.ts`: both consent types, each B-item gate, no-consent denial, separate counseling release, other-role parity, required evidence/reference, registry audit/disclosure/review, actor/patient isolation and exact four-hour expiry.
- `src/lib/__tests__/privacyP2Surfaces.test.ts`: identifier search, note preview/export, PDF/print disclosure, bounded summary/counseling inclusion and expiry.
- `e2e/coordinatorEmergencyP2.spec.ts`: real coordinator chart flow with court-order pick, reference and detail; active banner; all eight B headings visible; counseling heading absent; exactly one emergency audit and disclosure entry, pending compliance review and linked review item; live gate confirms B allowed and counseling denied. It uses real app module state, not duplicate test-only stores.
- Evidence image `e2e/screenshots/p2-emergency-unlock.png` visually reviewed: banner and eight sections render, counseling absent. This fixture has attendance records; several other sections legitimately say “None recorded.” It is not claimed as populated live-row coverage for every category.

## Closeout / next
P2 is complete under the approved validation and scope. No remaining P2 stop item. Phase **9a-1 is next in sequence, not started**. Retain the pre-existing slow therapist New-menu test investigation; do not raise timeout or retries. No publish.
