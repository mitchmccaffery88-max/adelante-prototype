# Phase 5c — My tasks upgrade, per-client follow-ups on the record, demo CINs

## Part 0 — Demo CINs

Findings:
- `Patient.cin` is the one canonical CIN. The only validation in the system is in
  `recordEligibilityCheck`: trimmed, upper-cased, must be exactly 9 characters.
  Real Medi-Cal CINs are 8 digits + 1 letter, and every existing example in the
  codebase follows that shape (`99887766A`, `98765432A`).
- No seeded patient and no seeded referral carries a CIN today — the only CIN
  values in the repo are in tests. So there is nothing to collide with, but I
  will still pick a distinct block.

Build: add fictional CINs in the `9xxxxxxxA`-style block to four seeded
patients (Daniel M., Rosa T., Marcus L., Alicia Serrano), each 9 characters,
each distinct from every test/fixture value already in the repo. Then verify
live that typing a CIN into the shared top-bar search finds the patient.

## Part 1 — My tasks (Care Coordination)

Current: `TaskQueueCard` offers only Snooze 3d / Done / Reopen / Show all.
The record already carries priority, worklistStatus, claim, type, and
automation provenance, and `/worklist` already exposes claim/status/filter.

Missing capability in the data layer: there is no way to edit a task's due
date, priority, or add a note. Everything else already exists.

Build:
- `AdelanteEHR.updateCaseTaskFields(id, patch, staffName, role)` in the EHR —
  patch limited to `title`, `detail`, `dueDate`, `priority`; writes an audit
  entry (`case_task_updated`) with the changed fields, actor and role, matching
  the attribution shape `setWorklistStatus` already uses.
- `AdelanteEHR.addCaseTaskNote(id, text, staffName, role)` — appends to a new
  optional `notes` array on `CaseTask` (`{ text, authorName, authorRole, at }`),
  audited the same way. Optional field, so existing rows read fine.
- `TaskQueueCard` rows become expandable. Collapsed row keeps today's summary.
  Expanded shows: full detail, type, priority, worklist status, claim state,
  automation provenance, and the note history.
- Expanded actions: change status (reusing `setWorklistStatus`), edit due date
  and priority, add a note, and "Complete and schedule follow-up" which
  completes the task and opens a small inline form creating the next task via
  the existing `createCaseTask` path (same patient, same assignee, prefilled
  title "Follow-up: …").
- Every change shows who/when inline (last updated by, note authorship).

Reassignment: recommend it stays out of this card and off `/worklist` too.
`assignedTo` is a caseManagerId and reassigning is a caseload decision already
handled by the real assignment path (`reassignCaseManager` / the profile
assignment UI), which writes provider-switch and audit records. Adding a
second, unattributed reassign control in a task card would fork that. The card
will instead show who the task is assigned to, and the claim state.

## Part 2 — Per-client follow-ups on the record

Finding: the patient record ALREADY has a Tasks section
(`recordSections.tsx` → `case` group, id `tasks`, `TasksTab`), reading the same
`caseTasksForPatient` rows as `PatientTasksCard`, with add + complete. So this
is a consolidation, not a move.

Build:
- Remove `PatientTasksCard` from the Care Coordination per-client column.
- In its place, a compact link card: open-follow-up count plus a link to
  `/record/$patientId?section=tasks`, so caseload visibility is kept.
- Bring the richer row UI from Part 1 into `TasksTab` (shared component, used
  by both card and record section) so due date/priority/status/notes editing
  exists on the record too.

### Open items rollup

Sources that genuinely exist per patient today:
- Unsigned notes / undocumented encounters — `listUnsignedWork()` (filterable
  by patient), links to `/notes-queue` and the record's Notes section.
- Unresolved SDOH needs — `patient.sdohPlan.items` with status not completed,
  links to the record's SDOH section.
- Pending refill requests — `listRefillRequests({ patientId, status: 'pending' })`,
  links to the record's Orders section.

Sources that do NOT exist: there is no reschedule-request record and no
group-access-request record anywhere in the model. I will not invent them.

Build a read-only "Open items for this client" block at the top of the record
Tasks section, listing only the three real sources, each row linking to where
the work is actually done. No new trackers, no new state.

## Non-goals
No Resource Referral changes, no agentic entry, no new task types, no change to
`/worklist` behaviour beyond reusing its helpers.

## Verification
Typecheck, full test run, plus new unit tests for the task update/note APIs.
Live browser at 1280 and 390 wide: CIN search finds a patient; My tasks rows
expand and each edit is attributed; follow-ups add/complete from the record;
rollup links land in the right sections. Zero console errors.
