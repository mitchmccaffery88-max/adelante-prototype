# Public referral page isolation

## Goal
Keep `/referral` publicly accessible while preventing the clinical/admin shell from appearing there.

## Changes
- Classify `/referral` as a public route even though staff can also reach it from their referral navigation entry.
- Give public-route classification precedence over staff-route classification.
- On public pages, hide staff-only controls and guards: the persistent staff sidebar, staff menu, notifications, and demo scenario control.
- Preserve the public header, language selector, sign-in option, referral form, referral submission behavior, crisis support strip, and staff-side referral queue.
- Add a regression test covering `/referral` public classification and shell precedence.
- Complete the referral page’s route-specific social metadata.

## Verification
- Run focused navigation and shell tests.
- Check the live referral page at desktop and mobile sizes, including direct navigation and form visibility.
- Confirm no sidebar or staff/admin controls appear and no browser console errors occur.
