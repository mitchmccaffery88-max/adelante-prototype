// §Standalone route items — /toolkit is a READ-ONLY aggregation. These tests
// assert it reads the real persisted Part B picks and saved takeaways, and
// that a patient with nothing gets an honest empty result.
import { describe, expect, it, beforeEach } from "vitest";
import { __resetEngagement } from "@/lib/engagement";
import { AdelanteEHR } from "@/lib/ehr";
import { RECOVERY_LESSONS } from "@/lib/recovery";
import { patientToolkit } from "@/lib/toolkit";

describe("patientToolkit", () => {
  beforeEach(() => __resetEngagement());

  it("is honestly empty before the patient builds anything", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    const tk = patientToolkit(p.id);
    expect(tk.isEmpty).toBe(true);
    expect(tk.warningSigns).toHaveLength(0);
    expect(tk.takeaways).toHaveLength(0);
  });

  it("aggregates real Part B picks across lessons, with source attribution", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    const lesson = RECOVERY_LESSONS[0]!;
    const sign = lesson.toolFlow.warningSigns[0]!;
    const person = lesson.toolFlow.supportPeople[0]!;
    const action = lesson.toolFlow.todayActions[0]!;

    AdelanteEHR.completeRecoveryLesson(p.id, lesson.id, {
      warningSigns: [sign],
      supportPeople: [person],
      todayAction: action,
    });

    const tk = patientToolkit(p.id);
    expect(tk.isEmpty).toBe(false);
    expect(tk.warningSigns.map((w) => w.value)).toContain(sign);
    expect(tk.supportPeople.map((w) => w.value)).toContain(person);
    expect(tk.todayActions.map((w) => w.value)).toContain(action);
    // Every pick links back to the lesson it came from.
    expect(tk.warningSigns[0]!.lessonId).toBe(lesson.id);
    expect(tk.warningSigns[0]!.lessonTitle).toBe(lesson.title);
    // Completion auto-saves the takeaway line.
    expect(tk.takeaways.map((t) => t.label)).toContain(lesson.toolkitLabel);
  });
});
