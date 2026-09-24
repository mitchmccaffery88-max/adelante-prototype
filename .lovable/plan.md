# Phase 6c — Group-access text notifications to patients

## What I found
- The six group writes (`enrollInGroup`, `endGroupEnrollment`, `cancelGroupSession`, `cancelGroupOccurrence`, `rescheduleGroupOccurrence`, plus self-enrollment, which goes through `enrollInGroup`) write an audit row and call `emit()`. Nothing sends anything.
- Two real Twilio senders exist: `sendReferralWelcome` and `sendStaffAlertSms`. Both go through the connector gateway and return `sent | not_configured | failed`. `staffAlerts.ts` is a staff-only ledger with a pluggable transport that the app installs from the root route.
- **Correction to the brief:** appointment texts are not real sends today. `notifyAppointmentChange` checks `isSmsOn(patientId) && p.phone`, then writes a `queued` entry that never leaves the app. The consent and phone check is what 6c reuses. The appointment "transport" is not reused, because it is simulated.
- Consent to text comes from `isSmsOn()`: `consentState.sms`, falling back to `smsFallback`. The phone number comes from `Patient.phone`. Both are the same sources the appointment flow uses.

## Part 2 category rule (needs your review)
Generic copy is used for **`sud_clinical_preauth`** and for **any unknown or missing category**. That second case fails closed, the same way unstamped legacy group notes do in `noteGateClass`.
Specific copy is used only for `skills_education` and `open_psychoeducational`. These are exactly the two categories `noteGateClass` already treats as non-Part 2. This adds no new classification.
I derive the rule from one helper, `isGroupNotificationSensitive(category)`, placed next to `noteGateClass`. Masking and texts then can't drift apart.

**Interpretations:**
- Specific copy names the topic, date and time only. It never includes the location address, the join link or the roster. A join link sent by SMS would work as a credential.
- On sensitive groups, the generic text also leaves out the date and time. When combined with a known clinic schedule, a time slot could identify the group.
- Specific copy also stays generic when an admin-set topic looks clinical? No. The category is the only signal. I won't guess from free text.

## Build
1. **Server sender** `src/lib/groupNotify.functions.ts` → `sendGroupNotificationSms({ to, body })`. It uses the same gateway pattern as `sendReferralWelcome` and returns the honest three outcomes. The body is composed on the client from fixed templates and checked by the validator for length only.
2. **Ledger** `src/lib/groupNotifications.ts`. It mirrors `staffAlerts.ts` for patients: records `{ id, patientId, sessionId, event, sensitive, body, triggeredBy: { actorId, kind: staff|patient|system }, createdAt, delivery, detail }`, and has `dispatchGroupNotification`, a pluggable transport, and `markGroupNotificationDelivery`. The transport is installed from the root route next to the staff-alert one. In tests it records only, with delivery `pending`.
3. **Eligibility check before any attempt.** If `isSmsOn(patientId)` is false or there is no phone, the attempt is recorded as `skipped` with a reason (`no_sms_consent` / `no_phone`) and **the transport is never called**. The skip is kept so staff can see why nobody was texted.
4. **Triggers.** Each of the five writes calls `notifyGroupChange(event, sessionId, patientIds, actor)` after its audit row. Enrollment added and ended text one patient. Session cancelled, occurrence cancelled and occurrence rescheduled text every active enrollee. Failed or blocked enrollments send nothing. The demo seed runs with notifications suppressed, so boot never sends.
5. **Attribution.** `triggeredBy` records the same actor the audit row records. Each attempt also writes a `group_notification_attempted` audit row that references the ledger id. It contains no message body, so the audit stream holds no copy.
6. **Visibility.** A compact "Text notifications" list on the group detail card in `/group-sessions` shows event, patient, outcome and who triggered it. It is behind the existing `group_sessions` gate. Sensitive rows show "generic message", not the body.

## Tests
- Sensitive vs. non-sensitive vs. unknown category produces the right copy. Generic copy never contains the topic, category or date.
- No consent or no phone produces `skipped`, and the transport is not called.
- Each of the five triggers produces one attempt per affected patient, with the correct `triggeredBy`.
- Blocked enrollment produces no attempt, and the seed produces no attempts.

## Verification
Typecheck, the full test suite, then a live browser check at both screen sizes. A skills group enrollment and a cancellation show a tracked attempt; `not_configured` is expected unless Twilio and `TWILIO_FROM_NUMBER` are set. An SUD group shows the generic copy. A patient without SMS consent shows `skipped` with no send. Zero console errors.

## Non-goals
No email, no changes to 6a/6b behaviour, no change to the appointment notification path, no change to billing or note access.
