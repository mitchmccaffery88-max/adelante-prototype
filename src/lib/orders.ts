// §Orders — validation gate + attribution rules.
//
// Faithful port of the pre-sign checks in Dr. Bagga's reference EMR
// (`OrderCart.canSign`). Kept in a standalone module (not inside the UI
// component) so a future server-side order API can re-run the exact same
// gate — client-only validation is not a safety control on its own.
//
// TODO(orders): later passes add duplicate-therapy checking, allergy
// cross-checks, and DEA-schedule-aware cosigner rules. Add them as extra
// entries in `validateOrder` so every consumer picks them up for free.

import type { MedOrder } from "@/lib/ehr";
import { canAccess, type StaffRole } from "@/lib/roles";
import {
  didFallbackToPositionalNames,
  extractIngredientNames,
  isComboProduct,
  isTopicalForm,
  isUnitDosedProduct,
  parseLiquidStrength,
  parseStrength,
  parseUnitsStrength,
  reconcileComboByIngredient,
  reconcileComboByUnits,
  reconcileDose,
  reconcileDoseByUnits,
  type DoseProduct,
  type DoseResult,
} from "@/lib/doseReconcile";

/**
 * Build the dose-math product view of an order. Liquids are detected first
 * ("20 MG/ML"), because the ingredient "/" split would otherwise mistake the
 * per-mL denominator for a second ingredient.
 */
export function productFromOrder(order: MedOrder): DoseProduct | undefined {
  if (!order.productName && !order.drugName) return undefined;
  const name = order.productName ?? order.drugName;
  const liquid = parseLiquidStrength(order.strengthText);
  if (liquid) {
    return {
      name,
      rxcui: order.rxcui,
      doseForm: order.doseForm,
      route: order.route,
      ingredients: [
        {
          name: extractIngredientNames(name)[0] ?? order.ingredientNames?.[0] ?? name,
          strengthMg: liquid.mgPerMl,
          perMl: liquid.mgPerMl,
        },
      ],
    };
  }
  // Unit-dosed concentration ("100 UNT/ML") — same shape as the liquid path,
  // but the axis is drug units, not mg.
  const unitConc = parseUnitsStrength(order.strengthText);
  if (unitConc?.unitsPerMl) {
    return {
      name,
      rxcui: order.rxcui,
      doseForm: order.doseForm,
      route: order.route,
      ingredients: [
        {
          name: extractIngredientNames(name)[0] ?? order.ingredientNames?.[0] ?? name,
          unitsPerMl: unitConc.unitsPerMl,
        },
      ],
    };
  }
  return {
    name,
    rxcui: order.rxcui,
    doseForm: order.doseForm,
    route: order.route,
    ingredients: parseStrength(order.strengthText, order.ingredientNames ?? [], name),
    ingredientNamesFallback: didFallbackToPositionalNames(order.strengthText, name),
  };
}

/** Field keys the UI highlights (amber) when they block signing. */
export type OrderFieldKey =
  | "drugName"
  | "dose"
  | "frequency"
  | "quantity"
  | "duration"
  | "daysSupply"
  | "indication"
  | "offCatalogJustification"
  | "manualDoseJustification"
  | "orderingProviderId"
  | "orderSource"
  | "readBackConfirmed";

export interface OrderIssue {
  field: OrderFieldKey;
  message: string;
}

/**
 * Which dosing model applies to this order. Resolved in priority order:
 *   topical  — cream/ointment/gel/lotion/foam/patch: apply-amount, never mg
 *   units    — strength expressed in UNT: insulin/heparin/biologics
 *   manual   — reconciliation exhausted (incl. DailyMed) + clinician override
 *   mg       — the normal reconciled path
 */
export type DoseMode = "mg" | "units" | "topical" | "manual";

export function doseModeFor(order: MedOrder): DoseMode {
  // RxNav's DOSE_FORM property is frequently absent, so the product NAME text
  // is checked too — "hydrocortisone 10 MG/ML Topical Cream" is a topical
  // whether or not the dose-form property came back.
  if (isTopicalForm(order.doseForm) || isTopicalForm(order.productName ?? order.drugName))
    return "topical";
  const product = productFromOrder(order);
  if (isUnitDosedProduct(product)) return "units";
  if (!product || product.ingredients.length === 0) return "manual";
  return "mg";
}

/** True when the ONLY remaining path is manual dose entry with a justification. */
export function reconciliationExhausted(order: MedOrder): boolean {
  return doseModeFor(order) === "manual";
}

/**
 * Should the DailyMed SPL fallback be queried for this catalog product?
 * Only when RxNav yields no parseable strength AND the product is neither
 * unit-dosed nor topical — those two are their own axes, not data gaps.
 * Pure so the ordering (RxNav -> DailyMed -> manual) is testable.
 */
export function needsDailyMedFallback(detail: {
  name: string;
  strength?: string;
  doseForm?: string;
  ingredientNames?: string[];
}): boolean {
  if (isTopicalForm(detail.doseForm) || isTopicalForm(detail.name)) return false;
  if (parseUnitsStrength(detail.strength)) return false;
  return parseStrength(detail.strength, detail.ingredientNames, detail.name).length === 0;
}

/**
 * Where an ingredient's machine-readable strength ultimately came from.
 *   rxnav        — RxNav's own strength/properties parsed cleanly
 *   dailymed     — RxNav had no parseable strength; the DailyMed SPL fallback did
 *   units_parsed — strength was expressed in drug UNITS ("100 UNT/ML"), not mg
 *   manual       — no machine-readable strength anywhere; clinician typed it
 */
export type StrengthSource = "rxnav" | "dailymed" | "units_parsed" | "manual";

export interface IngredientStrengthProvenance {
  ingredient: string;
  source: StrengthSource;
  strengthMg?: number;
  strengthUnits?: number;
  unitsPerMl?: number;
}

/**
 * Per-ingredient strength provenance for the audit trail. Reviewers must be
 * able to tell a machine-validated strength from a hand-typed one, so this is
 * recorded at sign time and never inferred after the fact.
 */
export function strengthProvenanceFor(order: MedOrder): IngredientStrengthProvenance[] {
  const product = productFromOrder(order);
  const fallbackName = order.productName ?? order.drugName;
  if (!product || product.ingredients.length === 0) {
    return [{ ingredient: fallbackName, source: "manual" }];
  }
  const catalogSource: StrengthSource = order.strengthSource === "dailymed" ? "dailymed" : "rxnav";
  return product.ingredients.map((ing) => {
    const unitDosed = ing.strengthUnits !== undefined || ing.unitsPerMl !== undefined;
    const hasMg = ing.strengthMg !== undefined;
    const source: StrengthSource = unitDosed
      ? "units_parsed"
      : hasMg
        ? catalogSource
        : // Topicals and exhausted products carry no quantitative strength; the
          // clinician's apply-amount / manual text is the operative instruction.
          "manual";
    return {
      ingredient: ing.name || fallbackName,
      source,
      strengthMg: ing.strengthMg,
      strengthUnits: ing.strengthUnits,
      unitsPerMl: ing.unitsPerMl,
    };
  });
}

/**
 * Attribution is required when the acting staff member cannot prescribe —
 * i.e. they lack write access to the `meds_erx` record class. Prescribers
 * (pmhnp) order under their own identity and never see the section.
 */
export function requiresAttribution(role: StaffRole): boolean {
  return canAccess(role, "meds_erx").level !== "write";
}

/** Per-field validation. Empty array = this order may be signed. */
export function validateOrder(order: MedOrder, opts: { needsAttribution: boolean }): OrderIssue[] {
  const issues: OrderIssue[] = [];
  const blank = (v?: string) => !v || !v.trim();

  if (blank(order.drugName)) issues.push({ field: "drugName", message: "Medication is required." });
  // Off-catalog governance: justification is a hard gate, never a soft warning.
  if (order.offCatalog && blank(order.offCatalogJustification))
    issues.push({
      field: "offCatalogJustification",
      message: "Off-catalog medications require a clinical justification.",
    });
  const mode = doseModeFor(order);
  if (mode === "topical") {
    // Topicals are dosed by application, not by a systemic mg target — never
    // gate signing on a missing mg value for these forms.
    if (blank(order.applicationInstruction))
      issues.push({
        field: "dose",
        message: "Application amount and site are required for topical products.",
      });
  } else if (mode === "manual") {
    if (blank(order.manualDose))
      issues.push({ field: "dose", message: "Dose is required (entered manually)." });
    // Same governance as off-catalog: a manually reconciled dose is not
    // machine-validated, so it needs a written reason.
    if (blank(order.manualDoseJustification))
      issues.push({
        field: "manualDoseJustification",
        message: "A manually reconciled dose requires a clinical justification.",
      });
  } else if (blank(order.dose)) {
    issues.push({ field: "dose", message: "Dose is required." });
  }
  if (blank(order.frequencyCode) && blank(order.frequency))
    issues.push({ field: "frequency", message: "Frequency is required." });
  if (order.quantity === undefined || order.quantity === null || Number.isNaN(order.quantity))
    issues.push({ field: "quantity", message: "Quantity is required." });
  // STAT orders are a single immediate administration — no duration.
  if (!order.isStat && (order.durationValue === undefined || !order.durationUnit))
    issues.push({ field: "duration", message: "Duration is required (or mark the order STAT)." });
  if (order.isControlled && (order.daysSupply === undefined || Number.isNaN(order.daysSupply)))
    issues.push({
      field: "daysSupply",
      message: "Days supply is required for controlled medications.",
    });
  if (!order.indicationProblemId && blank(order.indicationText))
    issues.push({
      field: "indication",
      message: "Indication is required — link a problem or enter free text.",
    });

  if (opts.needsAttribution) {
    if (blank(order.orderingProviderId))
      issues.push({ field: "orderingProviderId", message: "Ordering provider is required." });
    if (!order.orderSource)
      issues.push({ field: "orderSource", message: "Order source is required." });
    if (
      (order.orderSource === "verbal" || order.orderSource === "telephone") &&
      !order.readBackConfirmed
    )
      issues.push({
        field: "readBackConfirmed",
        message: "Read-back confirmation is required for verbal and telephone orders.",
      });
  }

  return issues;
}

export function issueFields(issues: OrderIssue[]): Set<OrderFieldKey> {
  return new Set(issues.map((i) => i.field));
}

/** Amber highlight classes — equivalent of the reference EMR's REQ_LABEL / REQ_FIELD. */
export const REQ_LABEL = "text-amber-700 dark:text-amber-400";
export const REQ_FIELD = "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20";

export const ORDER_SOURCE_OPTIONS: {
  value: NonNullable<MedOrder["orderSource"]>;
  label: string;
}[] = [
  { value: "verbal", label: "Verbal" },
  { value: "telephone", label: "Telephone" },
  { value: "protocol", label: "Protocol" },
  { value: "standing", label: "Standing order" },
];

export const ATTESTATION_TEXT =
  "I attest that these orders are clinically appropriate for this patient and that I take responsibility for them.";

/** Run the correct engine entry point for the order's chosen axis. */
export function reconcileForOrder(order: MedOrder): DoseResult | undefined {
  const product = productFromOrder(order);
  if (!product || product.ingredients.length === 0) return undefined;
  if (doseModeFor(order) === "topical") return undefined;
  if (isUnitDosedProduct(product)) {
    if (order.doseTargetUnits === undefined) return undefined;
    return reconcileDoseByUnits(product, order.doseTargetUnits, {
      // Pen/syringe products with a concentration support half-unit dosing.
      allowHalfUnits: product.ingredients.some((i) => !!i.unitsPerMl),
    });
  }
  const combo = isComboProduct(product);
  if (!combo) {
    if (order.doseTargetMg === undefined) return undefined;
    return reconcileDose(product, order.doseTargetMg);
  }
  if (order.doseAxis === "ingredient") {
    if (order.doseTargetMg === undefined) return undefined;
    return reconcileComboByIngredient(product, order.doseIngredientIndex ?? 0, order.doseTargetMg);
  }
  if (order.unitsPerAdmin === undefined) return undefined;
  return reconcileComboByUnits(product, order.unitsPerAdmin);
}
