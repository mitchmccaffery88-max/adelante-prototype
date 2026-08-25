// §Lesson-player Phase B — theme-matching a REAL Exercise Library tool to each
// Recovery lesson for "Part A · Practice".
//
// Zero new content: every exercise returned here already exists in
// `EXERCISES` (src/lib/library.ts). The match is deterministic and computed
// from the lesson's own authored text, in three tiers:
//
//   1. keyword  — the lesson's real words point at one tool (craving → urge
//                 surfing, rent/job → budget, apology → communication script).
//   2. module   — no clear keyword signal, so the module's mission decides.
//   3. fallback — a module we do not know: box breathing, the one tool that is
//                 safe and useful in every recovery context.
//
// The tier is returned so the UI can be honest about a generic match rather
// than implying the tool was authored for that lesson.
import { EXERCISES, getExercise, type Exercise } from "@/lib/library";
import type { RecoveryLesson } from "@/lib/recovery";

export type ExerciseMatchTier = "keyword" | "module" | "fallback";

export interface ExerciseMatch {
  exercise: Exercise;
  tier: ExerciseMatchTier;
}

/** Last-resort tool. Breathing is never wrong in a recovery lesson. */
const FALLBACK_EXERCISE_ID = "box-breathing";

/** One default per module, chosen against the module's real mission. */
const MODULE_DEFAULT: Record<string, string> = {
  "first-days-out": "box-breathing",
  "finding-my-people": "support-circle",
  "understanding-my-addiction": "trigger-map",
  "changing-my-everyday-life": "milestone-reward",
  "healing-my-relationships": "communication-script",
  "building-a-life-that-works": "budget-basics",
  "when-recovery-gets-hard": "urge-surfing-timer",
  "becoming-someone-new": "thought-record",
  "living-recovery": "warning-signs",
};

/** Real words from the authored lessons → the tool that answers them. */
const KEYWORDS: { exerciseId: string; words: string[] }[] = [
  { exerciseId: "urge-surfing-timer", words: ["craving", "cravings", "urge", "urges", "wave", "white-knuckl"] },
  { exerciseId: "box-breathing", words: ["panic", "anxiety", "anxious", "breathe", "breathing", "overwhelm", "calm down"] },
  { exerciseId: "trigger-map", words: ["trigger", "triggers", "people, places", "cue", "pattern", "cycle"] },
  { exerciseId: "thought-record", words: ["thought", "shame", "guilt", "belief", "self-talk", "identity", "who i am"] },
  { exerciseId: "anger-thermometer", words: ["anger", "angry", "rage", "blow up", "temper", "escalat"] },
  { exerciseId: "support-circle", words: ["sponsor", "meeting", "lonely", "alone", "support", "my people", "friend"] },
  { exerciseId: "budget-basics", words: ["money", "budget", "rent", "job", "work", "income", "bills", "paycheck"] },
  { exerciseId: "communication-script", words: ["apolog", "amends", "boundar", "conversation", "tell them", "say no", "family", "partner"] },
  { exerciseId: "warning-signs", words: ["warning sign", "warning signs", "slipping", "drift", "complacen", "red flag"] },
  { exerciseId: "if-i-slip-plan", words: ["slip", "lapse", "relapse", "used again", "setback"] },
  { exerciseId: "milestone-reward", words: ["goal", "milestone", "routine", "habit", "celebrat", "reward", "progress"] },
];

function lessonHaystack(lesson: RecoveryLesson): string {
  return [
    lesson.title,
    lesson.problem,
    lesson.learnTitle,
    lesson.learnBody,
    lesson.insight,
    lesson.toolkitLabel,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * The theme-matched exercise for one lesson. Pure and deterministic — the same
 * lesson always yields the same tool, so a patient's Part A does not move.
 */
export function matchExerciseForLesson(lesson: RecoveryLesson): ExerciseMatch {
  const hay = lessonHaystack(lesson);
  let best: { id: string; score: number } | null = null;
  for (const rule of KEYWORDS) {
    let score = 0;
    for (const w of rule.words) {
      if (hay.includes(w)) score += 1;
    }
    // Title hits count double: the title is the lesson's actual subject.
    const title = lesson.title.toLowerCase();
    for (const w of rule.words) {
      if (title.includes(w)) score += 2;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: rule.exerciseId, score };
  }
  if (best) {
    const ex = getExercise(best.id);
    if (ex) return { exercise: ex, tier: "keyword" };
  }
  const moduleId = MODULE_DEFAULT[lesson.moduleId];
  if (moduleId) {
    const ex = getExercise(moduleId);
    if (ex) return { exercise: ex, tier: "module" };
  }
  const fallback = getExercise(FALLBACK_EXERCISE_ID) ?? EXERCISES[0]!;
  return { exercise: fallback, tier: "fallback" };
}
