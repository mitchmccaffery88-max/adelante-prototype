// §Content Management admin tooling — THE LIVE READ PATH.
//
// `src/lib/library.ts` and `src/lib/recovery.ts` stay exactly what they were:
// pure, side-effect-free modules holding the SHIPPED BASELINE content. They
// are imported by `ehr.ts` and `adelPrompt.ts`, and making them store-aware
// would create a runtime cycle and put a mutable store underneath the whole
// EHR. So the overlay lives here instead, in front of them.
//
// RESOLUTION RULE, one place only:
//   published override for an id  →  wins
//   no published override         →  shipped baseline
//   published override with no baseline  →  a genuinely new lesson
// A draft or in-review override NEVER displaces shipped content. That is why
// an admin can edit a live lesson without patients seeing half-written text.
import { useSyncExternalStore } from "react";
import {
  LIBRARY_ITEMS,
  isLibraryItemVisible,
  type LibraryItem,
} from "@/lib/library";
import { RECOVERY_LESSONS, type RecoveryLesson } from "@/lib/recovery";
import type { PopulationResolution } from "@/lib/population";
import {
  publishedContentOfType,
  publishedVersion,
  setContentIntegrityGuard,
  subscribeContent,
  type ContentTypeId,
} from "@/lib/contentPublishing";
import {
  asLibraryItem,
  asRecoveryLesson,
  liveLibraryCategoryList,
  liveRecoveryModuleList,
} from "@/lib/contentTypes";
import { setContentResolver } from "@/lib/engagement";
// Side-effect import: Module 1 lessons 6–10 are authored as PUBLISHED managed
// content rather than shipped-array entries, so they must be seeded before any
// surface resolves the live catalog.
import "@/lib/recovery.firstDaysOut.authored";
// Side-effect import: Starting Strong's step-2 check-ins are authored the same
// way — published overrides of the shipped lessons, not edits to the array.
import "@/lib/library.startingStrong.authored";
// Side-effect import: Module 2's per-lesson check-in, Adel question/reflection
// and tool-flow option sets, authored as published overrides (Batch 2).
import "@/lib/recovery.findingMyPeople.authored";
// Side-effect import: Module 3's per-lesson check-in, Adel question/reflection
// and tool-flow option sets, authored as published overrides (Batch 3).
import "@/lib/recovery.understandingMyAddiction.authored";

export { subscribeContent };

/**
 * Subscribe a patient-facing surface to PUBLISHED content only. Returns the
 * published-version token, so a component re-renders when something is
 * actually published — not while it is being drafted.
 */
export function usePublishedContentVersion(): string {
  return useSyncExternalStore(
    subscribeContent,
    publishedVersion,
    () => "",
  );
}

function overlay<T extends { id: string }>(baseline: readonly T[], overrides: T[]): T[] {
  const byId = new Map<string, T>(baseline.map((b) => [b.id, b]));
  for (const o of overrides) if (o.id) byId.set(o.id, o);
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export function liveLibraryItems(): LibraryItem[] {
  const overrides = publishedContentOfType("library_lesson")
    .map((b) => asLibraryItem(b, String(b["id"] ?? "")))
    .filter((i) => !!i.id);
  return overlay(LIBRARY_ITEMS, overrides);
}

export function liveLibraryItem(id: string): LibraryItem | undefined {
  return liveLibraryItems().find((i) => i.id === id);
}

export function liveItemsInCategory(categoryId: string): LibraryItem[] {
  return liveLibraryItems()
    .filter((i) => i.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);
}

export function liveVisibleItemsInCategory(
  categoryId: string,
  resolution: PopulationResolution,
): LibraryItem[] {
  return liveItemsInCategory(categoryId).filter((i) => isLibraryItemVisible(i, resolution));
}

export function liveCategoryProgress(
  categoryId: string,
  completedIds: readonly string[],
  resolution: PopulationResolution,
): { total: number; completed: number; pct: number } {
  const items = liveVisibleItemsInCategory(categoryId, resolution);
  const completed = items.filter((i) => completedIds.includes(i.id)).length;
  return {
    total: items.length,
    completed,
    pct: items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
  };
}

export function liveLibraryCategories() {
  return liveLibraryCategoryList();
}

// ---------------------------------------------------------------------------
// Recovery modules
// ---------------------------------------------------------------------------

export function liveRecoveryLessons(): RecoveryLesson[] {
  const overrides = publishedContentOfType("recovery_lesson")
    .map((b) => asRecoveryLesson(b, String(b["id"] ?? "")))
    .filter((l) => !!l.id);
  return overlay(RECOVERY_LESSONS, overrides);
}

export function liveRecoveryLesson(id: string): RecoveryLesson | undefined {
  return liveRecoveryLessons().find((l) => l.id === id);
}

export function liveLessonsInModule(moduleId: string): RecoveryLesson[] {
  return liveRecoveryLessons()
    .filter((l) => l.moduleId === moduleId)
    .sort((a, b) => a.order - b.order);
}

export function liveModuleProgress(
  moduleId: string,
  completedLessonIds: readonly string[],
): { total: number; completed: number; pct: number } {
  const lessons = liveLessonsInModule(moduleId);
  const completed = lessons.filter((l) => completedLessonIds.includes(l.id)).length;
  return {
    total: lessons.length,
    completed,
    pct: lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100),
  };
}

/**
 * A module's `contentPending` flag is shipped metadata, but it stops being
 * TRUE the moment a real lesson is published into that module — otherwise the
 * admin tool could add content the patient UI still calls "pending".
 */
export function liveRecoveryModules() {
  return liveRecoveryModuleList().map((m) => ({
    ...m,
    contentPending: m.contentPending && liveLessonsInModule(m.id).length === 0,
  }));
}

export function liveRecoveryModule(id: string) {
  return liveRecoveryModules().find((m) => m.id === id);
}

// Register this module as the engagement store's lesson resolver, so
// completing a NEWLY PUBLISHED lesson finds its toolkit label and tool-flow
// option sets instead of silently no-op'ing against the baseline arrays.
setContentResolver({
  libraryItem: liveLibraryItem,
  recoveryLesson: liveRecoveryLesson,
});

// ---------------------------------------------------------------------------
// §Referential integrity — the real implementation of the store's guard.
//
// "In use" is deliberately measured against the LIVE catalog, not the store:
// a category is in use when a lesson a PATIENT CAN REACH points at it, which
// includes shipped baseline lessons the admin tool has never touched. Nothing
// here is advisory — `retireContent` / `discardContentDraft` call it and
// refuse, so a category cannot be pulled out from under live lessons even if
// a UI is bypassed.
// ---------------------------------------------------------------------------

export function containerUsage(typeId: ContentTypeId, id: string): string[] {
  if (typeId === "library_category")
    return liveLibraryItems()
      .filter((i) => i.categoryId === id)
      .map((i) => i.id);
  if (typeId === "recovery_module")
    return liveRecoveryLessons()
      .filter((l) => l.moduleId === id)
      .map((l) => l.id);
  return [];
}

setContentIntegrityGuard((typeId, id) => {
  const users = containerUsage(typeId, id);
  if (users.length === 0) return undefined;
  const what = typeId === "library_category" ? "library category" : "recovery module";
  const shown = users.slice(0, 3).join(", ");
  return `This ${what} still holds ${users.length} lesson${users.length === 1 ? "" : "s"} (${shown}${
    users.length > 3 ? ", …" : ""
  }). Move or withdraw those lessons first.`;
});