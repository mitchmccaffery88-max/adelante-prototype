# Scheduling — service type, modality, location, staff-only duration

Extend the existing schedule flow so a patient (or staff booking on their behalf) chooses **service type**, **virtual vs in-person**, **date/time**, and — for in-person — a **location**. Session **duration** becomes staff-only.

## Data model (`src/lib/ehr.ts`)

Extend `Appointment` (additive, all optional so seed data still compiles):

```ts
serviceType?: ServiceType;      // see below
modality?: "video" | "phone" | "in_person";
locationId?: string;            // required when modality === "in_person"
```

Add supporting types + seed data:

- `ServiceType`: `"intake" | "therapy_individual" | "therapy_group" | "med_management" | "peer_support" | "case_management" | "care_coordination"`. Each entry carries a label, allowed modalities, and a **default duration** used when staff don't override.
- `Location`: `{ id, name, address, city, room?, inPersonServices: ServiceType[] }`. Seed 2 Tulare County sites (e.g., Visalia hub, Porterville satellite).
- `listServiceTypes()`, `listLocations()`, `getServiceType(id)` helpers on `AdelanteEHR`.
- `getClinicianAvailability(clinicianId, days, opts?)` gains an optional `{ serviceType?, locationId? }` filter so slots for in-person services only surface at locations the clinician staffs. Also filter by clinician's supported services (add `services: ServiceType[]` to `Clinician`, seed sensible values).
- `bookAppointment` + `rescheduleAppointment` accept the new fields; validate that `in_person` bookings include `locationId` and that the service supports the chosen modality.

## Scheduling UI (`src/routes/schedule.tsx`)

Reorder to a guided flow:

1. **Service type** — card grid, plain-language labels ("Talk with a counselor", "Meet your care manager", etc.).
2. **Virtual or in person** — two large buttons; only show modalities the selected service supports. If only one is allowed, auto-select and hide.
3. **Location** — only when in-person; dropdown of locations that offer that service, showing address + city.
4. **Counselor** — existing dropdown, filtered to clinicians supporting the service (and the location, when in-person).
5. **Day + time** — existing pickers, now driven by the filtered availability call.
6. **Duration** — **hidden for patients**. Show a read-only line: "Session length: {defaultDuration} min — your care team can adjust this." Render the existing Select **only** when `getActingRole()` returns a clinical/coordination role (`therapist`, `pmhnp`, `case_manager`, `peer_specialist`); import `getActingRole` from `@/lib/roles`. Billing/sys_admin/patient never see it.

Submit passes `serviceType`, `modality`, `locationId` into `bookAppointment` / `rescheduleAppointment`. Confirmation toast includes the location line when in-person.

## Surfacing on other screens

Keep this change tightly scoped, but update the read-only spots that already render appointments so the new info shows through:

- `src/components/PatientHome.tsx` upcoming-appointment card: append "In person — {location.name}" or "Video visit" under the time.
- `src/routes/clinician.tsx` appointment list rows: small badge for modality + location name.
- `src/routes/case-manager.tsx` right-sidebar upcoming list: same badge treatment.

No changes to admin/billing/consent this pass.

## Copy & accessibility

- 6th-grade reading level, no jargon ("Meet in person" / "Meet by video").
- Service type cards get a short one-line helper ("A private talk with a counselor.").
- Location cards show address + city, and a "Get directions" link (`https://maps.google.com/?q=…`) opens in new tab.

## Out of scope (call out if user wants next)

- Group-session capacity / roster.
- Rooms/resource booking beyond a free-text room name.
- Real Healthie location sync — still mocked via `AdelanteEHR`.
- Cancellation policy / travel-time buffers.
