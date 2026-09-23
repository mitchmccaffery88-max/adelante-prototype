# Dashboard Standardization — Phase 5b: shared staff top bar

## What I found in the current code

- `StaffBreadcrumbs` already renders once for every staff page, inside the staff shell in `AppShell` (`<StaffNavSidebar /> + <StaffBreadcrumbs /> + <Outlet />`). It is the only per-page strip that all staff routes share today.
- The Clinician Workspace header holds only role/credential and the acting-clinician picker. "My work" exists only as one pill in the queue-count row on that single page.
- The Patient chart tab uses a plain dropdown listing every patient (name + episode day). Care Coordination keeps its own separate caseload list.
- Patient records carry the four searchable fields already: first/last name, `dob`, `programId` (e.g. ADL-2026-001), and `cin` (optional).
- `myOpenItems(...).total` is the count the queue pill and `/my-work` both already use.
- Assignment identity from Phase 1g lives in `caseloadScope.ts` (`caseManagerId` / `clinicianId` on the staff row vs. `caseManagerId` / `primaryClinicianId` on the patient).
- Permission matrix: `demographics` read-or-write covers ECM Provider, CF Care Manager, SUD Counselor, Clinical Trainee, Medical Assistant, Peer Specialist, CHW, Therapist, PMHNP, Billing coordinator, Clinical coordinator, System admin. It excludes Credentialing coordinator and Billing coordinator (expanded).

## Plan

### 1. Where the bar lives
Extend the existing shared staff strip rather than adding a second bar: rename the block in `StaffBreadcrumbs.tsx` into a `StaffTopBar` that keeps the current breadcrumb trail on the left and adds the new controls on the right. It already renders once in the staff shell, so every staff route gets the identical bar and there is no new nav-shell path to leak.

### 2. Typed patient search
New `src/components/StaffPatientSearch.tsx`, plus a pure matcher in `src/lib/patientSearch.ts` (unit-testable):
- Matches typed text against full name, `dob` (accepting `1990-04-02` and `04/02/1990`), `programId`, and `cin`.
- Results show name, DOB, and program ID; choosing one navigates to `/record/$patientId`.
- Keyboard accessible (command-style list, arrow keys + Enter).
- Rendered only when `canAccess(role, "demographics")` is not `none`.

**Ranking decision:** results rank the viewer's own assigned patients first (same assignment identity as Phase 1g), then everyone else, because a clinician typing three letters almost always means their own client. Assigned rows get a plain "Your caseload" marker. Nothing is filtered out, and the field carries the honest note that search covers all patients and is not an access boundary.

### 3. My Work entry
A persistent button in the bar showing `myOpenItems(...).total` — the exact same helper the dashboard pill and `/my-work` already call, so the numbers cannot diverge. Shown only when the shared nav registry already grants `/my-work` to the acting role (`canSeeNavEntry`), so it matches the sidebar exactly.

### 4. Chart tab lookup
Replace the bare dropdown in the Clinician Workspace Patient chart tab with the same search component (in an inline variant that selects into the tab instead of navigating). The tab still opens blank until a patient is chosen.

### 5. Role picture (to be confirmed on screen)
- Search + My Work: ECM Provider, SUD Counselor, Therapist, PMHNP, Clinical Trainee, Peer Specialist, CHW, Medical Assistant, Clinical coordinator, CF Care Manager, System admin (My Work subject to its existing gate).
- Search only, no My Work: Billing coordinator.
- Neither: Credentialing coordinator, Billing coordinator (expanded) — breadcrumbs only.

## Not in this phase
No agentic button, no My Tasks changes, no Follow-ups move, no Resource Referral changes, no change to record-level access checks, and Care Coordination keeps its own caseload list.

## Verification
Typecheck, full test run (plus new tests for the matcher and role visibility), and a live browser pass at desktop and phone widths as a clinician, a care-coordination role, and a credentialing coordinator: consistent bar across several staff pages, each search field finding a patient and opening the record, no search for roles without demographics, My Work count equal to `/my-work`, chart tab using the same search, zero console errors.
