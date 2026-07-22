# Adelante MVP Expansion — Implementation Plan

Additive extension of the existing wireframe (last edit: 2026-07-22). Nothing existing is rebuilt, restyled, or re-worded unless a section below explicitly calls it out. All new surfaces reuse `Card`, `Tabs`, `Badge`, `Select`, `EmptyState`, `LoadingSkeleton`, `TimePicker`, `ClientDate`, `CarePlanCard`, `ClientRecordDrawer`, and the existing navy/teal token system.

## 0. Global re-points (smallest safe edits)

- `src/lib/ehr.ts` (line 959), `src/routes/referral.tsx` (75), `src/routes/intake.tsx` (163): default `countyOfRelease` → `"Tulare"`. Keep `"Kings"` selectable in the county dropdown (labelled "Tentative — future expansion").
- `src/components/Landing.tsx` footer + `src/lib/i18n.tsx` `adminSubtitle` (EN + ES): "Kings County" → "Tulare County".
- Seed one `Facility` row: **Premier SUD & Mental Health, Tulare** and attach existing clinicians + `ClinicLocation`s to it.

## 1. Data model additions (`src/lib/ehr.ts`)

Additive types only; existing ones untouched.

```text
Organization { id, name }
County        { id, orgId, name }              // Tulare seeded; Kings placeholder
Facility      { id, countyId, name, address }  // Premier Tulare seeded
Program       { id, facilityId, name, careTypes[] }

CredentialDoc { id, clinicianId, kind: license|dea|malpractice|board|cv|caqh|other,
                issuingState?, number?, issuedAt?, expiresAt?, fileRef,
                status: current|expiring|expired|missing|under_review,
                verifiedAt?, verifiedBy?, verificationMethod? }

PayerEnrollment { id, clinicianId, payer, plan, billingTin, orgId,
                  status: enrolled|pending|not_enrolled|terminated,
                  effectiveFrom, effectiveTo? }

CoverageSpan  { id, patientId, payer, plan, from, to?, source }   // dated eligibility

ClinicianProfileExt { specialty, credentialType (PMHNP|LMFT|LCSW|MSW|Peer),
                      careTypes[], languages[], baseFacilityId, active: boolean }

AvailabilityBlock  { id, clinicianId, weekday, start, end, modality,
                     locationId?, careTypes[] }
AvailabilityException { id, clinicianId, date, kind: off|added, start?, end?, note }

AppointmentState = scheduled|confirmed|completed|cancelled_patient|
                   cancelled_staff|late_cancel|rescheduled|no_show
Appointment gains: state, stateHistory[], cancellationReason?, facilityId?

ProgressNote gains: source: human|machine_assisted, draftState: draft|signed,
                    signedAt?, signedBy?, part2Derived: boolean
AudioArtifact { id, encounterId, uri, part2Derived }   // schema-only, no UI
Consent gains: kinds "recording", "ai_use" (accepted by model; not surfaced)

Claim { id, encounterId, state: completed|documented|signed|coded|generated|
        submitted|paid|denied|partial, denialReason?, denialAt?,
        rendererId, patientCoverageAtDoS, enrollmentAtDoS }
```

Every new row carries `orgId` / `facilityId`. Reads scoped through a small
`scope.ts` helper (pilot: single org, no UI). Event bus (already present via
`Listener` in `ehr.ts`) fans out `appointment.stateChanged`,
`note.signed`, `credential.expiring`, `enrollment.changed`,
`coverage.changed` so dependent views re-render without polling.

## 2. RBAC extension (`src/lib/roles.ts`)

Add permission sets (independently grantable, layered on Admin):

- `clinical_coordinator` — roster, coverage
- `credentialing_coordinator` — credential vault PII (tighter than PHI)
- `billing_coordinator` — claims worklist + eligibility, **no clinical notes**

New `RecordClass` values: `credential_docs`, `payer_enrollment`, `claims`,
`roster`. Matrix wired so credentialing PII is only visible to
`credentialing_coordinator` / `sys_admin`; claims worklist opens without
therapy-note access.

## 3. New / modified surfaces

**New routes**
- `/clinician-profile` — self-serve profile: specialty, credential type, care
  types, languages, base facility, active toggle, link into credential vault.
- `/clinician-availability` — recurring weekly blocks (weekday × time ×
  modality × location × care types) + one-off exceptions. Uses `TimePicker`.
- `/clinician-credentials` — clinician's own credential vault; upload,
  expiration chips, "Under review" state, restricted-data banner.
- `/admin-credentialing` — roster credential status table, upload on behalf,
  mark verified, filter by status, payer-enrollment sub-table per clinician.
  Gated by `credentialing_coordinator`.
- `/admin-coordination` — clinical coordination roster: care types, current
  availability, load vs capacity, specialty, active flag, payer + credential
  status summaries; filter by care type / modality / facility / status.
- `/admin-claims` — claims worklist with tabs: Ready to bill · Blocked on
  documentation · Blocked on eligibility · Submitted · Denied. Denial reason
  capture. Uses `EmptyState`.
- `/notes-queue` — unsigned-note aging queue (clinician sees own; coordinator
  sees all). Age-based escalation styling (neutral → attention → urgent).

**Modified surfaces (smallest change)**
- `src/routes/clinician.tsx` — add "Today" and "My caseload" strip at top
  (today's appts w/ modality + location; per-patient episode day, next
  session, completion rate, PHQ-9/GAD-7 trend arrow). Existing tabs
  untouched. Add badges linking to unsigned-note queue + expiring credentials.
- `src/routes/schedule.tsx` + clinician booking in `clinician.tsx` — plug
  bookings through new `SchedulingConstraints.evaluate()` (active clinician,
  in availability window, modality match, care-type match, credentials
  current, payer/plan enrollment at DoS). On fail, show plain-language
  reason instead of hiding slots. Add inline "switch to virtual" affordance
  in the cancel/reschedule flow when reason ∈ {transport, ride, weather}.
- `src/routes/admin.tsx` — add cards linking to the four new admin surfaces;
  keep everything else intact.
- `src/routes/billing.tsx` — becomes the entry banner that links to the new
  `/admin-claims` worklist; existing content preserved as "Claim history".
- `src/routes/auth.tsx` persona picker — add "Clinical Coordinator",
  "Credentialing", "Billing Coordinator" as admin sub-personas.

**New components**
- `CredentialCard`, `CredentialStatusChip`, `PayerEnrollmentTable`,
  `AvailabilityEditor`, `AvailabilityBlockRow`, `RosterTable`,
  `ClaimStateBadge`, `ClaimWorklistTable`, `NoteAgingRow`,
  `TrendArrow`, `TodayList`, `CaseloadStrip`, `RestrictedDataBanner`,
  `AppointmentStateBadge`.

## 4. Cross-surface sync

Central `ehrBus` (extend existing subscription in `ehr.ts`). Mutations emit
typed events; the following views subscribe via `useEhr`: clinician
schedule, caseload strip, coordination roster, patient care plan, claims
worklist, notes queue. No component fetches on its own timer.

## 5. Care-plan / crisis / accessibility guarantees preserved

- 988 banner and MobileNav offset logic unchanged.
- All new patient-visible copy at 6th-grade reading level (staff surfaces
  may use clinical terminology).
- Every new surface receives an i18n key (EN populated, ES stubbed to match
  current pattern in `i18n.tsx`).
- Audit event emitted on every credential / claim / enrollment read + write
  via existing `AuditEvent` pipeline.

## 6. Explicitly NOT built (per Section 9)

Adel/AI features, ambient recording UI, patient summarization, primary
source verification, lab ordering, native app, secure messaging, tenant
management UI, full analytics dashboards, e-prescribing UI, automated
denial management. Schema seams only, per §7.3.

## 7. Deliverable at completion

Changelog file `.lovable/changelog-expansion.md` listing: screens added
(7), screens modified (5), components added (~14), data model additions
(~15 types), plus a "judgment calls" section (e.g., defaults for credential
"expiring soon" threshold — proposed 60 days; late-cancel window —
proposed <24h; payer list — Medi-Cal FFS, Tulare County MHP, and the three
Medi-Cal managed care plans active in Tulare as seed rows).

## Judgment calls needing your sign-off (please flag before build)

1. **Expiring-soon window**: 60 days for licenses/DEA, 30 for malpractice — OK?
2. **Late-cancel threshold**: <24 hours before start — OK?
3. **Seed payer list for Tulare**: Medi-Cal FFS, Tulare County MHP, Health Net Medi-Cal, Anthem Blue Cross Medi-Cal, CalViva — confirm the managed care set.
4. **"Active/inactive" toggle**: does deactivating a clinician auto-cancel their future appts or just freeze new bookings? Proposal: freeze bookings, flag existing appts for coordinator review, no auto-cancel.
5. **Notes queue escalation thresholds**: neutral 0–2 days, attention 3–6, urgent 7+ — OK?
