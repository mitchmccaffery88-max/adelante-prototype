# AI scribe — SculptSoft production handoff checklist

The prototype's AI scribe runs on a **Simulated** vendor (`src/lib/vendors/scribe.ts`, flag `scribe_simulated`). Everything around it is real logic: consent gate, all-party confirmation, group block, draft-in-chart, sentence provenance, unsupported-sentence guard, review/sign gate, retention, Part 2 masking, audit, pilot metrics. Production swaps the adapter and hardens the items below. Each item = one ticket.

Dependency key: **BAA** (signed BAA with Part 2 / 42 CFR 2.11 QSOA terms), **Vendor** (vendor choice made), **Backend** (persistent server + auth), **Counsel** (legal sign-off), **Clinical** (Christi / Dr. Bagga sign-off).

## 1. Vendor and contract
- [ ] **Select scribe vendor(s)** (STT + LLM, or one bundled vendor). AC: written comparison (accuracy, Spanish, latency, cost, data residency, no training on our data) signed off. Dep: Clinical, Counsel.
- [ ] **Sign BAA with Part 2 terms** for every subprocessor that touches audio or text. AC: executed BAA + QSOA on file; zero data retention / no model training clauses confirmed. Dep: Vendor, Counsel.
- [ ] **Implement `ScribeAdapter` for the real vendor** (`transcript`, `draft` → same `TranscriptSegment` / `DraftSentence` shapes). AC: existing `scribe.test.ts` passes against a vendor test double; `mode: "Live"`; mock kept for tests. Dep: Vendor, BAA.
- [ ] **Allow `scribe_simulated` to go live** only after the above. AC: admin toggle no longer refused for this flag; UI label changes from "Simulated"; audits drop `simulated: true`. Dep: BAA, Backend.

## 2. Audio capture
- [ ] **Telehealth capture**: stream audio from the video vendor session. AC: capture starts only after `captureBlocker` returns null server-side; per-participant tracks where available. Dep: Vendor, Backend.
- [ ] **In-person capture (mobile + browser)**: microphone permission, background/lock-screen handling, network-loss buffering in memory only. AC: works on iOS Safari, Android Chrome, desktop Chrome/Edge; no audio written to disk or local storage. Dep: Vendor.
- [ ] **Stop-on-withdrawal**: withdrawal (patient My care or staff) kills the live stream server-side within 2 s and discards buffers. AC: test proves no transcript persists after withdrawal. Dep: Backend.
- [ ] **No audio storage, anywhere** (vendor included). AC: vendor attestation + our own storage scan show no audio objects. Dep: BAA.

## 3. Speech-to-text
- [ ] **STT with diarization** (Clinician / Patient / Other) and per-segment speaker + recognition confidence. AC: adapter returns `speakerConfidence` and `asrConfidence` per segment; Draft cut-offs (0.70 / 0.75) re-tuned on pilot data. Dep: Vendor, Clinical.
- [ ] **Spanish / English code-switching** within one session. AC: `lang` per segment; "Session included Spanish" marker set correctly on a labelled test set. Dep: Vendor.

## 4. LLM drafting pipeline
- [ ] **Grounded drafting**: every output sentence carries the source segment ids it came from. AC: sentences with no ids are flagged "Not found in transcript"; no free-text sentence lacks a `sourceIds` field. Dep: Vendor.
- [ ] **Format prompts** for SOAP / DAP / BIRP / GIRP + DMC-ODS client response and next steps. AC: output maps to the template keys in `scribeFormats.ts`; English output for bilingual sessions. Dep: Vendor, Clinical.
- [ ] **Hard exclusions**: no diagnoses, billing codes, orders, tasks or care-plan changes. AC: output filter + red-team test set; follow-ups only as suggestions. Dep: Vendor, Clinical.
- [ ] **Prompt / model versioning** recorded on each draft. AC: model + prompt version stored with the session and shown in audit. Dep: Backend.

## 5. Retention and deletion
- [ ] **Server-side retention job**: delete transcript at sign, or after 7 days unsigned (Draft value). AC: scheduled job, idempotent, leaves the who/when/why stub; provenance refs survive. Dep: Backend, Clinical (confirm 7 days).
- [ ] **Deletion proof** at vendor and in our store. AC: vendor deletion API confirmation stored with the stub; monthly report of deletions vs sessions. Dep: Vendor, Backend.
- [ ] **Backups**: transcripts excluded from backups, or backup expiry within the retention window. AC: documented and tested restore shows no transcripts. Dep: Backend.

## 6. Audit, security, privacy
- [ ] **Immutable audit store** for all `scribe_*` events (append-only, tamper-evident). AC: no update/delete path; hash chain or WORM storage. Dep: Backend.
- [ ] **Encryption** in transit (TLS 1.2+) and at rest (KMS-managed keys) for transcript, draft and session data. AC: security review sign-off. Dep: Backend.
- [ ] **Server-side Part 2 masking**: transcripts and drafts inherit the patient's SUD classification; masked roles never receive the data. AC: API tests per role (billing, peer, etc.) return nothing for SUD sessions. Dep: Backend.
- [ ] **Outbound sharing via `disclose()` only**. AC: no export/print of transcript or draft bypasses the disclosure log. Dep: Backend.
- [ ] **Real staff identity** for every actor (replaces the top-bar acting switcher). AC: audit `actorId` comes from authenticated session. Dep: Backend.

## 7. Consent
- [ ] **Counsel review of consent wording** (EN + ES; currently "Draft — pending counsel review"). AC: approved text versioned in the consent ledger. Dep: Counsel.
- [ ] **Per-state consent rules** (California all-party today; other states for telehealth across state lines). AC: rule table by patient + clinician location drives the all-party step. Dep: Counsel.
- [ ] **Group sessions (IOT/ODF)**: Phase 1 blocks unless every present member consents. Phase 2 per-participant notes. AC: decision recorded; if built, per-member note split with per-member Part 2 masking. Dep: Clinical, Counsel.
- [ ] **Interpreter / advocate consent capture** as named parties rather than a checkbox. AC: party names stored with the session. Dep: Counsel.

## 8. Performance, accuracy, cost
- [ ] **Latency targets**: live transcript lag ≤ 3 s; draft ready ≤ 60 s after End session for a 50-minute visit. AC: p95 measured in pilot. Dep: Vendor.
- [ ] **Accuracy evaluation**: WER and diarization error on English, Spanish, code-switched and accented speech (Central Valley Spanish, Hmong-accented English, etc.); sentence-grounding precision. AC: published eval report; go/no-go thresholds agreed. Dep: Vendor, Clinical.
- [ ] **Cost model** at session volume (sessions/day × minutes × STT + LLM rates). AC: monthly cost estimate at pilot and full volume approved. Dep: Vendor.
- [ ] **Pilot metrics backend**: time end→sign, % edited, unsupported count, 1–5 rating, aggregate only with cohort guard 11. AC: same numbers as the admin vendors card, from the server. Dep: Backend.

## 9. Product follow-ups found during the prototype
- [ ] **Phase 2 role decision**: LVN, peer, CHW, ECM / care manager. AC: decision recorded; `SCRIBE_CAPTURE_ROLES` updated. Dep: Clinical.
- [ ] **RN triage notes surface**: RN can capture, but the chart Notes section is hidden for RN, so the RN draft is only reviewable on the scribe screen. AC: RN has a triage-note place in the chart to review/sign. Dep: Clinical.
- [ ] **Chart note editing for physicians/PMHNP**: they have read-level chart notes; the prototype lets the author sign their own reviewed AI draft only. AC: confirm this rule or widen note write rights. Dep: Clinical.
- [ ] **Accepted follow-ups**: "Send GAD-7" currently points to Tracking. AC: one-tap screener request through its registry action. Dep: none.
- [ ] **Holidays** for any business-day clocks the signed note joins. AC: holiday calendar config. Dep: Backend.

## 10. Phase 1b — in-person and field use
- [ ] **Device and microphone testing** on clinic tablets and staff phones (iOS + Android, built-in and headset mics, far-field in a counselling room). AC: test matrix passed; minimum supported devices published. Dep: Vendor.
- [ ] **Decision on encrypted on-device buffering** (default: **none**). AC: written decision; if "none", capture refuses to start offline (as in the prototype); if allowed, encrypted, time-boxed and wiped on upload, with counsel sign-off. Dep: Counsel, Backend.
- [ ] **Accuracy evaluation on noisy, real-world field recordings** (street, shelter, car, release gate; Spanish and code-switched). AC: WER and diarization error reported per setting; the noisy-setting thresholds (Draft 0.8 / 0.85) re-tuned. Dep: Vendor, Clinical.
- [ ] **Counsel guidance on recording in semi-public places** and on named bystanders. AC: written guidance reflected in the field privacy check and party rules. Dep: Counsel.
- [ ] **Offline / connectivity UX**. AC: Start is disabled with "No connection — capture can't run offline" when the network drops; a mid-session drop stops capture and keeps only what the server already received; "Dictate after the encounter" is offered once back online; no audio is ever written to the device. Dep: Backend.
- [ ] **Pause / Resume at the source**. AC: while paused, no audio leaves the device (mic stream closed, not just muted server-side); gaps are recorded with timestamps. Dep: Vendor.
- [ ] **Post-encounter dictation pipeline** (staff voice only, single speaker). AC: same grounding, flags, review and retention as a session; patient-consent requirement driven by the one counsel flag. Dep: Vendor, Counsel.
- [ ] **Identifying-detail detection for pre-enrollment AFBI** (names, birth dates, phones, addresses). AC: NER-based detector replaces the prototype regex; flagged sentences can't be kept. Dep: Vendor.
- [ ] **Setting dimension in pilot metrics** on the server. AC: per-setting metrics with cohort guard 11. Dep: Backend.
