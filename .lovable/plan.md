# Referrals Rework, Phase 4a — make referrals movable, fix the false SMS claim

## What I found first

- `advanceReferral` is the only mover and nothing calls it. It steps one stage, and on reaching "enrolled" creates a client record with name / date of birth / phone / CIN only — no audit entry, no referrer, agency, source, county or release date.
- The detail drawer is already shared and already live-updating. The ECM dashboard card opens it; the pilot dashboard card does **not** (read-only list, no click-through).
- Three progress strips index into a three-item order list (`submitted → contacted → enrolled`); a fourth state would render as "no progress" unless branched.
- The pilot dashboard's "Active referrals" tile counts everything that isn't enrolled.
- On submit, a referral is stamped "welcome SMS sent" and the public tracker shows a green tick. No message is ever attempted.
- Two honest senders exist to copy: a validated payload, a real Twilio call through the connector, and `sent` / `not_configured` / `failed` written back onto the record.

## Build

### 1. Actions in the shared drawer

Add **Mark contacted**, **Enroll**, **Decline** to `ReferralTimelineDrawer` — the single place all actions live. Both tracker cards keep their current display untouched; the pilot dashboard card gains only a minimal way to open the drawer (the row becomes clickable, same as the ECM card).

Replace the single-step `advanceReferral` with explicit, attributed actions: `markReferralContacted`, `enrollReferral`, `declineReferral`. Each records who acted, their role, and when. The old one-step function is retired rather than left as a second, unattributed path.

### 2. Decline as a real ended state

Add `declined` to the referral status type, then handle each consumer:

- Progress strips (both cards + the public tracker): a declined referral renders as an explicitly ended state — the strip stops at the stage it reached and is styled as closed, never as "step −1" / empty.
- Pilot dashboard "Active referrals": excludes declined as well as enrolled.
- Public referrer-facing tracker: reads **"Closed — we followed up with this person"**, with no reason and nothing clinical. The recorded reason stays staff-side only.

### 3. Honest welcome message

New server function on the exact advocate-invite pattern: validated payload, connector Twilio call, honest `not_configured` when credentials are absent (they are, in this environment). The result is written back onto the referral — `smsSentAt` is only ever set on a genuine `sent`, and the card/tracker show the real outcome ("not sent — text messaging isn't connected yet") instead of a false tick.

Draft copy (names the referrer, offers opt-out, nothing clinical):

> Hi {first name} — {referrer name} at {agency} asked Adelante to reach out to you. We're a community health program and someone will call you soon. Reply STOP to stop these texts.

The existing "manual outreach queued" branch is unchanged in behaviour; its wording drops the implication that a task exists.

### 4. Attribution and referral context on enrollment

- Every enroll and decline writes a real audit entry (actor, role, referral id, resulting client record).
- Context carried onto the new record using **existing** fields only: `releaseDate` (a real top-level field, currently left empty) and `coverage.countyOfRelease` (already the field county lives in).
- **Interpretation to confirm:** referrer, agency and referral source have no existing home on the client record, and the record already links back to the referral, which holds all three. Rather than inventing a parallel structure or duplicating them, the drawer and chart read them through that existing link. If you'd rather they were copied onto the record, say so and I'll add one documented block.
- **Deliberately not set:** the front-door "how did you hear about us" answer. Writing a justice referral source into it would flip the person's population track — that's a population-resolution change, and this ticket says not to touch it.

### 5. Permission tiers

- Mark contacted: any role with care-coordination write access.
- Enroll and decline: ECM provider, reentry/CF care manager, clinical coordinator only. Everyone else sees the drawer read-only with a short note saying why.
- Decline requires a reason (short picker — unable to reach, declined services, not eligible, referred elsewhere, other + free text) and is recorded with the actor and timestamp.

## Verification

Typecheck, full test run, plus new tests for the three actions, the permission tiers, the decline state and the honest send result. Live browser check on both a wide and a phone-sized screen: contact, enroll and decline a real referral, confirm the created record carries its context and audit, confirm the public tracker never claims a text was sent, and confirm each role tier behaves — zero console errors.

## Not in scope

Merging the two tracker cards (4b). Provisional/staged-visibility records (`86bc3x15b`). Population resolution and reporting.
