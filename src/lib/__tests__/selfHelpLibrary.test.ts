// §Adelante Journey Phase 5 — self-help Library / Exercise system.
//
// Proves the three things the architecture claims: progress is REAL patient
// record data, an advocate at the HIPAA-only read floor sees progress and
// nothing clinical, and population gating keeps reentry-specific copy away
// from someone it does not describe.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { resolvePopulation } from "@/lib/population";
import {
  engagementRecords,
  engagementSummary,
  getEngagement,
} from "@/lib/engagement";
import {
  EXERCISES,
  LIBRARY_CATEGORIES,
  LIBRARY_ITEMS,
  categoryProgress,
  getLibraryItem,
  itemsInCategory,
  visibleItemsInCategory,
} from "@/lib/library";

function newPatient(over: Record<string, unknown> = {}) {
  return AdelanteEHR.createPatient({ firstName: "Lib", lastName: "Learner", ...over } as never).id;
}

function invite(pid: string) {
  return AdelanteEHR.createAdvocateInvitation({
    patientId: pid,
    advocateName: "Rosa Ibarra",
    relationship: "Sister",
    invitationSentTo: "rosa@example.org",
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Lib Learner" },
  });
}

/** A claimed HIPAA-only link — the read floor. */
function hipaaOnlyLink(pid: string) {
  const link = invite(pid);
  AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: "hipaa_authorization",
    attestedName: "Rosa Ibarra",
  });
  return link;
}

describe("library content shape", () => {
  it("ships the full Starting Strong sequence, ordered and complete", () => {
    expect(LIBRARY_CATEGORIES.map((c) => c.id)).toContain("starting-strong");
    const items = itemsInCategory("starting-strong");
    expect(items).toHaveLength(10);
    expect(items.map((i) => i.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Every one of the eight instructional steps is present on every lesson.
    for (const i of items) {
      for (const field of [
        "problem",
        "learnTitle",
        "learnBody",
        "adelReflection",
        "adelQuestion",
        "insight",
        "action",
        "toolkitLabel",
      ] as const) {
        expect(i[field].length).toBeGreaterThan(0);
      }
      expect(i.activity.kind).toBeTruthy();
    }
  });

  it("ships all eleven exercises with a typed content payload matching `type`", () => {
    expect(EXERCISES).toHaveLength(11);
    for (const e of EXERCISES) expect(e.content.type).toBe(e.type);
    expect(EXERCISES.map((e) => e.id)).toEqual(
      expect.arrayContaining(["urge-surfing-timer", "box-breathing", "if-i-slip-plan"]),
    );
  });

  it("placeholder content is flagged, never silently shipped as final", () => {
    for (const i of LIBRARY_ITEMS) expect(i.placeholder).toBe(true);
  });
});

describe("progress is real patient record data", () => {
  it("completing a lesson persists on the patient and saves the toolkit takeaway", () => {
    const pid = newPatient();
    expect(AdelanteEHR.completedLibraryItems(pid)).toEqual([]);
    const res = AdelanteEHR.completeLibraryItem(pid, "ss-daily-rhythm");
    expect(res).toEqual({ completed: true, alreadyComplete: false });

    // In the ENGAGEMENT store, keyed by patient id — and explicitly NOT on
    // the clinical record.
    expect(getEngagement(pid)?.completedLibraryItems).toContain("ss-daily-rhythm");
    expect(AdelanteEHR.getPatient(pid)).not.toHaveProperty("completedLibraryItems");
    const toolkit = AdelanteEHR.savedToolkitItems(pid);
    expect(toolkit).toHaveLength(1);
    expect(toolkit[0]?.label).toBe(getLibraryItem("ss-daily-rhythm")?.toolkitLabel);
    expect(toolkit[0]?.from).toBe("library");
  });

  it("completion is idempotent and audited once", () => {
    const pid = newPatient();
    AdelanteEHR.completeLibraryItem(pid, "ss-calming-my-mind");
    const second = AdelanteEHR.completeLibraryItem(pid, "ss-calming-my-mind");
    expect(second.alreadyComplete).toBe(true);
    expect(AdelanteEHR.completedLibraryItems(pid)).toEqual(["ss-calming-my-mind"]);
    expect(AdelanteEHR.savedToolkitItems(pid)).toHaveLength(1);
    const events = AdelanteEHR.listAuditEvents({ patientId: pid }).filter(
      (e) => e.action === "library_item_completed",
    );
    expect(events).toHaveLength(1);
  });

  it("exercises track in their own namespace and only save a toolkit entry when asked", () => {
    const pid = newPatient();
    AdelanteEHR.completeExercise(pid, "box-breathing");
    expect(AdelanteEHR.completedExercises(pid)).toEqual(["box-breathing"]);
    expect(AdelanteEHR.completedLibraryItems(pid)).toEqual([]);
    expect(AdelanteEHR.savedToolkitItems(pid)).toHaveLength(0);
    AdelanteEHR.completeExercise(pid, "urge-surfing-timer", { saveToolkit: true });
    expect(AdelanteEHR.savedToolkitItems(pid).map((t) => t.from)).toEqual(["exercise"]);
  });

  it("unknown ids are refused rather than recorded", () => {
    const pid = newPatient();
    expect(AdelanteEHR.completeLibraryItem(pid, "not-a-lesson").completed).toBe(false);
    expect(AdelanteEHR.completedLibraryItems(pid)).toEqual([]);
  });

  it("a toolkit entry can be removed", () => {
    const pid = newPatient();
    AdelanteEHR.completeLibraryItem(pid, "ss-daily-rhythm");
    AdelanteEHR.removeToolkitItem(pid, "ss-daily-rhythm");
    expect(AdelanteEHR.savedToolkitItems(pid)).toHaveLength(0);
    // Removing the takeaway does NOT un-complete the lesson.
    expect(AdelanteEHR.completedLibraryItems(pid)).toContain("ss-daily-rhythm");
  });
});

describe("population gating — Phase 2 reused, not reinvented", () => {
  it("reentry-specific copy is hidden from a general-population patient", () => {
    const pid = newPatient();
    AdelanteEHR.recordFrontDoorEntry(pid, {
      existingCare: "no",
      heardAbout: "word_of_mouth",
    } as never);
    const r = resolvePopulation(pid);
    expect(r.track).toBe("general_population");
    const visible = visibleItemsInCategory("starting-strong", r);
    expect(visible.map((i) => i.id)).not.toContain("ss-finding-my-footing");
    // …and the progress denominator follows the visible set.
    expect(categoryProgress("starting-strong", [], r).total).toBe(9);
  });

  it("the same lesson is shown to a confirmed justice-involved patient", () => {
    const pid = newPatient();
    AdelanteEHR.setCoverage(pid, { justiceInvolvement: "yes" } as never);
    const r = resolvePopulation(pid);
    expect(r.track).toBe("post_release_ji");
    expect(visibleItemsInCategory("starting-strong", r).map((i) => i.id)).toContain(
      "ss-finding-my-footing",
    );
  });

  it("an unconfirmed 'not sure' answer does not open the gate", () => {
    const pid = newPatient();
    AdelanteEHR.setCoverage(pid, { justiceInvolvement: "unsure" } as never);
    const r = resolvePopulation(pid);
    expect(r.provisional).toBe(true);
    expect(visibleItemsInCategory("starting-strong", r).map((i) => i.id)).not.toContain(
      "ss-finding-my-footing",
    );
  });

  it("population-neutral content is visible to everyone", () => {
    const pid = newPatient();
    const r = resolvePopulation(pid);
    expect(visibleItemsInCategory("starting-strong", r).map((i) => i.id)).toContain(
      "ss-calming-my-mind",
    );
  });
});

describe("advocate visibility — Phase 4 tiers reused", () => {
  it("engagement data joins back to the clinical record by patient id", () => {
    const a = newPatient({ firstName: "Ana" });
    const b = newPatient({ firstName: "Beto" });
    AdelanteEHR.completeLibraryItem(a, "ss-daily-rhythm");
    AdelanteEHR.completeLibraryItem(a, "ss-calming-my-mind");
    AdelanteEHR.completeExercise(b, "box-breathing");

    // Population-health style query: cohort of clinical records LEFT JOINed
    // to engagement rows on patientId — a real join, not a black box.
    const cohort = [a, b].map((id) => AdelanteEHR.getPatient(id)!);
    const byId = new Map(engagementRecords(cohort.map((p) => p.id)).map((r) => [r.patientId, r]));
    const joined = cohort.map((p) => ({
      patientId: p.id,
      name: p.firstName,
      lessons: byId.get(p.id)?.completedLibraryItems.length ?? 0,
      exercises: byId.get(p.id)?.completedExercises.length ?? 0,
    }));
    expect(joined).toEqual([
      { patientId: a, name: "Ana", lessons: 2, exercises: 0 },
      { patientId: b, name: "Beto", lessons: 0, exercises: 1 },
    ]);
    expect(engagementSummary(a).lessonsCompleted).toBe(2);
    expect(engagementSummary(a).lastActivityAt).toBeTruthy();
  });

  it("the clinical record carries none of the three engagement fields", () => {
    const pid = newPatient();
    AdelanteEHR.completeLibraryItem(pid, "ss-daily-rhythm");
    AdelanteEHR.completeExercise(pid, "box-breathing", { saveToolkit: true });
    const patient = AdelanteEHR.getPatient(pid)!;
    for (const field of [
      "completedLibraryItems",
      "completedExercises",
      "savedToolkitItems",
    ] as const) {
      expect(patient).not.toHaveProperty(field);
    }
    // Nothing leaks through a serialized copy of the record either.
    expect(JSON.stringify(patient)).not.toContain("ss-daily-rhythm");
    // …while the engagement store does hold it.
    expect(getEngagement(pid)?.savedToolkitItems).toHaveLength(2);
  });

  it("a HIPAA-only advocate sees progress counts", () => {
    const pid = newPatient();
    const link = hipaaOnlyLink(pid);
    AdelanteEHR.completeLibraryItem(pid, "ss-daily-rhythm");
    AdelanteEHR.completeExercise(pid, "box-breathing");
    const view = AdelanteEHR.advocateLibraryProgress(link.id);
    expect(view.allowed).toBe(true);
    expect(view.lessonsCompleted).toBe(1);
    expect(view.exercisesCompleted).toBe(1);
    expect(view.completed.map((c) => c.title)).toContain("Creating My Daily Rhythm");
  });

  it("the DTO carries no clinical content and no patient-authored text", () => {
    const pid = newPatient();
    const link = hipaaOnlyLink(pid);
    AdelanteEHR.completeLibraryItem(pid, "ss-daily-rhythm");
    const view = AdelanteEHR.advocateLibraryProgress(link.id);
    const keys = Object.keys(view).sort();
    expect(keys).toEqual(
      [
        "allowed",
        "completed",
        "exercisesCompleted",
        "exercisesTotal",
        "lessonsCompleted",
        "lessonsTotal",
        "part2Disclosed",
        "reason",
      ].sort(),
    );
    // Explicitly: no toolkit labels (patient free text) reach the advocate.
    expect(JSON.stringify(view)).not.toContain("My three daily anchors");
    // And the advocate cannot read clinical notes through this or any tier.
    expect(AdelanteEHR.advocateCan(link.id, "clinical_notes_view")).toBe(false);
    expect(AdelanteEHR.advocateCan(link.id, "library_progress_view")).toBe(true);
  });

  it("an unclaimed invitation sees nothing and the denial is audited", () => {
    const pid = newPatient();
    const link = invite(pid);
    AdelanteEHR.completeLibraryItem(pid, "ss-daily-rhythm");
    const view = AdelanteEHR.advocateLibraryProgress(link.id);
    expect(view.allowed).toBe(false);
    expect(view.completed).toEqual([]);
    expect(view.lessonsCompleted).toBe(0);
    const denials = AdelanteEHR.listAuditEvents({ patientId: pid }).filter(
      (e) => e.category === "advocate" && e.action === "advocate_access_denied",
    );
    expect(denials.length).toBeGreaterThan(0);
  });

  it("every allowed advocate read is audited", () => {
    const pid = newPatient();
    const link = hipaaOnlyLink(pid);
    AdelanteEHR.advocateLibraryProgress(link.id);
    const events = AdelanteEHR.listAuditEvents({ patientId: pid }).filter(
      (e) => e.action === "advocate_self_help_progress_viewed",
    );
    expect(events).toHaveLength(1);
  });
});
