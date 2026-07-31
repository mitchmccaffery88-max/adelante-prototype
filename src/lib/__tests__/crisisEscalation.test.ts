import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { canAccess } from "@/lib/roles";
import { computeScore, crisisTriggeringScores, type TemplateSchema } from "@/lib/templateSchema";

const SCHEMA: TemplateSchema = {
  sections: [
    {
      id: "s",
      title: "PHQ",
      fields: [
        {
          key: "q1",
          type: "radio",
          label: "Q1",
          options: [
            { value: "0", label: "None", score: 0 },
            { value: "22", label: "Severe", score: 22 },
          ],
        },
      ],
    },
  ],
  scoring: [
    {
      id: "phq9",
      label: "PHQ-9",
      sum_of: ["q1"],
      bands: [
        { min: 0, max: 19, label: "Moderate" },
        { min: 20, max: 27, label: "Severe", triggersCrisis: true },
      ],
    },
  ],
};

function newPatient() {
  const p = AdelanteEHR.createPatient({
    firstName: "Crisis",
    lastName: "Test",
    programId: "TEST",
  } as never);
  return p.id;
}

describe("crisis escalation model", () => {
  let pid = "";
  beforeEach(() => {
    pid = newPatient();
  });

  it("flagging creates BOTH a critical alert and an open escalation", () => {
    const row = AdelanteEHR.flagCrisis(pid, "Nurse Ada", "Disclosed active plan");
    const alerts = AdelanteEHR.listAlerts(pid);
    const alert = alerts.find((a) => a.id === row.alertId);
    expect(alert?.severity).toBe("critical");
    expect(alert?.active).toBe(true);
    expect(alert?.label).toBe(AdelanteEHR.CRISIS_ALERT_LABEL);
    expect(row.status).toBe("open");
    expect(row.triggerSource).toBe("manual");
    expect(AdelanteEHR.listOpenCrisisEscalations().some((r) => r.escalation.id === row.id)).toBe(
      true,
    );
  });

  it("rejects a too-short reason", () => {
    expect(() => AdelanteEHR.flagCrisis(pid, "Nurse Ada", "x")).toThrow(/reason/i);
  });

  it("resolving requires a disposition and closes the alert", () => {
    const row = AdelanteEHR.flagCrisis(pid, "Nurse Ada", "Disclosed active plan");
    expect(() =>
      AdelanteEHR.resolveCrisisEscalation(pid, row.id, "Dr. B", { disposition: "  " }),
    ).toThrow(/disposition/i);
    const resolved = AdelanteEHR.resolveCrisisEscalation(pid, row.id, "Dr. B", {
      contactedWhom: "County crisis line",
      disposition: "Safety plan in place; follow-up in 24h",
    });
    expect(resolved.status).toBe("resolved");
    const alert = AdelanteEHR.getPatient(pid)?.alerts?.find((a) => a.id === row.alertId);
    expect(alert?.active).toBe(false);
    expect(alert?.removedReason).toMatch(/Safety plan/);
    expect(AdelanteEHR.listOpenCrisisEscalations().some((r) => r.escalation.id === row.id)).toBe(
      false,
    );
  });

  it("the open queue is sorted oldest-open first", () => {
    const a = AdelanteEHR.flagCrisis(pid, "Nurse Ada", "first event");
    const b = AdelanteEHR.flagCrisis(newPatient(), "Nurse Ada", "second event");
    // Force a deterministic ordering independent of same-millisecond stamps.
    AdelanteEHR.listCrisisEscalations(pid).forEach((r) => {
      if (r.id === a.id) r.triggeredAt = new Date(Date.now() - 60_000).toISOString();
    });
    const ids = AdelanteEHR.listOpenCrisisEscalations().map((r) => r.escalation.id);
    expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));
  });
});

describe("crisis queue RBAC", () => {
  it("excludes billing, billing_coordinator, and peer_specialist", () => {
    for (const role of ["billing", "billing_coordinator", "peer_specialist"] as const) {
      expect(canAccess(role, "crisis_queue").locked).toBe(true);
    }
  });
  it("gives coordinators write and treating clinicians read", () => {
    expect(canAccess("clinical_coordinator", "crisis_queue").level).toBe("write");
    expect(canAccess("sys_admin", "crisis_queue").level).toBe("write");
    for (const role of ["pmhnp", "therapist", "case_manager"] as const) {
      expect(canAccess(role, "crisis_queue").level).toBe("read");
    }
  });
});

describe("screener-band crisis gate at signing", () => {
  it("computeScore surfaces the triggering band", () => {
    expect(crisisTriggeringScores(SCHEMA, { q1: "0" })).toHaveLength(0);
    const hit = crisisTriggeringScores(SCHEMA, { q1: "22" });
    expect(hit).toHaveLength(1);
    expect(hit[0]!.band).toBe("Severe");
    // Incomplete scores never trigger.
    expect(computeScore(SCHEMA, {})[0]!.triggersCrisis).toBeUndefined();
  });

  it("a note cannot reach signed status without an explicit crisis decision", () => {
    const pid = newPatient();
    const note = AdelanteEHR.addProgressNote(pid, {
      clinicianId: "c-1",
      sessionType: "therapy",
      content: "",
      templateSchema: SCHEMA,
      templateAnswers: { q1: "22" },
    } as never)!;
    expect(() =>
      AdelanteEHR.signProgressNote(pid, note!.id, {
        signedBy: "Dr. B",
        role: "pmhnp",
        attested: true,
      }),
    ).toThrow(/crisis band/i);
    // Still a draft — the blocked attempt mutated nothing.
    expect(AdelanteEHR.getPatient(pid)?.progressNotes?.find((n) => n.id === note!.id)?.signedAt)
      .toBeUndefined();

    expect(() =>
      AdelanteEHR.signProgressNote(pid, note!.id, {
        signedBy: "Dr. B",
        role: "pmhnp",
        attested: true,
        crisisDecision: { kind: "not_escalating", reason: "x" },
      }),
    ).toThrow(/reason/i);

    AdelanteEHR.signProgressNote(pid, note!.id, {
      signedBy: "Dr. B",
      role: "pmhnp",
      attested: true,
      crisisDecision: { kind: "escalate" },
    });
    const open = AdelanteEHR.listCrisisEscalations(pid, { status: "open" });
    expect(open).toHaveLength(1);
    expect(open[0]!.triggerSource).toBe("screener_score");
    expect(open[0]!.triggerDetail).toMatch(/PHQ-9 total 22 \(Severe band\)/);
  });
});
