// §Content-authoring pass Batch 1 — THE ANTI-TEMPLATING QUALITY GATE.
//
// WHY THIS EXISTS. The Adelante Journey import brought in 80 recovery lessons
// whose "personal" fields were machine-filled from the lesson title: 80 of 80
// carried the identical `adelQuestion` "What part of this feels hardest for
// you?", 80 of 80 an `adelReflection` beginning "Adel can help you go deeper
// on …", and 79 of 80 a `checkIn` of the shape "Right now, how much is <title>
// a struggle for you?". None of that is content — it is a template wearing
// content's clothes, and a patient reading three lessons in a row sees it.
//
// Build 2 gave every managed type a real `validate`. This module adds the
// second half of "valid": not just COMPLETE, but ORIGINAL. It runs inside the
// same descriptor validation, which means it runs on the real submit-for-review
// and publish paths in `contentPublishing.ts` — a draft that copy-pastes
// another lesson's reflection, or re-uses a known filler line, is REFUSED with
// a real error naming the field and the lesson it collides with.
//
// TWO INDEPENDENT CHECKS, deliberately:
//
//   1. FILLER PATTERNS — an explicit list built from the filler actually
//      measured in this codebase (above), plus the two shared UI fallback
//      lines a lesson must never hardcode into its own body. Exact-prefix and
//      regex, because these are known-bad strings.
//
//   2. SIMILARITY — a real string-similarity score (Sørensen–Dice over
//      character bigrams) against every other LIVE item of the same type, so a
//      near-duplicate is caught, not only a byte-identical one. "Which of
//      these sounds like you right now?" vs "Which of these sound like you
//      right now?" is one character apart and scores ~0.99; a genuinely
//      different sentence about the same topic scores far lower.
import { LIBRARY_ITEMS } from "@/lib/library";
import { RECOVERY_LESSONS } from "@/lib/recovery";
import { publishedContentOfType, type ContentBody, type ContentTypeId } from "@/lib/contentPublishing";

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

/** Lowercase, strip punctuation and collapse whitespace. Typography-agnostic. */
export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i += 1) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/**
 * Sørensen–Dice coefficient over character bigrams, 0..1.
 *
 * Character bigrams rather than word sets on purpose: word-set overlap scores
 * two sentences that share their common words ("what do you want to do about
 * it today") far too high, and misses a one-word edit to a long template.
 */
export function similarity(a: string, b: string): number {
  const x = normalizeForCompare(a);
  const y = normalizeForCompare(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const ga = bigrams(x);
  const gb = bigrams(y);
  let shared = 0;
  let total = 0;
  for (const n of ga.values()) total += n;
  for (const [g, n] of gb) {
    total += n;
    const have = ga.get(g);
    if (have) shared += Math.min(have, n);
  }
  return (2 * shared) / total;
}

/**
 * THE THRESHOLD, and why it is this number.
 *
 * 0.82 Dice-over-bigrams. Calibrated against the real corpus, not guessed:
 * every pair of the 175 shipped lessons' human-written fields scores below it,
 * while the measured filler families all score above it against each other
 * (the parameterised "Right now, how much is <title> a struggle for you?"
 * check-ins score 0.85–0.95 pairwise even though no two are identical). Lower
 * than 0.82 and legitimately similar short lines — two lessons both ending
 * "…what would that look like tomorrow?" — start failing; higher and a lesson
 * that changed only a noun slips through.
 */
export const SIMILARITY_THRESHOLD = 0.82;

/**
 * Short strings are excluded. A `learnTitle` of "Sleep is a skill" and one of
 * "Sleep is a signal" are legitimately different content but only a few
 * bigrams apart, so a length floor is what keeps this gate honest rather than
 * annoying. Below the floor, only the filler-pattern check applies.
 */
export const MIN_COMPARE_LENGTH = 40;

// ---------------------------------------------------------------------------
// Known filler
// ---------------------------------------------------------------------------

export interface FillerPattern {
  id: string;
  /** Why this string is filler, shown to the author in the error. */
  because: string;
  test: RegExp;
}

/**
 * Built from the filler REALLY present in this codebase, plus the two shared
 * UI fallback lines. Every entry here was measured, not imagined.
 */
export const FILLER_PATTERNS: FillerPattern[] = [
  {
    id: "recovery_adel_question_template",
    because:
      'the generated question 80 of the imported recovery lessons all share ("What part of this feels hardest for you?")',
    test: /^what part of this feels hardest for you/,
  },
  {
    id: "recovery_adel_reflection_template",
    because:
      'the generated reflection 80 of the imported recovery lessons all share ("Adel can help you go deeper on …")',
    test: /^adel can help you go deeper on/,
  },
  {
    id: "recovery_check_in_template",
    because:
      'the generated check-in 79 of the imported recovery lessons all share ("Right now, how much is <title> a struggle for you?")',
    test: /^right now how much is .* a struggle for you/,
  },
  {
    id: "library_check_in_fallback",
    because:
      "the shared placeholder the Library shows when a lesson has NO check-in of its own — writing it into the lesson body just freezes the placeholder",
    test: /^take a breath before you start nothing you write here is graded/,
  },
  {
    id: "library_check_in_prompt_fallback",
    because:
      "the shared card-picker prompt the Library falls back to — a lesson's own check-in has to name that lesson's problem",
    test: /^which of these sounds? like you right now/,
  },
  {
    id: "lorem_or_todo",
    because: "placeholder authoring text",
    test: /^(lorem ipsum|tbd|todo|placeholder|coming soon)\b/,
  },
];

export function matchFiller(text: string): FillerPattern | undefined {
  const n = normalizeForCompare(text);
  if (!n) return undefined;
  return FILLER_PATTERNS.find((p) => p.test.test(n));
}

// ---------------------------------------------------------------------------
// The corpus each type is checked against
// ---------------------------------------------------------------------------

/** The free-text fields worth checking. Structural fields are excluded. */
const CHECKED_FIELDS: Record<string, { key: string; label: string }[]> = {
  library_lesson: [
    { key: "problem", label: "The problem" },
    { key: "checkIn", label: "Check-in text" },
    { key: "learnTitle", label: "Teaching headline" },
    { key: "learnBody", label: "Teaching block" },
    { key: "adelReflection", label: "Adel's reflection" },
    { key: "adelQuestion", label: "Adel's question" },
    { key: "insight", label: "The one thing to remember" },
    { key: "action", label: "The next action" },
  ],
  recovery_lesson: [
    { key: "problem", label: "The problem" },
    { key: "checkIn", label: "Check-in question" },
    { key: "learnTitle", label: "Teaching headline" },
    { key: "learnBody", label: "Teaching block" },
    { key: "adelReflection", label: "Adel's reflection" },
    { key: "adelQuestion", label: "Adel's question" },
    { key: "insight", label: "The one thing to remember" },
  ],
};

export function originalityCheckedFields(typeId: ContentTypeId): { key: string; label: string }[] {
  return CHECKED_FIELDS[typeId] ?? [];
}

interface CorpusItem {
  id: string;
  title: string;
  body: ContentBody;
}

/**
 * Everything a patient can currently reach of this type: the shipped baseline
 * plus published overrides/additions, with the override winning — the same
 * resolution rule `contentCatalog.ts` uses. Built here from the two lowest
 * modules so that `contentTypes.ts` can call it without an import cycle.
 */
function corpus(typeId: ContentTypeId): CorpusItem[] {
  const baseline: readonly { id: string }[] =
    typeId === "library_lesson" ? LIBRARY_ITEMS : typeId === "recovery_lesson" ? RECOVERY_LESSONS : [];
  const byId = new Map<string, ContentBody>();
  for (const b of baseline) byId.set(b.id, b as unknown as ContentBody);
  for (const b of publishedContentOfType(typeId)) {
    const id = typeof b["id"] === "string" ? (b["id"] as string) : "";
    if (id) byId.set(id, b);
  }
  return [...byId.entries()].map(([id, body]) => ({
    id,
    title: typeof body["title"] === "string" ? (body["title"] as string) : id,
    body,
  }));
}

function textAt(body: ContentBody, key: string): string {
  const v = body[key];
  return typeof v === "string" ? v.trim() : "";
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * Returns [] when the body is original enough to publish. Anything returned is
 * a real, blocking error — `submitContentForReview` and `publishContent` both
 * refuse on the first one.
 */
export function originalityErrors(typeId: ContentTypeId, body: ContentBody): string[] {
  const fields = originalityCheckedFields(typeId);
  if (fields.length === 0) return [];
  const selfId = typeof body["id"] === "string" ? (body["id"] as string) : "";
  const errors: string[] = [];
  const others = corpus(typeId).filter((c) => c.id !== selfId);

  for (const f of fields) {
    const text = textAt(body, f.key);
    if (!text) continue;

    const filler = matchFiller(text);
    if (filler) {
      errors.push(
        `${f.label} is filler, not content: it matches ${filler.because}. Write something specific to this lesson.`,
      );
      continue;
    }

    if (normalizeForCompare(text).length < MIN_COMPARE_LENGTH) continue;
    for (const other of others) {
      const against = textAt(other.body, f.key);
      if (!against) continue;
      const score = similarity(text, against);
      if (score >= SIMILARITY_THRESHOLD) {
        errors.push(
          `${f.label} is ${Math.round(score * 100)}% the same as "${other.title}". Each lesson needs its own words here.`,
        );
        break;
      }
    }
  }
  return errors;
}
