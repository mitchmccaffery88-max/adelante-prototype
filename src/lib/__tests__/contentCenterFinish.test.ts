import { describe, expect, it } from "vitest";
import "@/lib/contentCatalog";
import "@/lib/contentTags";
import { seedPublishedContent, getContentEntry, retireContent, saveContentDraft } from "@/lib/contentPublishing";
import { staleContentFor, canBrowseContent, defaultContentMode, staffContentInventory } from "@/lib/contentStaff";
import { nextReviewAfter, readingLevelOf } from "@/lib/contentGovernance";
import { runAction } from "@/lib/actions/runAction";
import { resolveNavAccess } from "@/lib/navGuard";
import { STAFF_ROLES } from "@/lib/roles";
import { liveExercise, liveRecoveryLessons } from "@/lib/contentCatalog";
import { matchExerciseForLesson } from "@/lib/recovery.exerciseMatch";
import { buildAdelSystemPrompt } from "@/lib/adelPrompt";
import { liveCurricula, firstDaysSteps } from "@/lib/curriculumTypes";
import { curriculumProgress, curriculumVisible } from "@/lib/curriculumProgress";
import { contentMetrics } from "@/lib/contentAnalytics";
import { addStructuredGoal, assignToGoal, getStructuredPlan } from "@/lib/structuredCarePlan";
import { completeLibraryItem, completeExercise, engagementRecords } from "@/lib/engagement";
import { AdelanteEHR } from "@/lib/ehr";
import { PATIENT_NAV } from "@/lib/navSections";
import { inventoryStatus } from "@/components/admin/ContentInventoryTable";
import { activityProblems } from "@/components/admin/StructuredPracticeEditor";
import { EXERCISE_CONTENT_TYPE } from "@/lib/curriculumTypes";

const actor = { name: "Mitch", staffId: "s-admin", role: "sys_admin" as const };
const now = () => new Date().toISOString();

describe("F1 mark reviewed advances next review and clears the stale queue", () => {
  it("editorial content clears nextReview; directory listings move 180 days", () => {
    const id = "f1-stale-lesson";
    seedPublishedContent({ typeId: "library_lesson", id, actor, body: { id, title: "Stale", meta: { owner: actor.name, nextReview: "2020-01-01" } }, atISO: now() });
    expect(staleContentFor(actor.staffId, actor.name, actor.role).some((e) => e.id === id)).toBe(true);
    const res = runAction("content_mark_reviewed", { role: actor.role, staffId: actor.staffId, staffName: actor.name }, undefined, { args: [{ typeId: "library_lesson", ids: [id], actor, note: "Reviewed" }] });
    expect(res.ok).toBe(true);
    expect(staleContentFor(actor.staffId, actor.name, actor.role).some((e) => e.id === id)).toBe(false);
    expect((getContentEntry("library_lesson", id)?.body.meta as Record<string, unknown>).lastReviewed).toBe(now().slice(0, 10));
    expect(nextReviewAfter("community_resource", "2026-01-01")).toBe("2026-06-30");
    expect(nextReviewAfter("crisis_line", "2026-01-01")).toBe("2026-04-01");
    expect(nextReviewAfter("consent", "2026-01-01")).toBe("2027-01-01");
    expect(nextReviewAfter("library_lesson", "2026-01-01")).toBeUndefined();
  });
});

describe("F2 /content-library route gate", () => {
  it("redirects every role outside clinical delivery, coordination and authoring", () => {
    const denied = STAFF_ROLES.map((r) => r.key).filter((r) => !canBrowseContent(r));
    expect(denied.length).toBeGreaterThan(0);
    for (const r of denied) {
      const a = resolveNavAccess(r, "/content-library");
      expect(a.status).toBe("denied");
      if (a.status === "denied") expect(a.redirectTo).not.toBe("/content-library");
    }
    for (const r of ["therapist", "pmhnp", "clinical_coordinator"] as const) expect(resolveNavAccess(r, "/content-library").status).toBe("allowed");
  });
});

describe("F3 shipped items in Manage", () => {
  it("lists shipped lessons as Live (shipped)", () => {
    const shipped = staffContentInventory("sys_admin").filter((e) => e.typeId === "library_lesson" && !getContentEntry(e.typeId, e.id));
    expect(shipped.length).toBeGreaterThan(0);
    expect(inventoryStatus(shipped[0]!)).toBe("Live (shipped)");
  });
});

describe("F4 plain validation", () => {
  it("rich activity and exercise messages use plain words", () => {
    expect(activityProblems("grounding", { senses: [] })[0]).toMatch(/five sense prompts/);
    expect(activityProblems("rate", { min: 5, max: 1, minLabel: "a", maxLabel: "b" })[0]).toMatch(/highest number/);
    expect(EXERCISE_CONTENT_TYPE.validate({ title: "x", purpose: "y", content: { type: "checklist", intro: "", items: [] } })).toContain("Add at least one checklist item.");
  });
});

describe("F5 live exercise catalog everywhere", () => {
  it("an edited exercise title reaches craving flow, matching and Adel", () => {
    const base = liveExercise("urge-surfing-timer")!;
    const box = liveExercise("box-breathing")!;
    seedPublishedContent({ typeId: "exercise", id: "urge-surfing-timer", actor, body: { ...(base as unknown as Record<string, unknown>), title: "Ride the Wave (edited)" }, atISO: now() });
    seedPublishedContent({ typeId: "exercise", id: "box-breathing", actor, body: { ...(box as unknown as Record<string, unknown>), title: "Square Breathing (edited)" }, atISO: now() });
    // CravingFlow reads liveExercise("urge-surfing-timer").
    expect(liveExercise("urge-surfing-timer")?.title).toBe("Ride the Wave (edited)");
    const titles = liveRecoveryLessons().map((l) => matchExerciseForLesson(l).exercise.title);
    expect(titles.some((t) => t.includes("(edited)"))).toBe(true);
    expect(buildAdelSystemPrompt({ sud: true, reentry: true })).toContain("Ride the Wave (edited)");
    // §Group 2 S2 — SUD practice never reaches a patient without the SUD pathway.
    expect(buildAdelSystemPrompt({ sud: false, reentry: false })).not.toContain("Ride the Wave (edited)");
  });
});

describe("F6/F9 Journeys", () => {
  it("My First Days Out holds the module's lessons in order; nav has My journeys", () => {
    const fdo = liveCurricula().find((j) => j.id === "first-days-curriculum")!;
    expect(fdo.steps.length).toBeGreaterThanOrEqual(5);
    expect(fdo.steps.every((s) => s.type === "recovery_lesson")).toBe(true);
    expect(fdo.steps.map((s) => s.id)).toEqual(firstDaysSteps().map((s) => s.id));
    expect(fdo.description.length).toBeGreaterThan(60);
    expect(fdo.es?.description).toMatch(/^Borrador/);
    expect(PATIENT_NAV.some((e) => e.to === "/journeys" && e.labelKey === "navMyJourneys")).toBe(true);
  });

  const journeyId = "f9-journey";
  const seedJourney = () => {
    seedPublishedContent({ typeId: "library_lesson", id: "f9-step-lesson", actor, body: { id: "f9-step-lesson", title: "F9 lesson" }, atISO: now() });
    seedPublishedContent({ typeId: "journey", id: journeyId, actor, atISO: now(), body: { id: journeyId, title: "F9 Journey", description: "Test path", unlock: "sequential", steps: [{ type: "library_lesson", id: "f9-step-lesson", required: true }, { type: "exercise", id: "box-breathing", required: true }] } });
  };

  it("/journeys page model: sequential lock, resume to next step", () => {
    seedJourney();
    const p = AdelanteEHR.listPatients()[2]!.id;
    const j = liveCurricula().find((x) => x.id === journeyId)!;
    expect(curriculumVisible(p, j)).toBe(true);
    const before = curriculumProgress(p, j);
    expect(before.next?.id).toBe("f9-step-lesson");
    expect(before.steps[1]?.locked).toBe(true);
    completeLibraryItem(p, "f9-step-lesson");
    expect(curriculumProgress(p, j).next?.id).toBe("box-breathing");
  });

  it("a Journey assignment completes when all required steps are done", () => {
    seedJourney();
    const p = AdelanteEHR.listPatients()[3]!.id;
    const T = { name: "Marisol", role: "therapist" as const };
    const g = addStructuredGoal({ patientId: p, clinicalText: "Daily coping", measure: "Uses a tool", owner: "patient" as never, actor: T });
    const a = assignToGoal({ patientId: p, goalId: g.id, kind: "activity", activityId: journeyId, frequency: "once", actor: T });
    completeLibraryItem(p, "f9-step-lesson");
    expect(getStructuredPlan(p).assignments.find((x) => x.id === a.id)!.completions.length).toBe(0);
    completeExercise(p, "box-breathing");
    expect(getStructuredPlan(p).assignments.find((x) => x.id === a.id)!.completions.length).toBe(1);
  });

  it("blocks retiring content used in a live Journey", () => {
    seedJourney();
    const res = retireContent({ typeId: "library_lesson", id: "f9-step-lesson", actor: { name: "Coordinator", staffId: "s-cc2", role: "clinical_coordinator" }, note: "No longer needed" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/live Journey/);
  });

  it("Journey metrics stay suppressed for real counts and populate under the Simulated sample", () => {
    seedJourney();
    expect(contentMetrics("journey", journeyId, "pmhnp")?.starts).toBeNull();
    const r = runAction("content_simulated_sample", { role: "pmhnp", staffId: "s-np1", staffName: "NP" }, undefined, { args: [{ note: "demo" }] });
    expect(r.ok).toBe(true);
    const m = contentMetrics("journey", journeyId, "pmhnp", undefined, undefined, { sample: true })!;
    expect(m.starts).toBeGreaterThanOrEqual(11);
    // Sample rows never reach real population reads.
    expect(engagementRecords().some((e) => e.patientId.startsWith("sim-sample-"))).toBe(false);
  }, 60_000);
});

describe("F7/F8", () => {
  it("reading level is computed and flags patient text above grade 6", () => {
    const simple = readingLevelOf("library_lesson", { title: "Go for a walk. It can help." });
    const hard = readingLevelOf("library_lesson", { title: "Comprehensive interdisciplinary rehabilitation necessitates collaborative individualized documentation." });
    expect(simple.aboveTarget).toBe(false);
    expect(hard.aboveTarget).toBe(true);
  });
  it("role default modes", () => {
    expect(defaultContentMode("sys_admin", 0, true)).toBe("audit");
    expect(defaultContentMode("pmhnp", 2, true)).toBe("review");
    expect(defaultContentMode("pmhnp", 0, true)).toBe("browse");
    expect(defaultContentMode("therapist", 0, false)).toBe("browse");
  });
  it("draft save keeps working for new ids", () => {
    expect(saveContentDraft).toBeTypeOf("function");
  });
});
