// §Lesson-player Phase C — "recommends" chips on the Adel step.
//
// ZERO new authored content. Every chip points at REAL existing content, and
// the targets are derived from the lesson's own `categoryId` / `moduleId` plus
// simple keyword overlap against titles that already exist. Deterministic, so
// the chips do not shuffle between visits.
import { LIBRARY_ITEMS, getLibraryCategory, type LibraryItem } from "@/lib/library";
import { RECOVERY_MODULES, RECOVERY_LESSONS, getRecoveryModule, type RecoveryLesson } from "@/lib/recovery";

export interface LessonRecommend {
  /** Chip text — always the real title of the thing being linked. */
  label: string;
  /** Why it is being suggested, in one short phrase. */
  reason: string;
  to: string;
  search: Record<string, string>;
}

const STOP = new Set([
  "the", "a", "an", "my", "me", "i", "to", "of", "and", "or", "for", "in", "on",
  "is", "it", "that", "this", "with", "when", "what", "how", "do", "am", "are",
  "can", "be", "out", "up", "get", "got", "your", "you",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function overlap(a: string[], b: string): number {
  const set = new Set(tokens(b));
  return a.reduce((n, w) => (set.has(w) ? n + 1 : n), 0);
}

/** Up to 3 chips for a Library lesson: siblings first, then a Recovery module. */
export function recommendsForLibraryItem(item: LibraryItem): LessonRecommend[] {
  const category = getLibraryCategory(item.categoryId);
  const siblings = LIBRARY_ITEMS.filter(
    (i) => i.categoryId === item.categoryId && i.id !== item.id,
  ).sort((a, b) => a.order - b.order);
  const words = tokens(`${item.title} ${item.problem}`);
  const ranked = [...siblings].sort(
    (a, b) => overlap(words, `${b.title} ${b.problem}`) - overlap(words, `${a.title} ${a.problem}`),
  );
  const out: LessonRecommend[] = ranked.slice(0, 2).map((s) => ({
    label: s.title,
    reason: category ? `More in ${category.name}` : "More like this",
    to: "/library",
    search: { item: s.id },
  }));

  const moduleWords = tokens(`${item.title} ${item.problem} ${category?.name ?? ""}`);
  const best = [...RECOVERY_MODULES]
    .filter((m) => !m.contentPending)
    .sort(
      (a, b) =>
        overlap(moduleWords, `${b.name} ${b.mission} ${b.subtitle}`) -
        overlap(moduleWords, `${a.name} ${a.mission} ${a.subtitle}`),
    )[0];
  if (best) {
    const first = RECOVERY_LESSONS.filter((l) => l.moduleId === best.id).sort(
      (a, b) => a.order - b.order,
    )[0];
    out.push({
      label: best.name,
      reason: "Related module in my journey",
      to: "/recovery-journey",
      ...(first ? { search: { lesson: first.id } } : { search: {} }),
    });
  }
  return out;
}

/** Up to 3 chips for a Recovery lesson: next lesson in module, then Library. */
export function recommendsForRecoveryLesson(lesson: RecoveryLesson): LessonRecommend[] {
  const mod = getRecoveryModule(lesson.moduleId);
  const siblings = RECOVERY_LESSONS.filter(
    (l) => l.moduleId === lesson.moduleId && l.id !== lesson.id,
  ).sort((a, b) => a.order - b.order);
  const next = siblings.find((l) => l.order > lesson.order) ?? siblings[0];
  const out: LessonRecommend[] = [];
  if (next) {
    out.push({
      label: next.title,
      reason: mod ? `Next in ${mod.name}` : "Next lesson",
      to: "/recovery-journey",
      search: { lesson: next.id },
    });
  }

  const words = tokens(`${lesson.title} ${lesson.problem} ${lesson.toolkitLabel}`);
  const ranked = [...LIBRARY_ITEMS]
    .map((i) => ({ i, score: overlap(words, `${i.title} ${i.problem}`) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i.id.localeCompare(b.i.id));
  for (const { i } of ranked.slice(0, 2)) {
    const category = getLibraryCategory(i.categoryId);
    out.push({
      label: i.title,
      reason: category ? `From ${category.name}` : "From the library",
      to: "/library",
      search: { item: i.id },
    });
  }
  return out.slice(0, 3);
}
