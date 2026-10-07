# SculptSoft handoff — Adel Brief (background, incremental)

The prototype computes the Brief in the browser (`src/lib/adelBrief.ts`): four fixed sections (Adherence, Engagement, Visit focus, Care gaps), ≤3 bullets each, cached per patient × role-visibility class, invalidated per source via `SECTION_DEPS`. The narrative is a **Simulated** template adapter (`src/lib/vendors/llm.ts`). Each item below is a ticket: acceptance criterion + dependency.

| # | Item | Acceptance criterion | Dependency |
|---|------|----------------------|------------|
| 1 | Server-side brief cache | Brief sections stored server-side keyed by patient × role-visibility class (role + Part 2 outcome); never shared across classes; entry holds computed-as-of and per-source fingerprint. | Backend |
| 2 | Event-driven invalidation | Every write to a source (MAR/doses, orders, refills, screeners, appointments, messages, check-in counts, plan, safety plan, SDOH, notes, referrals, consents, HIE, labs) publishes an event; only dependent sections recompute (same map as `SECTION_DEPS`). Test proves an unrelated write recomputes nothing. | Backend |
| 3 | Background warm | On workspace load, today's scheduled patients + caseload are queued for warm-up; first render never waits. | Backend |
| 4 | Part 2 at compute time | Sections are computed with the viewer class's filters (filterSudMedsForRole, roleSeesAsamSection, staffPlanView, hieChartView); a non-SUD class never receives SUD-derived bullets or a "Part 2 consent missing" bullet. | Backend, counsel |
| 5 | No note bodies | Brief inputs never include progress-note body text (unsigned notes contribute a count only); ECM/care-manager restriction holds. | Backend |
| 6 | Production LLM vendor + BAA | Real model replaces `SimulatedLlmAdapter` behind the same interface; vendor signs a BAA with 42 CFR Part 2 terms; no training on PHI; zero data retention. Toggle stays off by default. | Vendor choice, BAA, counsel |
| 7 | Grounding | Model input is ONLY the viewer's already-filtered bullets (never the raw record); output sentences that cannot be matched to input bullets are dropped; numbers/dates must match a source bullet exactly. | Vendor choice, backend |
| 8 | Provenance | Every sentence carries the bullet ids it came from (scribe provenance pattern) and links to them in the UI; missing provenance = sentence not shown. | Backend |
| 9 | Audit | Summary generation audits `adel_summary_generated` with counts only, no content; `simulated` flag removed only when the real vendor is live. | Backend |
| 10 | Latency targets | Brief open from cache p95 < 300 ms end-to-end; a single section refresh after an event p95 < 2 s; narrative generation p95 < 3 s with bullets shown first. | Backend, vendor choice |
| 11 | Clinical sign-off | Section scope, thresholds (30 d re-screen, 90 d safety-plan review, 7 d refill runway) signed off; Draft label removed after. | Clinical sign-off |

Prototype timings (seeded demo, Node, ms): Luis old 1.90 → cache hit 0.17; Daniel 0.85 → 0.09; Rosa 1.26 → 0.10. Incremental PHQ-9 update ≈ 1 ms, touching only Adherence / Visit focus / Care gaps.

## Patient Adel chat persistence

The prototype saves patient (and advocate-own) Adel chats in `src/lib/adelHistory.ts`, in browser memory, keyed by owner. There is no staff read path. Sharing sends a **Simulated** topic-only summary (`SimulatedAdelMemoryAdapter`, `src/lib/vendors/llm.ts`) to the care-team thread, through `disclose()` when the chat is Part 2-classified. Retention is 90 days (Draft — counsel to confirm).

| # | Item | Acceptance criterion | Dependency |
|---|------|----------------------|------------|
| 12 | Encrypted server-side chat storage | Threads stored server-side per owner (patient or advocate link), encrypted at rest with KMS-managed keys and TLS 1.2+ in transit; no browser storage of chat text; API returns threads only to the authenticated owner. A test proves no staff role can read a thread. | Backend |
| 13 | Retention and deletion jobs with proof | A scheduled job deletes threads 90 days after last activity (value confirmed by counsel). Patient delete-one / delete-all are hard deletes. Each deletion leaves a content-free stub (thread id, owner, time, reason). Vendor-side deletion is confirmed and stored with the stub; backups expire inside the window. A monthly report compares deletions with threads. | Backend, Counsel |
| 14 | LLM vendor no-training and zero-retention terms | BAA with 42 CFR Part 2 terms covers chat, memory and summary calls; contract terms: no training on our data, zero data retention, subprocessors listed. Replaces `SimulatedAdelMemoryAdapter`. The model receives only the owner's own recent history. | Vendor choice, BAA, Counsel |
| 15 | Part 2 classification on stored chats | Every stored thread carries a Part 2 flag set by a server-side classifier (substance-use mention, replacing the prototype keyword list). Shared summaries from flagged threads go through `disclose()` and are SUD-flagged so existing message masking applies. Classifier precision/recall are reported on a labelled EN/ES set. | Backend, Clinical, Counsel |
| 16 | Crisis path unchanged | The Phase 1 crisis scan runs before save or model call. Escalations keep the crisis policy's minimal snippet and never attach the stored thread. | Backend |
