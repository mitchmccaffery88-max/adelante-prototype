
## Goal

Turn `Patient.carePlanSummary` from a single free-text string into a **derived, structured care-plan snapshot** that auto-updates when intake screeners finish or clinicians edit goals/notes/meds, is surfaced consistently across Patient, Clinician, Case Manager, and Admin views, and is redacted through the existing RBAC + Part 2 consent gates.

## What to build

### 1. Structured CarePlanSnapshot in `src/lib/ehr.ts`

Add (additive, backward compatible):

```ts
export interface CarePlanSnapshot {
  updatedAt: string;
  updatedBy: "system" | "clinician" | "case_manager";
  // Plain-language 6th-grade summary, auto-composed
  summary: string;
  // Structured slices used by every surface
  focusAreas: { key: "mh" | "sud" | "sdoh" | "meds" | "engagement"; label: string; severity?: string }[];
  activeGoals: { id: string; text: string; status: Goal["status"] }[];
  nextSteps: { label: string; dueBy?: string; source: "screener" | "clinician" | "case_manager" | "self_help" }[];
  screenerHighlights: { key: string; name: string; score: number; band: string; takenAt: string; sensitive: boolean }[];
  medications: { name: string; state: "active" | "refill_pending" | "changed"; sensitive: boolean }[];
  sdohOpen: { need: string; status: SdohStatus }[];
  // Population-health aggregates (non-PHI safe)
  metrics: {
    phq9Latest?: number; gad7Latest?: number;
    goalsOpen: number; goalsDone: number;
    sdohOpen: number; sdohClosed: number;
    lastContactAt?: string;
  };
}
```

- Add `Patient.carePlan?: CarePlanSnapshot`. Keep `carePlanSummary` populated (mirror of `carePlan.summary`) so no reader breaks.
- Add `AdelanteEHR.recomputeCarePlan(patientId)` — pure function that reads screeners, goals, notes, meds/refills, SDOH, check-ins, tasks and returns a fresh `CarePlanSnapshot`.
- Auto-invoke `recomputeCarePlan` at the end of: `submitScreener`, `addGoal` / `setGoalStatus` / `removeGoal`, `updateCarePlanSummary` (merges clinician edits as an override paragraph), `addProgressNote`, `requestRefill` / `reviewRefill`, `addSdohItem` / `updateSdohItem`, `logCheckIn`. Append an `AuditEvent` of kind `care_plan_recomputed` with the trigger.
- Summary composer: template in plain 6th-grade English + Spanish key via `useI18n`. Falls back to "Care plan will appear here after intake." until intake completes.

### 2. Shared `<CarePlanCard />` component

New `src/components/CarePlanCard.tsx` used by all four surfaces so copy and gating stay identical.

Props: `{ patient, audience: "patient" | "clinician" | "case_manager" | "admin" }`.

Rendering rules per audience (all driven through `canAccess` from `src/lib/roles.ts`):

- **patient**: shows `summary`, `activeGoals`, `nextSteps`, non-sensitive `screenerHighlights` (PHQ-9/GAD-7/PCL-5), meds by name only if consent `part2Sud` unnecessary, SDOH items where `visibleToPatient`. Never shows SUD screeners / SUD meds unless the patient is viewing their own record (they always can).
- **clinician** (therapist/pmhnp): full snapshot, SUD slices shown only when `canAccess(role, "screeners_sud" | "sud_treatment", patient).locked === false`. Locked slices render the existing `<GatedCard />` "42 CFR Part 2 — consent required" state instead of the data.
- **case_manager / peer_specialist**: same as clinician but `therapy_notes`, `meds_erx` slices collapse to counts only ("2 active medications") when their matrix level is `read`-summary; SUD slices honor consent gating.
- **admin / sys_admin / billing**: only `metrics` block + de-identified `programId`; never `activeGoals`, `screenerHighlights`, meds, or SDOH detail — used for population health tiles. Enforced by the component (audience === "admin" branch reads only `carePlan.metrics`).

Every sensitive slice runs through `<GatedCard cls=... patient=... />` so the existing RBAC matrix is the single source of truth. No new access rules — we only classify each slice against an existing `RecordClass`.

### 3. Surface integration

- `src/components/PatientHome.tsx`: replace the current "Care plan" paragraph block with `<CarePlanCard audience="patient" />`. Keep the section heading and i18n keys.
- `src/routes/clinician.tsx`: above the existing editable textarea, render `<CarePlanCard audience="clinician" />`. The textarea keeps writing to `updateCarePlanSummary`, which now sets `carePlan.summary` as a clinician override and marks `updatedBy: "clinician"`.
- `src/components/ClientRecordDrawer.tsx`: replace the "Care plan" mini-panel with `<CarePlanCard audience="case_manager" />`.
- `src/routes/admin.tsx`: add a "Population health" strip that iterates patients and aggregates `carePlan.metrics` (avg PHQ-9, % goals closed, SDOH closure rate, patients with open crisis flag). Uses `<CarePlanCard audience="admin" />` for per-patient rows in existing patient tables.

### 4. i18n + accessibility

- Add English + Spanish strings for section title, focus-area labels, next-step verbs, locked-state message, "Updated {time} by {role}".
- Card uses `aria-live="polite"` around the summary paragraph so screen readers announce auto-updates after intake completion.
- Reuse existing shadcn Card / Badge components and design tokens; no new colors.

### 5. Verification

- Unit-style manual pass: run intake for the demo `enrolled` persona → PHQ-9 submit → confirm `PatientHome` summary changes without reload, clinician view shows updated snapshot, admin population-health tile increments.
- RBAC pass: switch acting role (Peer Specialist without Part 2 consent) → confirm SUD screener + SUD meds slices show the locked card, non-SUD slices remain visible.
- Playwright screenshot patient + clinician + case-manager + admin views at 390×844 and 1280×800 to confirm parity.
- `bun run build` and `bun run lint` clean.

## Technical notes

- Pure derivation in `recomputeCarePlan` keeps the in-memory store the single source of truth; no separate cache to invalidate. Notifiers already fan out on every EHR write, so React consumers re-render automatically.
- Sensitivity classification lives in the composer (each slice tagged `sensitive: boolean` at build time) so the component doesn't have to re-derive it. Component still calls `canAccess` for the authoritative gate.
- Admin metrics intentionally exclude names, screener item text, medication names, and SDOH free text; only counts, latest scores, and timestamps — matches current `programId` de-identification pattern.

## Out of scope

- Persisting to a real backend.
- Editable structured goals UI beyond what already exists in `clinician.tsx`.
- New consent purposes or new RBAC roles.
