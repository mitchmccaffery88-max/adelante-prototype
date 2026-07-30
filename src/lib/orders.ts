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
  parseLiquidStrength,
  parseStrength,
  reconcileComboByIngredient,
  reconcileComboByUnits,
  reconcileDose,
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
  | "orderingProviderId"
  | "orderSource"
  | "readBackConfirmed";

export interface OrderIssue {
  field: OrderFieldKey;
  message: string;
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
  if (blank(order.dose)) issues.push({ field: "dose", message: "Dose is required." });
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
