# Part B: Onboarding and intake follow-ups (plan only)

Part A is built. This plan covers the seven Part B items, split into phases. Nothing here is built yet.

## 1. About You background questions (step 2)
- Add two questions to About You:
  - "Are you involved with the justice system? (yes / no / unsure)" — moved here from the Coverage step, which asks it today. It keeps writing `coverage.justiceInvolvement`, so the coverage message, the safety-net lookup, the History step and the Obligations view all keep working.
  - "What are you looking for? Check all that apply: mental health, medication, substance use services."
- A pre-release episode or custody record still shows "Already on file" and skips the justice question, as Coverage does today.
- Where each answer goes:
  - **Patient profile:** new `Patient.seeking = { mentalHealth, medication, substanceUse }`, plus the justice answer.
  - **Care profile / care plan:** medication → a medication-management engagement goal; mental health → a therapy goal.
  - **Screeners offered:** PHQ-9 and GAD-7 for everyone. AUDIT and DAST-10 only when substance use is checked **and** Part 2 consent is on file; the consent gate is unchanged. PCL-5 when justice-involved or mental health is checked.
  - **Content / Resource Library:** hide Recovery Journey unless substance use is checked. Show post-release modules and Obligations when the person is justice-involved.
- **Part 2:** a substance-use selection is saved as SUD-category data behind the same mask as `needs.substanceUse` and the SUD screeners. Advocates and Part 2-restricted staff never see it (it goes through the existing `isConsentCategoryAuthorized` and the chart's masking). It is merged into the existing `needs.substanceUse` flag, not kept as a second flag.

## 2. Advocate option with the emergency contact
- On each emergency contact: "Also make this person my advocate". There is also a separate "Name an advocate" row.
- On submit, this creates a **pending invitation only**, through the existing advocate designation / `sendAdvocateInvite` path.
- The person gets no access until the patient signs the advocate consent step. Existing advocate-tier rules apply unchanged.
- My Care shows "Invitation pending — sign consent to activate".

## 3. Benefits verification in the Coverage step
- Check the Medi-Cal ID format as the person types, and warn when the ID matches another record (both already exist in the data layer).
- Show "What happens next": reported, then checked by staff or electronically, with the current status label from 8c.
- Optional photo of the benefits card, stored as a patient document tagged `coverage_card`, which the needs-verification worklist links to.
- Self-pay / sliding-fee people: one plain sentence about the payment arrangement. It never asks for card numbers.

## 4. Expanded needs assessment (standard for everyone)
- The directory uses 14 categories: housing, emergency_shelter, food, employment, transportation, recovery_meetings, support_groups, family_reunification, healthcare, education, parenting, financial, legal, life_skills.
- The questions follow the AHC-HRSN structure (core: living situation, food, transportation, utilities, safety; supplemental: employment, family/community support, education, finances, legal, parenting, physical activity/health access).
- Each answer maps to one or more directory categories (for example, food insecurity → food; housing instability → housing + emergency_shelter).
- **Wording is marked draft pending Christi's review.**
- Interpersonal safety stays staff-only by default (never shown to the patient or advocates), as it is today.
- The existing reconciliation ("still applies?" / "on file") carries over: `buildIntakeNeedsPlan` grows from 4 categories to the full set.

## 5. Three outcomes after intake
- **(a) Matched resources:** for each identified need, the top directory matches by category, reusing `sdohResourceMatch` and `/next-steps`.
- **(b) Appointment requests by service type,** based on what they're looking for (1:1 therapy, medication management, group, care coordination):
  - Saved as `AppointmentRequest{status:"pending_staff_confirmation"}` and routed to the scheduling queue.
  - It only becomes a booking if the person picks a real open slot from clinician availability.
- **(c) Existing records:** before creating a request, check the referral and pre-release episodes for an appointment already scheduled for this person. If one exists, show it ("Already scheduled for you") and create no duplicate.

## 6. My Care after intake
The tiles appear in this order:
1. First appointment — Scheduled / Requested, waiting for confirmation / Not yet scheduled.
2. Your needs — each need with its matched resources count and a link to Next Steps (grows from the Part A summary tile).
3. Recommended for you — content chosen from the About You answers.

The persistent Adel chat shows one CTA for the most relevant open item (for example, "Your therapy request is waiting for confirmation — want to see times?"). Crisis interception still comes first.

## 7. Adel-guided full intake including screeners
- Scripted and deterministic, not a live model. Text/chat can reuse the same script later.
- PHQ-9, GAD-7, AUDIT, DAST-10 and PCL-5 are read from `SCREENERS` **verbatim**, with their standard answer choices shown as buttons. Adel never paraphrases them; only the short transitions between screeners are written by us.
- The PHQ-9 item 9 flag calls the same code path as the form (`recordScreener` crisisFlag + `flagCrisis` screener_score), with the same banner.
- AUDIT and DAST-10 are only offered when Part 2 consent is on file. Adel never takes consent; it hands off to the Consent step, then resumes.
- Crisis language interception stays unchanged and comes first.

## Phases

| Phase | Scope | Demo-ready tomorrow? |
|---|---|---|
| B1 | Item 1 questions + storage + screener gating + Recovery Journey hide; item 2 pending-invite link | Yes — small, reuses existing paths |
| B2 | Item 6 tiles (appointment status "not yet scheduled / requested", needs tile), Adel CTA | Yes for tiles; Adel CTA risky |
| B3 | Item 5 (a) matches + (c) duplicate check; (b) requests queue | (a) yes; (b)(c) post-demo |
| B4 | Item 4 expanded needs assessment | Post-demo (needs Christi's wording review) |
| B5 | Item 3 benefits improvements | Post-demo |
| B6 | Item 7 Adel-guided screeners | Post-demo (clinical review of verbatim rendering + item 9 parity tests) |

## Technical notes
- New fields: `Patient.seeking`, `AppointmentRequest` store with audit, `needsAssessment` v2 answers mapped to `RESOURCE_CATEGORIES`.
- Every new write goes through the existing AdelanteEHR paths with audit; no second consent or crisis path.
- Tests: a Part 2 masking test for `seeking.substanceUse`, item 9 parity between the form and Adel, and a test that no duplicate appointment is created when one is already scheduled.
