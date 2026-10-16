# Plan: "+ New" role quick actions, personal quick-action settings, rest of 8c-2

Rollback point: HEAD `e49d1b337598843e710fc5905f13ac80df2f2851`. This is a plan only. Nothing gets built until Mitch approves the plan and every test line listed below.

## What I confirmed before writing this
- "+ New" is drawn today by three launchers: `DashboardActionLauncher.tsx` (/clinician), `ChartActionLauncher.tsx` (/record), and `OpsActionLauncher.tsx` (/admin, /admin-claims, /billing). All three go through `StaffNewTrigger` (`StaffDensity.tsx:20`). The routes that get it are hard-coded in `StaffShell.tsx:29`.
- **One person can already hold several roles.** `StaffMember.roleAssignments` (`roles.ts:1083-1090`) means "one person, one identity, several role assignments; the switcher picks the active one and audit records it". Helpers: `roleAssignmentsOf` (`roles.ts:1107`) and `hasRoleAssignment` (`roles.ts:1112`). Example: Darnell Pope holds ecm_provider plus cf_care_manager (in-facility, hidden while the in-facility setting is off) at `roles.ts:1159`. The acting role is stored in browser storage (`roles.ts:1045`, `:1552`, `:1561`). **No permission-model change is needed.**
- Duplicates found in the registry or launcher:
  - "Log contact" appears twice: `contact_log` (`chartActions.ts:748`) and `dashboard_contact` (`chartActions.ts:804`).
  - The launcher shows other names for registry actions (`OpsActionLauncher.tsx:36`):
    - claim_correct: "Fix a claim" vs "Correct claim" (`chartActions.ts:825`)
    - claim_status: "Move claim status / resubmit" vs "Change claim status" (`:837`)
    - eligibility_check: "Run eligibility check" vs "Eligibility check" (`:885`)
    - note template create: "Note template (create)" vs "Create note template" (`:911`)
    - note template clone: "Note template (clone)" vs "Clone note template" (`:911`)
- Refill decline (`AdelDrafts.tsx:148-150`) runs right away, with no confirmation step.
- Content create exists as the registry action `content_create` (`chartActions.ts:150`).

## Not yet confirmed (step A0 checks these first, read-only)
- What "+ New" and the role's allowed create actions look like on /worklist, /case-manager, /inbox and /clinician-profile.
- Whether each action in Mitch's A4 draft is allowed for that role on that page.

## A) "+ New" role quick actions

**A0. Finish the inventory (docs only).** Using the same script as the existing inventory, add these rows to `docs/phase8-new-button-inventory.md`:
- /worklist: nurse_rn, lvn, medical_assistant
- /case-manager: community_health_worker, cf_care_manager
- /inbox: billing, billing_coordinator
- /clinician-profile: credentialing_coordinator

Then add a mapping table: each A4 quick action → registry id → allowed / hidden / missing for that role on that page. Mitch's draft labels I expect to map: Progress note, Book a visit, Message patient, Request a screener, Task, Medication order, Refill decision, Lab order, Log contact (`dashboard_contact`), Field outreach contact, Referral from resource directory, Message team, Triage call (`triage_call`), Vitals (`metabolic`), Collect specimen (`specimen_collect`), Assign referral, Link a care partner, Fix a claim (`claim_correct`), Run eligibility check (`eligibility_check`), Record payment, Payment arrangement, feature setting, note template, Scheduling rule (`scheduling_rule_save`), Resend notification. Any that don't map get flagged; nothing is invented. Give clinic dose and Coordinate a refill are listed as **pending clinical sign-off** and are not offered. For medical_assistant and credentialing_coordinator, the table lists their allowed create actions so Mitch can choose.

**A1. One quick-action list.** A new `src/lib/quickActions.ts` holds:
- the default ids per role (data only)
- `CREATE_KINDS`: an allow-list of start/create registry ids. Actions on an existing item are never included (reply in thread, mark attended, close goal, edit AI sentence, and so on).
- `quickActionsFor(actor, page, patient?)`: filters every id through the registry's own `allowed()` check.

**A2. Menu shape.** A shared "+ New" menu, `src/components/staff/NewActionMenu.tsx`:
- "Quick actions" at the top (3–5 items)
- then "All actions" with a search box
- compact density, 14px text minimum, 48px touch targets, English only

The existing launchers keep their forms, handlers and runAction calls. Only the menu list is replaced.

**A3. Add "+ New" where it's missing:** My work, Worklist, Case manager, Inbox, and the content center (authors only, through `content_create` and the existing author gate). Each page opens its existing forms. If a page has no existing form for an action, that action is left out, not built.

**A4. Clean-up**
- Keep one "Log contact". Proposal: keep `dashboard_contact` in menus. `contact_log` stays in the registry because records and audit history refer to it; it is only removed from menus.
- Use one label per action. The launcher reads `label.en` from the registry. The registry wording is kept unless Mitch prefers Mitch's draft wording ("Fix a claim", "Run eligibility check"). **Mitch decides**, because renaming registry labels may change existing test text. See below.

## B) Personal quick-action settings

**B1. Model:** use the existing `roleAssignments`. No change.

**B2. Rules**
- The picker offers only actions in `CREATE_KINDS` that are allowed for one of the person's own `roleAssignmentsOf(me)`.
- Actions pending clinical sign-off are never offered.
- When an action runs, `runAction` checks it against the role the person is acting as right now. This is unchanged.
- An action from another of the person's roles shows a disabled "Switch to <role> to use this" with a button that opens the existing role switcher. **Recommendation: show it, don't hide it,** so the list stays stable. It never runs under the wrong role.
- Part 2 and sign-off rules are untouched.
- Saved ids that are no longer allowed are silently dropped when shown.

**B3. Settings screen.** Add a "Quick actions" section to the staff account page (proposed: /profile when the user is staff):
- defaults per role from A4
- add, remove, reorder (up/down buttons, keyboard-friendly)
- "Reset to my role defaults"
- a maximum of 8

**B4. Saving.** Browser storage under `adelante.quickActions.<staffId>`, labelled on screen "Saved on this device only — prototype". Later this moves to a per-user preferences table in the backend. **No audit entry** for personal preferences: they grant nothing and touch no patient data.

**B5. Admin-set defaults per role: later.** It needs a new registry action and audit trail. Recommend a separate batch.

## C) What remains of 8c-2
- Pop-ups: 13 of 14 replaced. One is kept by design: the patient removing their own advocate (`AdvocateDesignationPanel.tsx:79`). Archive = the existing withdrawal from 8c-1, so it's done.
- Staff deletes: frequency delete is done. AI sentence delete is done. **Refill decline is not done.**
- Remaining work:
  - Add a ConfirmDialog to refill decline in `AdelDrafts.tsx`: "Decline this refill?", "Keep pending" first, the reason required (already collected), one runAction call (already there).
  - Re-read the old count to check nothing else is left.

## Files
- New:
  - `src/lib/quickActions.ts`
  - `src/lib/quickActionPrefs.ts`
  - `src/components/staff/NewActionMenu.tsx`
  - `src/components/staff/QuickActionSettings.tsx`
- Changed:
  - the three existing launchers
  - `StaffShell.tsx:29` (route list)
  - the routes `my-work`, `worklist`, `case-manager`, `inbox`, `admin-content`, `profile`
  - `AdelDrafts.tsx`
  - docs: the inventory, a new `docs/phase8-quick-actions-report.md`, `roadmap.md`, and an AGENTS.md rule saying quick actions are presentation only and run through the registry

## Existing test lines that may change
None are known yet. Step A0 includes a read-only search of the tests for menu option text and "+ New" counts (`staffShell8a1.test.ts`, `opsLauncher.test.ts`, `e2e/staffShell8a1/8a2.spec.ts`, `e2e/staffNewAudit8a2.spec.ts`). Every hit will be listed as file, line, current text, proposed text and why, for approval **before** any build. If Mitch keeps the registry labels, label renames cause no test changes.

## New tests
- Unit:
  - personalization never surfaces an id outside the person's role assignments, checked for every role
  - pending-sign-off ids can't be added
  - an action from another role is disabled and never runs; switching role makes it run under the new role, with one audit entry for that role
  - reset brings back the defaults; the maximum of 8 is enforced
  - saved ids that are no longer allowed are dropped
  - each default maps to a create-only registry id
  - refill decline: one audit entry, and cancelling writes none
- Browser, axe on every new screen:
  - "+ New" on the five new pages, each as Cathy and one other role, with one audit entry per item created
  - the settings screen: add, reorder, reset
  - a two-role person (Darnell, with the in-facility setting on) sees the "Switch to" prompt
  - checks at 390 and 1280 widths, light and dark

## Risks
- **Cathy:** she must not gain any chart write she lacks today (consent_ledger, problems, allergies stay read-only). Covered by the registry filter plus a parity test against the current launchers.
- **Clinical safety:** clinic dose and refill coordination stay out until sign-off. Crisis actions are not shortcuts. Part 2 actions show only where they already show.
- **Browser storage:** saved preferences could be wrong on a shared computer. They grant nothing, which limits the harm.
- **Proxy cf_care_manager:** may see the "Switch to" prompt for a hidden role. Hidden assignments are excluded unless the in-facility setting is on.

## Batches (each approved separately)
1. A0 inventory plus the test-line list (docs only).
2. A1, A2 and A4: shared menu on the existing three launchers.
3. A3: new pages.
4. B: settings.
5. C: refill decline confirmation.

Each batch ends with the full unit suite, then every browser spec including axe, one after the other, not at the same time.
