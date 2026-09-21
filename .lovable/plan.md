# Phase 2b — Template scope model + credentialing admin actions

## What I found first

**Templates.** Confirmed: one flat tier. A template row has key, version, title, encounter type, schema, active flag, created-by name. No owner, no department. Versioning is real and safe (schema edit = new row + supersede; each note keeps its own frozen schema copy). That stays untouched.

**No department field exists anywhere** — not on staff, not on templates. Staff have a role (therapist, PMHNP, SUD counselor, ECM provider, peer specialist, care manager…) and a credential string. See "Interpretation" below for how I propose to map "department".

**Picker.** The note composer lists every active template with no permission check; the admin page checks the template permission. Two different models today.

**Credentialing.** The admin page has exactly one action (Verify). Records live on clinician records only; status is computed from expiry (60-day window, 30 for malpractice); Phase 2a added real document storage plus the owner/assist access model and license-date sync. Nothing here changes.

---

## Interpretation — the two judgement calls

**1. "Department" maps to clinical discipline, derived from role.** No department field exists and inventing an org-chart (with staff assignment UI, leads, transfers) is a much bigger build than this phase. Instead I map each existing staff role to one of a small, real set of disciplines:

- Behavioral health therapy — therapist, clinical trainee
- Psychiatry — PMHNP
- SUD services — SUD counselor
- Care management — ECM provider, CF care manager, community health worker
- Peer support — peer specialist
- Clinical administration — clinical coordinator, sys admin

A department-tier template belongs to one discipline. Everyone whose role sits in that discipline can use it; the discipline's lead role can edit it. This is derived, not stored, so it cannot drift out of sync with a second source of truth. I will label it honestly in the UI as discipline-based, and note that a real department directory is a later, separate piece of work.

**2. Picker permission — your instinct is right, and I'll implement it, but with a scope filter rather than no filter.** Editing a template is configuration; using one is documentation. Any clinical role that writes notes should be able to pick a template. So the picker shows: every Global template, every Department template for the picker's own discipline, and their own Personal templates. It does not show other people's personal templates. That is a real filter where today there is none, and it resolves the inconsistency in one coherent direction: read/use is broad and scope-based, edit is tier-based.

---

## Part 1 — Templates

**Data model** (`NoteTemplate`, additive, all optional so existing rows stay valid):
- `scope: "global" | "department" | "personal"` — defaults to `global` for all existing rows (they were authored by admins and are visible to everyone today, so that is their honest current meaning).
- `departmentId?` — required when scope is department.
- `ownerStaffId?` — required when scope is personal.
- `clonedFrom?` — source template id + version, recorded for provenance only; the clone is fully independent and never affects the source's version chain.
- Field-level `locked?: boolean` on `TemplateField`.

**New module `src/lib/templateScope.ts`** (pure, testable): discipline map, `disciplineForRole`, `templatesVisibleTo(templates, staff)`, `canEditTemplate(staff, template)`, `cloneToPersonal(template, staff)` (new key, version 1, scope personal, locked fields carried through), `lockedFieldViolations(source, clone)`.

**Engine** (`ehr.ts`): `createNoteTemplate` accepts scope/owner/department; new `cloneNoteTemplateToPersonal(templateId, staff)`; `updateNoteTemplate` rejects an edit that removes or un-requires a locked field inherited from a global/department source, with a clear message. Audit rows for clone and for a blocked locked-field edit. No change to the supersede path.

**UI**
- Admin page: tabs My / Department / System over the existing list, each with the same builder. Edit buttons appear only where `canEditTemplate` is true. Locked-field toggle available to global/department authors; shown as a padlock, non-editable, on a personal clone.
- "Save as my template" button on any template a staff member can see, in both the admin page and the note composer's picker.
- Picker filtered by `templatesVisibleTo`, with a small tier badge (System / Discipline / Mine).

## Part 2 — Credentialing admin actions

On `/admin-credentialing`, for the three roles that already reach it:
- **Add credential** — dialog: clinician, kind, number, issuing state, issued/expiry dates, optional document via the existing Phase 2a upload path (same limits, same validation, same viewer).
- **Edit / change expiry** — edit dialog on each row; an expiry change requires a short reason and writes an audit row. License-date sync to the booking block runs exactly as Phase 2a wired it.
- **Follow-up request** — flag a credential as needing the clinician's attention with a note; shows as a badge in the admin table and a banner on that person's own credentials page. Cleared when they upload or a coordinator clears it.
- **Export** — CSV of the credential roster. **Import** — CSV upload with a preview of what will be added/updated and a per-row error list; nothing is written until confirmed.

**Effective-date-by-licensure — my finding.** The current model already carries `issuedAt` + `expiresAt` per credential *record*, and each record is a specific kind (license, DEA, malpractice, CAQH…). So per-license-type dates already exist in substance — a clinician's DEA and malpractice rows hold their own independent dates. What is genuinely missing is per-*state* license tracking for a clinician licensed in more than one state; `issuingState` exists but nothing keys off it. I propose keeping the current model and adding state to the row label and the expiry/status computation grouping, rather than building a new date structure. I will report this rather than expand scope silently.

## Verification
Typecheck, full test suite, new unit tests for scope/clone/locked-field rules and for CSV import parsing. Live browser on both viewports: clone a global template to personal, edit it, confirm the source is untouched; attempt to remove a locked field and confirm it is blocked; confirm picker contents differ correctly for a therapist vs. a peer specialist; exercise add/edit/expiry/follow-up/export/import end to end. Zero console errors, no regression to versioning/snapshots or Phase 2a access and document behaviour.
