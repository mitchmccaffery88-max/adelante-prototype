// §Reminders — coverage for every contact type, including group occurrences,
// and the SMS-off patient preference.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, SERVICE_TYPES } from "../ehr";
import { sendDueReminders, upcomingContacts } from "../reminders";

function makeGroupWith(patientId: string, hoursAhead = 5) {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  const start = new Date(Date.now() + hoursAhead * 3600000);
  const g = AdelanteEHR.createGroupSession({
    topic: "Relapse prevention (placeholder topic)",
    facilitatorId: clinician.id,
    serviceType: "therapy_group",
    modality: "in_person",
    start: start.toISOString(),
    durationMin: 60,
    capacity: 8,
    recurrence: { kind: "none" },
    createdBy: "test",
  });
  AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId, enrolledBy: "test" });
  return g;
}

describe("reminder coverage", () => {
  it("sees group occurrences, which the 1:1 appointment model cannot", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    const g = makeGroupWith(p.id);
    const rows = upcomingContacts();
    const groupRow = rows.find((r) => r.source === "group" && r.refId.includes(g.id));
    expect(groupRow).toBeTruthy();
    expect(groupRow!.patientId).toBe(p.id);
    expect(groupRow!.serviceType).toBe("therapy_group");
  });

  it("covers every service type in the model — no new taxonomy invented", () => {
    const ids = SERVICE_TYPES.map((s) => s.id).sort();
    expect(ids).toEqual(
      [
        "intake",
        "therapy_individual",
        "therapy_group",
        "med_management",
        "peer_support",
        "case_management",
        "care_coordination",
      ].sort(),
    );
  });

  it("is idempotent — a contact is only reminded once", () => {
    const p = AdelanteEHR.listPatients()[2]!;
    makeGroupWith(p.id, 6);
    const first = sendDueReminders();
    expect(first.sent.length).toBeGreaterThan(0);
    const second = sendDueReminders();
    expect(second.sent).toHaveLength(0);
    expect(second.skippedDuplicate.length).toBeGreaterThan(0);
  });
});

describe("SMS opt-out is respected", () => {
  it("never queues an SMS reminder for a patient with SMS off", () => {
    const p = AdelanteEHR.listPatients()[3]!;
    AdelanteEHR.setConsent(p.id, "sms", false, "test");
    expect(AdelanteEHR.isSmsOn(p.id)).toBe(false);
    const g = makeGroupWith(p.id, 4);
    const run = sendDueReminders();
    expect(run.smsSuppressed.some((c) => c.patientId === p.id)).toBe(true);
    const notifications = (AdelanteEHR.getPatient(p.id)?.notifications ?? []).filter(
      (n) => n.kind === "reminder" && n.apptId.includes(g.id),
    );
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.some((n) => n.channel === "sms")).toBe(false);
    expect(notifications.some((n) => n.channel === "profile")).toBe(true);
  });

  it("does queue an SMS reminder when the patient has SMS on and a phone", () => {
    const p = AdelanteEHR.listPatients().find((x) => x.phone)!;
    AdelanteEHR.setConsent(p.id, "sms", true, "test");
    const g = makeGroupWith(p.id, 7);
    sendDueReminders();
    const notifications = (AdelanteEHR.getPatient(p.id)?.notifications ?? []).filter(
      (n) => n.kind === "reminder" && n.apptId.includes(g.id),
    );
    expect(notifications.some((n) => n.channel === "sms")).toBe(true);
  });
});
