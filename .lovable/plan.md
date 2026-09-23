# Dashboard Cleanup, Phase 6a — refill attribution/scoping + My caseload & My tasks on the Clinician Workspace

## What I found (grounding)

- `RefillRequest` has no clinician field at all — only `patientId`, `medicationId`, `medicationName`, `requestedAt`, `requestedBy` ("patient" | "clinician"), `pharmacyNote`, `status`, `reviewedBy`, `reviewedAt`, `denyReason`. So "my refills" can only honestly mean "refills for patients assigned to me", using the existing `primaryClinicianId` assignment field.
- Dose/frequency live on the `MedOrder` (`dose`, `frequency`), reachable from the refill's `medicationId`, not on the refill row.
- `reviewRefill` already accepts `clinicianId` and already does provider-switch detection; the Clinician Workspace is simply not passing it.
- `CaseTask.assignedTo` is a **caseManagerId**. Most clinicians have no `caseManagerId` on their staff record, so `caseTasksForCM` returns nothing for them. This is the crux of item 4.
- `TaskQueueCard` is a private function inside `src/routes/case-manager.tsx`; `TaskWorkRow` is already a shared component.

## Build

### 1. Refill attribution
Pass `clinicianId: actor.clinicianId ?? actor.staffId` (the same identity pattern the page already uses for unsigned work) into both the approve and deny `reviewRefill` calls, so `reviewedBy` is recorded and provider-switch detection fires here as it does everywhere else. Attribution follows the **acting staff member**, never the clinician picked in the page's clinician dropdown — the dropdown chooses whose schedule you're looking at, not who you are.

### 2. Scoping with a real toggle
Default the tile to refills whose patient is assigned to the acting clinician (`isAssignedTo` from `src/lib/caseloadScope.ts`, reusing the caseload rule rather than a new one). A two-button toggle — "My patients (n)" / "All pending (n)" — keeps the full list one click away for coverage. Same honesty note as the caseload: this changes what's listed, not what you're allowed to open. Staff with no assignment identity, or whose assigned set is empty, open on "All pending" with a one-line explanation rather than a blank tile.

### 3. Richer rows
Add to each row: dose and frequency from the linked `MedOrder` (omitted silently when the order doesn't carry them — no invented strings), "Requested by patient" / "Requested by clinician" from the real field, and a compact status history section listing recently reviewed refills (approved/sent to pharmacy/denied) with reviewer name, timestamp, and deny reason — collapsed behind a "Recently reviewed" disclosure so the pending queue stays the focus. Rows whose `reviewedBy` was never captured (pre-fix rows) read "Reviewer not recorded" rather than guessing.

### 4. My caseload and My tasks — chosen approach
**Chosen: a compact "My caseload" summary card that links across, plus a real embedded task list.** Reasoning:

- *Caseload*: the real caseload surface is a full table with filters, assignment, export and record drawers. Re-rendering it here would be a second copy of a page that already exists. A count card ("My caseload (n)", derived from the same `scopeCaseload(..., "mine")` call Care Coordination uses, with a link to `/case-manager`) gives the clinician the number and the route without duplicating the workspace. A count pill alone in the queue row would have been cheaper, but the queue row is a row of *worklists to clear*, and a caseload is not a queue — mixing them would misrepresent it.
- *Tasks*: the opposite call. Tasks are work to do right now, and `TaskWorkRow` is already the shared, self-contained row used by both existing surfaces, so embedding it costs nothing in duplication and saves a page hop. I will extract `TaskQueueCard` out of `case-manager.tsx` into `src/components/tasks/TaskQueueCard.tsx` and have both pages render it, so the two can't drift.

**The honest wrinkle:** tasks are assigned to case managers, and a clinician usually has no case-manager identity. So the card takes an explicit source:
- Acting staff *has* a `caseManagerId` → "My tasks", tasks assigned to them; identical to Care Coordination.
- Acting staff has only a `clinicianId` → "Follow-ups on my patients", the real `caseTasksForPatient` rows for patients whose `primaryClinicianId` is theirs, with a one-line note that task assignment is a case-manager field so these are their patients' open follow-ups rather than tasks assigned to them personally.
- Neither → the card says so plainly and links to `/worklist`.

No new task model, no new assignment field, no auto-assignment of tasks to clinicians.

## Technical notes

- Files: `src/routes/clinician.tsx` (refill tile, new caseload/tasks cards), new `src/components/tasks/TaskQueueCard.tsx` (extracted, given a `source` prop), `src/routes/case-manager.tsx` (import the extracted card, delete the local copy).
- No changes to `reviewRefill`, `CaseTask`, `RefillRequest`, `caseloadScope.ts`, or "Book a session".
- Tests: extend/add a unit test asserting `reviewedBy` is set and a provider switch is raised from a second reviewer, plus a scoping test for the assigned-patient filter.

## Verification
Typecheck, full test run, build, and a live browser pass at desktop and phone: refill tile defaults to the acting clinician's own patients with a working "all pending" toggle, approve/deny records the real reviewer and raises a provider switch when the prior reviewer differs, dose/frequency/requested-by/history render, and the caseload count and task rows match `/case-manager`. Zero console errors.
