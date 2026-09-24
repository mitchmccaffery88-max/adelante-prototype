# Phase 7b — Claim as the single source of billing status

## What's there today

- **Two separate status systems.** Visits carry their own billing status (draft, ready, submitted, paid, denied, write_off), changed through `transitionBilling`. Claims carry a second one (documented, signed, coded, generated, submitted, paid, denied, partial).
- **Most 1:1 visits never get a claim.** When a visit is marked attended, only the visit's own status flips to `ready`. A 1:1 claim is only created by a seed at boot, and only for 3 visits. Group, peer and CHW claims are created by their own note hooks. So `/billing` and `/admin-claims` are mostly describing different sets of visits, not just labelling them differently.
- **Amounts** are set in 4 claim-creation paths (fallbacks 12000/12000/6000/5000, and peer/CHW callers can pass their own amount) plus 5 visit-side `chargeCents ?? chargeForService(...)` reads.
- **No role check at the data layer.** Neither `transitionBilling` nor `advanceClaim` checks role. `/admin-claims` passes the hardcoded actor `"billing_coordinator"`. `signNote` changes claim state directly and doesn't go through `advanceClaim`.

## 1. Status mapping (needs your sign-off)

| Visit status | Claim state | Notes |
|---|---|---|
| draft | documented / signed / coded | Before submission. The claim says which of these steps it's at. |
| ready | generated | Built and ready to send |
| submitted | submitted | Same |
| paid | paid | Same |
| denied | denied | Same, still needs a reason |
| write_off | **new `written_off` state** | Needed because no current state means this. It ends the claim and needs a reason. |
| (none) | partial | Stays as is. It has no amount behind it. I won't add payment amounts (that's EDI scope), and I'll note this in the UI. |

**Allowed moves:** documented → signed → coded → generated → submitted → paid/denied. Denied → generated (resubmit) or written_off. documented/signed/coded/generated → written_off. The old "back to draft" moves from ready and write_off go away. Undoing a write-off becomes: not allowed. It's final and audited. **This needs your OK.**

**Visits with no claim yet.** On `/billing` they show a plain label, not a fake status. "Scheduled" visits stay off the page, as they are today. Attended visits with no note yet show "Not documented". Cancelled and no-show visits show "No claim — not billable". None of these count in the six-status summary, which lists only claim states.

**How claims get created:** marking a 1:1 visit attended creates its claim at `documented` (by moving the existing seeded helper into `updateAppointmentStatus`). This replaces the current flip to `ready`. The label "Not documented" then covers only attended visits whose claim was never created, which should only happen for older data.

## 2. One source for all views

- `/billing` rows, totals and filters read the claim that matches each visit (`encounterId === appt.id`). Group, peer and CHW claims with no 1:1 visit are listed too, so `/billing` and `/admin-claims` cover the same set.
- `BillingStatusSummary` counts claims. Its rows become the claim states grouped under the six familiar labels: Draft = documented+signed+coded, Ready = generated, Submitted, Paid, Denied, Write-off = written_off. Partial gets a 7th row.
- The pilot dashboard card uses the same helper. New honesty note: "Counts claim records — the same ones on the Claims worklist and Billing page."
- The clinician page's "Billing: {status}" line reads from the claim too.
- The visit's own `billingStatus`, `submittedAt`, `paidAt` and `denialReason` fields are removed from the type and seed. The 6 seeded visit statuses are turned into matching claims so the demo still shows a spread.

## 3–4. One write path, permission enforced in it

- New function `AdelanteEHRExt.transitionClaim(claimId, to, { denialReason?, note? })`. It:
  - Works out the actor from the acting staff member (`staffId`, name, role). Callers can't pass an actor string.
  - Refuses unless `canAccess(role, "billing").level === "write"`. The error says "Your role can view billing but can't change it." and nothing is changed.
  - Checks the allowed moves above and requires a reason for denied and written_off.
  - Adds history `{ at, state, actor: staffId, actorName, role, note }` and a `claim_status_changed` audit row with from, to and claimId.
- `advanceClaim` and `transitionBilling` are removed. Every caller (`/billing` and `/admin-claims`) switches to `transitionClaim`, and the hardcoded `"billing_coordinator"` goes. The page guards stay in place for fast feedback.

## 5. Note signing (Phase 1e)

Signing moves the claim through a separate, narrow function: `markClaimSignedFromNote(encounterId, signerId)`. It only ever does documented → signed, is attributed to the signer and is audited as `claim_status_changed` with `via: "note_signature"`. It does **not** require billing write access. Reason: signing is the clinician confirming the documentation, not a billing decision, and `signUnsignedWorkRow` already checks that the signer is allowed. Clinicians still can't call `transitionClaim` for anything else.

## 6. One amount function

`claimChargeCents({ serviceType, apptChargeCents? })` in ehr.ts returns `apptChargeCents ?? chargeForService(serviceType)`. All 4 creation paths use it. The 12000/6000/5000 fallbacks and the caller-passed `chargeCents` on peer/CHW claims are removed. Displays read `claim.chargeCents` only.

## Tests

- Status mapping table and allowed moves.
- `transitionBilling`/`advanceClaim` no longer exist, and `transitionClaim` is the only mutator (a grep test).
- Sys Admin refused at the data layer with nothing changed.
- Billing and Billing Coordinator can write, and history and audit record the real staff member.
- Note signing still advances documented → signed as a clinician.
- All amounts come from `claimChargeCents`.
- An attended visit creates a claim.
- `/billing` counts, `/admin-claims` and the pilot card agree for the same visit.
- Existing tests that use the old paths get updated.

Live browser at both viewports as Billing, Billing Coordinator, Sys Admin, and a clinician signing a note. Desktop checks wait until the acting role's name shows in the top bar before reading the page.

## Non-goals
No rate table, no EDI or payment-amount fields, no change to who can see which pages.
