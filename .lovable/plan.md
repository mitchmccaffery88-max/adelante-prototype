# Pre-demo My Care consolidation

## Build
- Consolidate My Care without adding cards: fold matched-resource counts into **Your support needs**, remove the duplicate needs surfaces and dead code, and hide pre-release known needs after intake.
- Fold first-appointment wording and empty state into **Next appointment** while preserving appointment details, preparation guidance, and the schedule link.
- Remove the dashboard weekly-status tile and place due/overdue status on the existing Weekly check-in form.
- Replace the single forward-step presentation with a short **Suggested for you** list: next lesson first, then distinct seeking/justice recommendations using their current destinations.
- Remove the separate advocate-pending tile and add pending-consent text, consent link, and delivery-failure feedback to invited rows in **Advocates & family**.
- Make intake-created advocate invitations draft-only. Trigger delivery only after advocate consent is signed, preserve delivery status, and prevent duplicate sends.
- Centralize Recovery Journey eligibility and apply it to desktop navigation, mobile navigation, the More menu, dashboard, suggestions, all other patient links, and direct route access. Eligibility will require either consented `needs.substanceUse` or an existing SUD/DMC-ODS program or episode.

## Verification
- Add/update focused tests for card consolidation, unified Recovery Journey eligibility, direct-route redirect, and no advocate contact before consent.
- Run the TypeScript check and full test suite, reporting totals and separating the known time-dependent medication failures if they recur.
- In one browser tab without reloads, verify desktop and phone card order/counts for Rosa, Daniel, Tomás, Alicia, and both requested new-signup states.
- Verify advocate delivery before and after consent, Kayla note → signature → Dr. Reyes cosign → signed billing claim, and a real referral **Log attempt** reflected in both queue and Client Journey.
- Report the exact Recovery Journey signals and per-persona outcomes, plus an unchanged factual inventory of other SUD-specific tools visible without a substance-use signal.

## Scope guard
- Removals and folds only; no new My Care cards and no changes to other SUD-tool visibility.
- Preserve crisis-first behavior, Part 2 protections, existing destinations, and every currently reachable piece of information.
