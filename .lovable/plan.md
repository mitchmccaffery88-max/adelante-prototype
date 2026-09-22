# Referrals Rework, Phase 4b — one shared tracker

## What the investigation confirmed

- The case-manager dashboard already uses `ReferralTrackerCard`, with status, program, clinician, and care-need filters, truthful outreach state, decline details, milestone dates, and the shared Phase 4a drawer.
- The pilot/admin dashboard still defines a second local `ReferralTrackerCard`. It repeats the same referral row, progress, decline, outreach, enrollment, and drawer behavior, but omits filters and milestone dates.
- Both currently show at most five rows and both sit in layouts that can accommodate the existing responsive filter controls. The admin copy is compact because it is older, not because its users have a distinct workflow.
- The pilot dashboard's Active referrals total is already correctly based on `isReferralClosed`, so enrolled and declined referrals are excluded.

## Build

1. Replace the pilot/admin dashboard's local tracker with the existing shared `ReferralTrackerCard`.
2. Remove the duplicated local component and all imports used only by that copy.
3. Keep one consistent presentation on both dashboards: the full filterable tracker, five-row default, truthful outreach state, ended decline state, milestone dates, and the shared Phase 4a drawer.
4. Add focused component tests proving filtering remains available and declined referrals render through the shared implementation.

## Presentation decision

Use the same real presentation in both contexts rather than introducing a compact variant. Both audiences manage or oversee the same referral pipeline, both currently show five rows, and pilot administrators benefit from the same filters. A variant would preserve presentation drift and create a second behavior branch without a distinct operational requirement.

## Verification

- Run the focused tests, full test suite, and typecheck.
- Check both dashboards live at wide and phone sizes.
- Confirm status/program/clinician/care-need filtering, drawer access, declined ended-state rendering, and the pilot Active referrals count.
- Confirm no browser console errors and no regression to Phase 4a actions.

## Not in scope

No changes to referral actions, the shared drawer, public referral tracking, or referral data rules.