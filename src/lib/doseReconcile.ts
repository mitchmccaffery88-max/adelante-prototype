// §Orders — dose reconciliation engine.
//
// DEV HANDOFF: port of the reference EMR's `doseReconcile.ts`. This is the
// safety-critical arithmetic that turns a clinician's INTENT ("give 100 mg")
// into a DISPENSABLE INSTRUCTION ("2 tablets of 50 mg") — or refuses, loudly,
// when no whole/half unit of the selected product can express that intent.
//
// Non-negotiable rules preserved from the reference:
//   * A dose that cannot be expressed exactly is an ERROR, never a rounding.
//   * Capsules and all modified-release forms (ER/XR/SR/CR/DR/LA) are NEVER
//     splittable — splitting them changes the release kinetics.
//   * Plain immediate-release tablets are half-splittable only.
//   * Liquids are continuous: mg -> mL via the product's mg/mL concentration.
//   * A combo product cannot be dosed by "mg" alone — the mg is ambiguous
//     across ingredients, so the caller must pick an axis (an ingredient) or
//     dose by units. That is the `combo_ambiguous` error.
//
// The only Adelante-side adjustment: the CartItem shape is replaced by the
// `DoseProduct` structure below, which is what `MedOrder` carries.

export type DoseErrorCode =
  | "no_product"
  | "no_strength"
  | "invalid_target"
  | "combo_ambiguous"
  | "target_lt_product"
  | "fraction_not_allowed"
  | "quarter_not_allowed";

export interface DoseError {
  code: DoseErrorCode;
  message: string;
}

/** One active ingredient of the selected product. */
export interface DoseIngredient {
  name: string;
  /** Strength numerator, always normalised to mg by `normalizeStrength`. */
  strengthMg: number;
  /** Present for liquids: the volume the strength is expressed per (mL). */
  perMl?: number;
}

export interface DoseProduct {
  /** Display name, e.g. "sertraline 50 MG oral tablet". */
  name: string;
  /** RxNorm concept id when the product came from the catalog. */
  rxcui?: string;
  /** Dose form string as returned by RxNav, e.g. "Oral Tablet", "Oral Solution". */
  doseForm?: string;
  /** Administration route, e.g. "oral", "IM", "SQ". Drives large-volume warnings. */
  route?: string;
  ingredients: DoseIngredient[];
  /**
   * True when ingredient names could NOT be extracted from the product name
   * text and the positional-zip fallback was used instead. Surfaced as a
   * warning so a clinician never trusts a mis-zipped combo label silently.
   */
  ingredientNamesFallback?: boolean;
}

export interface DoseResult {
  /** Units (tablets/capsules) per administration. Fractional only when legal. */
  unitsPerAdmin?: number;
  /** Volume per administration for liquids, in mL. */
  volumeMl?: number;
  /** Delivered mg per ingredient at the reconciled unit count. */
  perIngredientMg: { name: string; mg: number }[];
  /** Total mg delivered per administration (single-ingredient products only). */
  totalMg?: number;
  /** Non-blocking advisories (large volume, name-extraction fallback, ...). */
  warnings?: string[];
  error?: DoseError;
}

const MODIFIED_RELEASE =
  /\b(er|xr|sr|cr|dr|la|xl|extended|delayed|sustained|controlled)[\s-]?release?\b|\b(er|xr|sr|cr|dr|xl|la)\b/i;
const CAPSULE = /capsule/i;
const LIQUID = /(solution|suspension|syrup|elixir|concentrate|liquid|tincture|drops?)/i;
const INJECTION = /(injection|injectable|prefilled|syringe|vial)/i;

export function isLiquidForm(doseForm?: string): boolean {
  return !!doseForm && (LIQUID.test(doseForm) || INJECTION.test(doseForm));
}

/**
 * Splitting policy. Returns the smallest legal fraction of a unit.
 *   1   -> whole units only (capsules, all modified-release, injectables)
 *   0.5 -> plain tablets may be halved
 */
export function smallestUnitFraction(doseForm?: string): 1 | 0.5 {
  if (!doseForm) return 1;
  if (CAPSULE.test(doseForm)) return 1;
  if (MODIFIED_RELEASE.test(doseForm)) return 1;
  if (INJECTION.test(doseForm)) return 1;
  if (/tablet/i.test(doseForm)) return 0.5;
  return 1;
}

/** Convert a strength numerator to mg. Handles g / mcg / ng, passes mg through. */
export function normalizeStrengthToMg(value: number, unit: string): number | undefined {
  const u = unit.trim().toLowerCase();
  if (u === "mg") return value;
  if (u === "g" || u === "gm" || u === "gram") return value * 1000;
  if (u === "mcg" || u === "ug" || u === "µg") return value / 1000;
  if (u === "ng") return value / 1e6;
  return undefined; // %, units, meq etc. are not mg-convertible — caller must dose by units.
}

/**
 * Common starting doses per ingredient (mg), rendered as quick-pick chips on
 * the dose axis. Ported from the reference EMR; these are convenience values,
 * NOT a clinical dosing guideline — the engine still validates every pick.
 */
export const COMMON_INGREDIENT_DOSES: Record<string, number[]> = {
  buprenorphine: [2, 4, 8, 12, 16],
  methadone: [5, 10, 20, 40],
  oxycodone: [5, 10, 15, 20],
  hydrocodone: [5, 7.5, 10],
  acetaminophen: [325, 500, 650, 1000],
  ibuprofen: [200, 400, 600, 800],
  naloxone: [0.5, 1, 2],
};

export function commonDosesFor(ingredient?: string): number[] {
  if (!ingredient) return [];
  return COMMON_INGREDIENT_DOSES[ingredient.trim().toLowerCase()] ?? [];
}

// Trailing dose-form / route words trimmed off a name-extracted ingredient.
const NAME_STOP_WORDS = new Set([
  "oral",
  "sublingual",
  "buccal",
  "topical",
  "transdermal",
  "injectable",
  "injection",
  "tablet",
  "tablets",
  "capsule",
  "capsules",
  "film",
  "strip",
  "patch",
  "solution",
  "suspension",
  "syrup",
  "elixir",
  "concentrate",
  "extended",
  "delayed",
  "sustained",
  "controlled",
  "release",
  "chewable",
  "disintegrating",
  "product",
  "in",
  "and",
]);

/**
 * Extract ingredient names from an RxNav concept name.
 *
 * The reference EMR reads names out of the product-name TEXT rather than
 * relying on a parallel names array, because the text is what the clinician
 * sees and it never de-syncs from the strengths printed beside it.
 * "buprenorphine 8 MG / naloxone 2 MG sublingual tablet" -> ["buprenorphine","naloxone"].
 */
export function extractIngredientNames(productName?: string): string[] {
  if (!productName) return [];
  const cleaned = productName.replace(/\s*\[[^\]]+\]\s*/g, " ");
  const re = /([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,2})\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b/gi;
  const names: string[] = [];
  for (const m of cleaned.matchAll(re)) {
    const words = m[1]
      .split(/\s+/)
      .filter((w) => !NAME_STOP_WORDS.has(w.toLowerCase()) && !/^\d/.test(w));
    const name = words.join(" ").trim();
    if (name) names.push(name);
  }
  return names;
}

/**
 * Parse an RxNav-style strength string into ingredients.
 * Accepts "50 MG", "2 MG / 0.5 MG", "20 MG/ML", "5 MG / 325 MG".
 *
 * Naming precedence (matching the reference):
 *   1. names extracted from the product-name text (primary)
 *   2. positionally-zipped `ingredientNames` (FALLBACK ONLY, when extraction
 *      yields fewer names than the strength string has segments)
 *   3. "Ingredient N" placeholder
 * Use `didFallbackToPositionalNames` to flag case 2 to the user.
 */
export function parseStrength(
  strength: string | undefined,
  ingredientNames: string[] = [],
  productName?: string,
): DoseIngredient[] {
  if (!strength) return [];
  const segments = strength
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const extracted = extractIngredientNames(productName);
  const useExtracted = extracted.length >= segments.length && extracted.length > 0;
  const names = useExtracted ? extracted : ingredientNames;
  return segments
    .map((chunk, i) => {
      // "20 MG" | "20 MG/ML" already split on "/", so per-mL arrives as a bare unit.
      const m = chunk.match(/([\d.]+)\s*([a-zA-Zµ%]+)/);
      const name = names[i] ?? `Ingredient ${i + 1}`;
      if (!m) return { name, strengthMg: NaN };
      const mg = normalizeStrengthToMg(Number(m[1]), m[2]);
      return { name, strengthMg: mg ?? NaN };
    })
    .filter((x) => Number.isFinite(x.strengthMg));
}

/** True when parseStrength had to fall back to positional ingredient names. */
export function didFallbackToPositionalNames(
  strength: string | undefined,
  productName?: string,
): boolean {
  if (!strength) return false;
  const segments = strength.split("/").filter((s) => s.trim()).length;
  if (segments < 2) return false;
  return extractIngredientNames(productName).length < segments;
}

/**
 * Detect the "X MG/ML" liquid pattern and attach the per-mL basis.
 * RxNav expresses liquids as "20 MG/ML" — after the "/" split above the "ML"
 * chunk has no number, so liquids are reconstructed here instead.
 */
export function parseLiquidStrength(strength?: string): { mgPerMl: number } | undefined {
  if (!strength) return undefined;
  const m = strength.match(/([\d.]+)\s*(mg|g|mcg)\s*\/\s*([\d.]*)\s*ml/i);
  if (!m) return undefined;
  const mg = normalizeStrengthToMg(Number(m[1]), m[2]);
  const per = m[3] ? Number(m[3]) : 1;
  if (mg === undefined || !per) return undefined;
  return { mgPerMl: mg / per };
}

function err(code: DoseErrorCode, message: string): DoseResult {
  return { perIngredientMg: [], error: { code, message } };
}

const EPS = 1e-6;
function isMultipleOf(value: number, step: number): boolean {
  const q = value / step;
  return Math.abs(q - Math.round(q)) < EPS;
}

/**
 * SINGLE-INGREDIENT / LIQUID reconciliation.
 * `targetMg` is the clinician's intended dose per administration.
 */
export function reconcileDose(product: DoseProduct | undefined, targetMg: number): DoseResult {
  if (!product) return err("no_product", "Select a product before entering a dose.");
  if (!product.ingredients.length)
    return err("no_strength", "This product has no usable strength — dose by units instead.");
  if (!Number.isFinite(targetMg) || targetMg <= 0)
    return err("invalid_target", "Enter a dose greater than zero.");
  if (product.ingredients.length > 1)
    return err(
      "combo_ambiguous",
      "This is a combination product — a single mg value is ambiguous. Dose by units, or pick which ingredient the dose refers to.",
    );

  const ing = product.ingredients[0];
  const warnings: string[] = [];

  // Liquids are continuous — no splitting rules apply.
  if (ing.perMl) {
    const volumeMl = targetMg / ing.perMl;
    // Large-volume advisories, ported verbatim from the reference: parenteral
    // routes cannot absorb big boluses, and any large oral volume is worth a
    // second look before it reaches the MAR.
    if (/\b(im|sq|subcut)\b/i.test(product.route ?? "") && volumeMl > 5) {
      warnings.push(
        `${Math.round(volumeMl * 100) / 100} mL is a large volume for the ${product.route} route — split doses may be needed.`,
      );
    } else if (volumeMl > 30) {
      warnings.push(
        `${Math.round(volumeMl * 100) / 100} mL is a large single dose — double-check the concentration and intended dose.`,
      );
    }
    return {
      volumeMl: Math.round(volumeMl * 100) / 100,
      perIngredientMg: [{ name: ing.name, mg: targetMg }],
      totalMg: targetMg,
      warnings: warnings.length ? warnings : undefined,
    };
  }

  // Reference taxonomy: exactly two failure branches after the low-target check.
  const step = smallestUnitFraction(product.doseForm);
  const ratio = targetMg / ing.strengthMg;
  if (ratio + EPS < 0.5) {
    return err(
      "target_lt_product",
      `Smallest dispensable dose of this product is ${ing.strengthMg * 0.5} mg (half a ${ing.strengthMg} mg unit) — lower than the ${targetMg} mg requested. Choose a lower strength.`,
    );
  }
  if (step === 1 && !isMultipleOf(ratio, 1)) {
    return err(
      "fraction_not_allowed",
      `${product.doseForm ?? "This form"} cannot be split. ${targetMg} mg would require ${ratio.toFixed(3)} units.`,
    );
  }
  if (step === 0.5 && !isMultipleOf(ratio, 0.5)) {
    return err(
      "quarter_not_allowed",
      `Tablets may only be halved. ${targetMg} mg would require ${ratio.toFixed(3)} units of a ${ing.strengthMg} mg tablet.`,
    );
  }

  const rounded = Math.round(ratio / step) * step;
  return {
    unitsPerAdmin: rounded,
    perIngredientMg: [{ name: ing.name, mg: rounded * ing.strengthMg }],
    totalMg: rounded * ing.strengthMg,
  };
}

/**
 * COMBO reconciliation, axis = units.
 * The clinician states how many units per administration; every ingredient's
 * delivered mg is derived. This is the unambiguous path.
 */
export function reconcileComboByUnits(
  product: DoseProduct | undefined,
  unitsPerAdmin: number,
): DoseResult {
  if (!product) return err("no_product", "Select a product before entering a dose.");
  if (!product.ingredients.length)
    return err("no_strength", "This product has no usable strength.");
  if (!Number.isFinite(unitsPerAdmin) || unitsPerAdmin <= 0)
    return err("invalid_target", "Enter a unit count greater than zero.");

  const step = smallestUnitFraction(product.doseForm);
  if (!isMultipleOf(unitsPerAdmin, step))
    return err(
      "fraction_not_allowed",
      `${product.doseForm ?? "This form"} may only be given in increments of ${step} unit.`,
    );

  return {
    unitsPerAdmin,
    perIngredientMg: product.ingredients.map((i) => ({
      name: i.name,
      mg: Math.round(i.strengthMg * unitsPerAdmin * 1000) / 1000,
    })),
    warnings: product.ingredientNamesFallback
      ? [
          "Ingredient names could not be read from the product name — they are matched to strengths by position. Verify each ingredient before signing.",
        ]
      : undefined,
  };
}

/**
 * COMBO reconciliation, axis = one named ingredient.
 * The clinician states the target mg of ONE ingredient (e.g. "16 mg
 * buprenorphine"); the unit count is solved for, then the co-ingredient's
 * delivered mg is reported so it is never invisible.
 */
export function reconcileComboByIngredient(
  product: DoseProduct | undefined,
  ingredientIndex: number,
  targetMg: number,
): DoseResult {
  if (!product) return err("no_product", "Select a product before entering a dose.");
  const ing = product.ingredients[ingredientIndex];
  if (!ing) return err("no_strength", "Pick which ingredient the dose refers to.");
  if (!Number.isFinite(targetMg) || targetMg <= 0)
    return err("invalid_target", "Enter a dose greater than zero.");

  const step = smallestUnitFraction(product.doseForm);
  if (targetMg / ing.strengthMg + EPS < 0.5)
    return err(
      "target_lt_product",
      `Smallest dispensable amount of ${ing.name} in this product is ${ing.strengthMg * 0.5} mg.`,
    );

  const units = targetMg / ing.strengthMg;
  if (!isMultipleOf(units, step))
    return err(
      step === 1 ? "fraction_not_allowed" : "quarter_not_allowed",
      `${targetMg} mg of ${ing.name} needs ${units.toFixed(3)} units of this product, which it cannot be split into.`,
    );

  return reconcileComboByUnits(product, Math.round(units / step) * step);
}

/** True when the product needs the axis-picker UI. */
export function isComboProduct(product?: DoseProduct): boolean {
  return !!product && product.ingredients.length > 1;
}
