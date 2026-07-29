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
  | "not_a_multiple";

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
  ingredients: DoseIngredient[];
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
 * Parse an RxNav-style strength string into ingredients.
 * Accepts "50 MG", "2 MG / 0.5 MG", "20 MG/ML", "5 MG / 325 MG".
 * `ingredientNames` (when known) is zipped positionally, as RxNav orders
 * SCD ingredient names and strengths consistently.
 */
export function parseStrength(
  strength: string | undefined,
  ingredientNames: string[] = [],
): DoseIngredient[] {
  if (!strength) return [];
  return strength
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((chunk, i) => {
      // "20 MG" | "20 MG/ML" already split on "/", so per-mL arrives as a bare unit.
      const m = chunk.match(/([\d.]+)\s*([a-zA-Zµ%]+)/);
      const name = ingredientNames[i] ?? `Ingredient ${i + 1}`;
      if (!m) return { name, strengthMg: NaN };
      const mg = normalizeStrengthToMg(Number(m[1]), m[2]);
      return { name, strengthMg: mg ?? NaN };
    })
    .filter((x) => Number.isFinite(x.strengthMg));
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

  // Liquids are continuous — no splitting rules apply.
  if (ing.perMl) {
    const volumeMl = targetMg / ing.perMl;
    return {
      volumeMl: Math.round(volumeMl * 100) / 100,
      perIngredientMg: [{ name: ing.name, mg: targetMg }],
      totalMg: targetMg,
    };
  }

  if (targetMg + EPS < ing.strengthMg * smallestUnitFraction(product.doseForm)) {
    return err(
      "target_lt_product",
      `Smallest dispensable dose of this product is ${ing.strengthMg * smallestUnitFraction(product.doseForm)} mg — lower than the ${targetMg} mg requested. Choose a lower strength.`,
    );
  }

  const units = targetMg / ing.strengthMg;
  const step = smallestUnitFraction(product.doseForm);
  if (!isMultipleOf(units, step)) {
    if (step === 1 && isMultipleOf(units, 0.5)) {
      return err(
        "fraction_not_allowed",
        `${product.doseForm ?? "This form"} cannot be split. ${targetMg} mg would require ${units} units.`,
      );
    }
    return err(
      "not_a_multiple",
      `${targetMg} mg is not achievable with ${ing.strengthMg} mg units (needs ${units.toFixed(3)} units).`,
    );
  }

  const rounded = Math.round(units / step) * step;
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
  if (targetMg + EPS < ing.strengthMg * step)
    return err(
      "target_lt_product",
      `Smallest dispensable amount of ${ing.name} in this product is ${ing.strengthMg * step} mg.`,
    );

  const units = targetMg / ing.strengthMg;
  if (!isMultipleOf(units, step))
    return err(
      step === 1 ? "fraction_not_allowed" : "not_a_multiple",
      `${targetMg} mg of ${ing.name} needs ${units.toFixed(3)} units of this product, which it cannot be split into.`,
    );

  return reconcileComboByUnits(product, Math.round(units / step) * step);
}

/** True when the product needs the axis-picker UI. */
export function isComboProduct(product?: DoseProduct): boolean {
  return !!product && product.ingredients.length > 1;
}
