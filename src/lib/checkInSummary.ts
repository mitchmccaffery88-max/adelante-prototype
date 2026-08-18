// §Build A item 3 — the rules-based check-in summary.
//
// PURE and store-free on purpose: no Adel call, no LLM, no network. Given the
// emotions a patient just selected, this picks ONE reflection line, ONE
// existing Library category and ONE existing Resource category. It invents no
// content — the caller resolves a real live lesson / real verified resource
// from those category ids, and renders nothing if either is empty.
import type { EmotionId } from "@/lib/selfTracking";

export interface CheckInSummaryPlan {
  emotion: EmotionId;
  /** Acknowledgement in the patient's own terms. Never scored, never clinical. */
  reflection: string;
  /** An id from LIBRARY_CATEGORIES. */
  libraryCategoryId: string;
  /** An id from RESOURCE_CATEGORIES. */
  resourceCategoryId: string;
  /** Why this resource category — shown so the suggestion isn't a mystery. */
  resourceReason: string;
}

/**
 * Heaviest-first. When several emotions are picked we answer the one that
 * most needs answering rather than averaging them into nothing.
 */
const PRIORITY: EmotionId[] = [
  "craving",
  "depressed",
  "angry",
  "overwhelmed",
  "anxious",
  "stressed",
  "exhausted",
  "lonely",
  "hopeful",
];

const PLANS: Record<EmotionId, Omit<CheckInSummaryPlan, "emotion">> = {
  craving: {
    reflection:
      "You named a craving. Naming it is already the hard part — cravings peak and pass, and you don't have to ride this one out on willpower alone.",
    libraryCategoryId: "strengthen-recovery",
    resourceCategoryId: "recovery_meetings",
    resourceReason: "A room full of people who know exactly this hour.",
  },
  depressed: {
    reflection:
      "You said today feels heavy. That's worth taking seriously, and it isn't a failure of effort — it's something you can get real help with.",
    libraryCategoryId: "understanding",
    resourceCategoryId: "healthcare",
    resourceReason: "Somewhere to be seen by a person, not just an app.",
  },
  angry: {
    reflection:
      "Anger showed up today. It usually has a reason behind it, and there are ways to let it move through you without it costing you something.",
    libraryCategoryId: "big-emotions",
    resourceCategoryId: "support_groups",
    resourceReason: "Somewhere to say it out loud with no consequences.",
  },
  overwhelmed: {
    reflection:
      "Too much at once. You don't have to sort all of it — just the next one thing.",
    libraryCategoryId: "starting-strong",
    resourceCategoryId: "life_skills",
    resourceReason: "Practical help with the pile, not just the feeling.",
  },
  anxious: {
    reflection:
      "Anxious today. Your body is running ahead of the facts — that's uncomfortable, not dangerous, and it settles faster with something to do.",
    libraryCategoryId: "train-mind",
    resourceCategoryId: "healthcare",
    resourceReason: "If it keeps up, someone local can help you work on it.",
  },
  stressed: {
    reflection:
      "Stressed. Usually that means something real is pressing on you — worth looking at what's actually on the pile.",
    libraryCategoryId: "train-mind",
    resourceCategoryId: "financial",
    resourceReason: "A lot of stress is money-shaped. There's help for that.",
  },
  exhausted: {
    reflection:
      "Running on empty. Rest isn't a reward you have to earn first.",
    libraryCategoryId: "starting-strong",
    resourceCategoryId: "healthcare",
    resourceReason: "Ongoing exhaustion is worth someone checking on.",
  },
  lonely: {
    reflection:
      "Lonely is one of the hardest ones to say out loud, and you just did. Connection is a skill and a plan, not luck.",
    libraryCategoryId: "support-team",
    resourceCategoryId: "support_groups",
    resourceReason: "People nearby, in person, this week.",
  },
  hopeful: {
    reflection:
      "Hopeful today. Worth noticing — the good days are data too, and they're easier to repeat when you know what made them.",
    libraryCategoryId: "success-plan",
    resourceCategoryId: "employment",
    resourceReason: "A good day is a good day to take a next step.",
  },
};

/** The single plan for a set of selected emotions. Undefined when none given. */
export function checkInSummaryPlan(emotions: EmotionId[]): CheckInSummaryPlan | undefined {
  const picked = PRIORITY.find((e) => emotions.includes(e));
  if (!picked) return undefined;
  return { emotion: picked, ...PLANS[picked] };
}
