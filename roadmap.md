# Roadmap

## Batch SL (Mitch approved, Oct 24) — HARD STOP on non-named billing phone layout failure (Oct 24 rd9c fix: 945→873, still > 844; stopped)
Rollback: `0eff6798065e7362df8141759a99463e06005c9c`. No publishing.
- [x] Additive integration labels, bilingual member presentation and 15-flag source/audit inventory; approved exact-once adapter ledger saved.
- [x] NEW 34 unit cases pass; four NEW 390px axe spot checks pass; existing assertions/pins unchanged.
- [x] Only approved staffNewAudit8a2 timeout change; one added line (30s → 60s).
- [x] Initial full units 3037/3037; supervised restart; post-restart full units 3036/3037, EXIT 1.
- [x] Mitch accepted Oct 24 exact-generated-ID-only removal in batchBIntake.test.ts before unchanged privacy regex, both proofs 13/13, and full units 3,037/3,037 (historical accepted results; not rerun this continuation).
- [x] Full browser via setsid alone --workers=1 :8080 completed to literal EXIT 1: 227 passed / 1 failed, 48.6m; log and trace copied immediately to docs/sl-evidence/closeout-browser.txt and closeout-failures/.
- [ ] STOP: e2e/roleDashboards9c.spec.ts:15:5 billing above-fold at 390, assertion :27:36 expected <=844, received 945. Non-named failure; no rerun or fix. Await authorization to investigate/correct billing presentation with tests/config unchanged; accepted browser validation, screenshot restoration and successful final SHA/closeout remain blocked.
- [x] Oct 24 contentInventoryTables8b2:5: reproduced 10/10 passes (current median 17.1s, max 23.0s; rollback 0089ca4f median 17.2s, max 18.9s); 60s rule not met, no change. Mitch accepted no-change outcome and authorized closeout validation; any repeat inventory failure requires STOP, no rerun.
- [x] 19:48 authorization: supervised restart and fresh full units 3,037/3,037, 378/378 files, EXIT 0 (208.93s); evidence closeout-units.txt.
- [x] All 248 actual rollback image assets byte-identical; zero restoration writes. Report/evidence recorded; nothing published.

## Done
- B2 consent model (B2-1 … B2-6, B2-5 migration with system actor) — COMPLETE, final SHA c421de0a, browser 224/224. Follow-ups recorded: backend-phase typed-writer conversion; "advocate_release has no gate reader; decide in backend phase".

## Friday cleanup batch (Mitch approved, Oct 23) — COMPLETE Oct 24
Rollback: 9ddf890f292d97976fa34c042169eea200de99d1 (recorded first). Do not publish.
- [x] 1. Patient-name sweep and NEW label-pinning test; all requested surfaces traced. Identity comparison exceptions retain existing gates; dictation renders no name. See closeout table.
- [x] 2. Standalone-claim stored service date and local-calendar rendering corrected; NEW regression tests; no rate, rule or claim-state change.
- [x] 3. staffNewAudit8a2 investigation recorded with evidence provenance; timeout unchanged and byte-identical to rollback. Mitch owns any later timeout decision.
- [x] 4. Demo-only inventory documented, including every scenario and 16 flags (15 simulated; in_facility is off-by-default, not simulated). No code changes for inventory; unverified label coverage is explicit.
- [x] Validation: restart/full units previously accepted (3,003/3,003); full browser rerun alone --workers=1 on :8080: 224/224, 44.5m, literal EXIT 0; 17 screenshots restored and all 265 rollback images byte-identical; report and adapter ledger saved.

## Follow-ups outside this batch
- Backend phase: convert live untyped consent writers to typed records.
- Backend phase: "advocate_release has no gate reader; decide in backend phase".
- staffNewAudit8a2 timeout was unchanged in Friday cleanup; Mitch approved the scoped change Oct 24 in Batch SL (applied, validation pending).
