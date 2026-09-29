# Clinician workspace tiles and dashboard actions

## Scope
- Hide the custody patient-search link unless the in-facility segment is enabled.
- Replace the workspace queue chips and duplicate cards with a compact Today strip and four role-ordered, collapsible tiles.
- Keep acting-person and audited “View as” scoping across every count, row, and action.
- Add dashboard “+ New”, patient selection, patient-free actions, and keyboard shortcuts using the shared action registry.
- Preserve Part 2 filtering, outpatient-only defaults, existing store actions, and existing chart drawers.

## Build
1. Add workspace selectors for schedule groups, unified action items, attention-sorted caseload, role ordering, and Part 2-safe escalation notifications.
2. Build reusable dashboard tiles with per-person local open/closed preferences and Today-strip filtering.
3. Wire compact visit rows to check-in, join, attended, note drafting, and secondary visit controls.
4. Consolidate existing follow-up, re-screen, refill, provider-alert, and task sources into “Needs my action”; remove their duplicate dashboard renderings.
5. Extend the action registry with `needsPatient`, then adapt the launcher for dashboard patient selection and patient-free Task, Book, Contact, and Resource referral actions.
6. Add focused tests for counts/order/filtering/access, closed-loop notifications, and registry behavior; update architecture notes.

## Verification
- Run the TypeScript check, full test suite, and inspect the automatic build result.
- In one browser tab, verify Anita, Marisol, Luz, and Priya at desktop and 390px, including dashboard actions and no duplicate widgets.
- Confirm Luz sees no restricted substance-use content and all counts match their filtered tiles.

## Assumptions
- Existing draft cadence and action stores remain authoritative; this turn changes presentation and orchestration, not clinical policy.
- “Remember per person” uses browser local storage keyed by workspace staff identity.
