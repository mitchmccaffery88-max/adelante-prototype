---
name: SUD (42 CFR Part 2) access policy
description: Which staff roles read screeners_sud unconditionally vs consent-gated, and how the Part 2 messaging backstop role is chosen
type: feature
---
**Policy (confirmed, not a guess):** in the `screeners_sud` row of the RBAC
matrix in `src/lib/roles.ts`:

- `therapist` and `pmhnp` → `read` (unconditional). Both are direct treating
  clinicians with a legitimate clinical need to know SUD status without a
  separate consent gate.
- `case_manager` and `peer_specialist` → `consent_gated` (require the patient's
  `consents.part2Sud`). Care coordination is not clinical treatment — that
  distinction is the actual line.
- Everyone else (billing, billing_coordinator, etc.) → none.

**Single source of truth.** Every masking surface reads the same
`canAccess(role, "screeners_sud", patient)` check: Problems masking, screener
tracking, care-message masking (`careMessageMasking.ts`), note PDF export gate
(`notePdf.ts`), and autofill's `problems_active` / `last_note_summary`. Never
re-implement the rule locally, and never hardcode role names as a proxy for it.

**Part 2 messaging backstop.** When a message is flagged (patient self-flag at
send time, or a staff reviewer flag) and the assigned case manager is locked
for that patient, `pickSudBackstopRole()` in `src/lib/ehr.ts` alerts a role
that is both write-level `patient_messaging` (`MESSAGE_SUD_FLAG_ROLES`) and
un-gated by the same `canAccess` check, excluding the flagger's own role.
Selection is derived from the matrix, so flipping a cell updates it
automatically. Unflag never notifies.