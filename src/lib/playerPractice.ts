import type { LibraryItem } from "./library";
import { liveExercise } from "./contentCatalog";
import { taggedItem, taggedCatalog } from "./contentTags";
import type { ExerciseMatch } from "./recovery.exerciseMatch";

/** Live C3 tags match a practice; with no overlap there is no empty step. */
export function matchExerciseForLibraryLesson(item: LibraryItem): ExerciseMatch | undefined {
  const meta = taggedItem(item.id)?.meta;
  if (!meta) return undefined;
  const match = taggedCatalog().find((candidate) => candidate.kind === "exercise" && ["sdoh", "bands", "asam", "stages"].some((key) => {
    const source = meta[key as "sdoh"] as unknown[] | undefined;
    const target = candidate.meta[key as "sdoh"] as unknown[] | undefined;
    return source?.some((value) => target?.includes(value));
  }));
  const exercise = match ? liveExercise(match.id) : undefined;
  return exercise ? { exercise, tier: "keyword" } : undefined;
}