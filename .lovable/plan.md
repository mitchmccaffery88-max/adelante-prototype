# Phase 5e — "Ask Adel" prototype in the staff top bar

A demo-only helper for Dr. Bagga. Read-only, no model call, no writes, no stored transcript.

## What I found (real current state)

- The shared staff top bar is `src/components/StaffBreadcrumbs.tsx` (Phase 5b): breadcrumb left, `StaffPatientSearch` + My work right. That is where the entry point belongs — one place, every staff page.
- The three encounter prototypes exist at `/agentic/chart-review/$patientId`, `/agentic/scribe/$patientId`, `/agentic/dictation/$patientId`. They are not in the nav registry; `AppShell` already treats `/agentic/*` as a staff surface. Chart review reads real chart facts via `chartReviewFacts(patientId, role)` — which already takes the role, so masking is honoured.
- Honesty chrome already exists: `PrototypeBanner` ("Prototype — not connected to a live AI model"), `SampleBadge`, `RealDataBadge` in `components/agentic/PrototypeChrome.tsx`. I reuse these, not new labels.
- Real helpers available for answers: `myOpenItems` / `myCaseload` / `screenerDueRows` / `disengagementRows` (myWork.ts), `sdohNeedAging` / `referralAgingState` (sdohAging.ts), `sdohFunnel` (sdohReporting.ts), `referralFunnel` / `referralDropOff` (referralFunnel.ts), `coverageWorklistRows` + `coverageWorklistSummary`, `listUnsignedWork`, `AdelanteEHR.listClaims()`, credential status from `AdelanteEHRExt`, `listPatientOpenItems`.
- `screenerDueRows(patients, { role })` already drops Part 2 screeners per patient when `screeners_sud` is locked — reused as-is, no second rule.
- `cohortGuard()` / `MIN_COHORT_SIZE = 11` is the shared guard; `sdohFunnel` / `referralFunnel` already carry it on their results.

## Role groups (per-role picture)

| Group | Roles | Question theme |
| --- | --- | --- |
| Clinical | therapist, pmhnp, sud_counselor, clinical_trainee, medical_assistant | care-focused |
| Care coordination | ecm_provider, cf_care_manager, peer_specialist, community_health_worker | coordination-focused |
| Administrative | clinical_coordinator, billing, billing_coordinator, credentialing_coordinator, sys_admin | practice management |

Medical assistant sits in the clinical group but only gets questions its access supports (no psychotherapy/SUD content). Credentialing coordinator has no patient access at all: it keeps only the credential-expiry question and gets **no** encounter shortcuts and no patient prompt. No role falls outside the three groups. Every individual question is additionally filtered by a real `canAccess` check, so a role that ends up with zero questions **and** zero shortcuts never sees the button.

## Build

1. **`src/lib/askAdel.ts`** (pure, testable) — the whole thing lives here:
   - `roleGroupFor(role)` → `"clinical" | "coordination" | "admin"`.
   - `ASK_ADEL_QUESTIONS`: each entry `{ id, group, prompt, requires: RecordClass[], answer(ctx) }`.
   - `askAdelQuestionsFor(role)` — filters by group and by `canAccess`.
   - `answerQuestion(id, ctx)` → `{ lines: string[]; link?: { to, label }; backing: "real" | "illustrative"; guard?: CohortGuard; notes?: string[] }`.
   - `canUseAskAdel(role)` → questions or shortcuts exist.
2. **`src/components/AskAdelPanel.tsx`** — a Sheet opened from a top-bar "Ask Adel" button. Contains `PrototypeBanner`, the sample-question list for the role, the rendered answer (with link, guard notice, draft-threshold notes), and the three encounter shortcuts. A disabled-looking free-text box states plainly: *"This prototype answers only the sample questions listed above. Free-text questions are not available."* Shortcuts use the patient in context (`/record/$patientId` or an `/agentic/*` route); otherwise the panel shows the shared `StaffPatientSearch` inline to pick one.
3. **`StaffBreadcrumbs.tsx`** — render the button next to My work, only when `canUseAskAdel(role)`.

## Questions and their backing

Clinical — real: overdue re-screens on my caseload (`screenerDueRows`, Part 2-masked, draft cadence note, links `/my-work`); my unsigned notes and undocumented visits (`listUnsignedWork`, links `/notes-queue`); what changed for this patient since the last visit (`chartReviewFacts`, links the chart-review prototype). Illustrative: "care gaps before today's appointment" uses the chart-review gap list where real, otherwise labelled illustrative.

Coordination — real: needs/referrals past their draft aging threshold (`myOpenItems().sdohAging`, links `/my-work`); waitlisted referrals on my caseload (referral outcomes, links the record); clients with no contact since enrolment (`disengagementRows`, draft threshold labelled); follow-ups due (`myOpenItems().overdueTasks`).

Admin — real: referrals that reached an attended first visit this period (`referralFunnel`, links `/reporting#referral-funnel`); overdue Medi-Cal eligibility checks (`coverageWorklistSummary`, links `/eligibility-worklist`); claims at documented awaiting signature (`listClaims`, links `/admin-claims`); credentials expiring or expired (credential status, links `/admin-credentialing`).

## Guardrails applied

- Every answer runs the same selectors the real page runs, filtered by `canAccess` — no new data path.
- Part 2: SUD screener names never appear for a gated viewer (reuses `screenerDueRows` masking); referral answers never name a recovery/support-group category or organisation — those fold into the same "other / confidential" treatment used in reporting, and gated viewers see a restricted count only.
- Interpersonal-safety needs stay staff-only, exactly as the 5d-2 selectors already return them.
- Cross-patient aggregates carry `cohortGuard`; a below-threshold count renders the existing guard notice wording. Counts of *my own* caseload are stated as a personal work list, not a published aggregate.
- Read-only: answers render text and links. No buttons that write.

## Verification

Tests in `src/lib/__tests__/askAdel.test.ts`: role→group mapping for all 14 roles; question filtering by access; a Part 2-gated role never receives a SUD screener or recovery category in an answer; cohort guard present on aggregate answers; credentialing coordinator gets no shortcut; answers expose no write callable. Then typecheck, full suite, build, and a live browser pass at both viewports as a clinical, a coordination, an admin and a Part 2-gated role.

## Non-goals

No live model call, no transcript storage, no write actions, no changes to the existing `/agentic/*` prototypes.
