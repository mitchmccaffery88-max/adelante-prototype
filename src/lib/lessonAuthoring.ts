// §Lesson-player Phase D — SHARED OPTIONAL AUTHORING STRUCTURES.
//
// ARCHITECTURE ONLY. Every type in this module is optional on both lesson
// models, ships EMPTY on all 180 lessons, and has a real fallback in the
// renderer. Nothing here contains lesson content: Cathy authors all of it
// through `/admin-content`, lesson by lesson, after this build.
//
// It lives in its own module (rather than in `library.ts`) because both
// `library.ts` and `recovery.ts` need the same shapes, the admin descriptors
// need them, and the renderer needs them — one definition, no cycle.

/**
 * §Phase D item 1 — an OPTIONAL per-lesson override of the primary rating
 * dimension. Phase C derives a primary dimension from the lesson's own
 * check-in wording; that derivation stays as the fallback and is used
 * whenever `label` is empty.
 *
 * `higherIsHarder` is stated the way a clinician reads a scale ("10 is a
 * harder day"), and is inverted into the renderer's `higherIsBetter`. The
 * shared defaults (confidence / heaviness) are always appended after it, so
 * an override adds a dimension rather than removing the comparable pair.
 */
export interface LessonRatingOverride {
  /** Empty/absent → Phase C derivation is used unchanged. */
  label?: string;
  /** Anchor for the low end. Falls back to a neutral shared anchor. */
  lowLabel?: string;
  /** Anchor for the high end. Falls back to a neutral shared anchor. */
  highLabel?: string;
  /** TRUE for distress-style scales, where a HIGHER score is the worse day. */
  higherIsHarder?: boolean;
}

/**
 * §Phase D item 2 — one panel of a sub-paginated teaching block. When a lesson
 * has no stages the renderer shows `learnBody` as the single block it is today.
 */
export interface LearnStage {
  title: string;
  body: string;
}

/**
 * §Phase D item 4 — the if/then implementation-intention picker. Two closed
 * option sets, exactly like the recovery tool flow: what the patient picks is
 * queryable data, not prose. Absent → the lesson keeps the Phase B
 * scenario/decision activity as its only practice surface.
 */
export interface IfThenPractice {
  ifOptions: string[];
  thenOptions: string[];
}

/**
 * §Phase D item 5 — the FOUR-PART enrichment shape, modelled on the reference
 * project's `LearnParts`:
 *   1. what's happening (brain/body, plain words)
 *   2. why it happens (the invisible part)
 *   3. what can change (hope, not shame)
 *   4. before moving on (takeaway + one reflection question)
 *
 * Every part is optional so a half-authored enrichment cannot break a lesson;
 * `hasEnrichment` decides whether the renderer uses it at all.
 */
export interface EnrichmentPart {
  headline?: string;
  body?: string;
}

export interface LessonEnrichment {
  happening?: EnrichmentPart;
  why?: EnrichmentPart;
  /** Optional clinical framing line shown under part 2 ("CBT · Cognitive load"). */
  approach?: string;
  canChange?: EnrichmentPart;
  /** Part 4 — the quotable line. */
  takeaway?: string;
  /** Part 4 — one question, asked but not stored as clinical documentation. */
  reflection?: string;
}

/** The optional Phase D surface, mixed into BOTH lesson models identically. */
export interface LessonAuthoringExtras {
  /** Item 1 — per-lesson primary rating dimension. */
  ratingPrimary?: LessonRatingOverride;
  /** Item 2 — sub-paginated teaching block. */
  learnStages?: LearnStage[];
  /** Item 4 — if/then practice option sets. */
  ifThenPractice?: IfThenPractice;
  /** Item 5 — four-part enrichment of the teaching step. */
  enrichment?: LessonEnrichment;
}

const filled = (s: string | undefined): boolean => Boolean(s && s.trim());

function partFilled(p: EnrichmentPart | undefined): boolean {
  return Boolean(p && (filled(p.headline) || filled(p.body)));
}

/** TRUE when at least one enrichment part carries real authored text. */
export function hasEnrichment(e: LessonEnrichment | undefined): boolean {
  if (!e) return false;
  return (
    partFilled(e.happening) ||
    partFilled(e.why) ||
    partFilled(e.canChange) ||
    filled(e.takeaway) ||
    filled(e.reflection)
  );
}

/**
 * TRUE when BOTH sides of the if/then picker have something to pick. Authored
 * data arrives from the admin tool as a plain body, so a half-built structure
 * (one list present, the other missing) must read as "not authored" rather
 * than throw.
 */
export function hasIfThen(p: IfThenPractice | undefined): boolean {
  if (!p || !Array.isArray(p.ifOptions) || !Array.isArray(p.thenOptions)) return false;
  return p.ifOptions.some((o) => filled(o)) && p.thenOptions.some((o) => filled(o));
}

/** Stages with real text; anything blank is treated as unauthored. */
export function usableStages(stages: LearnStage[] | undefined): LearnStage[] {
  if (!Array.isArray(stages)) return [];
  return stages
    .filter((s) => filled(s?.title) && filled(s?.body))
    .map((s) => ({ title: s.title.trim(), body: s.body }));
}

