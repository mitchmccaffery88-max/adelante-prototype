// §C3/C5 "What this addresses" — the tag read path that drives suggestions in
// the care plan, patient Adel chat and the patient SDOH sections.
//
// Tags come from the PUBLISHED content body (`meta`) when an author set them,
// otherwise from the Draft backfill below (obvious mappings only, each marked
// `backfilled`). Suggestions are computed from tags only — never hardcoded ids.
// Draft — pending clinical sign-off.
import {
  liveLibraryItems, liveExercises,
  liveRecoveryLessons,
  liveRecoveryModules,
  liveAdvocateLibraryCategories,
} from "@/lib/contentCatalog";
import { EXERCISES } from "@/lib/library";
import { getContentEntry, publishedContent, type ContentTypeId } from "@/lib/contentPublishing";
import {
  metaOf,
  part2Required,
  type ContentMeta,
  type ReentryStage,
  type ScreenerBand,
} from "@/lib/contentGovernance";
import {
  getStructuredPlan,
  setPlanActivitySource,
  setTaggedSuggestionSource,
  completeAssignment,
  type PlanActivity,
  type PlanSuggestion,
} from "@/lib/structuredCarePlan";
import { onContentCompleted } from "@/lib/engagement";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { listResources, isResourceVerified, type CommunityResource } from "@/lib/communityResources";
import { matchResourcesForNeed } from "@/lib/sdohResourceMatch";

export type TaggedKind = "lesson" | "module" | "exercise";

export interface TaggedItem {
  kind: TaggedKind;
  typeId: ContentTypeId | "exercise";
  id: string;
  title: string;
  titleEs?: string;
  to: "/library" | "/recovery-journey";
  search: Record<string, string>;
  meta: ContentMeta;
  part2: boolean;
}

// ---------------------------------------------------------------------------
// Draft backfill — obvious mappings on shipped content only.
// ---------------------------------------------------------------------------
const SDOH_BY_ID: Record<string, string[]> = {
  "back-on-feet-housing": ["housing", "emergency_shelter"],
  "back-on-feet-work": ["employment"],
  "back-on-feet-money-basics": ["financial"],
  "back-on-feet-food-resources": ["food"],
  "back-on-feet-healthcare-support": ["healthcare"],
  "back-on-feet-my-benefits": ["financial"],
  "back-on-feet-transportation": ["transportation"],
  "back-on-feet-legal-responsibilities": ["legal"],
};
const BANDS_BY_ID: Record<string, ScreenerBand[]> = {
  "understanding-anxiety": ["gad7>=10"],
  "ss-managing-worry": ["gad7>=10"],
  "ss-calming-my-mind": ["gad7>=10"],
  "train-mind-worry-cycle": ["gad7>=10"],
  "box-breathing": ["gad7>=10"],
  "understanding-depression": ["phq9>=10"],
  "ss-daily-rhythm": ["phq9>=10"],
};
const PART2_LIBRARY_CATEGORIES = new Set(["strengthen-recovery"]);
const PART2_LIBRARY_IDS = new Set(["understanding-sud", "understanding-recovery-journey-2"]);
const CLINICAL_IDS = /^understanding-(sud|depression|anxiety|bipolar|ptsd|psychosis)$/;

function backfill(kind: TaggedKind, id: string, extra: { categoryId?: string; moduleId?: string; part2Sensitive?: boolean }): ContentMeta {
  const m: ContentMeta = { backfilled: true };
  if (SDOH_BY_ID[id]) m.sdoh = SDOH_BY_ID[id];
  if (BANDS_BY_ID[id]) m.bands = BANDS_BY_ID[id];
  if (extra.categoryId === "back-on-feet" || extra.categoryId === "starting-strong" || id === "first-days-out" || extra.moduleId === "first-days-out") {
    m.stages = ["first_30", "days_30_90"];
    m.populations = ["justice_involved"];
  }
  if (extra.moduleId === "when-recovery-gets-hard" || id === "when-recovery-gets-hard") m.asam = [3, 5];
  if (extra.moduleId === "understanding-my-addiction" || id === "understanding-my-addiction") m.asam = [4];
  if (extra.moduleId === "finding-my-people" || id === "finding-my-people") m.asam = [6];
  if (extra.categoryId === "strengthen-recovery") m.asam = [5];
  if (id === "back-on-feet-housing") m.asam = [6];
  if (
    kind === "module" ||
    extra.moduleId ||
    (extra.categoryId && PART2_LIBRARY_CATEGORIES.has(extra.categoryId)) ||
    PART2_LIBRARY_IDS.has(id) ||
    extra.part2Sensitive
  )
    m.part2 = true;
  if (CLINICAL_IDS.test(id)) m.clinical = true;
  return m;
}

function metaFor(typeId: ContentTypeId, id: string, fallback: ContentMeta): ContentMeta {
  const pub = publishedContent(typeId, id);
  const authored = pub ? metaOf(pub) : metaOf(getContentEntry(typeId, id)?.publishedBody);
  return Object.keys(authored).length > 0 ? authored : fallback;
}

/** Every live, patient-reachable item with its tags. Retired content never appears. */
export function taggedCatalog(): TaggedItem[] {
  const out: TaggedItem[] = [];
  const advocateCats = new Set(
    liveAdvocateLibraryCategories().map((c) => c.id),
  );
  for (const i of liveLibraryItems()) {
    if (advocateCats.has(i.categoryId)) continue;
    const meta = metaFor("library_lesson", i.id, backfill("lesson", i.id, { categoryId: i.categoryId }));
    const es = (publishedContent("library_lesson", i.id)?.["es"] as { title?: string } | undefined)?.title;
    out.push({
      kind: "lesson",
      typeId: "library_lesson",
      id: i.id,
      title: i.title,
      ...(es ? { titleEs: es } : {}),
      to: "/library",
      search: { item: i.id },
      meta,
      part2: meta.part2 === true,
    });
  }
  for (const m of liveRecoveryModules()) {
    if (m.contentPending) continue;
    const meta = metaFor("recovery_module", m.id, backfill("module", m.id, {}));
    out.push({
      kind: "module",
      typeId: "recovery_module",
      id: m.id,
      title: m.name,
      to: "/recovery-journey",
      // Deep link: the module's first lesson (the journey route takes `lesson`).
      search: ((): Record<string, string> => {
        const first = liveRecoveryLessons()
          .filter((l) => l.moduleId === m.id)
          .sort((a, b) => a.order - b.order)[0];
        return first ? { lesson: first.id } : {};
      })(),
      meta: { ...meta, part2: true },
      part2: true,
    });
  }
  for (const l of liveRecoveryLessons()) {
    const meta = metaFor("recovery_lesson", l.id, backfill("lesson", l.id, { moduleId: l.moduleId }));
    out.push({
      kind: "lesson",
      typeId: "recovery_lesson",
      id: l.id,
      title: l.title,
      to: "/recovery-journey",
      search: { lesson: l.id },
      meta: { ...meta, part2: true },
      part2: part2Required("recovery_lesson"),
    });
  }
  for (const e of liveExercises()) {
    if (e.placeholder) continue;
    const meta = backfill("exercise", e.id, { part2Sensitive: e.part2Sensitive });
    out.push({
      kind: "exercise",
      typeId: "exercise",
      id: e.id,
      title: e.title,
      to: "/library",
      search: { exercise: e.id },
      meta,
      part2: meta.part2 === true,
    });
  }
  return out;
}

export function taggedItem(id: string): TaggedItem | undefined {
  return taggedCatalog().find((t) => t.id === id);
}

// ---------------------------------------------------------------------------
// Patient context
// ---------------------------------------------------------------------------
const DAY = 86_400_000;

export function reentryStageOf(p: Patient | undefined, now = new Date()): ReentryStage | undefined {
  const rel = p?.releaseDate;
  if (!rel) return undefined;
  const d = Math.floor((now.getTime() - Date.parse(rel)) / DAY);
  if (!Number.isFinite(d)) return undefined;
  if (d < 0) return "pre_release";
  if (d <= 30) return "first_30";
  if (d <= 90) return "days_30_90";
  return "after_90";
}

function latest(p: Patient, key: string): number | undefined {
  const rows = (p.screenerHistory ?? [])
    .filter((h) => h.key === key)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return rows[0]?.score;
}

export function patientBands(p: Patient): ScreenerBand[] {
  const out: ScreenerBand[] = [];
  const phq = latest(p, "phq-9");
  const gad = latest(p, "gad-7");
  if (gad !== undefined && gad >= 10) out.push("gad7>=10");
  if (phq !== undefined && phq >= 10) out.push("phq9>=10");
  if (phq !== undefined && phq >= 20) out.push("phq9>=20");
  return out;
}

export function openNeedCategories(p: Patient): { needId: string; need: string; categories: string[] }[] {
  return (p.sdohPlan?.items ?? [])
    .filter((i) => i.status !== "completed" && i.status !== "not_completed")
    .map((i) => ({ needId: i.id, need: i.need, categories: matchResourcesForNeed(i)?.categoryIds ?? [] }));
}

/** Lessons tagged for a set of SDOH categories. */
export function lessonsForCategories(categoryIds: string[], opts: { seesPart2?: boolean } = {}): TaggedItem[] {
  return taggedCatalog().filter(
    (t) => t.kind !== "module" && (opts.seesPart2 || !t.part2) && (t.meta.sdoh ?? []).some((c) => categoryIds.includes(c)),
  );
}

/** Verified resources for a set of categories. */
export function verifiedResourcesFor(categoryIds: string[]): CommunityResource[] {
  return listResources()
    .filter((r) => categoryIds.includes(r.categoryId) && isResourceVerified(r))
    .sort((a, b) => Number(isResourceVerified(b)) - Number(isResourceVerified(a)) || a.name.localeCompare(b.name));
}

export interface ContentSuggestion {
  item: TaggedItem;
  reasonKey: "band" | "need" | "stage";
  /** Neutral, patient-safe reason. */
  reason: string;
  needId?: string;
}

/**
 * Tag-only match against the patient's own plan, needs, screener bands and
 * reentry stage. `seesPart2` false drops Part 2 items entirely (hidden, not
 * stubbed). Deterministic order.
 */
export function suggestContentForPatient(
  patientId: string,
  opts: { seesPart2: boolean; now?: Date; limit?: number } = { seesPart2: false },
): ContentSuggestion[] {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return [];
  const now = opts.now ?? new Date();
  const catalog = taggedCatalog().filter((t) => opts.seesPart2 || !t.part2);
  const out: ContentSuggestion[] = [];
  const seen = new Set<string>();
  const push = (s: ContentSuggestion) => {
    if (seen.has(s.item.id)) return;
    seen.add(s.item.id);
    out.push(s);
  };
  const stage = reentryStageOf(p, now);
  for (const need of openNeedCategories(p)) {
    const hits = catalog.filter((t) => (t.meta.sdoh ?? []).some((c) => need.categories.includes(c)));
    // Prefer content that also fits the stage.
    // Prefer content that also fits the stage, then human-set tags over Draft backfill.
    hits.sort(
      (a, b) =>
        Number((b.meta.stages ?? []).includes(stage!)) - Number((a.meta.stages ?? []).includes(stage!)) ||
        Number(!b.meta.backfilled) - Number(!a.meta.backfilled),
    );
    for (const h of hits.slice(0, 1)) push({ item: h, reasonKey: "need", reason: `Open need: ${need.need}`, needId: need.needId });
  }
  for (const band of patientBands(p)) {
    const hit = catalog.find((t) => (t.meta.bands ?? []).includes(band));
    if (hit) push({ item: hit, reasonKey: "band", reason: `Screener ${band.replace(">=", " ≥ ").toUpperCase()}` });
  }
  if (stage) {
    const hit = catalog.find((t) => (t.meta.stages ?? []).includes(stage) && !(t.meta.sdoh ?? []).length);
    if (hit) push({ item: hit, reasonKey: "stage", reason: "Fits where you are after release" });
  }
  return out.slice(0, opts.limit ?? 5);
}

// ---------------------------------------------------------------------------
// Coverage — gaps the content center home shows
// ---------------------------------------------------------------------------
export const COVERAGE_SDOH = ["housing", "food", "employment", "transportation", "financial", "legal", "healthcare", "education", "parenting"];
export const COVERAGE_BANDS: ScreenerBand[] = ["gad7>=10", "phq9>=10", "phq9>=20"];
export const COVERAGE_STAGES: ReentryStage[] = ["pre_release", "first_30", "days_30_90", "after_90"];

export interface CoverageReport {
  needsWithoutLesson: string[];
  needsWithoutResource: string[];
  bandsWithoutLesson: string[];
  stagesWithoutLesson: string[];
  plansPointingAtMissing: { patientId: string; activityId: string }[];
  gapCount: number;
}

export function contentCoverage(): CoverageReport {
  const cat = taggedCatalog();
  const res = listResources().filter(isResourceVerified);
  const needsWithoutLesson = COVERAGE_SDOH.filter((c) => !cat.some((t) => (t.meta.sdoh ?? []).includes(c)));
  const needsWithoutResource = COVERAGE_SDOH.filter((c) => !res.some((r) => r.categoryId === c));
  const bandsWithoutLesson = COVERAGE_BANDS.filter((b) => !cat.some((t) => (t.meta.bands ?? []).includes(b)));
  const stagesWithoutLesson = COVERAGE_STAGES.filter((s) => !cat.some((t) => (t.meta.stages ?? []).includes(s)));
  const ids = new Set(cat.map((t) => t.id));
  const plansPointingAtMissing: CoverageReport["plansPointingAtMissing"] = [];
  for (const p of AdelanteEHR.listPatients()) {
    for (const a of getStructuredPlan(p.id).assignments) {
      if (a.active && a.kind === "activity" && a.activityId && !ids.has(a.activityId))
        plansPointingAtMissing.push({ patientId: p.id, activityId: a.activityId });
    }
  }
  return {
    needsWithoutLesson,
    needsWithoutResource,
    bandsWithoutLesson,
    stagesWithoutLesson,
    plansPointingAtMissing,
    gapCount:
      needsWithoutLesson.length +
      needsWithoutResource.length +
      bandsWithoutLesson.length +
      stagesWithoutLesson.length +
      plansPointingAtMissing.length,
  };
}

// ---------------------------------------------------------------------------
// Registration — the care plan reads live content through these.
// ---------------------------------------------------------------------------
setPlanActivitySource((): PlanActivity[] =>
  taggedCatalog().map((t) => ({
    id: t.id,
    label: { en: t.title, es: t.titleEs ?? t.title },
    to: t.to,
    sud: t.part2,
    search: t.search,
    kind: t.kind,
    ...(t.kind === "exercise" ? { exercise: t.id } : {}),
  })),
);

setTaggedSuggestionSource((patientId, now): PlanSuggestion[] =>
  suggestContentForPatient(patientId, { seesPart2: true, now }).map((s) => ({
    id: `tag-${s.reasonKey}-${s.item.id}${s.needId ? `-${s.needId}` : ""}`,
    rule: s.reasonKey === "band" ? s.reason : s.reasonKey === "need" ? "Open need (content tag)" : "Reentry stage (content tag)",
    why: s.reason,
    kind: "activity" as const,
    activityId: s.item.id,
    frequency: s.item.kind === "module" ? ("weekly" as const) : ("once" as const),
    label: s.item.title,
  })),
);

/** Finishing a lesson / exercise / a module's lesson closes the matching assignment. */
onContentCompleted((c) => {
  let plan;
  try {
    plan = getStructuredPlan(c.patientId);
  } catch {
    return;
  }
  for (const a of plan.assignments) {
    if (!a.active || a.kind !== "activity") continue;
    if (a.activityId === c.id || (c.moduleId && a.activityId === c.moduleId)) {
      try {
        completeAssignment(c.patientId, a.id, { name: "Patient", role: "patient" }, new Date(), "lesson_finished");
      } catch {
        /* already done */
      }
    }
  }
});
