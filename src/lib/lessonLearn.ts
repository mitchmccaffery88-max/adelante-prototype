// §Lesson-player Phase D — RESOLUTION ORDER FOR THE TEACHING STEP.
//
// One rule, in one place, used by both lesson adapters:
//
//   1. `enrichment`   — the four-part structure, when any part is authored
//   2. `learnStages`  — an author-defined sequence of panels
//   3. `learnBody`    — the single block every lesson has today (the fallback)
//
// Nothing is invented here: the section headings for the enrichment parts are
// UI labels supplied by the caller (so they translate), and each part is only
// emitted when the author actually wrote something into it.
import {
  hasEnrichment,
  usableStages,
  type LearnStage,
  type LessonEnrichment,
} from "@/lib/lessonAuthoring";

/** UI labels for the four enrichment parts, passed in from `t()`. */
export interface EnrichmentLabels {
  happening: string;
  why: string;
  canChange: string;
  beforeMovingOn: string;
}

export interface LearnSource {
  learnBody: string;
  learnStages?: LearnStage[];
  enrichment?: LessonEnrichment;
}

function stage(title: string, body: string): LearnStage | null {
  return body.trim() ? { title, body } : null;
}

/**
 * The panels the teaching step should show. An empty array means "no stages" —
 * the caller renders `learnBody` as the single block it renders today.
 */
export function resolveLearnStages(
  source: LearnSource,
  labels: EnrichmentLabels,
): LearnStage[] {
  const e = source.enrichment;
  if (hasEnrichment(e) && e) {
    const parts: (LearnStage | null)[] = [
      stage(e.happening?.headline?.trim() || labels.happening, e.happening?.body ?? ""),
      stage(
        e.why?.headline?.trim() || labels.why,
        [e.why?.body ?? "", e.approach?.trim() ? `— ${e.approach.trim()}` : ""]
          .filter(Boolean)
          .join("\n\n"),
      ),
      stage(e.canChange?.headline?.trim() || labels.canChange, e.canChange?.body ?? ""),
      stage(
        labels.beforeMovingOn,
        [e.takeaway ?? "", e.reflection ?? ""].filter((x) => x.trim()).join("\n\n"),
      ),
    ];
    const stages = parts.filter((p): p is LearnStage => p !== null);
    if (stages.length > 0) return stages;
  }
  return usableStages(source.learnStages);
}
