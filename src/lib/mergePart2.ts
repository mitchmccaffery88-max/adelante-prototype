// §Batch E finish — Part 2 on merged data. Items that came from a merged-away
// record and are Part 2-covered carry a hold. While held they stay under the
// ORIGINAL record's consent state: roles that fail the Part 2 check never see
// them (existing masking), and no disclosure from the survivor includes them
// until someone re-confirms consent on the survivor ("Consent needs review").
// No imports from ehr.ts — safe for every store to use.
import { SUD_MEDICATION_NAMES } from "./sudMedClassifier";

export const PART2_HOLD = "_part2HeldFromMerge";
export interface Part2Hold {
  mergeId: string;
  fromPatientId: string;
}

const TERMS = [...SUD_MEDICATION_NAMES, "asam", "caloms", "audit-c", "audit", "dast", "dast-10", "cows", "ciwa", "opioid", "alcohol", "substance", "sud", "oud", "aud", "f1\\d(\\.\\d+)?"];
const RE = new RegExp(`\\b(${TERMS.join("|")})\\b`, "i");
const PART2_FIELDS = /asam|caloms|sud|part2/i;

/** Conservative: explicit SUD flags, a Part 2 field, or Part 2 terms anywhere in the item. */
export function looksPart2(item: unknown, field?: string): boolean {
  if (field && PART2_FIELDS.test(field)) return true;
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  if (o.sud === true || o.sudRelated === true || o.part2 === true || o.sudFlagged === true || o.category === "sud") return true;
  try {
    return RE.test(JSON.stringify(item));
  } catch {
    return false;
  }
}

export function holdOf(item: unknown): Part2Hold | undefined {
  return item && typeof item === "object" ? ((item as Record<string, unknown>)[PART2_HOLD] as Part2Hold | undefined) : undefined;
}
export const isHeldAfterMerge = (item: unknown) => Boolean(holdOf(item));

/** For any disclosure / outside packet: held items never leave. */
export function withoutMergeHeld<T>(items: readonly T[]): T[] {
  return items.filter((x) => !isHeldAfterMerge(x));
}
