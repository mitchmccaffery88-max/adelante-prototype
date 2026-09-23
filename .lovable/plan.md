# Phase 5d-2 — Needs ↔ referrals, directory picker, real outcomes

## What I found (current state)

- `ResourceReferral` (ehr.ts:1757) has `resourceId` but no link to a need; `SdohPlanItem.referralId` (ehr.ts:466) is declared and **never written by any code**.
- `addResourceReferral` (ehr.ts:8515) is the single create path and already enforces the Part 2 consent gate and attribution from 5d-1.
- `referralLinks.ts` is complete and correct but unused outside a test.
- The stale "searchable resource library lands in Build 2" string lives only in `i18n.tsx` (`cmReferralLibraryNote`, EN + ES) and is no longer rendered anywhere.
- The care-plan rollup (ehr.ts:6117) synthesizes open rows from positive AHC-HRSN domains that have no `SdohPlanItem` — display-only, not actionable.
- Patient-facing status labels exist in `PatientHome.tsx` (`pending/accepted/completed`); new outcome values need labels there or they render raw. That is the only patient-side touch and it is a label map, not a view change.

## Decisions (reported, as asked)

1. **One source of truth**: `ResourceReferral.sdohItemId` is stored; the never-written `SdohPlanItem.referralId` is removed and replaced by a derived `referralsForNeed(patientId, itemId)` lookup. A need can hold many referrals over time.
2. **Care Coordination tile**: replaced with a need-driven tile. It lists the client's open needs, each with a **Refer** button opening the same shared dialog as the record. With no open needs it links into the record's Social needs section to add one. Reason: every referral must hang off a need, and a free-text category box cannot know which need it serves.
3. **Outcome mapping** (honest, and no seeded referral data exists, so nothing real is rewritten):
   - `pending` → `pending`
   - `accepted` → `connected` — a partner accepting the person is the strongest real "link made" signal the old value carried
   - `completed` → `closed` — work finished; it never claimed a successful outcome, so it must not become `connected`
   New values: `waitlisted`, `not_eligible`, `declined_by_client`, `unreachable`.
4. **HRSN synthesized rows — recommendation: convert.** Materialize real `SdohPlanItem`s with `source: "pre_release_hrsn"` at the HRSN import path, plus a human-initiated "Create trackable needs from screening" action in the record for screenings already on file (no silent backfill on read). Utilities and interpersonal safety materialize like any other domain; the established rule that they are never *inferred from or overwritten by* intake stays untouched, and the patient-facing category-only rule in `sdohResourceMatch.ts` is unchanged. Staff-side directory picking is not restricted by that rule — it is a patient-display rule — and the Part 2 consent gate still governs recovery/support categories for everyone.

## Build

**Data layer (`ehr.ts`)**
- `ResourceReferral`: add `sdohItemId?`, `outcomeReason?`, widen `status` to `ResourceReferralOutcome` (7 values).
- `addResourceReferral`: accept `sdohItemId`/`resourceId`; when a need is linked and it is still `identified`, move it to `sent` with the same actor and its own audit entry. Consent gate and stamping unchanged.
- `setResourceReferralStatus`: accept an outcome + required reason for non-pending outcomes, attributed and audited (existing shape).
- New pure helper `referralsForNeed(patientId, itemId)`.
- `materializeHrsnNeeds(patientId, actor)` — creates missing `pre_release_hrsn` items for positive domains, dedupes by label, audited; called from the HRSN import path and from the record action.
- Care-plan synthesis stays as a fallback for screenings not yet materialized.

**Shared UI — `src/components/clinical/ReferForNeedDialog.tsx`**
- Need context at top; category defaulted from `matchResourcesForNeed`.
- Directory picker: real listings for the category via `listResources`, each row showing its link state through `referralLinks.ts` (published / not published). Sets `resourceId`.
- "Not in the directory" option: free-text organisation name + required note, `resourceId` left unset. Never writes to the directory — only content admin's publish lifecycle does.
- Part 2 warning + `Part2ConsentRequiredError` catch with the "Open consents" action, exactly as 5d-1.

**Record (`RecordTabs.tsx`)**
- SDOH tab: **Refer** action per need; shows that need's referrals inline with directory link state and attribution.
- Referrals tab: outcome select with reason, linked-need line, directory link state. Masked restricted row for gated viewers unchanged (still no category, provider or note).
- When an outcome is set to `connected`, a confirm prompt offers to resolve the need — a human confirms; nothing auto-closes.

**Cleanup**: remove `cmReferralLibraryNote` (EN + ES); add outcome labels to the patient status map.

## Verification

Typecheck, full suite, plus new tests: referral linked to need; need moves to `sent` on create; multiple referrals per need; directory link state active vs unpublished vs missing; off-directory create leaves the directory untouched; outcome mapping; `connected` prompts without auto-closing; consent gate still blocks through the need-level and directory paths. Live browser at both viewports including a Part 2-gated role.
