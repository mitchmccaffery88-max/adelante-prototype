---
name: Message routing architecture
description: Every patient/staff free-text surface, which ones call crisis detection, how Crisis Queue entries are attributed, CareMessage/authorType scope, advocate contributions, and the known gaps
type: feature
---

# Message & free-text routing — real map (audited, not aspirational)

## 1. Surfaces that accept patient-authored free text

| Surface | Entry point | Commits via | Crisis detection? | Order |
|---|---|---|---|---|
| Care-team message | `MessagesCard` in `src/components/PatientHome.tsx` (~L611) | `AdelanteEHR.sendPatientMessage(patientId, body, selfFlagged)` (`src/lib/ehr.ts` ~L9236) | Yes | AFTER commit — never blocks or edits the send |
| Medication refill request note | `src/components/PatientHome.tsx` ~L521 | refill-request store call | Yes | AFTER commit |
| Front-door "what brings you here" | `src/routes/start.other-help.tsx` ~L44-48 | `AdelanteEHR.recordFrontDoorEntry(id, { otherHelpNote })` | Yes | AFTER commit |
| Adel chat | `src/components/patient/AdelChat.tsx` ~L52-65 | nothing persisted (session memory only) | Yes | **BEFORE** the LLM call — a tripped message never reaches the gateway |
| Staff reply | `StaffMessagesTab.send()` | `AdelanteEHR.sendStaffMessage(patientId, staffName, body, role)` | No (staff-authored, by design) | n/a |
| Safety plan entries (`src/lib/safetyPlan.ts`) | patient-authored | **No crisis scan** — see gaps | n/a |
| Daily check-in / craving / lapse (`src/lib/selfTracking.ts`) | patient-authored but **structured** (emotion ids, 0–10, option ids), no free text | n/a | n/a |
| Advocate care-plan comment | `AdelanteEHR.advocateAddCarePlanComment` (`src/lib/ehr.ts` ~L10929) | `AdvocateContribution` | **No crisis scan** — see gaps | n/a |

Two orderings exist and both are deliberate: persisted surfaces scan *after* commit (the record is authoritative and must not be censored); Adel scans *before* because there is no record to protect and an LLM must not be the responder in a crisis.

## 2. Crisis detection — `src/lib/crisisTextDetection.ts`

- `detectCrisisLanguage(text)` — pure, regex list `CRISIS_PATTERNS` (10 patterns, explicitly an *unvalidated starting set* pending Christi / Dr. Bagga).
- `scanTextForCrisis(patientId, text, { surface, dedupeWhileOpen })` — on a match calls the ONE real escalation entry point, `AdelanteEHR.flagCrisis`, with `triggerSource: "message_pattern"` and actor `CRISIS_TEXT_SCANNER` ("Message scan (automated)"). Dedupes while an earlier `message_pattern` escalation for that patient is still open. Raw body is deliberately never copied into the escalation reason.
- Call sites (only these): `PatientHome.tsx` (care message, refill note), `start.other-help.tsx`, `AdelChat.tsx`.

## 3. Crisis Queue — `AdelanteEHR.flagCrisis` (`src/lib/ehr.ts` ~L12625)

- Single creation path for every source. Requires a ≥3 char reason. Creates a `critical` alert (`CRISIS_ALERT_LABEL`) + a `CrisisEscalation` row with `status: "open"`, appends a `crisis_escalation_flagged` audit row, and notifies role `clinical_coordinator`.
- `triggerSource: "manual" | "screener_score" | "assisted_signup" | "message_pattern"` — manual = clinician in-chart; screener_score = intake PHQ-9 band (~L7212); assisted_signup = `AssistedSignupCrisisButton`; message_pattern = the text scanner.
- Visibility: `/crisis-queue` (`src/routes/crisis-queue.tsx`) reads `listOpenCrisisEscalations()`, oldest-open first, gated by `canAccess(role, "crisis_queue")`. This page is the ENTIRE notification story — no SMS/email/paging.
- Flagging is broader than viewing: `CRISIS_FLAG_ROLES` (`src/lib/roles.ts` ~L708) includes `peer_specialist`, `sud_counselor`, `clinical_trainee`, who cannot see the cross-patient queue.
- Resolution: `resolveCrisisEscalation` requires a disposition and soft-deletes the alert.

## 4. `CareMessage` (`src/lib/ehr.ts` ~L194)

- One thread per patient (`threadPatientId`); `authorType` is **`"patient" | "staff"` only** — confirmed accurate, and intentionally kept that way (see §6).
- `authorRole?: StaffRole` (added with peer messaging) — display attribution + audit only, staff messages only.
- Part 2: `sudFlagged` is set by a HUMAN (staff reviewer or the patient's own "handle carefully" checkbox → `sudFlaggedByPatient`). No automatic Part 2 detection anywhere. Masking = `isMessageBodyMasked` (`src/lib/careMessageMasking.ts`) → `canAccess(role, "screeners_sud", patient)`. Patients always see their own thread in full. The flag itself stays visible even when the body is masked.
- Flag mutation is limited to `MESSAGE_SUD_FLAG_ROLES` = therapist / pmhnp / ecm_provider — deliberately narrower than write-level `patient_messaging` now that peers write.
- Blind-spot backstops: a self-flagged or retro-flagged message that masks the assigned case manager also notifies a matrix-derived un-gated role (`pickSudBackstopRole`).
- Staff queue: `listUnreadMessageThreads()` → `/message-queue` (oldest-unread first), gated by `patient_messaging`.

## 5. `AdvocateContribution` — message-like, but NOT a message

`src/lib/ehr.ts` ~L3894. Free text, but structurally different: it is a **sectioned, reviewable suggestion into the reentry care plan** (`section: housing | appointments | pharmacy | dme | general`, `review: pending | accepted | declined` with reviewer identity/role), one-directional, not threaded, no read/unread, no patient-visible reply. It writes to a plan-owner queue (`advocateContributionQueue`, owners `cf_care_manager` / `ecm_provider`), not the message queue. It has its own SUD blocker (`_advocateSudText` rejects the text outright) rather than the Part 2 masking model.

## 6. Peer specialists

`peer_specialist` is a real `StaffRole` with a real roster identity (`s-peer1` Andre Willis, CPSS). Peers route through the existing `staff` author type + `authorRole`, because the rest of the system distinguishes staff types by role on top of a named identity, never by forking an author-kind union. `patient_messaging` for `peer_specialist` was raised `read` → `write`; they still cannot change Part 2 flags.

## 7. Flow

```text
patient free text ──> primary commit (message / refill note / front-door note)
                          └─> scanTextForCrisis ─(match)─> flagCrisis(message_pattern)
Adel chat ── scan FIRST ──(match)──> flagCrisis(message_pattern) ; LLM skipped
screener band ───────────────────────> flagCrisis(screener_score)
assisted signup button ──────────────> flagCrisis(assisted_signup)
clinician in chart ──────────────────> flagCrisis(manual)
                                          |
                       critical alert + audit + notify(clinical_coordinator)
                                          v
                                    /crisis-queue  (canAccess crisis_queue)

care message ──> care thread ──> /message-queue (patient_messaging) ──> chart Messages tab
                     └─ human Part 2 flag ──> masked for roles lacking screeners_sud
advocate comment ──> AdvocateContribution ──> plan-owner review queue (separate track)
```

## 8. Honest gaps found by this audit

1. **Safety plan free text is not scanned.** `src/lib/safetyPlan.ts` entries are patient-authored prose about warning signs and reasons for living — arguably the highest-yield surface for crisis language — and no call site scans them. Left unscanned pending clinical review, because a safety-plan authoring session legitimately contains crisis words and the false-positive tolerance there is a clinical decision.
2. **Advocate contributions are not scanned.** An advocate reporting "he says he wants to die" produces no Crisis Queue entry. The text is third-party (not patient-authored), which is why the scanner was never wired there — but the escalation value is real.
3. **Detection is English-only.** The patterns are English regexes while the portal ships full Spanish. A Spanish-speaking member in crisis is not detected.
4. **Crisis Queue has no transport.** No SMS/email/push anywhere in the build; an unopened queue means nobody is told. Same for `/message-queue`.
5. **Staff replies are never scanned**, by design, but note there is also no scan of staff-entered notes quoting a patient.
6. **Adel transcripts are not persisted** (HELD decision), so a crisis in Adel produces a queue entry whose supporting text does not exist anywhere in the record.
7. **Front-door note attribution**: `scanTextForCrisis` is skipped entirely when `getCurrentPatientId()` is undefined — an anonymous front-door visitor in crisis is silently undetected.
