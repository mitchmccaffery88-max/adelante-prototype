# SculptSoft handoff — chart access and notifications

**Draft — pending exec RBAC review** (access model approved by Mitch, 8 Oct).
Everything below runs client-side in the prototype. None of it is a security
boundary until SculptSoft enforces it on the server.

## 1. Server-side chart-entry enforcement at the API
- Prototype rule: `src/lib/chartAccess.ts` → `chartEntryFor(role, staffId, patientId)`.
- Roles with chart entry: physician, pmhnp, nurse_rn, lvn, therapist, sud_counselor,
  clinical_trainee, medical_assistant, ecm_provider, cf_care_manager, peer_specialist,
  community_health_worker, clinical_coordinator.
- No chart entry and no patient search: sys_admin, billing, billing_coordinator,
  credentialing_coordinator.
- Every API that returns patient-scoped data must run this check first, then the
  existing record-class matrix (`roles.ts`), live Part 2 consent and the role limits for
  therapy notes, medication management and psych evaluation. Entering the chart never
  widens any section.
- UI gate: `resolveChartRouteAccess` (`navGuard.ts`) covers `/record/$patientId` and
  print. Notification deep links use the same rule. Denied users see "This chart isn't
  available for your role".

## 2. Site-scoped access model
- A person may open a chart only when the patient's enrolled site (`Patient.enrolledSiteId`,
  falling back to the primary clinician's site, then Premier Visalia) is one of the sites
  in that person's staff calendar (`workingCalendar.ts`).
- Being on the care team does not give access across sites.
- Search (`searchablePatientsFor`) returns only patients the person can open. Assigned
  patients sort first. Restricted records are hidden from search except for the care team.
- Search shows only on staff work pages (`searchPlacement.ts`), never on admin, setup,
  content or reporting pages.

## 3. Restricted-record workflow
- Set or cleared by sys_admin or the clinical coordinator, with a reason
  (`chart_restrict` registry action).
- Opening a restricted chart requires a reason (`chart_restricted_open`). The open is
  audited and creates a "Restricted record opened" item in the credentialing
  coordinator's Needs my action. The credentialing coordinator stands in for compliance.
- Compliance reviews the item with a note (`compliance_restricted_review`).
- Server needs: a persisted restriction flag, a reason-required open endpoint, and a
  compliance queue.

## 4. Immutable access log
- The prototype log (`accessLog.ts`) is an in-memory audit stream, marked "Prototype".
- Production needs append-only, tamper-evident storage written by the API on every
  chart, section, print and export read. The browser must never write it.

## 5. Compliance reporting jobs
- "Charts opened outside caseload": weekly counts per person, with drill-down to
  access-log rows (`complianceMonitoring.ts`).
- "Unusual volume": more than 30 distinct charts in a day (Draft threshold).
- Server: scheduled jobs over the immutable log. Results are visible only to sys_admin
  and the credentialing coordinator.

## 6. Per-user notification state
- `AppNotification.readBy` keeps read state per person for role broadcasts. One reader
  never marks a broadcast read for anyone else.
- Two lanes: My work holds tasks; the bell holds updates. Each task gets at most one bell
  pointer ("New task: …") with a `taskKey`. When the task leaves My work, the pointer
  closes (`notificationRouting.ts`, `closeTaskPointer`).
- Bell filters: All, Tasks, Updates, Mentions, plus Mark all read.
- Routing goes to named people where we know them: LVN cosign → the named supervising
  RN; higher-level-of-care changes → the assigned therapist or primary clinician, plus
  the coordinator.
- Server: a per-recipient notification table (recipient, read_at, closed_at, task_key).
  Clients must not share read rows.

## 7. Push/SMS text templates with Part 2 lint
- All notification text is neutral: no SUD terms, drug names, schedule classes,
  instrument names, scores or "Part 2".
- `accessBatch.test.ts` scans every `notify({...})` literal in `src/lib`.
- Server: keep templates in one catalog and run the same lint in CI before a template
  ships to push or SMS providers.
