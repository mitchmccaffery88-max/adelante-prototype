// §Worklist Phase B — protocol scheduling. Covers template validation, round
// generation cadence, stop semantics, and the fact that crisis alerting is the
// EXISTING sign-time gate (no new code path).
import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, worklistStatusFor } from "@/lib/ehr";
import type { TemplateSchema } from "@/lib/templateSchema";
import { canManageProtocol } from "@/lib/roles";

const STAFF = "Dr. R. Bagga";

const scored: TemplateSchema = {
  sections: [
    {
      id: "s",
      title: "Round",
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
      id: "sc",
      label: "Score",
      sum_of: ["q1"],
      bands: [
        { min: 0, max: 19, label: "Moderate" },
        { min: 20, max: 99, label: "Severe", triggersCrisis: true },
      ],
    },
  ],
};

const unscored: TemplateSchema = { sections: scored.sections };

let n = 0;
const tpl = (schema: TemplateSchema) =>
  AdelanteEHR.createNoteTemplate(
    { key: `proto_${++n}`, title: `Protocol tpl ${n}`, encounterType: "round", schema },
    STAFF,
  );

const newPatient = () =>
  AdelanteEHR.createPatient({ firstName: "Proto", lastName: "Test", programId: "TEST" } as never)
    .id;

describe("startProtocol validation", () => {
  let pid = "";
  beforeEach(() => {
    pid = newPatient();
  });

  it("rejects an unscored template with a clear message", () => {
    const t = tpl(unscored);
    expect(() => AdelanteEHR.startProtocol(pid, "CIWA-Ar", t.id, 60, 4, STAFF)).toThrow(
      /no scoring configured/i,
    );
  });

  it("rejects an inactive template", () => {
    const t = tpl(scored);
    AdelanteEHR.setNoteTemplateActive(t.id, false, "Retired", STAFF);
    expect(() => AdelanteEHR.startProtocol(pid, "COWS", t.id, 60, 4, STAFF)).toThrow(/inactive/i);
  });

  it("rejects an unknown template, empty name and nonsense cadence/rounds", () => {
    const t = tpl(scored);
    expect(() => AdelanteEHR.startProtocol(pid, "X", "nope", 60, 4, STAFF)).toThrow(/no longer/i);
    expect(() => AdelanteEHR.startProtocol(pid, "  ", t.id, 60, 4, STAFF)).toThrow(/name/i);
    expect(() => AdelanteEHR.startProtocol(pid, "X", t.id, 0, 4, STAFF)).toThrow(/cadence/i);
    expect(() => AdelanteEHR.startProtocol(pid, "X", t.id, 60, 0, STAFF)).toThrow(/round/i);
  });

  it("only scored active templates are offered to the picker", () => {
    const good = tpl(scored);
    const bad = tpl(unscored);
    const ids = AdelanteEHR.listProtocolTemplates().map((x) => x.id);
    expect(ids).toContain(good.id);
    expect(ids).not.toContain(bad.id);
  });
});

describe("round generation", () => {
  it("creates totalRounds worklist tasks at the right cadence", () => {
    const pid = newPatient();
    const t = tpl(scored);
    const inst = AdelanteEHR.startProtocol(pid, "CIWA-Ar", t.id, 30, 6, STAFF, "pmhnp");
    const rounds = AdelanteEHR.protocolRounds(inst.id);
    expect(rounds.length).toBe(6);
    expect(rounds.map((r) => r.roundNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    const base = new Date(inst.startedAt).getTime();
    rounds.forEach((r, i) => {
      expect(new Date(r.dueDate).getTime() - base).toBe((i + 1) * 30 * 60_000);
      expect(r.taskType).toBe("protocol_round");
      expect(r.source).toBe("protocol:CIWA-Ar");
      expect(r.templateId).toBe(t.id);
      expect(worklistStatusFor(r)).toBe("pending");
    });
  });

  it("rounds are ordinary worklist rows — they show up in listCaseTasks", () => {
    const pid = newPatient();
    const inst = AdelanteEHR.startProtocol(pid, "COWS", tpl(scored).id, 60, 2, STAFF);
    const all = AdelanteEHR.listCaseTasks().filter((t) => t.protocolInstanceId === inst.id);
    expect(all.length).toBe(2);
    expect(AdelanteEHR.worklistTaskTypes()).toContain("protocol_round");
  });

  it("starting is audited", () => {
    const pid = newPatient();
    const inst = AdelanteEHR.startProtocol(pid, "CIWA-Ar", tpl(scored).id, 60, 2, STAFF, "pmhnp");
    const actions = AdelanteEHR.listAuditEvents()
      .filter((a) => (a.detail as { instanceId?: string } | undefined)?.instanceId === inst.id)
      .map((a) => a.action);
    expect(actions).toContain("protocol_started");
  });
});

describe("stopProtocol", () => {
  it("cancels pending rounds, preserves completed ones, requires a reason", () => {
    const pid = newPatient();
    const inst = AdelanteEHR.startProtocol(pid, "CIWA-Ar", tpl(scored).id, 60, 4, STAFF);
    const rounds = AdelanteEHR.protocolRounds(inst.id);
    AdelanteEHR.completeProtocolRound(rounds[0]!.id, STAFF, "pmhnp");
    expect(() => AdelanteEHR.stopProtocol(inst.id, STAFF, "x")).toThrow(/reason/i);
    expect(AdelanteEHR.stopProtocol(inst.id, STAFF, "Patient transferred", "pmhnp")).toBe(true);
    const after = AdelanteEHR.protocolRounds(inst.id).map(worklistStatusFor);
    expect(after).toEqual(["completed", "cancelled", "cancelled", "cancelled"]);
    expect(AdelanteEHR.listProtocolInstances(pid)[0]!.status).toBe("stopped");
    expect(AdelanteEHR.stopProtocol(inst.id, STAFF, "already stopped")).toBe(false);
  });

  it("an instance completes on its own once every round is closed", () => {
    const pid = newPatient();
    const inst = AdelanteEHR.startProtocol(pid, "COWS", tpl(scored).id, 15, 2, STAFF);
    for (const r of AdelanteEHR.protocolRounds(inst.id))
      AdelanteEHR.completeProtocolRound(r.id, STAFF, "pmhnp");
    expect(AdelanteEHR.listProtocolInstances(pid)[0]!.status).toBe("completed");
  });
});

describe("crisis composition — no new alerting mechanism", () => {
  it("a crisis-band score on a round's note fires the EXISTING sign-time gate", () => {
    const pid = newPatient();
    const t = tpl(scored);
    const inst = AdelanteEHR.startProtocol(pid, "CIWA-Ar", t.id, 60, 3, STAFF, "pmhnp");
    const round = AdelanteEHR.protocolRounds(inst.id)[0]!;
    const note = AdelanteEHR.addProgressNote(pid, {
      clinicianId: "c1",
      date: new Date().toISOString(),
      sessionType: "individual",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      templateId: t.id,
      templateTitle: t.title,
      templateSchema: t.schema,
      templateAnswers: { q1: "22" },
      status: "draft",
    } as never)!;

    // Existing gate: signing is blocked until a crisis decision is recorded.
    expect(() =>
      AdelanteEHR.signProgressNote(pid, note.id, {
        signedBy: STAFF,
        role: "pmhnp",
        attested: true,
      }),
    ).toThrow(/crisis band/i);

    AdelanteEHR.signProgressNote(pid, note.id, {
      signedBy: STAFF,
      role: "pmhnp",
      attested: true,
      crisisDecision: { kind: "escalate" },
    });
    expect(AdelanteEHR.listOpenCrisisEscalations().some((r) => r.escalation.patientId === pid)).toBe(
      true,
    );

    // Round completion remains ordinary worklist mechanics.
    AdelanteEHR.completeProtocolRound(round.id, STAFF, "pmhnp");
    expect(worklistStatusFor(AdelanteEHR.protocolRounds(inst.id)[0]!)).toBe("completed");
  });
});

describe("protocol RBAC", () => {
  it("clinical judgment roles manage; case managers and peers do not", () => {
    expect(canManageProtocol("pmhnp")).toBe(true);
    expect(canManageProtocol("therapist")).toBe(true);
    expect(canManageProtocol("clinical_coordinator")).toBe(true);
    expect(canManageProtocol("ecm_provider")).toBe(false);
    expect(canManageProtocol("peer_specialist")).toBe(false);
  });
});
