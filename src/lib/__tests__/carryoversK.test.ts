// K1/K2 carry-overs: freeze removes open slots; staff contact edits via the registry.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { availableSlots } from "@/lib/clinicianAvailability";
import { setBookingsFrozen } from "@/lib/staffProfile";
import { runAction } from "@/lib/actions/runAction";

describe("K1 freeze", () => {
  it("a frozen clinician offers no slots; unfreezing restores them", () => {
    const actor = { role: "clinical_coordinator", staffId: "s-cc1" } as never;
    const before = availableSlots("c1").length;
    expect(before).toBeGreaterThan(0);
    setBookingsFrozen(actor, { clinicianId: "c1", frozen: true, reason: "Leave" });
    expect(availableSlots("c1")).toHaveLength(0);
    setBookingsFrozen(actor, { clinicianId: "c1", frozen: false, reason: "Back" });
    expect(availableSlots("c1").length).toBe(before);
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
