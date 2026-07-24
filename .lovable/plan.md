# Native EHR Adapter Layer

Today all UI code calls `AdelanteEHR` (a concrete in-memory store in `src/lib/ehr.ts`) directly. That means when we swap the in-memory mock for the real native Adelante EHR persistence, every consumer breaks or needs to be touched. This plan introduces a thin adapter interface between callers and the storage implementation, scoped to the three domains you named: **patients, appointments, clinicians**.

Scope is intentionally narrow and additive — no behavior change, no UI change, no data model change. Just a seam.

## What we're building

1. **`src/lib/ehr/adapter.ts`** — the port. Defines a `PatientAdapter`, `AppointmentAdapter`, and `ClinicianAdapter` TypeScript interface (read + write methods currently used by the app: `listPatients`, `getPatient`, `createPatient`, `updateProfile`, `listAppointments`, `bookAppointment`, `rescheduleAppointment`, `cancelAppointment`, `listClinicians`, `getClinicianAvailability`, etc.). Also exports an aggregate `EhrAdapter` type and a `registerEhrAdapter(adapter)` / `getEhrAdapter()` registry so an implementation can be swapped at boot.

2. **`src/lib/ehr/adapters/native-memory.ts`** — the current in-memory adapter. Wraps existing `AdelanteEHR` methods to satisfy the adapter interfaces. This preserves today's behavior 1:1; no persistence changes.

3. **`src/lib/ehr/index.ts`** — public entry. Registers the in-memory adapter by default and re-exports the current `AdelanteEHR` + `useEhr` symbols unchanged so nothing else has to move. Later, replacing the default registration with a real persistence adapter (Supabase, REST, etc.) is a one-line change.

4. **Docs**: short `src/lib/ehr/README.md` explaining "add a new backend = implement `EhrAdapter` and call `registerEhrAdapter()` in `src/start.ts`."

## What we're NOT doing (out of scope for this pass)

- Not touching `ehr-ext.ts` (credentials, claims, coverage) — those get their own adapter layer later if desired.
- Not migrating any existing call sites off `AdelanteEHR.*` — the seam sits behind it, and follow-up work can gradually route callers through `getEhrAdapter()`.
- Not enabling Lovable Cloud or wiring a real DB. This is purely the abstraction so we can drop one in.
- No changes to reactivity (`useEhr` / `ehrBus`) semantics.

## Technical details

```text
src/lib/ehr/
├── adapter.ts              # PatientAdapter, AppointmentAdapter, ClinicianAdapter, EhrAdapter, registry
├── adapters/
│   └── native-memory.ts    # wraps existing AdelanteEHR
├── index.ts                # registers default adapter + re-exports
└── README.md
```

- `adapter.ts` derives method signatures from the actual `AdelanteEHR` API surface for the three domains, so the interface reflects real usage (not aspirational).
- Registry is a simple module-scoped `let currentAdapter: EhrAdapter | null`. `registerEhrAdapter` sets it, `getEhrAdapter` throws if unset.
- `src/lib/ehr.ts` stays where it is; no risky edits. A follow-up plan can move its internals behind the adapter without a UI freeze.

## Verification

- Typecheck passes.
- App loads and existing flows (referral → intake → schedule → clinician) behave identically because no call sites moved.
