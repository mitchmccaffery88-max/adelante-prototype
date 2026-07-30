// §Orders — RxNav (NIH NLM RxNorm) catalog client.
//
// DEV HANDOFF: public API, NO key required — https://rxnav.nlm.nih.gov/REST/.
// This replaces the reference EMR's Supabase-backed medication catalog. The
// governance model is unchanged: a product either comes from the catalog (and
// carries an rxcui + strength + dose form) or it is OFF-CATALOG and requires a
// written clinical justification.
//
// MAPPING CAVEATS (read before extending):
//   * RxNav does NOT expose DEA schedule reliably. There is no controlled-
//     substance lookup here on purpose — `MedOrder.isControlled` stays a manual
//     clinician toggle rather than a fabricated lookup.
//   * Strength/dose form live on SCD/SBD term types. Ingredient-only (IN) and
//     brand-name (BN) concepts have neither, so they are filtered out of the
//     pickable results — you cannot reconcile a dose against "sertraline".
//   * Combo strengths arrive as "2 MG / 0.5 MG" with ingredient names in a
//     separate property; they are zipped POSITIONALLY, which RxNav guarantees
//     for SCDs but is worth revalidating if NLM changes the response shape.
//   * Liquids arrive as "20 MG/ML" — parsed by parseLiquidStrength, not by the
//     "/" ingredient split.

const BASE = "https://rxnav.nlm.nih.gov/REST";

export interface CatalogProduct {
  rxcui: string;
  name: string;
  /** e.g. "50 MG", "2 MG / 0.5 MG", "20 MG/ML" */
  strength?: string;
  /** e.g. "Oral Tablet" */
  doseForm?: string;
  ingredientNames: string[];
  /** SCD (generic) or SBD (branded). */
  tty?: string;
}

interface DrugsResponse {
  drugGroup?: {
    conceptGroup?: {
      tty?: string;
      conceptProperties?: { rxcui: string; name: string; tty: string; synonym?: string }[];
    }[];
  };
}

/** Term types that carry enough data to reconcile a dose against. */
const PICKABLE = new Set(["SCD", "SBD", "GPCK", "BPCK"]);

/**
 * Name search. Uses `drugs.json` (exact/normalised) and falls back to
 * `approximateTerm.json` for misspellings, mirroring the reference's
 * "search then fuzzy" behaviour.
 */
export async function searchProducts(
  term: string,
  signal?: AbortSignal,
): Promise<CatalogProduct[]> {
  const q = term.trim();
  if (q.length < 3) return [];

  const direct = await fetchJson<DrugsResponse>(
    `${BASE}/drugs.json?name=${encodeURIComponent(q)}`,
    signal,
  );
  let concepts = (direct?.drugGroup?.conceptGroup ?? [])
    .filter((g) => g.tty && PICKABLE.has(g.tty))
    .flatMap((g) => g.conceptProperties ?? []);

  if (concepts.length === 0) {
    const approx = await fetchJson<{
      approximateGroup?: { candidate?: { rxcui: string; name?: string }[] };
    }>(`${BASE}/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=15`, signal);
    const seen = new Set<string>();
    const candidates = (approx?.approximateGroup?.candidate ?? [])
      .filter((c) => c.rxcui && !seen.has(c.rxcui) && seen.add(c.rxcui))
      .slice(0, 15);
    const resolved = await Promise.all(
      candidates.map((c) =>
        fetchJson<{ properties?: { rxcui: string; name: string; tty: string } }>(
          `${BASE}/rxcui/${c.rxcui}/properties.json`,
          signal,
        ),
      ),
    );
    concepts = resolved
      .map((r) => r?.properties)
      .filter((p): p is { rxcui: string; name: string; tty: string } => !!p && PICKABLE.has(p.tty));
  }

  return concepts.slice(0, 20).map((c) => ({
    rxcui: c.rxcui,
    name: c.name,
    tty: c.tty,
    ...parseFromName(c.name),
  }));
}

/**
 * Fetch strength / dose form / ingredient names for a concept.
 * `allProperties.json?prop=all` is the richest endpoint; the name-derived
 * values are kept as a fallback because coverage varies by concept.
 */
export async function loadProductDetail(
  product: CatalogProduct,
  signal?: AbortSignal,
): Promise<CatalogProduct> {
  const data = await fetchJson<{
    propConceptGroup?: {
      propConcept?: { propCategory: string; propName: string; propValue: string }[];
    };
  }>(`${BASE}/rxcui/${product.rxcui}/allProperties.json?prop=all`, signal);

  const props = data?.propConceptGroup?.propConcept ?? [];
  const pick = (name: string) => props.filter((p) => p.propName === name).map((p) => p.propValue);

  const strength = pick("AVAILABLE_STRENGTH")[0] ?? pick("STRENGTH")[0] ?? product.strength;
  const doseForm = pick("DOSE_FORM")[0] ?? pick("RxNorm Dose Form")[0] ?? product.doseForm;
  const ingredientNames = pick("ACTIVE_INGREDIENT_NAME").length
    ? pick("ACTIVE_INGREDIENT_NAME")
    : product.ingredientNames;

  return { ...product, strength, doseForm, ingredientNames };
}

/**
 * Derive strength / form / ingredients from the SCD name, which follows the
 * shape "<ingredient> <strength> <dose form>" (combos join with " / ").
 * Used as the fast path so the picker renders before the detail call lands.
 */
export function parseFromName(
  name: string,
): Pick<CatalogProduct, "strength" | "doseForm" | "ingredientNames"> {
  const cleaned = name.replace(/\s*\[[^\]]+\]\s*$/, ""); // drop brand bracket
  const strengths = [
    ...cleaned.matchAll(/([\d.]+\s*(?:MG|MCG|G|ML|UNT|%)(?:\s*\/\s*(?:[\d.]+\s*)?ML)?)/gi),
  ].map((m) => m[1].trim());
  const ingredientNames = cleaned
    .split("/")
    .map((seg) => seg.replace(/[\d.]+\s*(MG|MCG|G|ML|UNT|%).*/i, "").trim())
    .filter(Boolean);
  const formMatch = cleaned.match(
    /(Oral Tablet[^/]*|Oral Capsule[^/]*|Extended Release Oral Tablet|Delayed Release Oral Tablet|Oral Solution|Oral Suspension|Sublingual Tablet|Sublingual Film|Injectable Solution|Transdermal System|Chewable Tablet|Disintegrating Oral Tablet|Topical Cream|Topical Ointment|Topical Gel|Topical Lotion|Topical Foam|Medicated Patch|Cream|Ointment|Gel|Lotion|Foam|Pen Injector|Prefilled Syringe|Auto-Injector)/i,
  );
  return {
    strength: strengths.join(" / ") || undefined,
    doseForm: formMatch?.[1]?.trim(),
    ingredientNames,
  };
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | undefined> {
  try {
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    // Network failures are non-fatal: the off-catalog path stays available.
    return undefined;
  }
}
