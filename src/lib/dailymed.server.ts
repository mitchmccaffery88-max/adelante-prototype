// §Orders — DailyMed (NIH NLM SPL) strength fallback.
//
// DEV HANDOFF: used ONLY when a product is neither unit-dosed nor topical and
// RxNav still yields no parseable quantitative strength. DailyMed publishes the
// FDA Structured Product Labeling, which carries real per-product ingredient
// strengths ("25 mg", "300 U in 1 mL").
//
// WHY SERVER-SIDE: dailymed.nlm.nih.gov does NOT send CORS headers (verified),
// so a browser fetch is blocked. RxNav does (`access-control-allow-origin: *`),
// which is why only this lookup needs a server function.
//
// No API key required. Public endpoints used:
//   /v2/spls.json?rxcui=... | ?drug_name=...   -> setid list
//   /v2/spls/{setid}/packaging.json            -> products[].active_ingredients[]

const BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2";

export interface DailyMedStrength {
  /** RxNav-shaped strength string, e.g. "25 MG" or "300 UNT/ML". */
  strength?: string;
  /** SPL setid the value came from — provenance for the chart. */
  setid?: string;
  /** Label title, for display. */
  title?: string;
}

async function getJson<T>(url: string): Promise<T | undefined> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

/**
 * Normalise a DailyMed strength phrase into the RxNav shape the dose engine
 * already parses. DailyMed writes either a bare amount ("25 mg") or a
 * ratio ("300 U in 1 mL", "10 mg in 1 mL"). The "in 1 1" denominator means
 * "per dosage unit" and is dropped.
 */
export function normalizeDailyMedStrength(raw: string): string | undefined {
  const s = raw.trim();
  const ratio = s.match(/^([\d.]+)\s*([A-Za-z%]+)\s+in\s+([\d.]+)\s*([A-Za-z]+)$/i);
  if (ratio) {
    const [, amount, unit, perQty, perUnit] = ratio;
    const u = unit.toUpperCase() === "U" ? "UNT" : unit.toUpperCase();
    if (/^(1|1\.0)$/.test(perQty) && perUnit === "1") return `${amount} ${u}`;
    if (/^ml$/i.test(perUnit)) {
      const per = Number(perQty) || 1;
      const value = Number(amount) / per;
      return `${value} ${u}/ML`;
    }
    return `${amount} ${u}`;
  }
  const flat = s.match(/^([\d.]+)\s*([A-Za-z%]+)$/);
  if (flat) return `${flat[1]} ${flat[2].toUpperCase() === "U" ? "UNT" : flat[2].toUpperCase()}`;
  return undefined;
}

interface SplListResponse {
  data?: { setid: string; title?: string }[];
}
interface PackagingResponse {
  data?: {
    products?: { active_ingredients?: { strength?: string; name?: string }[] }[];
  };
}

/** Look up a quantitative strength for an RxCUI (preferred) or product name. */
export async function lookupDailyMedStrength(input: {
  rxcui?: string;
  name?: string;
}): Promise<DailyMedStrength | undefined> {
  const queries: string[] = [];
  if (input.rxcui) queries.push(`${BASE}/spls.json?rxcui=${encodeURIComponent(input.rxcui)}&pagesize=3`);
  if (input.name)
    queries.push(`${BASE}/spls.json?drug_name=${encodeURIComponent(input.name)}&pagesize=3`);

  for (const q of queries) {
    const list = await getJson<SplListResponse>(q);
    for (const entry of list?.data ?? []) {
      const pack = await getJson<PackagingResponse>(`${BASE}/spls/${entry.setid}/packaging.json`);
      const products = pack?.data?.products ?? [];
      for (const p of products) {
        const parts = (p.active_ingredients ?? [])
          .map((a) => (a.strength ? normalizeDailyMedStrength(a.strength) : undefined))
          .filter((x): x is string => !!x);
        if (parts.length)
          return { strength: parts.join(" / "), setid: entry.setid, title: entry.title };
      }
    }
  }
  return undefined;
}
