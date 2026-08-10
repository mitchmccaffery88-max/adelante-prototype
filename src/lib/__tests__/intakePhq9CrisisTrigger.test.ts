import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

function newPatient() {
  return AdelanteEHR.createPatient({ firstName: "Phq", lastName: "Nine" }).id;
}

describe("intake PHQ-9 item 9 crisis trigger", () => {
  it("produces a real open crisis queue entry with screener_score source", () => {
    const pid = newPatient();
    AdelanteEHR.raiseCrisisFlag(pid, "phq-9-item-9");
    const row = AdelanteEHR.flagCrisis(
      pid,
      "Intake screener (automated)",
      "Automated flag: PHQ-9 item 9 indicated risk of self-harm",
      { triggerSource: "screener_score" },
    );
    expect(row.status).toBe("open");
    expect(row.triggerSource).toBe("screener_score");
    const queued = AdelanteEHR.listOpenCrisisEscalations().find((q) => q.patient.id === pid);
    expect(queued).toBeTruthy();
    const p = AdelanteEHR.getPatient(pid)!;
    expect(p.crisisFlag?.source).toBe("phq-9-item-9");
    expect(p.alerts?.some((a) => a.severity === "critical")).toBe(true);
  });
});
