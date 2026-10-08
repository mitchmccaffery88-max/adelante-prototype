import { getEngagement } from "./engagement";
import { liveLibraryItem, liveRecoveryLesson } from "./contentCatalog";
import { taggedItem, taggedCatalog } from "./contentTags";

export function latestInProgress(patientId: string, lang: "en" | "es" = "en") {
  const row = getEngagement(patientId);
  return Object.entries(row?.lessonResponses ?? {}).map(([key, response]) => {
    const split = key.indexOf(":");
    const surface = key.slice(0, split);
    const id = key.slice(split + 1);
    const item = surface === "library" ? liveLibraryItem(id) : surface === "recovery" ? liveRecoveryLesson(id) : undefined;
    const complete = surface === "library" ? row?.completedLibraryItems.includes(id) : row?.completedRecoveryLessons.includes(id);
    return item && !complete && !response.finishedAt && response.stepIndex !== undefined ? { id, surface, title: lang === "es" ? taggedItem(id)?.titleEs ?? "Español próximamente" : item.title, response, to: surface === "library" ? "/library" as const : "/recovery-journey" as const, search: surface === "library" ? { item: id } : { lesson: id } } : undefined;
  }).filter((r) => r !== undefined).sort((a, b) => b.response.updatedAt.localeCompare(a.response.updatedAt))[0];
}
export function latestTodayAction(patientId: string) {
  return Object.entries(getEngagement(patientId)?.lessonResponses ?? {}).map(([key, response]) => ({ id: key.slice(key.indexOf(":") + 1), response })).filter((r) => r.response.todayAction).sort((a, b) => b.response.updatedAt.localeCompare(a.response.updatedAt))[0];
}
/** Suggestions depend on published metadata, never fixed lesson ids. */
export function relatedPlayerContent(id: string, lang: "en" | "es" = "en") {
  const source = taggedItem(id);
  if (!source) return [];
  return taggedCatalog().filter((item) => item.id !== id && item.kind !== "module" && ["sdoh", "bands", "asam", "stages", "populations"].some((key) => {
    const a = source.meta[key as "sdoh"] as unknown[] | undefined;
    const b = item.meta[key as "sdoh"] as unknown[] | undefined;
    return a?.some((tag) => b?.includes(tag));
   })).slice(0, 2).map((item) => ({ label: lang === "es" ? item.titleEs ?? "Español próximamente" : item.title, to: item.to, search: item.search, reason: lang === "es" ? "Borrador — temas relacionados" : "Draft — matching content tags" }));
}