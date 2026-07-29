# Move Referral Status Tracking tile below Program Caseload tile

## Goal
Re-order the Case Manager page so the **Program Caseload** tile appears first, and the **Referral Status Tracking** tile sits directly below it, rather than side-by-side.

## Current state
In `src/routes/case-manager.tsx` (lines 170–181), both tiles share a 3-column grid:

```text
+--------------------------------+------------------------+
|  Program Caseload (lg:col-span-2)|  Referral status       |
|                                  |                        |
+--------------------------------+------------------------+
```

## Proposed change
Change the same `<section>` to a single-column vertical stack:

```text
+---------------------------------------------------+
|  Program Caseload (full width)                    |
+---------------------------------------------------+
|  Referral status (full width)                     |
+---------------------------------------------------+
```

## Implementation
1. In `src/routes/case-manager.tsx`, update the grid section around lines 170–181:
   - Remove `lg:grid-cols-3` and the wrapper `<div className="lg:col-span-2">` around `CaseloadTable`.
   - Render `CaseloadTable` as a full-width block first.
   - Render `ReferralTrackerCard` as a full-width block second, directly below.
   - Keep existing `mb-6` section spacing and `gap-4` for vertical rhythm.

## Files affected
- `src/routes/case-manager.tsx`

## Out of scope
- Admin page (`src/routes/admin.tsx`) keeps its current sidebar layout unless you explicitly ask to change it.