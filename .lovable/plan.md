# Case Manager / Peer Specialist — Client Record Gap Analysis & Plan

## Current state (what already works)

Case Manager workspace (`src/routes/case-manager.tsx`) selects one client from the caseload and surfaces separate cards in the right rail:

- Weekly check-in logger (modality, attended, note) → `AdelanteEHR.addCheckIn`
- Recent check-ins (last 5)
- Coverage actions (mark verified, request reactivation, enrollment-assist task)
- Eligibility flags (ECM, JI Reentry, Community Supports housing/food/transport)
- Resource referral create (category + provider) → `AdelanteEHR.addResourceReferral`
- Recent referrals (list only)
- External coordination card (informational only, no log)
- `PatientProfileDialog` opens a full demographics/contact/emergency/CIN editor with save

## Gaps (what the user called out)

| Area | Gap |
| --- | --- |
| Check-ins | No way to edit/delete a past entry; needs-flagged toggles exist in the type but aren't in the form; check-in list is read-only |
| Contact prefs | Editable only inside the profile dialog; not visible on the working caseload panel; no "SMS opt-in" toggle surfaced next to `smsFallback` |
| Emergency contact | Editable only in profile dialog; not shown in the working panel |
| Eligibility | Toggles work but there's no space for a short justification/source note per flag, and no "as of" date |
| Resource referrals | No status updates (pending → accepted → completed), no note, no follow-up date, no delete; patient never sees them |
| **SDOH plan** | Type exists (`sdohPlan.items` with `need / referralId / status / note`) but **zero UI and no `AdelanteEHR` methods** — completely unimplemented |
| **External coordination log** | Card is decorative — no data model, no entries, no Part 2 gating on individual entries |
| Peer Specialist view | Peer specialists route through the same page but there is no "peer note" surface separate from case-manager notes; RBAC matrix in `roles.ts` already distinguishes `peer_notes` from `case_notes` |
| Patient portal | `PatientHome` shows contact prefs + emergency but **does not show resource referrals or SDOH items in progress** — patient has no visibility into what CM is working on for them |
| Clinician view | `ClinicianWorkspace` has no SDOH / resource-status panel, so providers can't see what's impacting continuum of care |
| PHI gating | Referral `sudDisclosureConsent` is captured on create but never enforced when the entry appears in staff lists, and coordination-log has no Part 2 gate at the entry level |

## Plan — five focused edits

### 1. Data-model + service additions (`src/lib/ehr.ts`, additive only)

- Add `ExternalContact` type and `Patient.externalContacts?: ExternalContact[]` (id, agency, contactName, phone/email, role e.g. probation/parole/housing/PCP, part2Sensitive flag, createdAt).
- Add `CoordinationEntry` type and `Patient.coordinationLog?: CoordinationEntry[]` (id, date, partyType, party, direction in/out, channel, summary, part2Disclosed boolean, createdBy).
- Add `CheckIn.needsFlagged` full write path (housing/food/employment/transport/substanceUse toggles).
- Extend `ResourceReferral` with `status`, `note?`, `followUpDate?`, `updatedAt`, `visibleToPatient` (default true; false when Part 2 gated).
- Extend `SdohPlanItem` with `id`, `createdAt`, `updatedAt`, `visibleToPatient` (default true).
- New service methods (all mutate the in-memory store + notify subscribers): `updateCheckIn`, `deleteCheckIn`, `updateResourceReferral`, `deleteResourceReferral`, `addSdohItem`, `updateSdohItem`, `deleteSdohItem`, `addCoordinationEntry`, `addExternalContact`, `deleteExternalContact`, `setEligibilityNote(patientId, flagKey, note, asOf)`.
- No breaking changes: existing callers stay valid because every new field is optional.

### 2. New shared "Client record" editor drawer

Create `src/components/ClientRecordDrawer.tsx` — a tabbed side sheet (uses `Sheet` from shadcn) that both Case Manager and Peer Specialist open from the caseload. Tabs:

1. **Overview** — read-only header (name, program ID, DOB, CIN masked, day X/90, coverage badge, crisis flag) + last-contact freshness.
2. **Contact & preferences** — inline editors for phone, email, SMS opt-in switch, preferred channel, best time, language, address, emergency contact. Writes through `updateProfile` (already exists).
3. **Check-ins** — add / edit / delete, with needs-flagged toggles inline; list shows last 10 with edit buttons.
4. **SDOH plan** — add need (housing/food/legal/benefits/…) with status (identified/sent/accepted/scheduled/completed/not_completed), note, "visible to patient" switch. List of open items with quick status change.
5. **Resource referrals** — add + status pipeline (pending → accepted → completed), note, follow-up date, delete, "visible to patient" switch (auto-off when SUD-referral + no Part 2 consent).
6. **Eligibility** — existing ECM/JI/Community Supports toggles plus an "As of" date and a short source note per flag.
7. **External coordination** — external contacts table (add/remove) + coordination log entries (add: date, party, direction, channel, summary). Each new entry has a required "Part 2 detail disclosed?" checkbox; when true and Part 2 consent is off, the save is blocked with the existing 42 CFR guardrail message.
8. **Peer notes** (visible only when `useActingRole() === "peer_specialist"`, gated via `GatedCard`) — free-text peer-support notes; writes to a new `Patient.peerNotes?: PeerNote[]`.

RBAC: consume `useActingRole()` + `canAccess()` from `src/lib/roles.ts` so peer specialists see peer-notes tab and case managers see case-notes tab; SUD-flagged fields render inside `GatedCard` where the matrix marks them `consent_gated`.

### 3. Wire into `case-manager.tsx`

- Replace the right-rail stack of cards with a **compact summary column** (last contact, coverage, crisis, open SDOH count, open referrals count, next appointment).
- Change caseload row "Open" button to launch `ClientRecordDrawer` (keep the small "Profile" button as the quick-demographics-only view).
- Keep the check-in quick-log card at the top so the most common daily action stays one click away; deep edits happen in the drawer.

### 4. Patient-visible surfaces (`src/components/PatientHome.tsx`)

- New card "Your support plan" showing SDOH items where `visibleToPatient !== false`, with plain-language status labels ("Housing referral sent to Kings/Tulare Continuum — waiting for callback") and any staff note.
- New card "Referrals for you" listing resource referrals with visible status pipeline and a "What to do next" line per status (patient-friendly, 6th-grade language, EN/ES via existing `useI18n`).
- No PHI-sensitive rows (Part 2 items with `visibleToPatient=false`) render here.

### 5. Clinician visibility (`src/routes/clinician.tsx`)

- Add a read-only "Social drivers & referrals" panel on the client detail view, sourced from the same `sdohPlan` + `resourceReferrals` collections, so providers see what's impacting the care continuum without leaving their workspace. Gated through `canAccess("sdoh")` / `canAccess("case_notes")` so nothing bypasses the record-class matrix.

## Out of scope (intentionally)

- No resource-library search (Build 2 per existing note in `ResourceReferralCard`).
- No new backend or persistence; still the in-memory `AdelanteEHR` mock.
- No changes to the auth/persona picker or router.
- No new i18n keys beyond the small set required for patient-visible statuses.

## Technical notes

- All new store methods follow the existing `AdelanteEHR` pattern: mutate the `patients` array in place and call the internal `emit()` subscribers so `useEhr` re-renders.
- All new fields are optional to keep existing demo patients (`p1`/`p2`/`p3`) valid without seed changes; add one seeded SDOH item and one coordination entry on `p1` so the new UI has demo content.
- Part 2 gating reuses `AdelanteEHR.getConsentState(patient.id).part2Sud` and the existing `GatedCard` component — no new consent logic.
- Peer-vs-case-manager tab visibility is derived from `useActingRole()`, which is already persisted in localStorage via `roles.ts`.
