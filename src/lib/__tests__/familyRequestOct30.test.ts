import { describe, it, expect } from "vitest";
import { AdelanteEHR, APPT_REQUEST_BOOK_AS, APPT_REQUEST_STAFF_LABEL, APPT_REQUEST_SERVICE_TYPES } from "@/lib/ehr";

describe("family request kind (Oct 30 Draft)", () => {
  it("labels and books as family/collateral, not therapy", () => {
    expect(APPT_REQUEST_STAFF_LABEL.family).toBe("Family or collateral session");
    expect(APPT_REQUEST_BOOK_AS.family).toBe("family_collateral");
    expect(APPT_REQUEST_SERVICE_TYPES.therapy).not.toContain("family_collateral");
    expect(AdelanteEHR.getServiceType?.("family_collateral")?.patientRequestKind ?? "family").toBe("family");
  });
  it("creates once, dedupes a second ask", () => {
    const p = AdelanteEHR.listPatients()[0];
    const actor = { id: p.id, role: "patient" };
    const first = AdelanteEHR.createAppointmentRequests(p.id, { family: true }, actor)[0];
    expect(first.kind).toBe("family");
    expect(first.outcome).toBe("requested");
    const again = AdelanteEHR.createAppointmentRequests(p.id, { family: true }, actor)[0];
    expect(again.outcome).toBe("already_requested");
  });
});
