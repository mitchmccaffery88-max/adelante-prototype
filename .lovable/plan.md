# Plan: Agentic Roadmap prototype walkthrough

## Scope
Build three unmistakably demo-only screens for Dr. Bagga’s platform walkthrough:

1. Guided Chart Review — pre-visit summary using existing patient chart data.
2. Scribe Copilot — live-encounter prototype with Xaia-inspired parallel panels.
3. Smart Dictation — post-encounter dictation prototype, visually distinct from live recording.

No live AI integration, no transcription, no billing-code engine, no data-model changes, and no changes to real clinical access rules.

## Investigation first
- Confirm existing chart data sources for medications/MAR, notes, screeners, care plan, alerts, tasks, and appointments.
- Confirm existing appointment/chart entry points and route patterns.
- Reuse the app’s existing warning/draft/pending-review visual language for prototype labels and consent caveats.

## Build approach
- Add shared prototype UI helpers for:
  - “Prototype — not connected to a live AI model” label.
  - Source-data badge/copy separating real chart facts from sample narrative.
  - Scribe-only consent-precondition banner.
- Add three staff-facing routes:
  - `/agentic/chart-review/$patientId`
  - `/agentic/scribe/$patientId`
  - `/agentic/dictation/$patientId`
- Each route will include its own route metadata and use existing patients via `AdelanteEHR`.

## Guided Chart Review
- Pull real data from the existing patient record where available: demographics, appointments, care plan, meds/orders, MAR administrations, notes, screeners, tasks, alerts, referrals/SDOH.
- Present a pre-visit summary with clear sections:
  - Real chart facts.
  - Sample/illustrative synthesis narrative.
  - Care gaps and flags derived from existing fields when possible.
- Add a real entry point from the full-page chart header and appointment cards.

## Scribe Copilot
- Create a live-encounter demonstration screen modeled on the reference layout language: parallel panels for red flags, chart insights, differential, suggested questions, recommendations, and transcript.
- Populate all panels with realistic sample content tied to the selected demo patient, clearly labeled as sample.
- Add a visible top banner: “Recording consent confirmed — prototype only.”
- Add a sensible real entry point from clinician appointment/session cards and chart header.

## Smart Dictation
- Create a post-encounter screen with no live-visit framing and no recording-consent banner.
- Show sample clinician dictation alongside a polished chart-aware note preview.
- Visually position it as lower-burden post-visit documentation, not patient recording.
- Add a real entry point from chart header and note/documentation area if feasible without altering workflow.

## Verification
- Run typecheck and tests.
- Use browser verification at 1280px and 390px for all three screens.
- Confirm prototype labels on all three screens.
- Confirm the consent banner appears only on Scribe Copilot.
- Confirm Guided Chart Review displays real patient facts.
- Confirm entry points exist from clinical surfaces.
- Confirm no console errors.

## Interpretation to report
- How Scribe Copilot is visually distinguished from Smart Dictation.
- Which real entry points were used for each screen.
- Any places where sample narrative is used because the real system has no live AI generation.
