# Adelante Expansion — additive layer

## New modules
- `src/lib/ehr-ext.ts` — Organization, County, Facility, ClinicianProfileExt, CredentialDoc, PayerEnrollment, CoverageSpan, AvailabilityBlock/Exception, NoteSignature, Claim + cross-surface `ehrBus`.
- `src/lib/scheduling.ts` — `SchedulingConstraints.evaluate()` returning blocks/warnings (license, credential, enrollment, availability, service, modality, location, double-book, past time). `isLateCancel()` uses a 24 h window.

## Roles
- Added `clinical_coordinator`, `credentialing_coordinator`, `billing_coordinator` to `STAFF_ROLES`.

## New routes (all reachable from the Staff dropdown or Admin dashboard)
- `/clinician-profile` — self-serve specialty/languages/bio + freeze bookings.
- `/clinician-availability` — weekly blocks + time-off exceptions.
- `/clinician-credentials` — upload license/DEA/malpractice, status auto-derived.
- `/admin-credentialing` — verify creds, view payer enrollments, expiring alerts.
- `/admin-coordination` — cover frozen providers, spot unassigned patients.
- `/admin-claims` — encounter-level claims worklist (documented → paid/denied).
- `/notes-queue` — unsigned completed encounters; signing releases the claim.

## Patches
- `AppShell` — added the 4 new staff nav entries.
- `admin.tsx` — added three coordination shortcut cards.
- `billing.tsx` — link to the claims worklist.
- Kings → Tulare defaults in `intake.tsx`, `referral.tsx`, `i18n.tsx`, `Landing.tsx`.

## Judgment defaults (change on request)
- Expiring-soon: 60 d license/DEA/board, 30 d malpractice.
- Late-cancel threshold: <24 h before start.
- Note aging: 0–2 d neutral, 3–6 d attention, 7+ d urgent.
- Freezing a clinician does not auto-cancel future appts; they are flagged for coordinator coverage.
- Seed payers: Medi-Cal FFS, Tulare County MHP, Health Net Medi-Cal, Anthem Blue Cross Medi-Cal, CalViva Health.