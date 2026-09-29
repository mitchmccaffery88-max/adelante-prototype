// §Batch E finish — Part 2 on merged data. Items that came from a merged-away
// record and are Part 2-covered carry a hold. While held they stay under the
// ORIGINAL record's consent state: roles that fail the Part 2 check never see
// them (existing masking), and no disclosure from the survivor includes them
// until someone re-confirms consent on the survivor ("Consent needs review").
// No imports from ehr.ts — safe for every store to use.
import { isSudMedication, type SudClassifiable } from "./sudMedClassifier";

export const PART2_HOLD = "_part2HeldFromMerge";
export interface Part2Hold {
  mergeId: string;
  fromPatientId: string;
}

/** Instrument types that are Part 2 (SUD screeners / withdrawal scales / ASAM). */
export const PART2_INSTRUMENTS = new Set(["audit", "audit-c", "dast-10", "dast", "cows", "ciwa", "ciwa-ar", "asam"]);
/** Structured stores whose rows are Part 2 by definition. */
const PART2_STORES = new Set(["asamAssessments", "calomsRecords", "asamClaims", "sudEpisodes"]);
const NON_SUD_CATEGORIES = new Set(["mental_health", "medical", "pregnancy", "group", "general", "physical_health"]);

export type Part2Class = "part2" | "not_part2" | "unclassified";

/**
 * Structured classification only — never free text. Order:
 * explicit SUD flags → `sensitive` → consent/note category → instrument type
 * → medication classifier. Anything without a structured signal is
 * "unclassified" and treated as PROTECTED until consent is re-confirmed.
 */
export function classifyPart2(item: unknown, field?: string): Part2Class {
  if (field && PART2_STORES.has(field)) return "part2";
  if (!item || typeof item !== "object") return "unclassified";
  const o = item as Record<string, unknown>;
  if (o.sud === true || o.sudRelated === true || o.part2 === true || o.sudFlagged === true) return "part2";
  if (o.sensitive === true) return "part2";
  for (const k of ["category", "noteCategory", "consentCategory"]) {
    const c = o[k];
    if (c === "sud" || c === "part2") return "part2";
  }
  const inst = typeof o.key === "string" ? o.key : typeof o.instrument === "string" ? o.instrument : typeof o.screenerKey === "string" ? o.screenerKey : undefined;
  const instKey = (inst ?? (field && PART2_INSTRUMENTS.has(field) ? field : undefined))?.toLowerCase();
  if (instKey && PART2_INSTRUMENTS.has(instKey)) return "part2";
  const isMed = ["name", "drugName", "medicationName", "productName"].some((k) => typeof o[k] === "string") && ("dose" in o || "sig" in o || "drugName" in o || "medicationName" in o || "rxnormId" in o);
  if (isMed) return isSudMedication(o as SudClassifiable) ? "part2" : "not_part2";
  if (instKey) return "not_part2";
  if (o.sensitive === false) return "not_part2";
  for (const k of ["category", "noteCategory", "consentCategory"]) {
    const c = o[k];
    if (typeof c === "string" && NON_SUD_CATEGORIES.has(c)) return "not_part2";
  }
  return "unclassified";
}

/** Held after a merge unless structured data proves it is NOT Part 2. */
export function needsMergeHold(item: unknown, field?: string): boolean {
  return classifyPart2(item, field) !== "not_part2";
}

export function holdOf(item: unknown): Part2Hold | undefined {
  return item && typeof item === "object" ? ((item as Record<string, unknown>)[PART2_HOLD] as Part2Hold | undefined) : undefined;
}
export const isHeldAfterMerge = (item: unknown) => Boolean(holdOf(item));

/** For any disclosure / outside packet: held items never leave. */
export function withoutMergeHeld<T>(items: readonly T[]): T[] {
  return items.filter((x) => !isHeldAfterMerge(x));
}
