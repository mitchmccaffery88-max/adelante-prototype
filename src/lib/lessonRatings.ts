// §Lesson-player Phase C — before/after rating dimensions.
//
// ZERO new authored content. Every lesson gets the SAME shared default set of
// two dimensions, plus at most ONE primary dimension derived from the lesson's
// own already-authored `checkIn` text when its real words point at a named
// feeling. Nothing here invents per-lesson labels — that is Phase D.
//
// `higherIsBetter` is what makes a delta honest: "confidence" going up is an
// improvement, "how heavy this feels" going up is not. The tile colour is
// computed from the dimension, never from the raw sign of the change.
import type { LessonRatingOverride } from "@/lib/lessonAuthoring";


export interface RatingDimension {
  id: string;
  label: string;
  /** Anchor for score 1. */ lowLabel: string;
  /** Anchor for score 5. */ highLabel: string;
  /** FALSE for distress-style scales, where a lower score is the good outcome. */
  higherIsBetter: boolean;
}

export const RATING_SCALE_MIN = 1;
export const RATING_SCALE_MAX = 5;

/** The shared set every lesson gets, in both Library and Recovery. */
export const DEFAULT_RATING_DIMENSIONS: RatingDimension[] = [
  {
    id: "confidence",
    label: "Confidence I can handle this",
    lowLabel: "Not at all",
    highLabel: "Very confident",
    higherIsBetter: true,
  },
  {
    id: "distress",
    label: "How heavy this feels right now",
    lowLabel: "Light",
    highLabel: "Very heavy",
    higherIsBetter: false,
  },
];

/**
 * Primary dimensions, keyed off real words that already appear in authored
 * check-in text. First match wins; a lesson with no signal simply gets the
 * shared pair above.
 */
const PRIMARY_RULES: { words: string[]; dimension: RatingDimension }[] = [
  {
    words: ["crav", "urge", "use again", "using"],
    dimension: {
      id: "urge",
      label: "How strong the urge is",
      lowLabel: "Quiet",
      highLabel: "Very strong",
      higherIsBetter: false,
    },
  },
  {
    words: ["anxious", "anxiety", "nervous", "panic", "stress", "overwhelm"],
    dimension: {
      id: "calm",
      label: "How calm I feel",
      lowLabel: "Not calm",
      highLabel: "Calm",
      higherIsBetter: true,
    },
  },
  {
    words: ["alone", "lonely", "isolat", "nobody", "no one"],
    dimension: {
      id: "connected",
      label: "How connected I feel",
      lowLabel: "On my own",
      highLabel: "Supported",
      higherIsBetter: true,
    },
  },
  {
    words: ["angry", "anger", "rage", "resent", "temper"],
    dimension: {
      id: "anger",
      label: "How much anger I'm carrying",
      lowLabel: "None",
      highLabel: "A lot",
      higherIsBetter: false,
    },
  },
  {
    words: ["shame", "guilt", "worthless", "failure", "embarrass"],
    dimension: {
      id: "shame",
      label: "How much shame I'm carrying",
      lowLabel: "None",
      highLabel: "A lot",
      higherIsBetter: false,
    },
  },
  {
    words: ["hope", "future", "worth it", "give up", "point of"],
    dimension: {
      id: "hope",
      label: "How hopeful I feel",
      lowLabel: "Not hopeful",
      highLabel: "Hopeful",
      higherIsBetter: true,
    },
  },
  {
    words: ["scared", "afraid", "fear", "worried", "worry"],
    dimension: {
      id: "fear",
      label: "How scared I feel about this",
      lowLabel: "Not scared",
      highLabel: "Very scared",
      higherIsBetter: false,
    },
  },
];

/**
 * The dimensions for one lesson: the primary followed by the shared default
 * pair. Deterministic, so a patient's "before" and "after" always line up on
 * the same scales.
 *
 * §Phase D item 1 — an OPTIONAL authored override takes precedence over the
 * Phase C derivation. When no label is authored (the state every lesson ships
 * in) the derivation below is used exactly as before.
 */
export function dimensionsForLesson(
  checkIn?: string,
  override?: LessonRatingOverride,
): RatingDimension[] {
  const authored = override?.label?.trim();
  const primary = authored
    ? ({
        id: "authored",
        label: authored,
        lowLabel: override?.lowLabel?.trim() || "Not at all",
        highLabel: override?.highLabel?.trim() || "Very much",
        higherIsBetter: !override?.higherIsHarder,
      } satisfies RatingDimension)
    : derivedPrimary(checkIn);
  if (!primary) return DEFAULT_RATING_DIMENSIONS;
  return [primary, ...DEFAULT_RATING_DIMENSIONS.filter((d) => d.id !== primary.id)];
}

/** Phase C's derivation, unchanged — now the fallback when nothing is authored. */
function derivedPrimary(checkIn?: string): RatingDimension | undefined {
  const hay = (checkIn ?? "").toLowerCase();
  if (!hay) return undefined;
  return PRIMARY_RULES.find((r) => r.words.some((w) => hay.includes(w)))?.dimension;
}


export type DeltaVerdict = "better" | "worse" | "same" | "incomplete";

/** How a before → after change reads FOR THAT DIMENSION. */
export function deltaVerdict(
  dimension: RatingDimension,
  before: number | undefined,
  after: number | undefined,
): DeltaVerdict {
  if (typeof before !== "number" || typeof after !== "number") return "incomplete";
  const diff = after - before;
  if (diff === 0) return "same";
  const improved = dimension.higherIsBetter ? diff > 0 : diff < 0;
  return improved ? "better" : "worse";
}
