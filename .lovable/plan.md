# Adelante Pathways — MVP EMR Extension Plan

This is strictly **additive**. No existing route, type, method, flow, or design token is removed or renamed except the one deliberate seam rename in Step 1. After every step I verify the app still runs and existing flows (landing → intake → schedule; referral → enrollment; clinician notes) are unchanged.

## Step 1 — Seam rename (mechanical, behavior-preserving)
- `src/lib/healthie.ts` → `src/lib/ehr.ts`
- `HealthieService` → `AdelanteEHR`, `useHealthie` → `useEhr`
- Update every import (AppShell, all routes, PatientProfileDialog, PatientHome, etc.)
- No signatures, fields, or behavior change. Verify build + all flows.

## Step 2 — County flip + additive type fields (no UI change)
- AppShell footer: "Kings County Pilot" → "Tulare County Pilot"
- Reweight demo `countyOfRelease` to mostly Tulare; keep 1–2 Kings records for the ISL 2027 pipeline
- Referral form county default → Tulare
- Extend types in `ehr.ts` (all optional, backward compatible):
  - `Patient.episodes?: Episode[]`
  - `Patient.releaseDateMeta?: {...}` (keep existing `releaseDate` string)
  - `Patient.documents?: PatientDocument[]`
  - `Patient.sdohPlan?: {...}`
  - `Patient.selfHelpPlan?: {...}`
  - `Patient.coverage.snapshots?: [...]`; add `private_pay | uninsured` status
  - `Appointment.fundingLane?: FundingLane`
  - Extend `ConsentPurpose` with `telehealth | roi | portal | proxy | group`
- Seed Marcus (p3) with co-occurring MH + SUD episodes
- Add `tMinus(patientId)` helper and stub methods: `uploadDocument`, `classifyDocument`, `verifyDocument`, `rejectDocument`

## Step 3 — Consent ledger view + extended purposes
- New route `/consent` (or tab) surfacing `listAllConsentEvents()` + disclosure log
- Per-purpose revoke wired to existing `setConsent`; revoke of `part2Sud` re-locks SUD rows live
- Add i18n keys for new purposes

## Step 4 — Acting-staff-role context + RBAC record-class gating
- New "acting as" selector in existing Staff dropdown (case_manager, peer_specialist, therapist, pmhnp, billing, sys_admin), stored in localStorage
- Small `useActingRole()` hook + `canAccess(recordClass, role, consentState)` matrix per spec §4b
- Wrap gated chart sections with a `<GatedCard>` that renders locked-state ("42 CFR Part 2 — consent required") when denied

## Step 5 — Document upload + verify queue
- Patient home: upload control writing an `unverified` document
- Case-manager: "Documents to verify" queue with classify → verify/reject actions and Part-2 inheritance for `part2_program_record` class

## Step 6 — Episodes strip + release-date object + funding-lane tags
- Patient chart header: episodes strip (chips per episode with state)
- Release date UI shows source/confidence badges + history popover
- Appointment cards render funding-lane pill; scheduling writes a default lane based on coverage

## Step 7 — /billing route + ISL + code/rate table + credentialing
- New route `/billing` (added to `staffNav`) with tabs: Claims worklist (filter by lane), ISL reportable, Code & rate table (Tulare, with "Bagga's clinic NPI | Adelante" toggle), Credentialing tracker (extends `Clinician.mediCalCredentialed/mediCalStatus` with license #, NPI, DEA, DMC cert, effective dates; hard-stop on expired)
- ISL banner referencing 1/1/2027 mandate; uninsured events auto-tagged `isl_non_medi_cal`

## Step 8 — SDOH plan surface + self-help plan surface
- Intake: needs now write `sdohPlan.items` with closed-loop status
- Case-manager: SDOH plan tab per patient showing status progression
- Patient home: self-help modules list with completion checkboxes; adherence shown in caseload

## Step 9 — SUD/DMC-ODS architecture-preview + PMHNP vs Therapist gating
- `/clinician` gated tabs by acting role: PMHNP gets psych eval note type + medication list + "Send to DoseSpot" mock (labeled EPCS/bup stub); Therapist keeps existing progress notes
- New "SUD / DMC-ODS" tab labeled "Architecture preview" showing episode state, ASAM LOC placeholder, LPHA-routing note stub

## Step 10 — Population-health admin + MPI stub + dual crisis ladder
- Admin: enrollment funnel, 70% completion threshold line, PHQ-9/GAD-7 trends, no-show reasons, equity stub
- MPI: "possible duplicate" card in admin/case-manager when name/DOB/CIN collide; mock merge + audit
- Crisis: keep 988 banner; add SDOH-urgent ladder (case manager, 24–48h clock, logged separately from clinical crisis); `// TODO(adelante):` for after-hours coverage

## Technical notes
- All new types optional → no existing demo record breaks
- All new copy goes through `useI18n`/`t()` (EN + stub ES)
- Design tokens (navy/teal/gold, font-display, shadcn/ui) reused; no new palette
- `AdelanteEHR` stays in-memory mock; every new method uses the existing `emit()` pattern
- Where clinical thresholds/decisions are unresolved, code carries `// TODO(adelante):` comments per §5/§9/§10 rather than guessing
- Section §10 (Dr. Bagga field spec) left as an explicit placeholder in `ehr.ts` next to `ProgressNote`/`Goal`

## Verification after each step
1. `bun run build` clean
2. Manual smoke: landing → auth → intake → schedule; referral → case-manager → clinician → admin
3. Consent revoke flow re-locks gated sections (from Step 4 onward)

Ready to start with Step 1 (the rename) on approval.
