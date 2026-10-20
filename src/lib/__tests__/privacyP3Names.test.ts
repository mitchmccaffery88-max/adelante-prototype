// Privacy P3 — incoming data-exchange events follow the staffPatientLabel rule.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { listIncomingEvents, seedDataExchangeDemo } from "@/lib/dataExchange";
import { staffPatientLabel, viewerCanOpenChart } from "@/lib/staffPatientLabel";
import { STAFF_ROSTER } from "@/lib/roles";

describe("Privacy P3 — name label on incoming events", () => {
  it("program ID for viewers without chart access, full name only with it", () => {
    seedDataExchangeDemo();
    for (const role of ["sys_admin", "clinical_coordinator"] as const) {
      const staffId = STAFF_ROSTER.find((s) => s.role === role)?.id;
      const events = listIncomingEvents(role);
      if (role === "clinical_coordinator") expect(events.length).toBeGreaterThan(0);
      for (const { encounter } of events) {
        const p = AdelanteEHR.getPatient(encounter.patientId)!;
        const label = staffPatientLabel({ role, staffId }, p.id);
        expect(label).toBe(viewerCanOpenChart({ role, staffId }, p.id) ? `${p.firstName} ${p.lastName}` : p.programId);
      }
    }
  });
  it("the events list renders only the label and links only with chart access", () => {
    const src = readFileSync("src/routes/data-exchange.tsx", "utf8");
    const events = src.slice(src.indexOf("function Events()"), src.indexOf("function", src.indexOf("function Events()") + 20));
    expect(events).not.toMatch(/firstName|lastName|nameOf/);
    expect(events).toContain("viewerCanOpenChart(actor, e.patientId)");
    expect(events).toContain("staffPatientLabel(actor, e.patientId)");
  });
});
