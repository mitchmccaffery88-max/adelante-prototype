# Referrals: enforce referrer contact, make it visible, attribute submission

## What exists today (verified)
- `createReferral` (src/lib/ehr.ts ~7413) stores the submission as given — no referrer-contact check, no audit row, no submitter field.
- The only caller is `ReferralSubmissionForm`, used as `variant="public"` on /referral and `variant="staff"` inside the /referral-queue "Submit on someone's behalf" panel.
- `ReferralActor { staffId, name, role }` and `_referralActor()` (reads the acting staff member) already back `contactedBy` / `enrolledBy` / `declinedBy`, each with an audit row (`referral_contacted`, `referral_enrolled`, ...).
- Drawer header shows only "Submitted {date}"; referrer name/phone/email appear only inside the fallback box.
- 16 existing tests call `createReferral`, several without referrer contact.

## Build

### 1. Rule enforced in the data layer
- In `createReferral`, before anything is stored: if neither `referrerPhone` nor `referrerEmail` is non-blank (trimmed, reusing `referrerHasContact` from referralOutreach.ts), throw an error carrying the same message the form shows (`REFERRER_CONTACT_REQUIRED_MSG`, moved to a shared spot so the form and data layer use one string). Nothing is stored, no task created, no audit row.
- Blank strings are stored as `undefined`, so a "   " phone can't slip through.
- Form keeps its own check (fast feedback); the data layer is the real guarantee — same pattern as the Part 2 consent gate.
- Rule substance unchanged. Legacy records without contact are untouched (still handled by the honest drawer note).
- Existing tests that create referrals without referrer contact get a `referrerPhone` added; one new test proves the throw.

### 2. Referrer always visible in the drawer
- New "Referred by" block near the top of `ReferralTimelineDrawer`, always rendered: name, agency, source label, phone (tel: link), email (mailto: link). Missing values read "No phone on file" / "No email on file" — never hidden, never invented. Legacy with neither shows the existing no-contact note.
- The fallback box keeps its own prompt but no longer needs to be the only place contact shows.

**Queue-list question — recommendation: yes, a compact indicator, but agency + name only, not phone/email.**
Reasoning: the queue is a scan-and-triage surface; knowing "Probation · J. Ortiz" at a glance helps staff prioritise and recognise repeat referrers, while full contact details are only needed once someone opens the referral to act on it. Putting phone numbers and emails in every row adds clutter and widens exposure of third-party contact details on a shared screen for no triage benefit. Row gets one muted line "Referred by {agency} · {name}"; if the referrer has no contact on file (legacy only), a small "No referrer contact" tag so staff know before opening.

### 3. Real submission attribution
- `Referral.submittedBy?: ReferralSubmitter`, where
  `ReferralSubmitter = { kind: "staff"; actor: ReferralActor } | { kind: "external" }`.
  Staff reuses `ReferralActor` exactly; external carries no actor because none exists.
- `createReferral` takes a required `channel: "staff" | "public"` from the caller. For `"staff"` the data layer resolves the actor itself via `_referralActor()` — the caller cannot pass a name. For `"public"` it records `{ kind: "external" }`.
  Why the channel comes from the caller: the acting-staff value in browser storage exists even on the public page, so the data layer can't tell a public submission from a staff one on its own. Tying it to which form was used is the honest signal available without new sign-in.
- Audit row at creation, same shape as other referral actions: `action: "referral_submitted"`, actor = staff id or `"external"`, detail = channel, referrer name + agency, and which contact kinds were provided ("phone", "email", or both) — not the values themselves, keeping third-party contact out of the audit stream as with other rows. Timestamp = `createdAt`.
- Drawer header: "Submitted {date} by {name} ({role})" for staff; "Submitted {date} through the public referral form — no staff member attached" for external; legacy records with no field: "Submitter not recorded".
- The referral-queue timeline/activity (if it lists audit actions) gets a label for `referral_submitted`.

## Tests
- Data-layer throw with neither contact (including whitespace-only); passes with only phone / only email.
- Staff channel records the acting staff member as `submittedBy`; public records `{ kind: "external" }`.
- Every successful creation writes exactly one `referral_submitted` audit row; a rejected one writes none.

## Browser check (desktop + phone)
Data-layer rejection via a direct call in the page; drawer shows referrer block on a referral with no fallback pending; staff-submitted referral names the staff member; public one reads as externally submitted; queue row shows the compact referrer line. Zero console errors.

## Non-goals
No change to the rule itself, outreach/call-list logic, welcome text, or referral actions. No email sending. No new sign-in.
