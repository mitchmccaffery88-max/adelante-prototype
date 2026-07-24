// Implementation-agnostic contract suite for `EhrAdapter`.
//
// Any adapter — the in-memory default today, a Supabase/REST backend
// tomorrow — must pass this suite unchanged. The suite exercises the
// three domains the port owns (patients, appointments, clinicians) and
// pins the observable behavior UI code depends on.
//
// The `factory` returns a fresh adapter per test so state from one case
// doesn't leak into the next. For the in-memory adapter that means
// re-importing the module under `vi.resetModules()` (see the
// native-memory contract test).

import { describe, expect, it, beforeEach } from "vitest";
import type { EhrAdapter } from "../adapter";
import {
  makeAppointmentDraft,
  makePatientDraft,
  pickClinicianForService,
  pickOpenSlot,
} from "./fixtures";

export function runEhrAdapterContract(
  name: string,
  factory: () => Promise<EhrAdapter> | EhrAdapter,
): void {
  describe(`ehr adapter contract › ${name}`, () => {
    let adapter: EhrAdapter;

    beforeEach(async () => {
      adapter = await factory();
    });

    // ── Patient ────────────────────────────────────────────────────
    describe("patient", () => {
      it("createPatient → getPatient round-trips the record", () => {
        const draft = makePatientDraft({ firstName: "Ada", lastName: "Lovelace" });
        const created = adapter.createPatient(draft);

        expect(created.id).toBeTruthy();
        expect(created.firstName).toBe("Ada");
        expect(created.lastName).toBe("Lovelace");
        expect(created.cin).toBe(draft.cin);
        expect(created.dob).toBe(draft.dob);

        const fetched = adapter.getPatient(created.id);
        expect(fetched).toBeDefined();
        expect(fetched!.id).toBe(created.id);
        expect(fetched!.firstName).toBe("Ada");
      });

      it("listPatients includes newly created patient", () => {
        const created = adapter.createPatient(makePatientDraft({ firstName: "Grace" }));
        const ids = adapter.listPatients().map((p) => p.id);
        expect(ids).toContain(created.id);
      });

      it("updateProfile merges patch and preserves untouched fields", () => {
        const created = adapter.createPatient(
          makePatientDraft({ firstName: "Rosa", cin: "12345678B", dob: "1985-03-04" }),
        );
        adapter.updateProfile(created.id, { preferredName: "Ro", email: "ro@example.com" });

        const after = adapter.getPatient(created.id)!;
        expect(after.preferredName).toBe("Ro");
        expect(after.email).toBe("ro@example.com");
        // Untouched fields survive the merge.
        expect(after.firstName).toBe("Rosa");
        expect(after.cin).toBe("12345678B");
        expect(after.dob).toBe("1985-03-04");
      });

      it("getPatient returns undefined for an unknown id; updateProfile is a no-op", () => {
        expect(adapter.getPatient("does-not-exist")).toBeUndefined();
        expect(() => adapter.updateProfile("does-not-exist", { email: "x@y" })).not.toThrow();
      });
    });

    // ── Clinician ──────────────────────────────────────────────────
    describe("clinician", () => {
      it("listClinicians returns records with required fields", () => {
        const list = adapter.listClinicians();
        expect(list.length).toBeGreaterThan(0);
        for (const c of list) {
          expect(c.id).toBeTruthy();
          expect(c.name).toBeTruthy();
        }
      });

      it("cliniciansForService returns only clinicians offering that service", () => {
        const filtered = adapter.cliniciansForService("med_management");
        expect(filtered.length).toBeGreaterThan(0);
        for (const c of filtered) {
          // A clinician with no `services` array is unrestricted; skip those.
          if (c.services) expect(c.services).toContain("med_management");
        }
      });

      it("getClinicianAvailability returns slots with the expected shape", () => {
        const [c] = adapter.listClinicians();
        const slots = adapter.getClinicianAvailability(c.id, 14);
        expect(slots.length).toBeGreaterThan(0);
        for (const s of slots) {
          expect(typeof s.start).toBe("string");
          expect(Number.isFinite(new Date(s.start).getTime())).toBe(true);
          expect(typeof s.durationMin).toBe("number");
          expect(s.durationMin).toBeGreaterThan(0);
        }
      });

      it("getClinicianAvailability marks a slot taken after a booking at that start", () => {
        const clinician = pickClinicianForService(adapter, "therapy_individual");
        const patient = adapter.createPatient(makePatientDraft());
        const slot = pickOpenSlot(adapter, clinician.id);

        adapter.bookAppointment({
          patientId: patient.id,
          clinicianId: clinician.id,
          start: slot.start,
          durationMin: slot.durationMin,
          serviceType: "therapy_individual",
          modality: "video",
        });

        const after = adapter.getClinicianAvailability(clinician.id, 14);
        const match = after.find((s) => s.start === slot.start);
        expect(match?.taken).toBe(true);
      });
    });

    // ── Appointment ────────────────────────────────────────────────
    describe("appointment", () => {
      it("bookAppointment preserves the input fields on the returned record", () => {
        const clinician = pickClinicianForService(adapter, "therapy_individual");
        const patient = adapter.createPatient(makePatientDraft());
        const draft = makeAppointmentDraft(adapter, patient.id, clinician.id);

        const appt = adapter.bookAppointment(draft);
        expect(appt.id).toBeTruthy();
        expect(appt.status).toBe("scheduled");
        expect(appt.patientId).toBe(patient.id);
        expect(appt.clinicianId).toBe(clinician.id);
        expect(appt.start).toBe(draft.start);
        expect(appt.durationMin).toBe(draft.durationMin);
        expect(appt.serviceType).toBe(draft.serviceType);
        expect(appt.modality).toBe(draft.modality);
      });

      it("listAppointments contains the booked appointment", () => {
        const clinician = pickClinicianForService(adapter, "therapy_individual");
        const patient = adapter.createPatient(makePatientDraft());
        const appt = adapter.bookAppointment(
          makeAppointmentDraft(adapter, patient.id, clinician.id),
        );
        const ids = adapter.listAppointments().map((a) => a.id);
        expect(ids).toContain(appt.id);
      });

      it("bookAppointment rejects a conflicting slot on the same clinician", () => {
        const clinician = pickClinicianForService(adapter, "therapy_individual");
        const p1 = adapter.createPatient(makePatientDraft({ firstName: "A" }));
        const p2 = adapter.createPatient(makePatientDraft({ firstName: "B" }));
        const draft = makeAppointmentDraft(adapter, p1.id, clinician.id);

        adapter.bookAppointment(draft);
        expect(() =>
          adapter.bookAppointment({ ...draft, patientId: p2.id }),
        ).toThrow();
      });

      it("rescheduleAppointment preserves id, applies new start / clinician / service", () => {
        const first = pickClinicianForService(adapter, "therapy_individual");
        const alt = adapter
          .cliniciansForService("therapy_individual")
          .find((c) => c.id !== first.id);
        expect(alt, "need a second clinician for reschedule").toBeDefined();

        const patient = adapter.createPatient(makePatientDraft());
        const appt = adapter.bookAppointment(
          makeAppointmentDraft(adapter, patient.id, first.id),
        );

        const newSlot = pickOpenSlot(adapter, alt!.id);
        adapter.rescheduleAppointment(appt.id, newSlot.start, {
          clinicianId: alt!.id,
          serviceType: "intake",
          modality: "phone",
        });

        const after = adapter.listAppointments().find((a) => a.id === appt.id)!;
        expect(after.id).toBe(appt.id);
        expect(after.start).toBe(newSlot.start);
        expect(after.clinicianId).toBe(alt!.id);
        expect(after.serviceType).toBe("intake");
        expect(after.modality).toBe("phone");
        expect(after.patientId).toBe(patient.id); // unrelated field preserved
      });

      it("updateAppointmentStatus transitions to cancelled / attended / no_show", () => {
        const clinician = pickClinicianForService(adapter, "therapy_individual");
        const patient = adapter.createPatient(makePatientDraft());

        const a1 = adapter.bookAppointment(
          makeAppointmentDraft(adapter, patient.id, clinician.id),
        );
        adapter.updateAppointmentStatus(a1.id, "cancelled");
        expect(adapter.listAppointments().find((a) => a.id === a1.id)!.status).toBe("cancelled");

        // Cancelling frees the slot so we can book again for the follow-on assertions.
        const a2 = adapter.bookAppointment(
          makeAppointmentDraft(adapter, patient.id, clinician.id),
        );
        adapter.updateAppointmentStatus(a2.id, "attended");
        expect(adapter.listAppointments().find((a) => a.id === a2.id)!.status).toBe("attended");

        const a3 = adapter.bookAppointment(
          makeAppointmentDraft(adapter, patient.id, clinician.id),
        );
        adapter.updateAppointmentStatus(a3.id, "no_show");
        expect(adapter.listAppointments().find((a) => a.id === a3.id)!.status).toBe("no_show");
      });
    });
  });
}