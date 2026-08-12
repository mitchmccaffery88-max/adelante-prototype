import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";
import {
  dispatchStaffAlert,
  listStaffAlerts,
  resetStaffAlerts,
  setStaffAlertTransport,
  type StaffAlertRecord,
} from "@/lib/staffAlerts";

function newPatient() {
  return AdelanteEHR.createPatient({ firstName: "Alert", lastName: "Transport" } as never).id;
}

beforeEach(() => resetStaffAlerts());

describe("out-of-band staff alert transport", () => {
  it("hands every crisis flag to the installed transport, addressed to the crisis role", () => {
    const seen: StaffAlertRecord[] = [];
    setStaffAlertTransport((r) => void seen.push(r));
    const pid = newPatient();
    AdelanteEHR.flagCrisis(pid, "Anita Brooks", "Ideation with plan disclosed");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.kind).toBe("crisis_flagged");
    expect(seen[0]!.recipientRole).toBe("clinical_coordinator");
    expect(seen[0]!.linkRoute).toBe("/crisis-queue");
    // No free text from the trigger leaves the building over SMS.
    expect(seen[0]!.body).not.toContain("Ideation with plan");
  });

  it("fires for an automated message-pattern flag too, not just manual ones", () => {
    setStaffAlertTransport(() => {});
    const pid = newPatient();
    scanTextForCrisis(pid, "I want to kill myself", { surface: "a care-team message" });
    const rows = listStaffAlerts().filter((a) => a.kind === "crisis_flagged");
    expect(rows).toHaveLength(1);
  });

  it("alerts once for the first unread patient message, not for every message", () => {
    const pid = newPatient();
    AdelanteEHR.sendPatientMessage(pid, "Can I move my appointment?");
    AdelanteEHR.sendPatientMessage(pid, "Also, I need a refill");
    const rows = listStaffAlerts().filter((a) => a.kind === "unread_patient_message");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.linkRoute).toBe("/message-queue");
  });

  it("records a real, assertable row even with no transport installed", () => {
    dispatchStaffAlert({
      kind: "crisis_flagged",
      recipientRole: "clinical_coordinator",
      subject: "s",
      body: "b",
    });
    expect(listStaffAlerts()[0]!.delivery).toBe("pending");
  });
});

describe("Spanish crisis language", () => {
  it("escalates through the identical mechanism as English", () => {
    for (const s of [
      "quiero morirme",
      "estoy pensando en quitarme la vida",
      "quiero terminar con mi vida",
      "tengo pensamientos suicidas",
      "he pensado en cortarme",
      "quiero hacerme daño",
      "ya no quiero estar aquí",
      "estarían mejor sin mí",
      "ya no puedo más",
      "no vale la pena vivir",
      "quiero darme un pase definitivo",
    ]) {
      const pid = newPatient();
      const row = scanTextForCrisis(pid, s, { surface: "a care-team message" });
      expect(row?.triggerSource, s).toBe("message_pattern");
      expect(AdelanteEHR.listCrisisEscalations(pid, { status: "open" })).toHaveLength(1);
    }
  });

  it("leaves ordinary Spanish alone", () => {
    const pid = newPatient();
    expect(scanTextForCrisis(pid, "¿Puedo cambiar mi cita para el viernes?", { surface: "x" }))
      .toBeUndefined();
    expect(AdelanteEHR.listCrisisEscalations(pid)).toHaveLength(0);
  });
});

describe("anonymous front-door crisis alert", () => {
  it("routes a pre-patient detection to a real scoped staff alert", () => {
    const before = AdelanteEHR.listAnonymousCrisisAlerts().length;
    const res = scanTextForCrisis(undefined, "honestly I want to die", {
      surface: "the front-door 'what brings you here' note",
    });
    // No chart, so no escalation is returned...
    expect(res).toBeUndefined();
    const open = AdelanteEHR.listAnonymousCrisisAlerts();
    expect(open.length).toBe(before + 1);
    expect(open.at(-1)!.patternIds).toContain("want_to_die");
    // ...but the clinical coordinator is notified in-app and out of band.
    const notes = AdelanteEHR.listNotificationsFor("Priya Raman", "clinical_coordinator");
    expect(notes[0]!.category).toBe("crisis_flagged");
    expect(notes[0]!.patientId).toBeUndefined();
    expect(listStaffAlerts().some((a) => a.kind === "anonymous_crisis")).toBe(true);
  });

  it("acknowledging clears it from the open list", () => {
    const row = AdelanteEHR.raiseAnonymousCrisisAlert({ surface: "the front door", patternIds: ["suicidal"] });
    expect(AdelanteEHR.acknowledgeAnonymousCrisisAlert(row.id, "Priya Raman")).toBe(true);
    expect(AdelanteEHR.listAnonymousCrisisAlerts().some((a) => a.id === row.id)).toBe(false);
    expect(
      AdelanteEHR.listAnonymousCrisisAlerts({ includeAcknowledged: true }).some((a) => a.id === row.id),
    ).toBe(true);
  });
});
