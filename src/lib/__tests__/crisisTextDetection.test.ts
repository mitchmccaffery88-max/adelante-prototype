import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { detectCrisisLanguage, scanTextForCrisis } from "@/lib/crisisTextDetection";

function newPatient() {
  return AdelanteEHR.createPatient({ firstName: "Crisis", lastName: "Text" } as never).id;
}

describe("crisis language detection", () => {
  it("matches direct crisis language", () => {
    for (const s of [
      "I want to kill myself",
      "i just want to die",
      "feeling suicidal today",
      "I keep hurting myself",
      "thinking about ending my life",
      "life is not worth living",
      "I'd be better off dead",
    ]) {
      expect(detectCrisisLanguage(s).matched, s).toBe(true);
    }
  });

  it("does not match ordinary messages", () => {
    for (const s of [
      "Can I move my appointment to Friday?",
      "The medication makes me sleepy",
      "I died laughing at the group session joke",
      "",
    ]) {
      expect(detectCrisisLanguage(s).matched, s).toBe(false);
    }
  });
});

describe("scanTextForCrisis → real crisis queue entry", () => {
  it("creates an open escalation with message_pattern source", () => {
    const pid = newPatient();
    const row = scanTextForCrisis(pid, "I want to kill myself", { surface: "a care-team message" })!;
    expect(row).toBeTruthy();
    expect(row.status).toBe("open");
    expect(row.triggerSource).toBe("message_pattern");
    const alert = AdelanteEHR.listAlerts(pid).find((a) => a.id === row.alertId);
    expect(alert?.severity).toBe("critical");
    expect(alert?.active).toBe(true);
    expect(AdelanteEHR.listOpenCrisisEscalations().some((r) => r.escalation.id === row.id)).toBe(true);
  });

  it("creates nothing for a non-matching message", () => {
    const pid = newPatient();
    expect(scanTextForCrisis(pid, "Please refill my meds", { surface: "x" })).toBeUndefined();
    expect(AdelanteEHR.listCrisisEscalations(pid)).toHaveLength(0);
  });

  it("does not flood the queue while an earlier match is still open", () => {
    const pid = newPatient();
    scanTextForCrisis(pid, "I want to die", { surface: "a care-team message" });
    scanTextForCrisis(pid, "still suicidal", { surface: "a care-team message" });
    expect(AdelanteEHR.listCrisisEscalations(pid, { status: "open" })).toHaveLength(1);
  });

  it("end-to-end: a sent patient care message produces a queue entry", () => {
    const pid = newPatient();
    const sent = AdelanteEHR.sendPatientMessage(pid, "honestly I want to kill myself")!;
    // Same call the composer makes after send.
    scanTextForCrisis(pid, sent.body, { surface: "a care-team message" });
    const open = AdelanteEHR.listCrisisEscalations(pid, { status: "open" });
    expect(open).toHaveLength(1);
    expect(open[0]!.triggerSource).toBe("message_pattern");
    // The message itself is still delivered verbatim.
    expect(AdelanteEHR.listCareMessages(pid).at(-1)!.body).toBe("honestly I want to kill myself");
  });
});
