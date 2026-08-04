import { describe, expect, it } from "vitest";
import { AdelanteEHR, type AuditEvent } from "../ehr";
import { maskIdentifier, redactAuditEvent } from "../auditRedaction";

const patientId = AdelanteEHR.listPatients()[0]!.id;

function evt(over: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "a1",
    at: new Date().toISOString(),
    category: "care_plan",
    action: "goal_status_changed",
    patientId,
    detail: { goalId: "g1", goalText: "Attend SUD group weekly", from: "open", to: "done" },
    ...over,
  };
}

describe("audit redaction", () => {
  it("shows PHI detail to a role with read access to the record class", () => {
    const r = redactAuditEvent(evt(), "pmhnp");
    expect(r.detail.goalText).toBe("Attend SUD group weekly");
    expect(r.redacted).toBe(false);
    expect(r.subjectLabel).toBe(patientId);
  });

  it("withholds free-text PHI but keeps structural fields for a role without access", () => {
    const r = redactAuditEvent(evt({ category: "rx", action: "order_signed" }), "peer_specialist");
    expect(r.detail.goalText).toBeUndefined();
    expect(r.detail.goalId).toBe("g1");
    expect(r.detail.from).toBe("open");
    expect(r.redacted).toBe(true);
    expect(r.redactionReason).toBeTruthy();
  });

  it("masks the subject identifier when the role cannot read demographics", () => {
    const r = redactAuditEvent(evt(), "sys_admin");
    expect(r.subjectMasked).toBe(true);
    expect(r.subjectLabel).toBe(maskIdentifier(patientId));
    expect(r.subjectLabel).not.toContain(patientId);
  });

  it("redacts consent-gated categories until consent is on file", () => {
    const before = redactAuditEvent(
      evt({ category: "clinical", detail: { note: "SUD counseling" } }),
      "billing",
    );
    expect(before.detail.note).toBeUndefined();
    expect(before.redacted).toBe(true);
  });
});
