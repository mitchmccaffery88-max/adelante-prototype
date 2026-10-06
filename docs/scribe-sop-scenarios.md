# AI scribe and dictation — clinical delivery and documentation scenarios

**Draft — pending SME and counsel review.** This is a draft SOP for review by clinical SMEs (Christi, Dr. Bagga) and counsel. The capture and AI layers in the prototype are **Simulated**: no microphone, speech-to-text or AI model, and no audio is ever stored.

## Who can use what (Draft — pending SME decision)

| Role | Live scribe (telehealth / clinic / field) | Post-encounter dictation |
|---|---|---|
| Physician, PMHNP, therapist, SUD counselor, RN | Yes, all settings | Yes |
| Peer specialist, CHW, ECM provider | No | AFBI contacts and own contact notes (case management, care coordination, peer support visits) |
| Care manager (CF) | No | Own contact notes only (not an AFBI role) |
| LVN | No | No |
| Billing, coordinators, admin | No | No (coordinators can record consent) |

Part 2 masking applies everywhere: roles that can't see substance-use content never see SUD transcripts, drafts or AFBI activities.

## Steps common to every scenario

- **Patient consent:** "AI-assisted session documentation (recording)" must be active (not withdrawn, expired or not yet in effect). For substance-use care it must include the Part 2 line.
- **Review:** open the draft; resolve each "Not found in transcript" sentence (keep with reason, edit, or delete); check "Speaker uncertain" and "Unsure what was said" flags; confirm "I reviewed and edited this note/draft" with a 1–5 rating. Any later edit clears the confirmation.
- **Sign:** notes then follow the normal sign / cosign flow and note clocks. AFBI drafts are saved as an AFBI contact.
- **Retention:** no audio, ever. The transcript is deleted when the note is signed (or the AFBI contact saved), or after 7 days unsigned (Draft). An audited record (who, when, why) remains, along with the sentence-to-transcript references.
- **Never automatic:** the draft never adds diagnoses, billing codes, orders, tasks or care-plan changes. Suggested follow-ups do nothing until accepted one by one.
- **Consent missing:** Start is disabled with the reason and next step. Ask the patient, record consent (My care or the chart's Consents section), or write by hand.
- **Consent withdrawn mid-session:** capture stops immediately and the in-progress transcript is discarded (audited). Write the note by hand.

## Scenarios by setting

### 1. Telehealth (clinical roles)
- **Consent steps:** patient consent; confirm everyone on the call has agreed (all-party, California).
- **Privacy:** confirm the patient is somewhere they can talk.
- **When to pause:** not available; end and restart if needed.
- **Draft fills:** the chart note in the chosen format (SOAP / DAP / BIRP / GIRP) plus the DMC-ODS elements.
- **Review, sign and retention:** as in the common steps.

### 2. In person — clinic (clinical roles)
- **Consent steps:** patient consent. Every other person present (interpreter, advocate, family) is added **by name and relationship** and marked agreed. A general checkbox doesn't count. Then the all-party confirmation.
- **When to pause:** for interruptions, or when someone joins who hasn't been named and agreed. Nothing is captured while paused; the gap shows in the transcript.
- **Draft fills:** the chart note.

### 3. In the field (clinical roles)
- **Privacy:** confirm "Location is private enough for this conversation". If it isn't, move or don't record.
- **Consent steps:** patient consent. Any bystander is a **named consenting party** (name + relationship); otherwise capture stays off.
- **When to pause:** someone walks up, there's a phone call, the location stops being private, or the conversation moves to something the patient doesn't want captured. Use the large Pause button.
- **Noisy setting:** stricter uncertainty flags (Draft: speaker 0.8, words 0.85, vs 0.7 / 0.75). Expect more flags to check.
- **Draft fills:** the chart note, or AFBI fields when started from the AFBI form.

### 4. No signal
- Live capture can't run offline because no audio is stored or buffered on the device. Start shows "No connection — capture can't run offline".
- After the encounter, once back online, use **"Dictate after the encounter"**: the staff member records their own spoken summary.
- Patient AI recording consent is currently **required** for dictation too. Draft — counsel to confirm whether dictation of the staff member's own summary needs patient recording consent. This is one setting, so counsel's answer is a one-line change.
- The dictation draft has the same sourcing, flags, review confirmation and retention as a session draft.

## Special scenarios

### AFBI field outreach — enrolled person
- **Who:** peer, CHW, ECM, therapist, PMHNP and physician (live scribe only for the clinical roles).
- **Draft fills:** the AFBI fields (activities, minutes, outcome, next step, location type), not a progress note.
- **Review:** each field and sentence is reviewed, then saved as the AFBI contact.
- **Funding:** always ISL (non-Medi-Cal). It can never become a Medi-Cal claim.

### AFBI — person not enrolled yet
- The patient's AI consent can't be checked, so **only post-encounter dictation** is allowed.
- **Initials only.** Any sentence with a name, birth date, phone number or street address is flagged "Identifying detail". It must be edited out or deleted (it can't be kept), and is saved with initials only.
- Linking to a chart later goes through the patient-matching review queue, as today.

### Group sessions (IOT / ODF)
- Capture is blocked unless **every** member present has active consent. Missing members are shown by initials only.
- Per-participant group notes are Phase 2. Until then, write group notes by hand when anyone lacks consent.

### Interpreter or advocate present
- Name each person (e.g. "Maria L., interpreter"; "J. Ortiz, AHCD agent") and confirm they agree.
- If an interpreter is present by phone during telehealth, the all-party confirmation covers them. Counsel to confirm.
- The draft is written in English. "Session included Spanish" is marked, and uncertain segments are flagged.

### Patient withdraws mid-session
- Tap "Patient withdrew consent" (or the patient withdraws in My care). Capture stops immediately and the transcript is discarded and audited.
- No draft is created. Write the note by hand.
- Future sessions are blocked until the patient agrees again.

## Open questions for SMEs and counsel
1. Does dictation of the staff member's own summary need patient recording consent?
2. Recording in semi-public places (shelters, parks, release gates): is a privacy confirmation plus named bystanders enough?
3. Live scribe for peer / CHW / ECM / care manager: when, and with what safeguards?
4. RN triage notes: where they are reviewed and signed in the chart.
5. Is the 7-day unsigned retention right?
6. Are the noisy-setting thresholds right?
