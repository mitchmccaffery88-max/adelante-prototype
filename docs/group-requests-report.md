# Group requests and per-group join rules (26 Oct, Mitch)

Preview only; nothing published. Requirement lists are labelled "Draft — pending clinical sign-off".

## What already existed and was extended (no parallel system)
- `requestJoinGroup` / `approveGroupJoinRequest` / `declineGroupJoinRequest` in `ehr.ts` remain the only request item and decision writes. Same row, same lifecycle audits (`group_join_requested/approved/declined`, `group_join_approval_blocked`).
- Phase A Intake on-behalf path (`requestIntakeGroup` → `assertIntakeGroupBoundary`) is unchanged. A care-team on-behalf path now runs through the same `onBehalf` field, checked by `assertGroupStaffRequest`.
- `PatientGroupScheduling` (Appointments → Groups) keeps "Your group calendar"; its request card is replaced by one data-driven list.
- `GroupJoinRequestsQueue` on `/group-sessions` gains requirement statuses and three decisions.
- Telehealth consent block, group-eligibility gate (`assertEnrollmentAllowed`) and the county group confidentiality setting are reused, not re-implemented.

## Rules
- **Group fields** (`GroupSession`): `audiences` (existing content audiences; empty = everyone), `joinRule` (`open` | `care_team_approval` | `invite_only`; absent = `care_team_approval`), `groupType`, `billable` (informational), `language`. Saved via registry `group_policy_set` (therapist, PMHNP, physician, clinical coordinator; reason required). A type that needs clinical approval cannot be set to `open`.
- **Requirements per TYPE** (`GROUP_TYPES` in `groupRequests.ts`): `dmc_ods_sud` = SUD signal (episode, diagnosis or clinician care-plan goal; intake answers do not count), Part 2 consent covering treatment, group confidentiality acknowledgment, Medi-Cal coverage status, clinician approval. Every group also checks group eligibility, space, telehealth consent when it meets online, and the confidentiality acknowledgment when the county setting is on.
- **Patient visibility**: audience any-match; invite-only groups never appear unless already enrolled.
- **Patient action**: enrolled → "You're in this group"; pending → "Requested — your care team is checking"; open + every requirement met → "Join" (direct enrollment through the existing write); otherwise "Ask to join" → "We'll check with your care team. You'll get a message when you're added." Clinical/Part 2 items are never named ("Your care team will confirm this group is right for you."); only the confidentiality acknowledgment and telehealth consent are described. EN/ES (tú, draft Spanish).
- **Routing** (one request, tasks on Today): assigned care manager; assigned primary clinician when the type needs clinical approval or has a Part 2 element (a clinician who cannot approve, e.g. a trainee, does not count and the clinical coordinator is added). No one assigned → Intake Coordinator if the linked referral's intake is not complete, otherwise clinical coordinator. Task: "Group request: <group> — check and decide" (protected groups say "restricted group").
- **Decisions** (registry, reason required): "Approve and add" — clinician only when clinical approval or Part 2 applies, otherwise care manager may approve; any hard requirement "Not met" refuses. "Not right now" — patient message "Your care team will talk with you about other options." "Needs something first" — creates a follow-up task (form, telehealth form, coverage check, other). Every decision sends a portal message and closes routing tasks when final.
- **Review view**: Met / Not met / Needs review from real records; Part 2 items show a lock and "Part 2 — needs consent covering treatment" for roles without SUD access.
- **Audit**: one registry event per action plus existing store lifecycle events; IDs only for protected groups.
- **Billing**: unchanged; approved enrollments already flow to billing.

## Seeds
Through `createGroupSession`: "Stress and sleep" (open, skills, billable), "Substance use recovery group (DMC-ODS)" (care-team approval, SUD audience, billable), "Reentry cohort" (invite only, justice-involved).

## Stop boundaries / gaps
1. **No patient self-sign path** exists for the group confidentiality acknowledgment or telehealth consent. Building one would add a new consent writer, so the patient list describes the item and the care team sends it ("Needs something first"). Needs a decision before adding.
2. **Open groups still require group eligibility.** The existing care-plan eligibility gate is non-negotiable in project rules, so an open group shows "Ask to join" until it is set.
3. **Care-team on-behalf requests** inherit the Phase A rule that on-behalf requests need clinical approval.
4. Spanish copy is draft pending native-speaker review.

## Files
- New: `src/lib/groupRequests.ts`, `src/lib/groupRequestBoundary.ts`, `src/components/groups/GroupJoinRulesEditor.tsx`, `src/lib/__tests__/groupRequests.test.ts`, `src/test/groupRequestsApproved.ts`.
- Changed: `src/lib/ehr.ts` (six exact-once deltas pinned in `groupRequestsApproved.ts`), `src/lib/chartActions.ts` (7 actions), `src/components/PatientGroupScheduling.tsx`, `src/components/groups/GroupJoinRequestsQueue.tsx`, `src/routes/group-sessions.tsx`, `src/test/signupOct26Approved.ts`, `src/lib/__tests__/consentInventoryB2.test.ts` (+3 read-only consent checks), `runAction` snapshot (new action rows only), `docs/b2-consent-inventory.md`, `src/lib/AGENTS.md`.

## Validation
- Full units: see final counts below.
