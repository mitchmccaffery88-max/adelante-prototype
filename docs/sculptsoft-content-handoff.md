# SculptSoft handoff — Patient Content & Resources Center

Everything in the prototype content center is in-memory and resets on reload. Rules
below are **Draft — pending clinical sign-off**.

## 1. Server-side CMS with versions and approval
- Today: `src/lib/contentPublishing.ts` holds each item's working body, frozen
  published body and a full revision list (created / edited / submitted /
  returned / published / retired). Patient screens read published bodies only
  (`src/lib/contentCatalog.ts` overlays them on the shipped baseline).
- Needed: persistent tables for entries + immutable revisions, author and
  reviewer recorded per revision, server-enforced publish rules (below).
- Publish rule (`src/lib/contentGovernance.ts → publishBlocker`):
  - editorial items publish immediately by any content publisher;
  - items flagged **clinical** or **Part 2** need a clinical reviewer
    (PMHNP, physician, clinical coordinator) who is not the author;
  - patient-facing content without a Spanish version is blocked unless an
    override reason is recorded; Spanish users then see "Spanish coming soon".
  - The server must re-check all three; the UI is not the gate.

## 2. Tag taxonomy governance
- "What this addresses" fields: SDOH categories (same ids as
  `sdohResourceMatch.ts`), screener bands, ASAM dimensions, reentry stage
  (pre-release / first 30 / 30–90 / after 90), population; flags Part 2 and
  clinical; Spanish status, reading level, owner, next review date.
- Shipped content was back-filled where the mapping was obvious; each such tag
  carries `backfilled: true` and is shown as Draft. A human must confirm them.
- Every recovery / SUD lesson is tagged Part 2. Needed: an owner for the
  taxonomy, a change process, and a migration when a tag is renamed.

## 3. Reading-level service
- Today a rough grade estimate runs in the browser (Draft target: 6th grade for
  patient text). Replace with a server-side scorer for EN and ES.

## 4. Translation workflow
- Spanish status per item: missing / draft / reviewed. Needed: translator
  assignment, side-by-side review, and "reviewed" set only by a named reviewer.

## 5. Review reminders
- Each item has a next review date; the center's home counts "Past review
  date". Needed: scheduled reminders to the owner, escalation to the content
  manager, no automatic unpublish (product decision: no expiry for now).

## 6. Part 2 enforcement on derived text
- Part 2 titles are hidden (not stubbed) for roles without SUD access, in
  advocate progress and in notification text; recovery-meeting resources show
  the category only (daily check-in included). Adel suggestions to the patient
  are tag-driven, Simulated, and neutral.
- Needed server-side: the same filter on every derived string (push, SMS,
  email, exports, search indexes, analytics), not only on screens.

## 7. Resource verification audit before launch
- Baseline verification (Mitch, 8 Oct 2026) was recorded through the real
  verify action on every listing with complete facts, verifier "Baseline
  verification (Mitch)", note "Baseline — final audit before official launch".
- **One listing was not verified:** SMART Recovery has no phone number on file.
  The verify action requires address, phone and hours, so it stays in the
  "Not verified" queue until a real phone is entered. Nothing was invented.
- Verify now stamps the current managed revision (CMS edits are never
  overwritten by the shipped copy). Needed: a pre-launch audit that re-calls
  each provider and records a fresh verification.

## Staff reference, curriculum and audit (S1–S6, Draft)
- `/content-library` provides the role-gated Care reference view; `/admin-content` retains Browse, Manage, Review, Audit and its existing authoring gates. Part 2 catalog rows are omitted, not teased. Enforce these gates server-side.
- Preview uses a local boundary and local language/response state; never patient progress, toolkit, crisis or shared-note writes. Render patient players inside `.patient-theme` while the staff shell keeps staff tokens.
- Exercise and Journey are CMS types with versioned structured bodies, tags, audience gates, ES Draft variants, clinical/non-author approval and inventory export. Shipped exercises and curricula migrate through `seedPublishedContent`.
- Curriculum steps reference module/lesson/exercise ids; sequential required steps lock following steps. Live Journeys block retiring referenced content; replace the reference first, with an audited reason.
- New response/completion records pin `publishedRev`; legacy revision gaps are explicitly unknown, never guessed. Server storage must pin the actual full published snapshot and revision in the response transaction.
- Audit metrics/CSV are aggregates only; every cell below 11 suppressed. No patient-level export, private text, supports or contact data. Period filtering applies to starts/completion dates. Journey rating-change aggregation needs validated cross-step methodology before launch.
- Main audit receives content lifecycle records; registry mutation attempts remain action events. Bulk review requires a reason. Review-overdue work routes to the metadata owner without auto-reassignment.
- Production-bundle browser CI remains the accepted SculptSoft/CI follow-up; the prototype checks use the running dev server with one-time warm-up.
- Journey analytics are Draft derived engagement cohorts: first observed activity among expanded lesson/module steps, completion only when required steps are complete, rating change = per-person average paired dimension change then cohort median. No fabricated Journey-start events; validate attribution where a lesson belongs to multiple Journeys. Rates additionally suppress small non-completer cohorts to avoid subtraction leakage.
