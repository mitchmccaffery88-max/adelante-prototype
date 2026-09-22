# Referrals Rework, Phase 4c

Four additions on top of Phase 4a/4b. Nothing already shipped changes behaviour except where noted.

## 1. Tell the referrer when the referral moves

Today the person who made a referral only learns anything if they revisit the public
page. New: when a referral is marked contacted, enrolled, or declined, we attempt a
real text to the referrer's work phone using the same sender already proven in 4a.

- New server function `sendReferrerUpdate` next to the existing welcome sender —
  same validated-payload / real Twilio call / `sent | not_configured | failed`
  shape. No new transport, no email.
- Copy, one message each, no clinical content, external-reader safe:
  - contacted: "Adelante has made contact with the person you referred ([first name, last initial]). No action needed from you."
  - enrolled: "The person you referred ([first name, last initial]) is now enrolled with Adelante."
  - declined: "Adelante has closed the referral for [first name, last initial]. We followed up with this person. Reply or call us if you'd like to refer again." — the reason is never sent.
- Sent only when a referrer work phone is on file; the real outcome is written back
  onto the referral (`referrerUpdates[]`) and shown in the drawer. No silent stamps.
- Fired from the drawer action handlers, not inside the store, so the store stays
  synchronous and testable — mirrors how the welcome text is wired.

## 2. Staleness badge on the shared tracker

Computed purely from real timestamps: days since the last real action
(`contactedAt` if present, otherwise `createdAt`). Closed referrals (enrolled or
declined) are never stale.

Proposed draft threshold — **3 business-ish days "due", 7 days "overdue"** — with
reasoning stated on screen: a referral is a person newly out of custody or in
crisis-adjacent circumstances whose phone number decays fast; the existing crisis
SLAs are in hours and the coverage thresholds are in months, so neither transfers.
Seven days is the point at which a reachable phone number commonly stops being
reachable. Labelled exactly like the other unratified numbers in this app:
"Draft threshold — pending care-operations sign-off."

Rendered as a small amber/red badge on each tracker row plus an existing-style
"draft" note under the card. Added as a new `src/lib/referralAging.ts` module so the
threshold is one constant, testable, and reusable.

## 3. Segmented referral form

At the top of the existing public form, a required three-state prompt:
"Is this individual justice-involved?" → Yes / No / Unsure, **unanswered by default**;
submit is blocked until answered.

- Yes → reveals the existing county of release, expected release date, and Medi-Cal
  ID fields.
- No / Unsure → those three fields are hidden and not submitted.
- The Medi-Cal ID input keeps writing to the **existing `Referral.cin` field**
  (confirmed: `cin?: string` on `Referral`, already normalized, already duplicate-
  checked against referrals and patients, already carried into the patient record by
  `enrollReferral`). No second identifier is created.
- New `Referral.justiceInvolved: "yes" | "no" | "unsure"` so downstream systems can
  branch. Optional on the type so existing seeded records stay valid; the form always
  sets it.

## 4. Advocate discovery at enrollment

No advocate fields on the public form. Instead, the drawer's Enroll action becomes a
short two-step: enroll as today, then a prompt — "Does this person have a known
advocate?" (court-appointed or patient-identified) with Skip as a first-class choice.

Choosing yes renders the **existing** `AdvocateInviteForm` against the just-created
patient id, which already calls `createAdvocateInvitation` and
`deliverAdvocateInvitation`. No new invite path, no new copy, no changes to the
advocate module.

## Verification

Typecheck, full test suite, new unit tests for the aging module, the referrer-update
composer, and the justice-involved tagging. Live browser pass on both dashboards and
the public form at 1280 and 390 wide, both an allowed and a blocked role, zero
console errors.

## Non-goals

No staff email. No email transport. No changes to 4a's actions or 4b's consolidation
beyond adding the badge and the post-enroll advocate step.
