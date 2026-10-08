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
