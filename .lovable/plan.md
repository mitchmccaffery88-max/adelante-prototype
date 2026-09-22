# Phase 4d — a real staff referral queue with its own nav entry

## Confirmed current state
- The staff nav entry `referral` ("Referrals", Care group, gated on care-coordination) points at `/referral`.
- `/referral` is in `PUBLIC_ROUTES`, so the shell deliberately strips the staff sidebar, notifications, staff menu and route guard there. Staff clicking "Referrals" therefore leave the EHR entirely and land on the public submission form.
- The consolidated tracker `ReferralTrackerCard` (filters, staleness badge, drawer actions) exists only as a card inside `/admin` (line 373) and `/case-manager` (line 259). It has no page of its own.
- Single-purpose staff queues (`/notes-queue`, `/crisis-queue`, `/worklist`) share one shape: a route file with `head()`, an access check that returns a "your role can't view this" card, a centred `max-w-*` container, a header with title + one-line description, and the queue body.

## Build

### 1. New page `/referral-queue`
New route file following the `/notes-queue` pattern: route-specific `head()`, a care-coordination access check with the same locked-card fallback, a header ("Referrals" / "Everyone referred into Adelante care — contact, enroll or decline from here"), and the existing shared `ReferralTrackerCard` rendered with a large `limit` so it works as a full queue rather than a top-five summary. No changes to the card itself.

### 2. Repoint the nav entry
`STAFF_NAV` entry `referral` now points at `/referral-queue`, same label, group and gate. `/referral` stays in `PUBLIC_ROUTES` and stays fully public and unauthenticated — it simply stops being a staff nav destination.

### 3. "Submit a referral on someone's behalf"
Extract the existing form body from `src/routes/referral.tsx` into a shared `ReferralSubmissionForm` component, unchanged in fields, validation, duplicate-CIN check, welcome-SMS behaviour and copy. The public route renders it exactly as today; the staff queue page renders the same component inside a dialog opened from a "Submit a referral" button, with a short staff-context line above it naming that the staff member is recording a referral on someone else's behalf.

Reasoning: a separate staff intake action would be a second implementation of a form that already exists and was just hardened in 4c — two places to keep honest. Linking out to `/referral` would drop staff out of the shell again, which is the exact complaint being fixed. One component, two hosts, keeps the public form untouched and the staff path inside the EHR.

Assumption: no prefill of the referrer name/agency from the acting staff member — that would change shared form behaviour, and a staff member recording a referral is often relaying someone else's details. Say the word and I'll add it.

### 4. Dashboard cards stay, with a link through
Keep the tracker on `/admin` and `/case-manager`, unchanged, and add a "View all referrals" link to the new page. Reasoning: both dashboards are at-a-glance surfaces and referral flow is genuinely part of what each audience watches; the card is already the single shared component, so keeping it costs no duplication. Removing it would trade a real awareness signal for tidiness. The new page becomes the place you go to work the queue; the cards stay the place you notice it needs working.

## Tests
- Update `src/lib/__tests__/navSections.test.ts`: the `referral` entry now resolves to `/referral-queue`; `/referral` stays public.
- Add a test asserting the nav registry contains no staff entry pointing at a public route.

## Verification
Typecheck, full test run, and a live session: "Referrals" in the staff nav keeps the sidebar and shows the tracker; the submit dialog records a real referral; `/referral` still loads with no sign-in and no staff chrome. Desktop and phone widths, zero console errors.
