// §Admin governance — local suppression of RxNav search results.
//
// WHY THIS EXISTS: Orders queries RxNav live, so there is no local catalog to
// curate. What a facility CAN say is "RxNav carries this, but we do not stock
// it / do not want it ordered here". That is a purely local, client-side
// exclusion applied to search RESULTS — it never edits RxNorm data and it is
// NOT a clinical contraindication check.
//
// The off-catalog path is untouched: a suppressed product can still be entered
// off-catalog with a written justification, which is the intended escape hatch.

export interface CatalogSuppression {
  id: string;
  /** Exact RxCUI match (strongest), and/or a case-insensitive name substring. */
  rxcui?: string;
  drugName?: string;
  /** REQUIRED — why this product is not orderable here. */
  reason: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  /** Reason recorded when the suppression is lifted (deactivate, never delete). */
  deactivatedReason?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface SuppressibleProduct {
  rxcui?: string;
  name: string;
}

/** The first ACTIVE rule that matches, or undefined. */
export function matchSuppression(
  product: SuppressibleProduct,
  rules: CatalogSuppression[],
): CatalogSuppression | undefined {
  const name = product.name.toLowerCase();
  return rules.find((r) => {
    if (!r.active) return false;
    if (r.rxcui && product.rxcui && r.rxcui === product.rxcui) return true;
    const needle = (r.drugName ?? "").trim().toLowerCase();
    return needle.length > 0 && name.includes(needle);
  });
}

/** Split results into what stays visible and what a local rule removed. */
export function applySuppressions<T extends SuppressibleProduct>(
  products: T[],
  rules: CatalogSuppression[],
): { visible: T[]; suppressed: { product: T; rule: CatalogSuppression }[] } {
  const visible: T[] = [];
  const suppressed: { product: T; rule: CatalogSuppression }[] = [];
  for (const p of products) {
    const rule = matchSuppression(p, rules);
    if (rule) suppressed.push({ product: p, rule });
    else visible.push(p);
  }
  return { visible, suppressed };
}
