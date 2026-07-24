## Goal

Lock in the `EhrAdapter` contract so any future backend (Supabase, REST, etc.) provably behaves the same as today's in-memory adapter for the three domains (patient, appointment, clinician).

## Approach

Write **implementation-agnostic contract tests** — a single suite that runs against any object satisfying `EhrAdapter`. Today it runs against `nativeMemoryEhrAdapter`. When a new backend adapter lands, it re-runs the same suite with zero rewrites.

Add Vitest (project has no test runner yet) plus fixtures that shape the domain data the tests need. Keep scope to the adapter methods already in the port; do not expand the port.

## What we're adding

1. **Test runner** — `bun add -D vitest @vitest/ui jsdom`; add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json`. Minimal `vitest.config.ts` with the `@` alias mirroring `vite.config.ts`.

2. **Fixtures** — `src/lib/ehr/__tests__/fixtures.ts`
   - `makePatientDraft(overrides?)` — minimal valid patient payload for `createPatient`.
   - `makeAppointmentDraft(overrides?)` — minimal valid booking payload for `bookAppointment` (patientId, clinicianId, serviceType, start, duration, modality).
   - `pickSeededClinician(adapter)` — returns the first clinician from `listClinicians()` so tests don't hardcode seeded IDs.
   - Deterministic date helpers (fixed base date + offsets) so time-of-day/DOW-sensitive availability rules are reproducible.

3. **Contract suite** — `src/lib/ehr/__tests__/adapter.contract.ts`
   Exports `runEhrAdapterContract(name, factory)` where `factory` returns a fresh adapter per test. For the in-memory adapter, the factory re-imports the module with `vi.resetModules()` so each test starts from clean seeded state. Suite groups:
   - **Patient mapping**
     - `createPatient` returns record with generated id; `getPatient(id)` returns the same shape (round-trip).
     - `listPatients()` includes the created patient.
     - `updateProfile(id, patch)` merges (does not replace) and preserves untouched fields including `cin`, `dob`, contact prefs.
     - Unknown id: `getPatient` returns `undefined`; `updateProfile` throws or is a no-op — assert whichever the current adapter does and pin it.
   - **Appointment mapping**
     - `bookAppointment` returns an appointment with `status: 'scheduled'` (or current default) and the exact `clinicianId`, `serviceType`, `modality`, `start`, `duration` supplied.
     - `listAppointments({ patientId })` and `{ clinicianId }` both include it.
     - `rescheduleAppointment` preserves id, applies new `start`/`clinicianId`/`serviceType`/`modality`, keeps unrelated fields.
     - Conflict: booking a second overlapping appointment for the same clinician throws; the error is surfaced (not swallowed).
     - `updateAppointmentStatus` transitions to `cancelled` / `completed` / `no_show` and the record reflects it on next read.
   - **Clinician mapping**
     - `listClinicians()` returns ≥1 seeded clinician with required fields (`id`, `name`, `serviceTypes`, `locationIds` or equivalent).
     - `cliniciansForService(serviceType)` only returns clinicians whose `serviceTypes` includes it (subset check, not equality).
     - `getClinicianAvailability(clinicianId, dateRange)` returns slots inside the range, each with `start`/`end`/`modality`, and excludes slots that collide with an appointment booked in the same test.

4. **Wire the in-memory run** — `src/lib/ehr/__tests__/native-memory.contract.test.ts`
   ```ts
   import { runEhrAdapterContract } from './adapter.contract';
   runEhrAdapterContract('native-memory', async () => {
     vi.resetModules();
     const mod = await import('@/lib/ehr/adapters/native-memory');
     return mod.nativeMemoryEhrAdapter;
   });
   ```

## Out of scope

- No new adapter methods, no changes to `AdelanteEHR`, no UI edits.
- No coverage of `ehr-ext` (credentials/claims/coverage) — separate port, separate suite later.
- No integration tests against a real backend (there isn't one yet).

## Verification

- `bun run test` passes locally; suite name reads `ehr adapter contract › native-memory › …`.
- Deliberately breaking a mapping (e.g. dropping `modality` in `bookAppointment`) fails the suite — proves the contract has teeth.
- Typecheck still passes; no runtime imports added to app bundle (tests live under `__tests__/`).
