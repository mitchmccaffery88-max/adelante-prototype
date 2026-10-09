// K1/K2 carry-overs: freeze removes open slots; staff contact edits via the registry.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { availableSlots } from "@/lib/clinicianAvailability";
import { setBookingsFrozen } from "@/lib/staffProfile";
import { runAction } from "@/lib/actions/runAction";

describe("K1 freeze", () => {
  it("a frozen clinician offers no slots; unfreezing restores them (test-only clinician, §F2)", () => {
    const actor = { role: "clinical_coordinator", staffId: "s-cc1" } as never;
    // TEST-ONLY clinician — never a demo persona.
    const T = "c-test-freeze";
    AdelanteEHRExt.upsertClinicianProfile({ clinicianId: T, specialty: "Test fixture", credentialType: "LCSW", careTypes: ["therapy_individual"], languages: ["English"], active: true } as never);
    for (const weekday of [1, 2, 3, 4, 5]) AdelanteEHRExt.upsertAvailabilityBlock({ clinicianId: T, weekday, start: "09:00", end: "12:00", modality: "hybrid" } as never);
    const before = availableSlots(T).length;
    expect(before).toBeGreaterThan(0);
    setBookingsFrozen(actor, { clinicianId: T, frozen: true, reason: "Leave" });
    expect(availableSlots(T)).toHaveLength(0);
    setBookingsFrozen(actor, { clinicianId: T, frozen: false, reason: "Back" });
    expect(availableSlots(T).length).toBe(before);
  });
});

describe("K2 staff contacts", () => {
  it("editor roles save contacts with separate phone/email; others are refused; bad email rejected", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    const list = [{ id: "ec_a", name: "Ana Ruiz", relationship: "Sister", phone: "5595550111", email: "ana@example.com" }, { id: "ec_b", name: "Beto Ruiz", relationship: "Friend", phone: "5595550112" }];
    expect(runAction("patient_contacts_update", { role: "peer_specialist" }, p, { args: [p.id, list, { name: "Peer", role: "peer_specialist" }] }).ok).toBe(false);
    const ok = runAction("patient_contacts_update", { role: "clinical_coordinator" }, p, { args: [p.id, list, { name: "Coord", role: "clinical_coordinator" }] });
    expect(ok.ok).toBe(true);
    expect(AdelanteEHR.getPatient(p.id)!.emergencyContacts).toHaveLength(2);
    expect(AdelanteEHR.getPatient(p.id)!.emergencyContact!.name).toBe("Ana Ruiz");
    const bad = runAction("patient_contacts_update", { role: "clinical_coordinator" }, p, { args: [p.id, [{ ...list[0]!, email: "nope" }], { name: "Coord", role: "clinical_coordinator" }] });
    expect(bad.ok).toBe(false);
  });
});
