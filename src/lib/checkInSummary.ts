// §Build A item 3 — the rules-based check-in summary.
//
// PURE and store-free on purpose: no Adel call, no LLM, no network. Given the
// emotions a patient just selected, this picks ONE reflection line, ONE
// existing Library category and ONE existing Resource category. It invents no
// content — the caller resolves a real live lesson / real verified resource
// from those category ids, and renders nothing if either is empty.
import type { EmotionId } from "@/lib/selfTracking";
import { CHECK_IN_COPY } from "@/lib/checkInCopy";

export interface CheckInSummaryPlan {
  emotion: EmotionId;
  /** Acknowledgement in the patient's own terms. Never scored, never clinical. */
  reflection: string;
  /** An id from LIBRARY_CATEGORIES. */
  libraryCategoryId: string;
  /** An id from RESOURCE_CATEGORIES. */
  resourceCategoryId?: string;
  /** Why this resource category — shown so the suggestion isn't a mystery. */
  resourceReason?: string;
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
  "calm",
  "okay",
];

const PLANS: Record<EmotionId, Omit<CheckInSummaryPlan, "emotion">> = {
  calm: { reflection: CHECK_IN_COPY.en.reflections.calm, libraryCategoryId: "success-plan" },
  okay: { reflection: CHECK_IN_COPY.en.reflections.okay, libraryCategoryId: "starting-strong" },
  craving: {
    reflection: "",
    libraryCategoryId: "strengthen-recovery",
    resourceCategoryId: "recovery_meetings",
    resourceReason: "",
  },
  depressed: {
    reflection: "",
    libraryCategoryId: "understanding",
    resourceCategoryId: "healthcare",
    resourceReason: "",
  },
  angry: {
    reflection: "",
    libraryCategoryId: "big-emotions",
    resourceCategoryId: "support_groups",
    resourceReason: "",
  },
  overwhelmed: {
    reflection: "",
    libraryCategoryId: "starting-strong",
    resourceCategoryId: "life_skills",
    resourceReason: "",
  },
  anxious: {
    reflection: "",
    libraryCategoryId: "train-mind",
    resourceCategoryId: "healthcare",
    resourceReason: "",
  },
  stressed: {
    reflection: "",
    libraryCategoryId: "train-mind",
    resourceCategoryId: "financial",
    resourceReason: "",
  },
  exhausted: {
    reflection: "",
    libraryCategoryId: "starting-strong",
    resourceCategoryId: "healthcare",
    resourceReason: "",
  },
  lonely: {
    reflection: "",
    libraryCategoryId: "support-team",
    resourceCategoryId: "support_groups",
    resourceReason: "",
  },
  hopeful: {
    reflection: "",
    libraryCategoryId: "success-plan",
    resourceCategoryId: "employment",
    resourceReason: "",
  },
};

/** The single plan for a set of selected emotions. Undefined when none given. */
export function checkInSummaryPlan(emotions: EmotionId[], lang: "en" | "es" = "en"): CheckInSummaryPlan | undefined {
  const picked = PRIORITY.find((e) => emotions.includes(e));
  if (!picked) return undefined;
  const plan = PLANS[picked];
  return { ...plan, emotion: picked, reflection: CHECK_IN_COPY[lang].reflections[picked], resourceReason: picked === "calm" || picked === "okay" ? undefined : CHECK_IN_COPY[lang].resourceReasons[picked] };
}
