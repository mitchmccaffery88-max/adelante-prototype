// §Patient portal Build 2 — the private pattern nudge.
//
// Cathy's `privateNudge()` takes check-in history, craving logs, meds missed
// today, open obligations, days since contact and lapses, and returns ONE
// reflective observation. Three properties of her design are load-bearing and
// are preserved here:
//
//   1. It is REFLECTIVE, never scored. No risk number, no severity, no
//      threshold that "trips". It notices a pattern and says it plainly.
//   2. It is PRIVATE. This module is pure: it takes values in and returns a
//      string out. It has no store, no audit sink, and no EHR import, so it is
//      structurally incapable of writing anywhere staff-visible. Do not add
//      one — the privacy promise printed on the card ("Nobody else sees this")
//      must be true in the code, not just in the copy.
//   3. It never lectures. Tone is observational and warm.
//
// Two of Cathy's six inputs have no real equivalent in this build and are
// therefore ABSENT rather than faked: there is no craving-log entity (only the
// urge-surfing-timer exercise, which records completion, not craving events)
// and no lapse/slip record. See the gap list in the build notes.

export type NudgeTone = "steady" | "noticing" | "gentle";

export interface PrivateNudge {
  /** Stable id so the UI can key/animate without re-deriving the text. */
  id: string;
  text: string;
  tone: NudgeTone;
}

export interface PrivateNudgeInput {
  /** Consecutive check-in days, from `checkInStreakFrom`. */
  streakDays: number;
  /** Whether today already has a check-in. */
  checkedInToday: boolean;
  /** Real scheduled medication slots today with no self-report yet. */
  medsUnmarkedToday: number;
  /** Real scheduled medication slots today, total. */
  medsScheduledToday: number;
  /** Open (incomplete) obligations, from `listObligations`. */
  openObligations: number;
  /** Whole days since the patient's last care-team message, either direction. */
  daysSinceContact?: number;
  /** Distinct check-in days in the trailing 14 days. */
  checkInDaysLast14: number;
}

/**
 * Return at most one observation, most specific first. One card, one thought —
 * a stack of nudges reads as a scorecard, which is exactly what this is not.
 */
export function privateNudge(input: PrivateNudgeInput): PrivateNudge | null {
  const {
    streakDays,
    checkedInToday,
    medsUnmarkedToday,
    medsScheduledToday,
    openObligations,
    daysSinceContact,
    checkInDaysLast14,
  } = input;

  // Medication: only speak when there is a real schedule to speak about.
  if (medsScheduledToday > 0 && medsUnmarkedToday === medsScheduledToday) {
    return {
      id: "meds-unmarked",
      tone: "gentle",
      text: "Today's medication isn't marked yet. No rush — it's here whenever you get to it.",
    };
  }

  if (medsScheduledToday > 0 && medsUnmarkedToday > 0) {
    return {
      id: "meds-partial",
      tone: "gentle",
      text: `You've marked some of today's medication and ${medsUnmarkedToday} ${
        medsUnmarkedToday === 1 ? "is" : "are"
      } still open.`,
    };
  }

  // Contact: a long quiet stretch is worth naming, without implying fault.
  if (daysSinceContact !== undefined && daysSinceContact >= 10) {
    return {
      id: "quiet-stretch",
      tone: "noticing",
      text: `It's been about ${daysSinceContact} days since you and your care team talked. That's allowed — and the thread is still open if you want it.`,
    };
  }

  // Obligations: count only, never the detail. The detail lives on its own card.
  if (openObligations >= 3) {
    return {
      id: "obligations-stacked",
      tone: "noticing",
      text: `You've got ${openObligations} things on your obligations list right now. That's a lot to hold at once — they don't all have to happen today.`,
    };
  }

  // Streaks: celebrate real runs, and be kind about a broken one.
  if (streakDays >= 7) {
    return {
      id: "streak-strong",
      tone: "steady",
      text: `${streakDays} days in a row of checking in. That consistency is yours — nobody handed it to you.`,
    };
  }

  if (streakDays >= 3) {
    return {
      id: "streak-building",
      tone: "steady",
      text: `Three or more days running now. Small and repeated beats big and once.`,
    };
  }

  if (streakDays === 0 && checkInDaysLast14 >= 3) {
    return {
      id: "returning",
      tone: "gentle",
      text: "You've been back a few times in the last couple of weeks. Coming back is the part that counts, not the streak.",
    };
  }

  if (!checkedInToday && checkInDaysLast14 === 0) {
    return {
      id: "first-move",
      tone: "gentle",
      text: "Nothing logged yet. Whenever you're ready, one small check-in is plenty for today.",
    };
  }

  return null;
}
