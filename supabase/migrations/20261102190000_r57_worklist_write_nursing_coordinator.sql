-- R57 follow-up 3, option B (Mitch 2 Nov 12:52 CT).
-- Draft — pending clinical sign-off and the go-live permissions audit; not applied.
-- Keeps the Phase 1 grant seed (20261027021308) in sync with src/lib/roles.ts:
-- worklist read -> write for nurse_rn, lvn and clinical_coordinator only.
update app.record_class_grants set level='write'
where record_class='worklist' and role in ('nurse_rn','lvn','clinical_coordinator') and level='read';
