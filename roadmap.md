# Roadmap

## Done
- B2 consent model (B2-1 … B2-6, B2-5 migration with system actor) — COMPLETE, final SHA c421de0a, browser 224/224. Follow-ups recorded: backend-phase typed-writer conversion; "advocate_release has no gate reader; decide in backend phase".

## Friday cleanup batch (Mitch approved, Oct 23) — IN PROGRESS
Rollback: 9ddf890f292d97976fa34c042169eea200de99d1 (recorded first). Do not publish.
- [ ] 1. Patient-name sweep: trace all untraced surfaces in docs/privacy-p3-report.md §1 (admin-audit, admin-documents-audit, group-audit, disclosure-log, cosign-inbox, caseload-review, case-manager, clinician, CrisisQueueDetails, GroupJoinRequestsQueue, clinical-referrals, PostEnrollmentSetupCard, ClientRecordDrawer, AfbiContactForm, PatientMatchingQueue, ExistingPersonStep, WorkspaceDashboard, DashboardActionLauncher, agentic list/review/scribe). Apply staffPatientLabel/viewerCanOpenChart where reachable without chart access; "gated, no change" with reason otherwise; identity-matching screens keep names for merge-allowed roles only. NEW label-pinning test.
- [ ] 2. Standalone-claim service-date bug (billing.tsx ~:125–150): reproduce, fix app-side, NEW regression test. No billing rule/rate/claim-state change; parity exact except corrected date.
- [ ] 3. staffNewAudit8a2 slow test: investigation only, 5x timing current vs 0089ca4f on :8091. No timeout change; propose one for Mitch if supported.
- [ ] 4. docs/demo-only-inventory.md (docs only): DemoControlsBar, StaffRoleSwitcher/setActingStaff/setActingRole, AppShell staff picker, DemoStateSwitcher, QA scenario switcher + scenarios, VITE_E2E mode, devJourneys/adelBriefCheck/setInFacilityEnabled, 16 FEATURE_FLAGS simulated integrations + label locations, system migration actor, demo seed patients/staff/names, on-screen "demo"/"sample" copy. Classify (a) testing/impersonation tool, (b) simulated integration, (c) fictional seed data, (d) placeholder copy. No code changes.
- [ ] Validation: restart → full units → FULL browser --workers=1 on :8080 to literal EXIT in /tmp/fri-browser.log → screenshots vs rollback → docs/friday-cleanup-report.md + roadmap → final SHA.
