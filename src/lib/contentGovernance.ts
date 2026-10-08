// §C3/C4 Content governance — "what this addresses" metadata, the sign-off
// rule and the Spanish publish block. PURE: no store imports, so the content
// store, the catalog and the UI all read the same rule.
//
// Draft — pending clinical sign-off: the field set, the backfilled tags, the
// 6th-grade reading-level target and the reviewer roster are all Draft.
import type { StaffRole } from "@/lib/roles";

export type ReentryStage = "pre_release" | "first_30" | "days_30_90" | "after_90";
export type ContentPopulation = "justice_involved" | "general" | "advocate";
export type SpanishStatus = "missing" | "draft" | "reviewed";

/** Screener bands content can address, e.g. "gad7>=10". */
export const SCREENER_BANDS = ["phq9>=10", "gad7>=10", "phq9>=20", "audit>=8", "dast>=3"] as const;
export type ScreenerBand = (typeof SCREENER_BANDS)[number];

export interface ContentMeta {
  /** SDOH need categories — the same ids as `sdohResourceMatch`. */
  sdoh?: string[];
  bands?: ScreenerBand[];
  /** ASAM dimensions 1–6. */
  asam?: number[];
  stages?: ReentryStage[];
  populations?: ContentPopulation[];
  part2?: boolean;
  clinical?: boolean;
  esStatus?: SpanishStatus;
  /** Required reason when publishing patient content without Spanish. */
  spanishOverrideReason?: string;
  owner?: string;
  nextReview?: string;
  lastReviewed?: string;
  /** Tags filled in by the shipped-content backfill, not a human. */
  backfilled?: boolean;
}

export const CLINICAL_REVIEWER_ROLES: StaffRole[] = ["pmhnp", "physician", "clinical_coordinator"];
export const READING_LEVEL_TARGET = 6;
export const GOVERNANCE_DRAFT_LABEL = "Draft — pending clinical sign-off";

const SUD_WORDS =
  /\b(recovery|relapse|craving|sobriety|sober|substance|alcohol|drinking|opioid|fentanyl|meth|naloxone|narcan|mat|moud|buprenorphine|suboxone|methadone|using|use again|12[- ]step|aa|na meeting|smart recovery)\b/i;

export function metaOf(body: Record<string, unknown> | undefined): ContentMeta {
  const m = body?.["meta"];
  return m && typeof m === "object" ? (m as ContentMeta) : {};
}

const PATIENT_TYPES = new Set([
  "library_lesson",
  "recovery_lesson",
  "library_category",
  "recovery_module",
  "community_resource",
  "naloxone_access_point",
  "exercise",
  "journey",
]);

/** Draft: the Spanish block applies to lessons; directory names and containers are exempt. */
export const SPANISH_REQUIRED_TYPES = new Set(["library_lesson", "recovery_lesson", "exercise", "journey"]);

export function isPatientFacingType(typeId: string): boolean {
  return PATIENT_TYPES.has(typeId);
}

function textOf(body: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of ["title", "name", "problem", "subtitle", "mission", "description", "toolkitLabel"]) {
    const v = body[k];
    if (typeof v === "string") parts.push(v);
  }
  return parts.join(" ");
}

/** Part 2 is REQUIRED on recovery lessons/modules and auto-suggested on SUD topics. */
export function part2Required(typeId: string): boolean {
  return typeId === "recovery_lesson" || typeId === "recovery_module";
}
export function part2Suggested(typeId: string, body: Record<string, unknown>): boolean {
  return part2Required(typeId) || (["library_lesson", "exercise", "journey"].includes(typeId) && SUD_WORDS.test(textOf(body)));
}

export function isPart2Content(typeId: string, body: Record<string, unknown>): boolean {
  return part2Required(typeId) || metaOf(body).part2 === true || body.part2Sensitive === true;
}

export function spanishStatusOf(body: Record<string, unknown>): SpanishStatus {
  const m = metaOf(body);
  if (m.esStatus) return m.esStatus;
  const es = body["es"];
  return es && typeof es === "object" && Object.keys(es as object).length > 0 ? "draft" : "missing";
}

/** Rough Flesch–Kincaid grade over the patient-visible text. Draft heuristic. */
export function readingGrade(text: string): number {
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (words.length === 0) return 0;
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  const syll = words.reduce((n, w) => {
    const s = w.toLowerCase().replace(/[^a-z]/g, "").replace(/e$/, "").match(/[aeiouy]+/g);
    return n + Math.max(1, s?.length ?? 1);
  }, 0);
  const g = 0.39 * (words.length / sentences) + 11.8 * (syll / words.length) - 15.59;
  return Math.max(0, Math.round(g * 10) / 10);
}

export function bodyReadingGrade(body: Record<string, unknown>): number {
  const all: string[] = [];
  const walk = (v: unknown, k?: string) => {
    if (k === "meta" || k === "es" || k === "id") return;
    if (typeof v === "string") all.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object")
      for (const [kk, vv] of Object.entries(v as Record<string, unknown>)) walk(vv, kk);
  };
  walk(body);
  return readingGrade(all.join(". "));
}

export interface SignOffInput {
  typeId: string;
  body: Record<string, unknown>;
  actorRole: StaffRole;
  actorKey: string;
  /** Staff id or name of whoever last wrote the working copy. */
  authorKey?: string;
}

/**
 * THE publish rule (Mitch, 7 Oct). Returns a refusal reason or undefined.
 *  - clinical or Part 2 content: approver must be a clinical reviewer who is
 *    not the author;
 *  - editorial content publishes immediately;
 *  - patient content without Spanish is blocked unless a reason is recorded.
 */
export function publishBlocker(i: SignOffInput): string | undefined {
  const m = metaOf(i.body);
  const needsClinical = m.clinical === true || isPart2Content(i.typeId, i.body);
  if (needsClinical) {
    if (!CLINICAL_REVIEWER_ROLES.includes(i.actorRole))
      return "Clinical or Part 2 content needs approval from a PMHNP, physician or clinical coordinator.";
    if (i.authorKey && i.authorKey === i.actorKey)
      return "Clinical or Part 2 content needs a reviewer who isn't the author.";
  }
  if (
    SPANISH_REQUIRED_TYPES.has(i.typeId) &&
    spanishStatusOf(i.body) === "missing" &&
    !m.spanishOverrideReason?.trim()
  )
    return "Add a Spanish version, or record a reason to publish without it (Spanish users will see \"Spanish coming soon\").";
  return undefined;
}

export function needsClinicalSignOff(typeId: string, body: Record<string, unknown>): boolean {
  return metaOf(body).clinical === true || isPart2Content(typeId, body);
}
