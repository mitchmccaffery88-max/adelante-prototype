// §Adelante Journey Phase 5 — self-help Library + Exercise system (schema).
//
// PURE MODULE. Content and shape only: no store access, no React, no
// side effects. The patient's PROGRESS lives in the separate ENGAGEMENT store
// (`src/lib/engagement.ts`), keyed by patient id — real, queryable, server-
// side data (never localStorage), but deliberately NOT a field on the
// clinical `Patient` record: it is engagement data, not documentation.
//
// Reuse, not reinvention:
//  • Population gating is Phase 2's `PopulationTrack` / `isPopulationAllowed`
//    (src/lib/population.ts). An item carries `populations` ONLY when its text
//    genuinely references incarceration or release; the vast majority of this
//    library is population-neutral and carries nothing.
//  • Advocate visibility is Phase 4's tier system (src/lib/advocate.ts). The
//    new `library_progress_view` permission sits at the HIPAA-only read floor
//    and above — see the reasoning there.
// TYPE-ONLY on purpose: `ehr.ts` imports this module for the advocate progress
// read, and `population.ts` imports `ehr.ts`. Keeping this edge erased means
// there is no runtime cycle. The gate LOGIC is Phase 2's, restated in the one
// place it is applied (`isLibraryItemVisible`) rather than duplicated widely.
import type { PopulationResolution, PopulationTrack } from "@/lib/population";

// ---------------------------------------------------------------------------
// Categories + lessons
// ---------------------------------------------------------------------------

export interface LibraryCategory {
  id: string;
  name: string;
  desc: string;
  /** lucide-react icon NAME, resolved by the UI. Keeps this module pure. */
  icon: string;
  /** What the category is clinically aiming at — shown to staff, not patients. */
  clinicalTarget: string;
  order: number;
}

/**
 * A lesson. The eight-part instructional sequence is the schema, not a
 * convention: Problem → Check-In → Learn → Interactive Activity → Reflection
 * → Insight → Action → Toolkit. Every field below is required so a lesson
 * cannot ship with a missing step.
 */
export interface LibraryItem {
  id: string;
  categoryId: string;
  title: string;
  minutes: number;
  order: number;
  /** 1 — the lived problem, in the patient's own words. */
  problem: string;
  /** 3 — teaching block. */
  learnTitle: string;
  learnBody: string;
  /** 4 — the interactive activity (the doing part). */
  activity: LibraryActivity;
  /** 5 — Adel's reflection prompt + the question the patient answers. */
  adelReflection: string;
  adelQuestion: string;
  /** 6 — the one thing to remember. */
  insight: string;
  /** 7 — the concrete next action. */
  action: string;
  /** 8 — what gets saved into the patient's toolkit on completion. */
  toolkitLabel: string;
  /**
   * Phase 2 population gate. ABSENT means population-neutral (the default,
   * and the case for most of this library). Present means the copy directly
   * references custody or release and must not be shown to someone it does
   * not describe.
   */
  populations?: PopulationTrack[];
  /**
   * TRUE when the lesson's own TITLE is 42 CFR Part 2 content (SUD treatment).
   * Advocate progress reads withhold the title of such an item unless the
   * Part 2 gate is lifted — same rule the group-topic read already uses.
   */
  part2Sensitive?: boolean;
  /** Flag placeholder text so it is never mistaken for cleared content. */
  placeholder?: boolean;
}

/**
 * Step 4 — a small, typed interaction, not free text.
 *
 * The variants below are the ones the real Starting Strong content actually
 * uses. Every variant stays a closed, discriminated member so the renderer
 * fails to compile if one is left unhandled.
 */
export type LibraryActivity =
  | { kind: "checklist"; prompt: string; items: string[] }
  | { kind: "sort"; prompt: string; buckets: string[]; cards: string[] }
  | { kind: "write"; prompt: string; lines: number; placeholder?: string }
  | { kind: "rate"; prompt: string; min: number; max: number; minLabel: string; maxLabel: string }
  /** Tap-to-select cards; nothing is right or wrong. */
  | { kind: "reflection"; title: string; prompt: string; cards: string[] }
  /** Order a handful of anchors into the shape of a day. */
  | { kind: "timeline"; title: string; prompt: string; steps: string[] }
  /** A paced-breath activity inside a lesson (the exercise type is separate). */
  | {
      kind: "breathing";
      title: string;
      prompt: string;
      inhaleSec: number;
      holdSec: number;
      exhaleSec: number;
      rounds: number;
    }
  /** Several labelled sliders scored together. */
  | {
      kind: "sliders";
      title: string;
      prompt: string;
      sliders: { id: string; label: string; minLabel: string; maxLabel: string }[];
    }
  /** 5-4-3-2-1 style sensory grounding. */
  | { kind: "grounding"; title: string; prompt: string; senses: { label: string; count: number }[] }
  /** Pick a response and get feedback on it. */
  | {
      kind: "decision";
      title: string;
      prompt: string;
      choices: { label: string; feedback: string; good?: boolean }[];
    };

// ---------------------------------------------------------------------------
// Exercises — standalone tools, reachable without a lesson
// ---------------------------------------------------------------------------

export type ExerciseType =
  | "timer"
  | "breathing"
  | "checklist"
  | "worksheet"
  | "mapper"
  | "calculator"
  | "scale";

export type ExerciseContent =
  | { type: "timer"; seconds: number; prompts: string[]; closing?: string }
  | {
      type: "breathing";
      inhaleSec: number;
      holdSec: number;
      exhaleSec: number;
      holdAfterSec: number;
      cycles: number;
    }
  | { type: "checklist"; intro: string; items: string[]; closing?: string }
  | {
      type: "worksheet";
      intro: string;
      fields: {
        id: string;
        label: string;
        placeholder?: string;
        multiline?: boolean;
        /** Tappable suggested answers; the field stays free-text. */
        options?: string[];
      }[];
    }
  | {
      type: "mapper";
      intro: string;
      columns: { id: string; label: string; hint: string; suggestions?: string[] }[];
    }
  | {
      type: "calculator";
      intro: string;
      rows: { id: string; label: string }[];
      totalLabel: string;
      againstLabel: string;
      /** When present, income is itemised instead of a single figure. */
      incomeRows?: { id: string; label: string }[];
      closing?: string;
    }
  | {
      type: "scale";
      intro: string;
      min: number;
      max: number;
      minLabel: string;
      maxLabel: string;
      bands: { upTo: number; label: string; guidance?: string; moves?: string[] }[];
    };

export interface Exercise {
  id: string;
  title: string;
  subtitle: string;
  minutes: number;
  type: ExerciseType;
  tags: string[];
  /** Why a clinician would hand this to someone. */
  purpose: string;
  content: ExerciseContent;
  populations?: PopulationTrack[];
  part2Sensitive?: boolean;
  placeholder?: boolean;
}

// ---------------------------------------------------------------------------
// Progress — the shapes the patient record stores. Declared here so the store
// and the UI share one definition.
// ---------------------------------------------------------------------------

/** Where a saved toolkit entry came from. */
export type ToolkitOrigin = "library" | "exercise";

export interface SavedToolkitItem {
  /** The source lesson/exercise id — one saved entry per source, idempotent. */
  id: string;
  label: string;
  from: ToolkitOrigin;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// SEED CONTENT — "Starting Strong"
//
// PLACEHOLDER TEXT, deliberately and visibly flagged (`placeholder: true`).
// The category and all ten lesson ids/titles below are the REAL structure from
// the source; three lessons and two exercises are written out end-to-end so
// the architecture is provably correct. Mitch is supplying the real full-text
// content for all ten lessons and all eleven exercises next; replacing the
// bodies is a content edit, not a schema change.
// ---------------------------------------------------------------------------

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  {
    id: "starting-strong",
    name: "Starting Strong",
    desc: "The first steps: steadying the day, the body, and the mind.",
    icon: "Sunrise",
    clinicalTarget:
      "Behavioral activation, arousal regulation, sleep hygiene and early stability planning.",
    order: 1,
  },
];

/** Every lesson in the Starting Strong sequence, in order. */
export const LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: "ss-finding-my-footing",
    categoryId: "starting-strong",
    title: "Finding My Footing",
    minutes: 8,
    order: 1,
    problem:
      "PLACEHOLDER. The first days after release don't feel free — they feel loud. Everything is a decision, and none of the old routines fit.",
    learnTitle: "Why the first weeks feel harder than you expected",
    learnBody:
      "PLACEHOLDER. Your nervous system spent a long time adapted to a place where the day was decided for you. Coming out, that same system has to make hundreds of small choices an hour. That is not weakness — it is load. Footing comes back by shrinking the number of decisions, not by trying harder.",
    activity: {
      kind: "checklist",
      prompt: "Which of these are true for you this week?",
      items: [
        "I don't know what my day is supposed to look like",
        "I'm avoiding places with a lot of people",
        "I'm sleeping at odd hours",
        "I have paperwork I haven't opened",
      ],
    },
    adelReflection:
      "PLACEHOLDER. Adel: I've sat with a lot of people in week one. Nobody has ever told me it felt like relief the whole time.",
    adelQuestion: "What is the one thing that has felt hardest this week?",
    insight: "Footing is built from fewer decisions, not more effort.",
    action: "Pick one hour tomorrow that is already decided before you wake up.",
    toolkitLabel: "My one decided hour",
    // Directly about release. Gated to the justice-involved tracks.
    populations: ["pre_release_ji", "post_release_ji"],
    placeholder: true,
  },
  {
    id: "ss-daily-rhythm",
    categoryId: "starting-strong",
    title: "Creating My Daily Rhythm",
    minutes: 7,
    order: 2,
    problem:
      "PLACEHOLDER. Some days disappear. You look up and it's evening and you can't say where the hours went.",
    learnTitle: "Anchors beat schedules",
    learnBody:
      "PLACEHOLDER. A schedule fails the first time a day goes sideways. Anchors don't. Three fixed points — a wake time, one meal, one wind-down — hold the shape of a day even when everything between them changes.",
    activity: {
      kind: "write",
      prompt: "Write your three anchors: a wake time, one meal, one wind-down.",
      lines: 3,
      placeholder: "e.g. Up at 7 · Lunch at noon · Lights down at 10",
    },
    adelReflection:
      "PLACEHOLDER. Adel: I don't plan my whole day. I plan three moments and let the rest come to me.",
    adelQuestion: "Which of your three anchors will be hardest to keep?",
    insight: "Three fixed points are enough to hold a day.",
    action: "Keep all three anchors for two days in a row.",
    toolkitLabel: "My three daily anchors",
    placeholder: true,
  },
  {
    id: "ss-calming-my-mind",
    categoryId: "starting-strong",
    title: "Calming My Mind",
    minutes: 6,
    order: 3,
    problem:
      "PLACEHOLDER. Your thoughts are moving faster than you are, and telling yourself to relax makes it worse.",
    learnTitle: "You calm the body first",
    learnBody:
      "PLACEHOLDER. A racing mind is usually downstream of an activated body. Slowing the out-breath tells the body the emergency is over, and the mind follows a minute or two later. That order matters: body first, thoughts second.",
    activity: {
      kind: "rate",
      prompt: "Right now, how fast is your mind moving?",
      min: 0,
      max: 10,
      minLabel: "Still",
      maxLabel: "Racing",
    },
    adelReflection:
      "PLACEHOLDER. Adel: I stopped arguing with my thoughts. I just make my breath longer and wait for them to get bored.",
    adelQuestion: "Where in your body do you feel it first when your mind speeds up?",
    insight: "A longer out-breath is the fastest way in.",
    action: "Use Box Breathing once today before you need it.",
    toolkitLabel: "My early warning body signal",
    placeholder: true,
  },
  ...(
    [
      ["ss-managing-overwhelm", "Managing Overwhelm", 4, 7],
      ["ss-managing-worry", "Managing Worry", 5, 7],
      ["ss-grounding-myself", "Grounding Myself", 6, 5],
      ["ss-managing-big-feelings", "Managing Big Feelings", 7, 8],
      ["ss-creating-safety", "Creating Safety in My Life", 8, 8],
      ["ss-restoring-sleep", "Restoring Healthy Sleep", 9, 9],
      ["ss-stability-plan", "Building My Stability Plan", 10, 10],
    ] as const
  ).map(([id, title, order, minutes]) => stubLesson(id, title, order, minutes)),
];

/**
 * The remaining seven Starting Strong lessons exist as REAL, ordered entries
 * with their real titles, carrying an unmistakable placeholder body. They are
 * listed rather than omitted so the sequence, the counts and the progress math
 * are correct today and the follow-up is a pure text substitution.
 */
function stubLesson(id: string, title: string, order: number, minutes: number): LibraryItem {
  return {
    id,
    categoryId: "starting-strong",
    title,
    minutes,
    order,
    problem: `PLACEHOLDER — awaiting the real "${title}" text.`,
    learnTitle: `PLACEHOLDER — ${title}`,
    learnBody: `PLACEHOLDER. The full evidence-based lesson text for "${title}" is being supplied and will replace this body without any schema change.`,
    activity: {
      kind: "write",
      prompt: `PLACEHOLDER activity for "${title}".`,
      lines: 3,
    },
    adelReflection: "PLACEHOLDER — Adel's reflection is part of the incoming content.",
    adelQuestion: "PLACEHOLDER — what stood out to you here?",
    insight: "PLACEHOLDER insight.",
    action: "PLACEHOLDER action step.",
    toolkitLabel: `${title} — takeaway`,
    placeholder: true,
  };
}

export const EXERCISES: Exercise[] = [
  {
    id: "urge-surfing-timer",
    title: "Urge Surfing",
    subtitle: "Ride the wave for ten minutes without acting on it.",
    minutes: 10,
    type: "timer",
    tags: ["craving", "impulse", "distress tolerance"],
    purpose:
      "PLACEHOLDER. Urges peak and fall. Timing one, rather than fighting it, teaches the body that it ends on its own.",
    content: {
      type: "timer",
      seconds: 600,
      prompts: [
        "Name it: 'this is an urge, not an order.'",
        "Where do you feel it? Put a hand there.",
        "Rate it 0–10. Don't try to change it.",
        "Rate it again. Notice whether it moved.",
      ],
    },
    // The tags are about craving, but the tool itself is not Part 2 content
    // and is offered to everyone; nothing here discloses a diagnosis.
    placeholder: true,
  },
  {
    id: "box-breathing",
    title: "Box Breathing",
    subtitle: "Four counts in, four hold, four out, four hold.",
    minutes: 4,
    type: "breathing",
    tags: ["anxiety", "grounding", "sleep"],
    purpose:
      "PLACEHOLDER. An evenly paced breath with a lengthened out-breath lowers physiological arousal within a couple of minutes.",
    content: { type: "breathing", inhaleSec: 4, holdSec: 4, exhaleSec: 4, holdAfterSec: 4, cycles: 8 },
    placeholder: true,
  },
  ...(
    [
      ["trigger-map", "Trigger Map", "mapper", 12],
      ["thought-record", "Thought Record", "worksheet", 12],
      ["anger-thermometer", "Anger Thermometer", "scale", 6],
      ["support-circle", "Support Circle", "mapper", 8],
      ["budget-basics", "Budget Basics", "calculator", 15],
      ["communication-script", "Communication Script", "worksheet", 10],
      ["if-i-slip-plan", "If I Slip Plan", "worksheet", 12],
      ["warning-signs", "Warning Signs", "checklist", 8],
      ["milestone-reward", "Milestone Reward", "worksheet", 6],
    ] as const
  ).map(([id, title, type, minutes]) => stubExercise(id, title, type, minutes)),
];

function stubExercise(id: string, title: string, type: ExerciseType, minutes: number): Exercise {
  const content: ExerciseContent =
    type === "mapper"
      ? {
          type: "mapper",
          intro: `PLACEHOLDER — the real "${title}" instructions are incoming.`,
          columns: [
            { id: "a", label: "PLACEHOLDER column A", hint: "…" },
            { id: "b", label: "PLACEHOLDER column B", hint: "…" },
          ],
        }
      : type === "checklist"
        ? { type: "checklist", intro: `PLACEHOLDER — "${title}".`, items: ["PLACEHOLDER item"] }
        : type === "scale"
          ? {
              type: "scale",
              intro: `PLACEHOLDER — "${title}".`,
              min: 0,
              max: 10,
              minLabel: "Calm",
              maxLabel: "Peak",
              bands: [
                { upTo: 3, label: "Green", guidance: "PLACEHOLDER guidance." },
                { upTo: 7, label: "Amber", guidance: "PLACEHOLDER guidance." },
                { upTo: 10, label: "Red", guidance: "PLACEHOLDER guidance." },
              ],
            }
          : type === "calculator"
            ? {
                type: "calculator",
                intro: `PLACEHOLDER — "${title}".`,
                rows: [{ id: "r1", label: "PLACEHOLDER row" }],
                totalLabel: "Total",
                againstLabel: "Money coming in",
              }
            : {
                type: "worksheet",
                intro: `PLACEHOLDER — "${title}".`,
                fields: [{ id: "f1", label: "PLACEHOLDER field", multiline: true }],
              };
  return {
    id,
    title,
    subtitle: `PLACEHOLDER — real subtitle incoming.`,
    minutes,
    type,
    tags: ["placeholder"],
    purpose: `PLACEHOLDER. The clinical purpose text for "${title}" is being supplied.`,
    content,
    placeholder: true,
  };
}

// ---------------------------------------------------------------------------
// Pure selectors
// ---------------------------------------------------------------------------

export function getLibraryCategory(id: string): LibraryCategory | undefined {
  return LIBRARY_CATEGORIES.find((c) => c.id === id);
}

export function getLibraryItem(id: string): LibraryItem | undefined {
  return LIBRARY_ITEMS.find((i) => i.id === id);
}

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function itemsInCategory(categoryId: string): LibraryItem[] {
  return LIBRARY_ITEMS.filter((i) => i.categoryId === categoryId).sort((a, b) => a.order - b.order);
}

/**
 * The Phase 2 gate, applied to content. An item with no `populations` is
 * ALWAYS visible — population-neutral is the default and the common case.
 * Otherwise the resolution must be an allowed, CONFIRMED track: an unconfirmed
 * "not sure" answer never surfaces reentry-specific copy.
 */
export function isLibraryItemVisible(
  item: { populations?: PopulationTrack[] },
  resolution: PopulationResolution,
): boolean {
  if (!item.populations || item.populations.length === 0) return true;
  // Identical to `isPopulationAllowed(resolution, item.populations)` with the
  // default `requireConfirmed: true`.
  return item.populations.includes(resolution.track) && !resolution.provisional;
}

export function visibleItemsInCategory(
  categoryId: string,
  resolution: PopulationResolution,
): LibraryItem[] {
  return itemsInCategory(categoryId).filter((i) => isLibraryItemVisible(i, resolution));
}

export function visibleExercises(resolution: PopulationResolution): Exercise[] {
  return EXERCISES.filter((e) => isLibraryItemVisible(e, resolution));
}

/** Completion math for one category, against the patient's visible set. */
export function categoryProgress(
  categoryId: string,
  completedItemIds: readonly string[],
  resolution: PopulationResolution,
): { total: number; completed: number; pct: number } {
  const items = visibleItemsInCategory(categoryId, resolution);
  const completed = items.filter((i) => completedItemIds.includes(i.id)).length;
  return {
    total: items.length,
    completed,
    pct: items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
  };
}
