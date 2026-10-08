# Patient player and engagement handoff

## Built
- K1: content-center create/edit/submit/approve/publish/withdraw/verify mutations use registered actions and `runAction`; permission snapshot additions retain existing grants.
- K2: ASAM intervention content comes from published C3 dimension tags rather than fixed lesson IDs; acceptance checks the live catalog.
- Shared lesson renderer: saved/resumable answers, optional before/after ratings and unanswered 0–10 confidence, lettered decisions, visited-only progress, patient palette, rounded card and pill navigation. No milestones or achievement badges were added.
- Phase-timed breathing with Start/Pause, countdown, cycle cap and reduced-motion countdown-only rendering; shared by lesson activities and ExercisePlayer.
- Exercise toolkit saves use activity-based summaries. In-lesson inputs save to the existing engagement store. Mapper selections are removable chips.
- Opt-in, session-persistent EN/ES read-aloud controls, slow/normal, replay/stop and sentence highlighting when browser boundary events are available. Sensitive steps remain tap-only; voice is labelled Simulated.
- Home resumes the most recently updated incomplete lesson and shows its saved step; toolkit fallback applies only when none is in progress. Today actions remain patient-private.
- Library practice uses matching exercises and guided tool flow, with no-match skip. Grounding collects one sense per screen and saves each answer.
- Lesson Adel saves up to three sequential answers, scans each free-text answer for crisis signals, returns template-based Simulated encouragement and up to two published tag-matched links, and carries the topic into Adel chat.
- Closing previews the exact tool, next step, reminder and supports saved on confirmation, then shows a warm completion panel.
- Cohort/advocate projections redact protected content identity and omit responses, support contacts and today actions. Engagement counts/streaks derive from store events, not sample metrics.
- SMART Recovery remains Not verified; no phone number was invented.

## Main files
- `src/components/library/ModuleTemplate.tsx`, `LibraryLesson.tsx`, `ExercisePlayer.tsx`, `BreathingPractice.tsx`, `GroundingPractice.tsx`, `AdelConversation.tsx`, `ClosingPreview.tsx`
- `src/components/recovery/RecoveryLessonView.tsx`, `GuidedToolFlow.tsx`
- `src/components/voice/LessonReadAloud.tsx`, `src/hooks/useAdelVoice.ts`
- `src/lib/patientPlayerActions.ts`, `playerEngagement.ts`, `playerPractice.ts`, `breathing.ts`, `engagement.ts`, `contentCatalog.ts`, `asamCarePlan.ts`, `i18n.player.ts`
- `src/components/patient/HomeDashboard.tsx`, `src/styles.css`, `src/lib/AGENTS.md`
- `src/components/library/__tests__/playerEngagement.test.tsx`, `src/lib/__tests__/asamCarePlan.test.ts`, `e2e/patientPlayer.spec.ts`, `playwright.config.ts`, `e2e/global-setup.ts`

## Verification
- Full unit run: **2,435 tests passed across 295 files**.
- Harness compilation/type checking reported clean; latest observed harness log reports `build OK`. No manual build or typecheck was run.
- Full parallel browser run against localhost Vite preview: **52/52 passed**, three workers, **3.5 minutes**, no retries in this run. This includes calendar, continuity, content wiring and both new player journeys. Previous parallel run before adding the two player specs: 50/50 passed.
- English browser journey: Luis listens twice, starts/pauses breathing, saves practice, chooses an action, leaves to Home, resumes Part B, answers all three Adel questions, checks the exact toolkit preview and finishes. The saved label equals the displayed preview; private answer/support text is absent from the cohort projection.
- Spanish browser journey: valid first-72-hours lesson, Draft Spanish controls, listen/stop/continue; a HIPAA-only advocate link created and claimed through store functions has allowed progress access with no protected lesson ID or private answer/action. Privacy is asserted on the advocate projection, not a separately rendered advocate walkthrough.
- Standalone English walkthrough finished at `/library?item=ss-calming-my-mind`, with no observed page errors. Screenshots confirm breathing, toolkit preview and completion.

## Decisions and remaining work
- **K3 production-artifact run remains unverified.** The production preview command requires Nitro build output, which is absent in this sandbox; the harness owns builds. The 52-test green run above is against the running development server, not a production bundle. Retain one-time warm-up and existing assertions; do not treat this as production verification.
- New player controls are EN/ES (Spanish Draft). Shipped lesson body translations are not universally complete: `ss-calming-my-mind` has no Spanish authored overlay and displays the Spanish-coming-soon fallback. Recovery content retains its existing Draft translation/fallback policy; translation review remains required before official launch.
- Content-center C2 tables/search/filters/edit side-drawer preview were not completed in this player increment and remain outstanding.
- Browser speech voices and sentence boundary events vary by device; do not promise a particular Spanish voice or clinical-grade narration. Spoken breath cues remain optional; countdown remains usable without audio.
- Prototype responses remain in the engagement store; local persistence used for screener stability is not an identity backend or production storage guarantee.

## SculptSoft backend requirements
- Persist private lesson/exercise responses server-side keyed by authenticated patient, surface and content revision; retain step, max visited, substep, tool-part and answer fields. Apply owner checks to every read/write and content-free reasoned audit events.
- Separate patient-private free text/support contacts/actions from analytics and staff/advocate projections. Explicit sharing must use the consent/disclosure boundary; never put these values into push/SMS/search indexes.
- Recompute completion, toolkit save, streak and latest-incomplete projections transactionally; make retries idempotent and handle concurrent sessions without discarding answers.
- Preserve action-registry permission checks server-side for CMS changes and ASAM suggestion acceptance; reject retired or missing published IDs and keep source/revision provenance.
- Use a replaceable Simulated voice/Adel adapter boundary. Any real voice or LLM service needs approved consent, retention, language and Part 2 review; never send patient responses to an external service merely to narrate a step.