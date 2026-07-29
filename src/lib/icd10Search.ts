// NIH NLM Clinical Tables — ICD-10-CM search.
// Public, no-key, CORS-enabled. Docs:
// https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html
//
// Classification regex mirrors Dr. Bagga's production BaggaEMR rules exactly:
//   is_mental_health = /^F/i.test(code)
//   is_sud           = /^F1[0-9]/i.test(code)
//   is_pregnancy     = /^O/i.test(code) || /^Z3[3-9]/i.test(code)
// Do not tune these locally — they mirror upstream clinical semantics.

export const ICD10_MH_RE = /^F/i;
export const ICD10_SUD_RE = /^F1[0-9]/i;
export const ICD10_PREGNANCY_RE = /^O/i;
export const ICD10_PREGNANCY_Z_RE = /^Z3[3-9]/i;

export type Icd10Category = "sud" | "mental_health" | "pregnancy" | "medical";

export function classifyIcd10(code: string | undefined | null): Icd10Category {
  if (!code) return "medical";
  if (ICD10_SUD_RE.test(code)) return "sud";
  if (ICD10_MH_RE.test(code)) return "mental_health";
  if (ICD10_PREGNANCY_RE.test(code) || ICD10_PREGNANCY_Z_RE.test(code)) return "pregnancy";
  return "medical";
}

export interface Icd10Hit {
  code: string;
  name: string;
  category: Icd10Category;
  isSud: boolean;
  isMentalHealth: boolean;
  isPregnancy: boolean;
}

/**
 * Query NIH NLM Clinical Tables ICD-10-CM search.
 * Response shape: `[total, codes, extra, data]` where `data` is an array of
 * `[code, name]` tuples per the `df=code,name` request.
 */
export async function searchIcd10(
  terms: string,
  opts: { maxList?: number; signal?: AbortSignal } = {},
): Promise<Icd10Hit[]> {
  const q = terms.trim();
  if (!q) return [];
  const maxList = opts.maxList ?? 15;
  const url =
    `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search` +
    `?sf=code,name&df=code,name&maxList=${maxList}` +
    `&terms=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`ICD-10 search failed: ${res.status}`);
  const body = (await res.json()) as [number, string[], unknown, [string, string][]];
  const rows = Array.isArray(body?.[3]) ? body[3] : [];
  return rows.map(([code, name]) => {
    const category = classifyIcd10(code);
    return {
      code,
      name,
      category,
      isSud: category === "sud",
      isMentalHealth: ICD10_MH_RE.test(code),
      isPregnancy: category === "pregnancy",
    };
  });
}