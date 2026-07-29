// NIH NLM Clinical Tables — Conditions search (SNOMED with ICD-10 crosswalk).
// Public, no-key, CORS-enabled. Docs:
// https://clinicaltables.nlm.nih.gov/apidoc/conditions/v3/doc.html
//
// This is Dr. Bagga's "search by condition" path. Users type a lay term
// (e.g. "depression"), the API returns SNOMED-anchored conditions with the
// crosswalked ICD-10-CM codes, and we classify each result with the same
// regex the ICD-10 client uses so SUD/MH/pregnancy flags stay consistent.

import { classifyIcd10, ICD10_MH_RE, type Icd10Category } from "./icd10Search";

export interface ConditionHit {
  /** SNOMED key_id from Clinical Tables (`consumer_id` in some builds). */
  snomedCode: string;
  /** Preferred display name for staff (`primary_name`). */
  primaryName: string;
  /** Consumer-friendly / plain-language name. */
  consumerName?: string;
  /** Crosswalked ICD-10-CM codes (may be empty). */
  icd10Codes: string[];
  /** Primary ICD-10-CM code (first in the crosswalk) if present. */
  primaryIcd10?: string;
  /** Category derived from the primary ICD-10 code via `classifyIcd10`. */
  category: Icd10Category;
  isSud: boolean;
  isMentalHealth: boolean;
  isPregnancy: boolean;
}

/**
 * Query NIH NLM Clinical Tables conditions search. `df` order matters — we
 * request `primary_name,consumer_name,icd10cm_codes,key_id` so the tuples
 * come back in that exact order.
 */
export async function searchConditions(
  terms: string,
  opts: { maxList?: number; signal?: AbortSignal } = {},
): Promise<ConditionHit[]> {
  const q = terms.trim();
  if (!q) return [];
  const maxList = opts.maxList ?? 15;
  const url =
    `https://clinicaltables.nlm.nih.gov/api/conditions/v3/search` +
    `?sf=primary_name,consumer_name,synonyms,word_synonyms` +
    `&df=primary_name,consumer_name,icd10cm_codes,key_id` +
    `&maxList=${maxList}&terms=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`Conditions search failed: ${res.status}`);
  const body = (await res.json()) as [
    number,
    string[],
    unknown,
    [string, string, string, string][],
  ];
  const rows = Array.isArray(body?.[3]) ? body[3] : [];
  return rows.map(([primary_name, consumer_name, icd10cm_codes, key_id]) => {
    // `icd10cm_codes` is a comma/pipe delimited string in the Clinical Tables API.
    const codes = (icd10cm_codes ?? "")
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const primaryIcd10 = codes[0];
    const category = classifyIcd10(primaryIcd10);
    return {
      snomedCode: key_id,
      primaryName: primary_name,
      consumerName: consumer_name || undefined,
      icd10Codes: codes,
      primaryIcd10,
      category,
      isSud: category === "sud",
      isMentalHealth: primaryIcd10 ? ICD10_MH_RE.test(primaryIcd10) : false,
      isPregnancy: category === "pregnancy",
    };
  });
}