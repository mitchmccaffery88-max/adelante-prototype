# Referrals Phase 4e — real outreach work, attempt trail, referrer fallback

## What I found first

- `requestManualOutreach` sets `outreachTask: "manual_call"` on the referral and nothing else. Four places read it, all decorative. No task, no owner, no due date.
- The existing task system (`CaseTask`) is **patient-keyed**: every consumer dereferences `patientId` — the worklist row links to `/record/$patientId`, the personal worklist and CM queue look the patient up by name. A referral has no patient record until enrollment, so a `CaseTask` for a referral would render a nameless row with a dead link on two existing pages.
- `/referral-queue` (Phase 4d) already exists as the dedicated staff home for referral work, and `REFERRAL_DISPOSITION_ROLES` already names who may act.
- Referrer phone and email are collected on every referral; phone is used only for outbound status texts, email for nothing at all.

## Interpretation — where outreach work lives

Outreach tasks will be **referral-scoped work items stored on the referral**, surfaced on the referral queue, mirroring `CaseTask` semantics (title, due date, open/done, role pool, claim-by-individual, attribution) rather than reusing the patient-keyed `CaseTask` row. Reason: reusing `CaseTask` means either inventing an empty `patientId` (breaks two existing pages) or reshaping the task model and every consumer. The referral queue is the real, already-built place this work belongs.

## Assignee reasoning

Nobody owns a referral before enrollment — there is no case manager or clinician yet. So it is a **role pool with individual claim**, the same shape `CaseTask` already uses (`allowedRoles` + `claimedBy`). Pool = any role with care-coordination write (that is already the "log outreach" tier from Phase 4a — outreach is contacting, not disposition). Claiming records staff id, name, role and time.

## Fallback-trigger reasoning

Two triggers, because two different things are true:

- **No phone ever given** — the contact path is absent, not unanswered. Prompt immediately at submission.
- **Contact path proven dead** — any attempt logged as *wrong number* or *disconnected* proves the number is bad. Prompt immediately.
- **Unanswered** — *no answer* / *left message* prove nothing on their own. Prompt after **2** such attempts, labelled a draft threshold pending care-operations sign-off, matching the aging-badge honesty pattern. Two attempts is roughly a working day of tries, and the referrer's number is still fresh at that point.

## Build

1. **`src/lib/referralOutreach.ts`** (new, pure): attempt outcomes (`no_answer`, `left_message`, `wrong_number`, `disconnected`, `reached`), labels, `OUTREACH_FALLBACK_DRAFT` threshold constant + note, `needsReferrerFallback(referral)`, `outreachTaskState(referral)`.
2. **`src/lib/ehr.ts`**: `Referral` gains `outreach?: { task?: ReferralOutreachTask; attempts: ReferralOutreachAttempt[] }`. `createReferral` creates a real open outreach task whenever a welcome text can't send (no phone, or no consent). New store methods: `claimReferralOutreach`, `logReferralOutreachAttempt` (records outcome, note, actor, time; a `reached` attempt closes the task and stamps `contactedAt`), `completeReferralOutreachTask`. Each writes an audit entry with attribution.
3. **Drawer (`ReferralTimelineDrawer`)**: an "Outreach" block — task state, claim button, "Log an attempt" form (outcome select + optional note), and the attempt trail newest-first with who and when.
4. **Referrer fallback prompt**: in the drawer, when `needsReferrerFallback` is true, an explicit card showing the referrer's name, agency, phone and email with a plain instruction to contact them for updated details. Shown only to roles that may log outreach.
5. **Queue**: `ReferralTrackerCard` gets an "Outreach needed" filter option and a small badge on rows with an open outreach task; the queue page shows an open-outreach count.
6. **Form copy**: the "no reliable phone" checkbox copy changes from a bare promise to the honest, now-true statement that a care-team member will be given a follow-up task to reach this person; the thank-you screen wording is aligned.
7. **Tests**: task creation on no-phone/no-consent, attempt logging and attribution, fallback trigger at each of the three conditions, `reached` closing the task.

## Non-goals

No email field for the referred person, no email transport, no changes to the post-enrollment journey steps (Phase 4f), no changes to Phase 4a–4d actions beyond the additions above.

## Verification

Typecheck, full test suite, and a live browser session on desktop and phone width: submit with "no reliable phone" → task appears on the queue and in the drawer; claim it; log a failed attempt; confirm the referrer-fallback card appears at the reasoned trigger with real referrer contact details; zero console errors.
