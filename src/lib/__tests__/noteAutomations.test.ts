import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { plannedAutomations, summarizeAutomation, type Automation, type TemplateAnswers, type TemplateSchema } from "@/lib/templateSchema";

const PATIENT = AdelanteEHR.listPatients()[0]!.id;

const taskAutomation = (over: Partial<Automation> = {}): Automation => ({
  id: "auto_task",
  label: "72-hour safety follow-up",
  enabled: true,
  action: { kind: "schedule_task", taskType: "Safety follow-up", dueInDays: 3, priority: "urgent" },
  ...over,
});

function schema(automations: Automation[]): TemplateSchema {
  return { sections: [], automations };
}

function signedNote(automations: Automation[], answers: TemplateAnswers = {}) {
  const n = AdelanteEHR.addProgressNote(PATIENT, {
    clinicianId: "c1",
    date: new Date().toISOString(),
    sessionType: "individual",
    subjective: "s",
    objective: "",
    assessment: "",
    plan: "",
    authorSource: "human",
    status: "draft",
    templateKey: "phq9",
    templateTitle: "PHQ-9 Follow-up",
    templateSchema: schema(automations),
    templateAnswers: answers,
  });
  if (!n) throw new Error("no note");
  AdelanteEHR.signProgressNote(PATIENT, n.id, {
    signedBy: "Dr. Bagga",
    role: "pmhnp",
    attested: true,
  });
  return n;
}

describe("post-sign automations", () => {
  it("creates a case task tagged with its source note", () => {
    const n = signedNote([taskAutomation()]);
    const runs = AdelanteEHR.listNoteAutomationRuns(n.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.resultKind).toBe("case_task");
    const task = AdelanteEHR.listCaseTasks().find((t) => t.id === runs[0]!.resultId);
    expect(task?.sourceNoteId).toBe(n.id);
    expect(task?.sourceAutomationId).toBe("auto_task");
    expect(task?.origin).toBe("note_automation");
    expect(task?.priority).toBe("urgent");
  });

  it("never fires twice for the same note+automation", () => {
    const n = signedNote([taskAutomation()]);
    const before = AdelanteEHR.listCaseTasks().length;
    AdelanteEHR.runNoteAutomations(PATIENT, n.id, { actorId: "Dr. Bagga" });
    AdelanteEHR.runNoteAutomations(PATIENT, n.id, { actorId: "Dr. Bagga" });
    expect(AdelanteEHR.listNoteAutomationRuns(n.id)).toHaveLength(1);
    expect(AdelanteEHR.listCaseTasks().length).toBe(before);
  });

  it("skips disabled automations and honours the condition", () => {
    const n = signedNote(
      [
        taskAutomation({ id: "off", enabled: false }),
        taskAutomation({ id: "gated", when: { condition: "phq9_total >= 10" } }),
      ],
      { phq9_total: 4 },
    );
    expect(AdelanteEHR.listNoteAutomationRuns(n.id)).toHaveLength(0);
  });

  it("fires when the condition is satisfied", () => {
    const n = signedNote([taskAutomation({ id: "gated", when: { condition: "phq9_total >= 10" } })], {
      phq9_total: 18,
    });
    expect(AdelanteEHR.listNoteAutomationRuns(n.id)).toHaveLength(1);
  });

  it("problem gate matches active problems only", () => {
    const gated = taskAutomation({
      id: "prob",
      when: { requiresActiveProblem: { icd10Prefixes: ["F11"] } },
    });
    const activeF11 = [{ category: "sud", icd10Code: "F11.20" }];
    expect(plannedAutomations(schema([gated]), {}, activeF11)).toHaveLength(1);
    expect(plannedAutomations(schema([gated]), {}, [])).toHaveLength(0);
    expect(
      plannedAutomations(schema([gated]), {}, [{ category: "sud", icd10Code: "F32.1" }]),
    ).toHaveLength(0);
  });

  it("start_template opens an unsigned draft traced to the source note", () => {
    const tpl = AdelanteEHR.listNoteTemplates()[0];
    if (!tpl) return;
    const n = signedNote([
      {
        id: "auto_draft",
        label: "Open follow-up note",
        enabled: true,
        action: { kind: "start_template", templateKey: tpl.key },
      },
    ]);
    const run = AdelanteEHR.listNoteAutomationRuns(n.id)[0]!;
    expect(run.resultKind).toBe("draft_note");
    const draft = AdelanteEHR.listPatients().find((x) => x.id === PATIENT)?.progressNotes?.find((x) => x.id === run.resultId);
    expect(draft?.status).toBe("draft");
    expect(draft?.signedBy).toBeFalsy();
    expect(draft?.automationOrigin?.sourceNoteId).toBe(n.id);
  });

  it("cosign-routed notes do not fire until the cosignature lands", () => {
    const n = AdelanteEHR.addProgressNote(PATIENT, {
      clinicianId: "c1",
      date: new Date().toISOString(),
      sessionType: "individual",
      subjective: "s",
      objective: "",
      assessment: "",
      plan: "",
      authorSource: "human",
      status: "draft",
      templateTitle: "CM check-in",
      templateSchema: schema([taskAutomation({ id: "after_cosign" })]),
      templateAnswers: {},
    })!;
    AdelanteEHR.signProgressNote(PATIENT, n.id, {
      signedBy: "Maria CM",
      role: "case_manager",
      attested: true,
      cosignRequired: true,
      cosignRole: ["therapist"],
    });
    expect(AdelanteEHR.listNoteAutomationRuns(n.id)).toHaveLength(0);
    AdelanteEHR.cosignProgressNote(PATIENT, n.id, {
      cosignedBy: "Christi",
      role: "therapist",
      attested: true,
    });
    expect(AdelanteEHR.listNoteAutomationRuns(n.id)).toHaveLength(1);
  });

  it("summaries read as plain English", () => {
    expect(summarizeAutomation(taskAutomation())).toMatch(/Safety follow-up/);
    expect(summarizeAutomation(taskAutomation())).toMatch(/3 day/);
  });
});
