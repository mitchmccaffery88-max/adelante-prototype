# R57 engagement-risk flag and event-triggered needs re-screens

Approved by Mitch, 1 Nov 2026. **Draft — pending clinical sign-off**; Christi tunes thresholds and weights. Explainable, non-punitive rules, not a prediction model. No publication, persistence or Supabase changes.

## What exists (inventory before product changes)

| Source | Current evidence / availability |
| --- | --- |
| Missed visits | `src/lib/ehr.ts:2200–2240` stores appointment start/status, `noShow.at` and `cancellation.at/lateCancel`; real cancellation/no-show paths are `staffCancelAppointment` and `markAppointmentNoShow` (`ehr.ts:9953` onward). Existing dated appointment status supplies the 30-day window; no new attendance fields. |
| Outreach and replies | `src/lib/caseloadReview.ts:26–34,73–124` records attempted/no-answer versus actual call/text/in-person/video contacts, with dates. Patient `careMessages` (`ehr.ts:1870`, messaging methods near 16800) has staff/member authorship and timestamps. Use structured attempt logs plus staff messages, never infer unanswered calls from free text. |
| Phone/address | `src/lib/demographics.ts:61–68` and `ehr.ts:1850` hold timestamped changed fields; `updatePatientDemographics` appends history (`ehr.ts:12276`). Phone change and address change exist. A structured disconnected-phone or confirmed SMS-undeliverable field has not been established: **needs data**, skip those branches; notification delivery errors are not automatically a disconnected phone. |
| Coverage | `ehr.ts:1725–1760` stores coverage status and verification (`pending`, `not_found`, etc.), with dated coverage spans. Captured inactive/suspended or pending eligibility can be used; absent coverage is **needs data**, not an inferred gap. Eligibility transports remain Simulated. |
| Release/reentry | Patient `releaseDate` plus provenance `releaseDateMeta` (`ehr.ts:1874–1875`); R53 already reads real release date in `rescreenCadence.ts:22–30`. No episode-day substitution. |
| HRSN / needs | Scored results/history in `ehr.ts:1692`; CMS AHC-HRSN definition/domains in `screeners.ts:550` onward. Housing/food/transport domain positives and `sdohPlan.items` (`ehr.ts:792–813,1891`) have resolution status and provenance; packet needs are separate referral-staging evidence, not automatically a clinical HRSN result. Safety has its own `safetySensitive` boundary (`ehr.ts:696–699,807–813`) and is excluded here. |
| Phone/data need | `whatWouldHelp.ts:40–58` captures optional topic `phone` with the canonical need “Phone or internet”; this exists in `sdohPlan` when actually selected. Absence is **needs data**, not a fabricated add-on answer. |
| Member needs changes | Need source `intake_self_report` and dated updates exist (`ehr.ts:679–683,802–805`). Only actual member writes may trigger; staff/advocate/partner imports never become member-reported changes. |
| R53 overdue | `rescreenCadence.ts:65–80` groups outstanding tasks; `RESCREEN_PROMPT_RULES.staffFollowupDays` is 10. No instrument names or safety content belong in the engagement reason. |
| App-open sweep | `useReminderSweep.ts:28–55` invokes the existing R53 sweep on mount and every 20 minutes while a browser is open. Exact timing/delivery needs the production scheduler, R54/R48. |
| Caseload tile/list | `WorkspaceDashboard.tsx:95,149` renders the existing “My caseload” tile; `CaseloadTable.tsx:210–224` renders the staff member list, including a previous New/Steady presentation column. Caller scopes and chart gates must remain authoritative. |
| Task lifecycle | Existing `CaseTask` (`ehr.ts:4427–4498`), creation dedupe (`ehr.ts:16997–17029`) and staff worklist completion are reused. Existing completion has no R57 outcome requirement yet. |

### Signal mapping (all Draft — pending clinical sign-off)

- Missed visits: **exists** (dated no-show/late-cancel status).
- Outreach not answered: **exists** (structured no-answer contacts and timestamped staff/member messages; message content never inspected).
- Contact lost: **partial** (phone history exists; disconnected/confirmed undeliverable **needs data**, skipped).
- Housing unstable: **exists** (living-situation item/HRSN domain + resolution; do not treat every housing-quality issue as loss of stable housing).
- No phone or data: **exists if captured** as “Phone or internet”; otherwise **needs data**.
- Transportation / food: **exists** (scored domain and unresolved plan evidence).
- Re-screen overdue: **exists** (R53 day-10 groups; neutral reason only).
- Early reentry: **exists if release date captured**; no stand-alone flag.
- Coverage gap: **exists if captured** (status/verification); otherwise **needs data**.
- Interpersonal safety: **excluded**, keeps existing clinician routing; never a flag reason.

## Results

- Inventory completed before application changes. No invented signal fields or demo events.
- Implementation and validation pending.

## Open clinical / production items

- Christi: confirm thresholds, time windows, weights and early-reentry step-up; all remain Draft.
- Disconnected phone / confirmed SMS undeliverable: needs structured data; do not infer from simulated delivery failure text.
- Uncaptured phone/data need and absent coverage: needs data, skipped.
- R54/R48 production scheduler: app-open sweeps cannot guarantee timing or delivery.