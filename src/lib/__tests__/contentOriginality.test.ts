// §Content-authoring pass Batch 1 — the anti-templating gate, and the twenty
// lessons this batch authored.
import { beforeEach, describe, expect, it } from "vitest";
import {
  FILLER_PATTERNS,
  MIN_COMPARE_LENGTH,
  SIMILARITY_THRESHOLD,
  matchFiller,
  originalityErrors,
  similarity,
} from "@/lib/contentOriginality";
import {
  __resetContentOfType,
  approveAndPublishContent,
  saveContentDraft,
  submitContentForReview,
} from "@/lib/contentPublishing";
import { LIBRARY_LESSON_TYPE, RECOVERY_LESSON_TYPE } from "@/lib/contentTypes";
import { liveLessonsInModule, liveLibraryItems } from "@/lib/contentCatalog";
import {
  STARTING_STRONG_CHECK_INS,
  seedAuthoredStartingStrongCheckIns,
} from "@/lib/library.startingStrong.authored";

const APPROVER = { staffId: "s-cc2", name: "Cathy", role: "clinical_coordinator" as const };

describe("string similarity is a real near-duplicate check, not exact-match", () => {
  it("scores identical text 1 and unrelated text low", () => {
    expect(similarity("the urge is a wave", "the urge is a wave")).toBe(1);
    expect(similarity("where you sleep decides the rest", "your tolerance dropped")).toBeLessThan(0.4);
  });

  it("catches a one-word edit to a long template — the case exact-match misses", () => {
    const a = "Right now, how much is finding a sponsor a struggle for you?";
    const b = "Right now, how much is asking for help a struggle for you?";
    expect(a).not.toEqual(b);
    expect(similarity(a, b)).toBeGreaterThan(SIMILARITY_THRESHOLD);
  });

  it("ignores punctuation, case and curly quotes", () => {
    expect(similarity("Don't wait — call.", "dont wait call")).toBe(1);
  });

  it("scores two genuinely different sentences on the same topic below the bar", () => {
    expect(
      similarity(
        "Where did you sleep last night, and did you feel safe there?",
        "Think about where you've been this week. Where did your body actually relax?",
      ),
    ).toBeLessThan(SIMILARITY_THRESHOLD);
  });
});

describe("known filler patterns come from the filler really measured here", () => {
  it("flags each measured family", () => {
    expect(matchFiller("What part of this feels hardest for you?")?.id).toBe(
      "recovery_adel_question_template",
    );
    expect(matchFiller('Adel can help you go deeper on "How do I ask for help?" — or just listen.')?.id).toBe(
      "recovery_adel_reflection_template",
    );
    expect(matchFiller('Right now, how much is "Why is sleep so important" a struggle for you?')?.id).toBe(
      "recovery_check_in_template",
    );
    expect(matchFiller("Take a breath before you start. Nothing you write here is graded.")?.id).toBe(
      "library_check_in_fallback",
    );
    expect(matchFiller("Which of these sound like you right now?")?.id).toBe(
      "library_check_in_prompt_fallback",
    );
  });

  it("leaves real authored content alone", () => {
    for (const c of STARTING_STRONG_CHECK_INS) expect(matchFiller(c.checkIn)).toBeUndefined();
  });

  it("every pattern explains itself to the author", () => {
    for (const p of FILLER_PATTERNS) expect(p.because.length).toBeGreaterThan(10);
  });
});

describe("the gate runs on the real publish path, not just as documentation", () => {
  beforeEach(() => {
    __resetContentOfType("library_lesson");
    seedAuthoredStartingStrongCheckIns();
  });

  function body(overrides: Record<string, unknown>) {
    return {
      ...LIBRARY_LESSON_TYPE.emptyBody(),
      id: "lib_gate_probe",
      categoryId: "starting-strong",
      title: "Gate probe",
      minutes: 5,
      order: 98,
      problem: "You keep putting off the one call that would change the week.",
      learnTitle: "Avoidance is expensive",
      learnBody:
        "Putting a thing off does not make it smaller. It keeps a low hum of dread running in the background all day, which costs more energy than the call would have.",
      activity: {
        kind: "checklist",
        prompt: "Which call have you been putting off?",
        items: ["A family member", "An appointment line", "My care manager"],
      },
      adelReflection: "The dread is usually bigger than the thing itself.",
      adelQuestion: "What's the shortest version of that call you'd be willing to make?",
      insight: "The call is shorter than the week you spend avoiding it.",
      action: "Make the call before noon tomorrow.",
      toolkitLabel: "My avoided call",
      ...overrides,
    };
  }

  it("refuses to publish a draft that pastes a known filler template", () => {
    saveContentDraft({
      typeId: "library_lesson",
      id: "lib_gate_probe",
      body: body({ checkIn: "Take a breath before you start. Nothing you write here is graded." }),
      actor: APPROVER,
    });
    const res = approveAndPublishContent({
      typeId: "library_lesson",
      id: "lib_gate_probe",
      actor: APPROVER,
      validate: LIBRARY_LESSON_TYPE.validate,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toMatch(/filler, not content/);
  });

  it("refuses at submit-for-review too, so filler never reaches an approver", () => {
    saveContentDraft({
      typeId: "library_lesson",
      id: "lib_gate_probe",
      body: body({ adelQuestion: "What part of this feels hardest for you?" }),
      actor: APPROVER,
    });
    const res = submitContentForReview({
      typeId: "library_lesson",
      id: "lib_gate_probe",
      actor: APPROVER,
      validate: LIBRARY_LESSON_TYPE.validate,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toMatch(/filler, not content/);
  });

  it("refuses a near-duplicate of another live lesson, naming the collision", () => {
    const donor = liveLibraryItems().find((i) => i.id === "ss-restoring-sleep")!;
    saveContentDraft({
      typeId: "library_lesson",
      id: "lib_gate_probe",
      // One word changed from the shipped lesson — exact-match would allow it.
      body: body({ learnBody: donor.learnBody.replace("normal", "typical") }),
      actor: APPROVER,
    });
    const res = approveAndPublishContent({
      typeId: "library_lesson",
      id: "lib_gate_probe",
      actor: APPROVER,
      validate: LIBRARY_LESSON_TYPE.validate,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toMatch(/Restoring Healthy Sleep/);
  });

  it("publishes genuinely original content", () => {
    saveContentDraft({
      typeId: "library_lesson",
      id: "lib_gate_probe",
      body: body({
        checkIn: "Which call is the one you keep sliding to tomorrow? Tap what's closest.",
        checkInOptions: ["A family member", "Somewhere official", "My care team"],
      }),
      actor: APPROVER,
    });
    const res = approveAndPublishContent({
      typeId: "library_lesson",
      id: "lib_gate_probe",
      actor: APPROVER,
      validate: LIBRARY_LESSON_TYPE.validate,
    });
    expect(res.ok).toBe(true);
  });

  it("does not compare a lesson against itself when it is re-published", () => {
    const live = liveLibraryItems().find((i) => i.id === "ss-daily-rhythm")!;
    expect(originalityErrors("library_lesson", structuredClone(live) as never)).toEqual([]);
  });
});

describe("Batch 1 — the twenty lessons authored in this pass", () => {
  const ss = () => liveLibraryItems().filter((i) => i.categoryId === "starting-strong");
  const m1 = () => liveLessonsInModule("first-days-out");

  it("gives all ten Starting Strong lessons a real check-in with card options", () => {
    const items = ss();
    expect(items).toHaveLength(10);
    for (const i of items) {
      expect(i.checkIn?.trim(), `${i.id} has no check-in`).toBeTruthy();
      expect((i.checkInOptions ?? []).length, `${i.id} has too few options`).toBeGreaterThanOrEqual(3);
      expect((i.checkInOptions ?? []).length).toBeLessThanOrEqual(5);
    }
  });

  it("writes each check-in to that lesson's own problem — none repeat", () => {
    const texts = ss().map((i) => i.checkIn!);
    expect(new Set(texts).size).toBe(texts.length);
    for (const a of texts)
      for (const b of texts)
        if (a !== b) expect(similarity(a, b)).toBeLessThan(SIMILARITY_THRESHOLD);
  });

  it("shares no option card between two Starting Strong lessons", () => {
    const seen = new Map<string, string>();
    for (const i of ss())
      for (const o of i.checkInOptions ?? []) {
        expect(seen.has(o), `"${o}" is reused by ${seen.get(o)} and ${i.id}`).toBe(false);
        seen.set(o, i.id);
      }
  });

  it("leaves ZERO instances of the measured filler strings across all twenty", () => {
    const offenders: string[] = [];
    for (const i of ss())
      for (const f of [i.problem, i.checkIn, i.learnTitle, i.learnBody, i.adelReflection, i.adelQuestion, i.insight, i.action])
        if (f && matchFiller(f)) offenders.push(`${i.id}:${f}`);
    for (const l of m1())
      for (const f of [l.problem, l.checkIn, l.learnTitle, l.learnBody, l.adelReflection, l.adelQuestion, l.insight])
        if (f && matchFiller(f)) offenders.push(`${l.id}:${f}`);
    expect(offenders).toEqual([]);
  });

  it("gives Module 1 ten lessons with a unique question, reflection and check-in each", () => {
    const lessons = m1();
    expect(lessons).toHaveLength(10);
    for (const field of ["adelQuestion", "adelReflection", "checkIn"] as const) {
      const texts = lessons.map((l) => l[field]);
      expect(new Set(texts).size, `${field} repeats inside Module 1`).toBe(texts.length);
    }
  });

  it("gives every Module 1 lesson its own tool-flow option sets", () => {
    const seen = new Set<string>();
    for (const l of m1())
      for (const k of ["warningSigns", "supportPeople", "todayActions"] as const) {
        const sig = `${k}::${JSON.stringify(l.toolFlow[k])}`;
        expect(seen.has(sig), `${l.id} reuses a ${k} option set`).toBe(false);
        seen.add(sig);
      }
  });

  it("passes the same validation the admin form and the publish path enforce", () => {
    for (const i of ss())
      expect(LIBRARY_LESSON_TYPE.validate(structuredClone(i) as never), i.id).toEqual([]);
    for (const l of m1())
      expect(RECOVERY_LESSON_TYPE.validate(structuredClone(l) as never), l.id).toEqual([]);
  });

  it("keeps the length floor honest — short fields are filler-checked, not similarity-checked", () => {
    expect(MIN_COMPARE_LENGTH).toBeGreaterThan(20);
  });
});
