## Goal
Add a **Staff sign-in** option on `/auth` so I can log in as a clinician (or any staff role) and land in the correct workspace with the acting role set — currently the page only lists patient personas.

## Changes

### `src/routes/auth.tsx`
- Convert the mode toggle from 2 tabs to 3: **Sign in (patient)** · **Sign up (patient)** · **Staff sign in**.
- Add a Staff sign-in panel with:
  - **Role picker** using `STAFF_ROLES` from `src/lib/roles.ts` (Therapist, PMHNP, Case manager, Peer specialist, Clinical coordinator, Credentialing coordinator, Billing, Billing coordinator, System admin).
  - When role is **Therapist** or **PMHNP**, show a secondary **Clinician identity** picker populated from `AdelanteEHR.listClinicians()` so the session is tied to a real clinician record (needed for unsigned-notes queue, availability, credentials pages).
  - Email/password inputs (cosmetic, same as patient sign-in — demo has no real auth).
  - Continue button.
- On submit:
  - Call `setActingRole(role)` from `src/lib/roles.ts`.
  - Persist a staff session to `localStorage`/`sessionStorage` under a new key `adelante.staff.session` (`{ role, clinicianId? }`) mirroring the existing patient `remember` behavior.
  - Clear the patient `adelante.session` key so the app doesn't act as a patient simultaneously.
  - Route to the correct workspace:
    - therapist / pmhnp → `/clinician`
    - case_manager / peer_specialist → `/case-manager`
    - clinical_coordinator → `/admin-coordination`
    - credentialing_coordinator → `/admin-credentialing`
    - billing / billing_coordinator → `/billing`
    - sys_admin → `/admin`
- Keep the existing patient persona picker unchanged.

### Small helper note
No new files. `setActingRole` and `STAFF_ROLES` already exist and persist to localStorage; this plan just exposes them from the sign-in surface. Patient flow, RBAC matrix, and downstream pages remain untouched.

## Out of scope
- Real password auth / Lovable Cloud auth (this is still the demo persona model).
- New staff-only routes or permission changes.
- Auto-redirect guards on staff routes.
