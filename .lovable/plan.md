## Goal

Give Case Managers the same population views Admins get today (Caseload table + Referral Status bar) directly in `/case-manager`, let them bulk-upload their assigned caseload via CSV, and add a "Assign clinician" control anywhere an unassigned patient shows up (Coordination Center, Case Manager page, patient record drawer).

## Scope

Frontend + a small set of additive EHR mutations. No schema/backend changes beyond the in-memory adapter. No changes to Admin behavior — the widgets are extracted into shared components and re-used.

## 1. Extract shared widgets from `admin.tsx`

New file `src/components/admin/ReferralTrackerCard.tsx`: move `ReferralTrackerCard` + `trackerStyles`/`trackerOrder` verbatim out of `src/routes/admin.tsx` and export. `admin.tsx` imports it.

New file `src/components/admin/CaseloadTable.tsx`: extract the Admin caseload `Card` (episode/coverage filters, CSV export, table, row-click → open profile). Props: `patients`, `title?`, `onOpenPatient(id)`, optional `showAssignClinician` toggle. Keep the de-identified column set unchanged so we don't leak PHI into Admin views; when `showAssignClinician` is on (Case Manager), render an extra "Primary clinician" column with an assign action (see §3).

`admin.tsx` now renders `<CaseloadTable patients={filteredPatients} … />` and `<ReferralTrackerCard referrals={referrals} />` from the shared modules — no visual change.

## 2. Surface on `/case-manager`

In `src/routes/case-manager.tsx`, below the existing Caseload card (and above the mobile card list is fine — reuse the existing grid), add:

- `<CaseloadTable>` scoped to `caseload` (already computed) with `showAssignClinician`. Title: "Caseload overview".
- `<ReferralTrackerCard referrals={referrals}>` where `referrals = useEhr(() => AdelanteEHR.listReferrals())`. Filter to referrals whose `enrolledPatientId` is either unset OR belongs to the selected CM's caseload so a CM sees pipeline relevant to them; keep 5-item cap.
- Add "Upload caseload" button next to the CM selector header (§4).

## 3. Assign clinician for unassigned patients

Add EHR mutation in `src/lib/ehr.ts` (mirrors existing `reassignPrimaryClinician` but for CM assignment + supports first-assign):

- `assignCaseManager({ patientId, caseManagerId, actorId? })` — sets `patient.caseManagerId`, emits, appends audit event `category: "assignment"`.
- Reuse existing `reassignPrimaryClinician` for clinician assignment; it already handles first-assign (prev is undefined) and emits a `ProviderSwitch` — that's the desired notification behavior per prior spec.

New shared component `src/components/AssignClinicianButton.tsx`:
- Props: `patientId`, optional `serviceType` hint.
- Popover with `<Select>` of clinicians filtered by `AdelanteEHR.cliniciansForService(serviceType)` if provided, else `listClinicians()`. Shows credential + Medi-Cal status + current caseload count as a light "load" hint.
- On confirm: calls `reassignPrimaryClinician({ patientId, clinicianId, initiatedBy: "admin" })` and toasts success.
- If `patient.primaryClinicianId` already set → button label "Reassign"; else "Assign".

Wire it into three places:

1. `src/routes/admin-coordination.tsx` — the "Unassigned primary clinician" list currently links to `/case-manager`; replace that link with `<AssignClinicianButton>` inline. Also add a Case Manager assign control there for patients with no `caseManagerId`.
2. `src/components/admin/CaseloadTable.tsx` — when `showAssignClinician`, render the button in the new column.
3. `src/components/ClientRecordDrawer.tsx` — in the header/summary area, next to primary clinician display, render the button (visible to roles `case_manager`, `clinical_coordinator`, `sys_admin`; use existing `useActingRole` and the `canAccess` matrix as gate — treat as `care_plan` write class for authorization since assignment affects care routing).

## 4. CSV caseload upload

New component `src/components/CaseloadUploadDialog.tsx`. Case Manager clicks "Upload caseload" → dialog with:
- File input (`.csv`), plus a "Download template" link that produces headers: `cin,first_name,last_name,dob,phone,program_id`.
- Parse CSV client-side (small helper — no new dep; simple split with quote handling is fine for the MVP; if we need robustness we can add `papaparse` later, but keep this build depless).
- Match algorithm per row:
  1. If `cin` matches an existing patient → assign that patient to the acting CM (via new `assignCaseManager`).
  2. Else if `program_id` matches → same.
  3. Else if `first_name`+`last_name`+`dob` all match → same, but flag row as "matched by name/DOB — confirm".
  4. Else → create new patient via `AdelanteEHR.createPatient` with the CSV fields, assign to CM.
- Preview screen shows counts (matched / created / skipped / needs review) with a row list; user clicks "Apply" to commit. Emits one toast summary and appends audit events.

The dialog is added to the CM page header and also linked from the "Assign in caseload" spot on `/admin-coordination`.

## 5. RBAC + audit

- `assignCaseManager` / `reassignPrimaryClinician` are already surfaced only from staff pages. Gate the UI on `useActingRole()` roles listed above; hide buttons for `peer_specialist` and patient-only sessions.
- Every assignment/upload writes to the audit log so `/admin-audit` reflects it.

## Out of scope

- Any change to Admin's KPIs, billing, or PopulationCarePlanStrip.
- Server persistence — this stays in the in-memory adapter until the native EHR backend lands.
- Server-side CSV validation, dedupe against multi-CM conflicts, or role-based reassignment approvals.

## Verification

- Build + typecheck clean.
- `/admin` renders identically (shared components imported, not duplicated).
- `/case-manager` shows the extracted Caseload overview + Referral Status; both respect the selected CM.
- CSV upload with a mixed-match sample assigns existing patients and creates new ones, with the correct preview counts.
- On `/admin-coordination`, `/case-manager`, and the Client Record drawer, an unassigned patient can be assigned a clinician; audit log gets a `provider_switch` (or first-assign) entry and the record drawer/coordination list updates without reload.
