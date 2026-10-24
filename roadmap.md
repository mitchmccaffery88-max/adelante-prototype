# Roadmap

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
- staffNewAudit8a2 timeout proposal is with Mitch; no change authorized or made in this batch.
