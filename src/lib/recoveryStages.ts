// §5-stage recovery journey model — PURE. No store access, no React.
//
// TWO THINGS LIVE HERE AND THEY ARE DELIBERATELY DIFFERENT KINDS OF THING:
//
// 1. RECOVERY_STAGE_REVIEW — the clinical sign-off flag, the same real pattern
//    as `SAFETY_CONTENT_REVIEW` (safetyContent.ts) and
//    `ADVOCATE_MESSAGING_REVIEW` (advocateMessaging.ts). The feature is fully
//    built, audited and demo-testable, but every patient-facing surface that
//    renders stage content also renders the pending notice while `pending` is
//    true. Unlike advocate messaging, the write is NOT refused: a stage here is
//    a self-check / care-team note, not a clinical determination, so blocking
//    it would make the feature untestable for no safety gain. Flipping
//    `pending` to false is one edit, here, and needs real sign-off.
//
// 2. RECOVERY_STAGES — the five stages and their real observable signals,
//    transcribed from the source journey model. Signals are REFERENCE content:
//    concrete markers a person can look at and recognise. They are NOT scored,
//    NOT counted, and NOT used to compute or advance a stage anywhere in this
//    codebase.
//
// EXPLICIT NON-GOAL — NO AUTO-DERIVATION. There is deliberately no function in
// this module (or anywhere else) that reads engagement, screener or care-plan
// data and returns a stage. Which stage someone is in is a clinical judgment;
// deriving it from activity counts would be inventing an unvalidated
// instrument. The stage is SET by a person (the patient or their care team)
// and every change is audited and reversible — see `AdelanteEHR.setRecoveryStage`.

export type RecoveryStageId =
  | "stabilizing"
  | "building_strength"
  | "reconnecting"
  | "growing"
  | "thriving";

export interface RecoveryStage {
  id: RecoveryStageId;
  /** 1-based position in the model. Ordering only — not a score. */
  order: number;
  label: string;
  /** One plain-language line about what this stretch is mostly about. */
  blurb: string;
  /** Concrete, observable markers. Reference content, never scored. */
  signals: readonly string[];
}

export const RECOVERY_STAGE_REVIEW = {
  pending: true,
  reviewers: "Christi / Dr. Bagga",
  scope:
    "The five-stage recovery journey model and the observable signals listed under each stage. The stage is person-set and audited, never computed from data, but the model itself and its wording have not been clinically approved for this deployment.",
  notice:
    "Pending clinical review by Christi / Dr. Bagga. These stages are a self-check reference, not a clinical assessment — nothing here is scored or decided for you.",
} as const;

export const RECOVERY_STAGES: readonly RecoveryStage[] = [
  {
    id: "stabilizing",
    order: 1,
    label: "Stabilizing",
    blurb: "Getting the basics steady — somewhere to sleep, papers moving, someone who knows where you are.",
    signals: [
      "A safe place to sleep",
      "ID, benefits and food access in motion",
      "One person who knows where you are",
    ],
  },
  {
    id: "building_strength",
    order: 2,
    label: "Building Strength",
    blurb: "Showing up for yourself on the ordinary days, not just the hard ones.",
    signals: [
      "Checking in 4+ days a week",
      "Meds and appointments kept two weeks running",
      "One coping tool you've actually used",
    ],
  },
  {
    id: "reconnecting",
    order: 3,
    label: "Reconnecting",
    blurb: "People come back into the picture — and you let them.",
    signals: [
      "Regular contact with one trusted person",
      "In a group, meeting or peer circle",
      "One repaired conversation",
    ],
  },
  {
    id: "growing",
    order: 4,
    label: "Growing",
    blurb: "Building forward — work, school, plans with dates on them.",
    signals: [
      "Working, in school, or in training",
      "A goal with a date on it",
      "Handling a hard week without spiraling",
    ],
  },
  {
    id: "thriving",
    order: 5,
    label: "Thriving",
    blurb: "The life is yours, and you have something left over to give.",
    signals: [
      "Off active supervision, or nearly done",
      "Mentoring or supporting someone else",
      "Life feels like yours",
    ],
  },
] as const;

export function recoveryStage(id: RecoveryStageId): RecoveryStage {
  const s = RECOVERY_STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown recovery stage: ${id}`);
  return s;
}

export function isRecoveryStageId(v: unknown): v is RecoveryStageId {
  return typeof v === "string" && RECOVERY_STAGES.some((s) => s.id === v);
}

// ---------------------------------------------------------------------------
// Milestones — warm, real, and derived ONLY from things the person actually did
// ---------------------------------------------------------------------------
//
// This is the one place activity data IS read, and it is deliberately NOT
// stage-related: a milestone says "you did this", it never says "so you're in
// stage N". No points, no badges, no leaderboard, no comparison to anyone.
// Every input below is already computed on the home dashboard from real dated
// patient-authored events (see `checkInStreak.ts` and `engagement.ts`).

export interface RecoveryMilestoneInput {
  /** Consecutive check-in days, from `checkInStreakFrom`. */
  streakDays: number;
  /** Distinct check-in days in the last 14, from the same real sources. */
  checkInDaysLast14: number;
  /** Library lessons finished (population-visible ones the patient can see). */
  lessonsDone: number;
  /** Practice exercises finished. */
  exercisesDone: number;
  /** Tools the patient saved to their own toolkit. */
  toolkitSaved: number;
}

export interface RecoveryMilestone {
  id: string;
  /** The warm headline, e.g. "You've checked in 7 days in a row". */
  title: string;
  /** One line of why it counts. Never a nudge to do more. */
  body: string;
}

const STREAK_TIERS = [30, 14, 7, 3] as const;

/**
 * Milestones the person has ALREADY reached, most meaningful first. Returns an
 * empty list when nothing has been earned yet — an empty state is honest, a
 * fabricated milestone is not.
 */
export function recoveryMilestones(input: RecoveryMilestoneInput): RecoveryMilestone[] {
  const out: RecoveryMilestone[] = [];
  const tier = STREAK_TIERS.find((t) => input.streakDays >= t);
  if (tier) {
    out.push({
      id: `streak_${tier}`,
      title: `You've checked in ${input.streakDays} days in a row`,
      body:
        tier >= 14
          ? "That's a habit now, not a streak. It held through days that weren't easy."
          : "Showing up on the ordinary days is the part that actually builds something.",
    });
  }
  if (input.checkInDaysLast14 >= 8 && !tier) {
    out.push({
      id: "steady_fortnight",
      title: `${input.checkInDaysLast14} check-in days in the last two weeks`,
      body: "Not every day, and it doesn't need to be. You keep coming back.",
    });
  }
  if (input.lessonsDone > 0) {
    out.push({
      id: "lessons",
      title:
        input.lessonsDone === 1
          ? "You finished your first lesson"
          : `You've finished ${input.lessonsDone} lessons`,
      body: "You sat with something hard and worked through it in your own words.",
    });
  }
  if (input.exercisesDone > 0) {
    out.push({
      id: "exercises",
      title:
        input.exercisesDone === 1
          ? "You tried a practice for the first time"
          : `You've done ${input.exercisesDone} practices`,
      body: "Trying a tool once is how you find out which ones are yours.",
    });
  }
  if (input.toolkitSaved > 0) {
    out.push({
      id: "toolkit",
      title: `${input.toolkitSaved} ${input.toolkitSaved === 1 ? "tool" : "tools"} in your toolkit`,
      body: "Things you decided were worth keeping for a harder day.",
    });
  }
  return out;
}
