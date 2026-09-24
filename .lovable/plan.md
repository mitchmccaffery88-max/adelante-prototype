# Phase 7a — Revenue & billing menu, Billing Coordinator parity, CalAIM codes moved to billing

## What I found

- **Menu:** the `revenue` group ("Revenue & consent") holds Billing, Claims worklist, Medi-Cal verification, Consent and Consent audit. Consent pages are gated on `consent_ledger`.
- **Billing vs Billing Coordinator:** I compared the two roles across all 44 record classes. They differ in exactly four:

| Class | billing | billing_coordinator |
|---|---|---|
| `billing` | write | none |
| `problems` | read (claim coding) | none |
| `demographics` | read | none |
| `consent_ledger` | read | none |

  Every other class already matches, including `eligibility` write, `population_health` read, `group_sessions` read, and the consent-gated SUD classes.
- **Pages:** `/billing` and `/admin-claims` are gated only through the nav registry and route guard (`billing` class), so fixing the matrix is enough to open them.
- **CalAIM codes:** `CalaimCodesSection` is rendered at `admin-kpi-targets.tsx:348` with the page's `population_health`-write `canWrite`. The store methods (`addQualifyingCode` / `deactivateQualifyingCode` / `reactivateQualifyingCode`) record the actor and require a reason to deactivate. They don't check the role themselves; the page does that.
- **Pilot dashboard card (`admin.tsx:378–402`):** shows Draft/Submitted/Paid/Denied from appointment `billingStatus`, with no Ready or Write-off and no links. Only `population_health` write roles (Clinical Coordinator, Sys Admin) can open `/admin`, and neither can open `/billing`.

## Build

### 1. Menu groups
- Rename `revenue` to **"Revenue & billing"**: Billing, Claims worklist, Medi-Cal verification, and a new **CalAIM qualifying codes** entry.
- **Where consent goes:** a new **"Consent & privacy"** group, placed right after Facility & Custody and before Revenue & billing. It holds Consent and Consent audit, with the same `consent_ledger` gates. It's its own group, not Administration, because most roles that open it are clinical (ECM, therapist, PMHNP, SUD counselor) and wouldn't expect it under Administration.

### 2. Billing Coordinator parity (matrix changes, `roles.ts`)
- `billing`: add `billing_coordinator: "write"`.
- `problems`: add `billing_coordinator: "read"` (claim coding, the same reason Billing has it).
- `demographics`: add `billing_coordinator: "read"` (knowing whose claim it is).
- **`consent_ledger`: left unchanged (none).** Consent isn't a billing class, and you said not to widen non-billing access. After this change it's the only difference between the two roles. **Decision needed:** confirm now, or when the roles are merged.
- No other role and no other class changes. I'll update tests that assume Billing Coordinator can't reach billing pages (for example, `navSections.test.ts` and the admin-gate tests).

### 3. CalAIM codes page: new route `/billing-calaim-codes`
- Renders `CalaimCodesSection` unchanged, with a page header and its own `head()`.
- **Opening the page:** allowed with `billing` read **or** `population_health` write. The menu entry uses the same `anyOf` gate.
- **Editing:** `canWrite` = `billing` write, which after step 2 means Billing and Billing Coordinator.
- **Clinical Coordinator and Sys Admin keep read-only access:** they can see the full list, including retired codes and reasons, but not add, deactivate or reactivate. That matches your recommendation, since the codes drive their dashboards.
- Audit and deactivate-with-reason behaviour don't change (same component, same store calls).
- **KPI Targets:** remove the section and add a one-line pointer: "CalAIM qualifying codes are now managed by billing → CalAIM qualifying codes". It's a link when the viewer can open that page. Links elsewhere that pointed to `/admin-kpi-targets#calaim-codes` (for example the dashboard "manage" link) will be moved to the new page.

### 4. Billing status card (`admin.tsx`)
- Show all six statuses: Draft, Ready, Submitted, Paid, Denied, Write-off.
- Each count links to `/billing?status=<status>`. `/billing` gets a small `validateSearch` so the status filter starts from that value (no logic change).
- The people who see this card (Clinical Coordinator, Sys Admin) can't open `/billing`. For them, counts stay as plain numbers with the note "Billing staff work these on the Billing page." Links show only for roles that pass the `billing` gate, so nobody gets a link that just redirects them away.
- **Honesty label:** "Counts appointment billing status (the Billing page). Claim records on the Claims worklist are counted separately until the two billing models are unified." Plus a link to the Claims worklist for billing roles.

## Non-goals
No change to either billing model, no rate table, no change to how CalAIM eligibility is computed, and no consent-access changes.

## Verification
Typecheck and the full test run, including new tests: the matrix differs only on `consent_ledger`; both billing roles see the Revenue & billing group and can edit codes; Clinical Coordinator and Sys Admin are read-only; consent entries appear under the new group. Browser at desktop and phone as Billing, Billing Coordinator and Clinical Coordinator: menu groups, page access, code editing, status-card links, and no console errors.
