# AUDIT baseline inventory (rollback 649459806dd4)

## src/routes/admin-audit.tsx — admin-audit-table
- Source / filters / hidden rows / order: redactAuditEvents(listAuditEvents), limit 200; category/patient/actor/date plus content/read/brief predicates; brief excluded outside ACCESS_LOG_ROLES; store order.
- Existing hooks: data-testid="access-log-label".
- Row actions + handlers: none; exportGoalChanges unchanged.

## src/routes/admin-documents-audit.tsx — documents-audit-table
- Source / filters / hidden rows / order: redactAuditEvents(listAuditEvents clinical/advocate), DOCUMENT_ACTIONS, patient/action filters; denied documents access returns []; store order.
- Existing hooks: data-testid="documents-audit-table".
- Row actions + handlers: none.

## src/routes/consent-audit.tsx — consent-audit-table
- Source / filters / hidden rows / order: redactAuditEvents consent/disclosure/advocate stream with patient/action/category filters and categories/gates projection; store order.
- Existing hooks: data-testid={`gate-${ok ? "pass" : "fail"}`}; data-testid="consent-audit-table"; data-testid="advocate-gates-cell".
- Row actions + handlers: none; advocate-gates-cell and gate-pass/gate-fail.

## src/routes/group-audit.tsx — group-audit-table
- Source / filters / hidden rows / order: clinical stream, ACTION_SET/patient/action/date; protected joins excluded by roleSeesGroupJoinRequest BEFORE redactAuditEvents; store order; group-audit-hidden count preserved.
- Existing hooks: data-testid="group-audit-hidden"; data-testid="group-audit-table".
- Row actions + handlers: none.

## src/routes/admin-permissions.tsx — action-audit-feed
- Source / filters / hidden rows / order: events filtered eventFilter/feedRole; store order; redactAuditEvent subject only.
- Existing hooks: data-testid="permissions-matrix"; data-testid="capabilities"; data-testid="capability-sud-reporting"; data-testid="sud-reporting-post-mvp"; data-testid="capability-note-content"; data-testid="feature-flags"; data-testid={`simulated-${flag.id}`}; data-testid="action-audit-feed".
- Row actions + handlers: none.

## src/routes/admin-permissions.tsx — permissions-matrix
- Source / filters / hidden rows / order: matrix.filter role/group/state/search; role/action rows, not record classes; matrix order.
- Existing hooks: data-testid="permissions-matrix"; data-testid="capabilities"; data-testid="capability-sud-reporting"; data-testid="sud-reporting-post-mvp"; data-testid="capability-note-content"; data-testid="feature-flags"; data-testid={`simulated-${flag.id}`}; data-testid="action-audit-feed".
- Row actions + handlers: none; excluded: existing matrix is an action-capability comparison, not record-class rows; retain its sticky dense comparison and CSV inputs.

## src/routes/disclosure-log.tsx — disclosure-log-table
- Source / filters / hidden rows / order: listDisclosureLog channel/recipientType/patient/emergencyOnly; DISCLOSURE_LOG_ROLES route gate; store order.
- Existing hooks: data-testid="disclosure-log-table"; data-testid="access-log-table".
- Row actions + handlers: existing Mark reviewed calls markEmergencyReviewed + _emit + toast; removed from this read-only table per task.

## src/routes/disclosure-log.tsx — access-log-table
- Source / filters / hidden rows / order: patientId ? accessEventsFor(patientId).slice(0,100) : []; same route gate; store order.
- Existing hooks: data-testid="disclosure-log-table"; data-testid="access-log-table".
- Row actions + handlers: none.

## src/routes/quality-compliance.tsx — outside-caseload-table
- Source / filters / hidden rows / order: outsideCaseloadReport serialized through report; same report gate and order; enclosing outside-caseload-report retained.
- Existing hooks: data-testid="restricted-opens"; data-testid="outside-caseload-report"; data-testid="unusual-volume"; data-testid="restrict-record".
- Row actions + handlers: View toggles drill only; preserve as read-only expansion.

## Completion / validation
- Converted eight read-only tables: admin-audit-table, documents-audit-table, consent-audit-table, group-audit-table, action-audit-feed, disclosure-log-table, access-log-table, outside-caseload-table (inside unchanged outside-caseload-report).
- Kept permissions-matrix: baseline rows are role/action combinations, not record classes; retain the existing capability comparison and CSV source rather than changing its model.
- No permissions, lib files, row filters, export functions or goal audit export calls changed; goal exporter verified byte-identical to rollback.
- Existing gap recorded, not fixed: action-audit-feed uses raw event.detail for action/who/reason while only subject uses redactAuditEvent. Disclosure emergency review mutation removed from this table to satisfy requested read-only scope; no replacement mutation added.
- Added src/components/__tests__/auditTables8b3.test.tsx: 2 tests passed; e2e/auditTables8b3.spec.ts written, browser deliberately not run per coordinator rules. Semantic eslint: zero errors, one existing fast-refresh export warning; full style lint reports pre-existing formatting as well as new formatting.
- devJourneys does not expose redactAuditEvents; browser projections use exposed AdelanteEHR store with identical caller predicates (redaction preserves IDs).
