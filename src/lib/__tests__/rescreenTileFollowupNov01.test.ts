// Mitch, 1 Nov 11:50 CT. Draft — pending clinical sign-off.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type Patient } from "../ehr";
import { rescreenInstrumentView } from "../rescreenDashboard";
import { runAction } from "../actions/runAction";
import { STAFF_ROSTER } from "../roles";

const DAY = 86400000;
const now = Date.parse("2026-11-01T19:00:00Z");
const due = { screenerKey: "phq-9", daysSinceLast: 33, cadenceStep: 30 };
function patient(tasks: Patient["tasks"] = []): Patient {
  const base = AdelanteEHR.listPatients()[0];
  if (!base) throw new Error("Missing demo patient prerequisite");
  return { ...base, screeners: {}, screenerHistory: [], incompleteScreeners: [], tasks };
}
const request = (days: number, automaticRescreen = false) => ({ id: `r-${days}-${automaticRescreen}`, kind: "rescreen" as const, label: "Screening follow-up needed", screenerKey: "phq-9", createdAt: new Date(now - days * DAY).toISOString(), automaticRescreen });

describe("R53 tile follow-up rules", () => {
  it("allows Send now after an automatic prompt", () => {
    const v = rescreenInstrumentView(patient([request(1, true)]), due, now);
    expect(v.sendEnabled).toBe(true);
    expect(v.sendLabel).toBe("Send now");
  });
  it("blocks resend until 7 full days after a staff send", () => {
    const p = patient([request(0)]);
    expect(rescreenInstrumentView(p, due, now + 7 * DAY - 1).sendEnabled).toBe(false);
    const enabled = rescreenInstrumentView(p, due, now + 7 * DAY);
    expect(enabled.sendEnabled).toBe(true);
    expect(enabled.sendLabel).toBe("Send again");
  });
  it("a newer automatic prompt cannot hide or reset a staff cooldown", () => {
    const v = rescreenInstrumentView(patient([request(0, true), request(6)]), due, now);
    expect(v.sendEnabled).toBe(false);
    expect(v.chipText).toBe("Requested by staff 6 days ago");
  });
  it("projects actual request provenance and age", () => {
    expect(rescreenInstrumentView(patient([request(1, true)]), due, now).chipText).toBe("Requested automatically 1 day ago");
    expect(rescreenInstrumentView(patient([request(2)]), due, now).chipText).toBe("Requested by staff 2 days ago");
    expect(rescreenInstrumentView(patient([request(0)]), due, now).chipText).toBe("Requested by staff 0 days ago");
  });
  it("projects Due N days ago and retains Due for today", () => {
    expect(rescreenInstrumentView(patient(), due, now).chipText).toBe("Due 3 days ago");
    expect(rescreenInstrumentView(patient(), { ...due, daysSinceLast: 31 }, now).chipText).toBe("Due 1 day ago");
    expect(rescreenInstrumentView(patient(), { ...due, daysSinceLast: 30 }, now).chipText).toBe("Due");
  });
  it("existing registry staff send replaces automatic-only provenance and is immediate for the member", () => {
    const p = AdelanteEHR.listPatients().find(p => p.intakeCompletedAt);
    const actor = STAFF_ROSTER.find(s => s.role === "therapist");
    if (!p || !actor) throw new Error("Missing real-store prerequisites");
    const result = runAction("rescreen_send", { role: actor.role, staffId: actor.id }, p, { via: "sendRescreenTask", args: [p.id, "phq-9"] });
    expect(result.ok).toBe(true);
    const updated = AdelanteEHR.getPatient(p.id);
    if (!updated) throw new Error("Patient disappeared after send");
    expect(AdelanteEHR.patientReassessmentDue(p.id).map(r => r.key)).toContain("phq-9");
    expect(rescreenInstrumentView(updated, due, Date.now()).sendEnabled).toBe(false);
  });
});