// §Orders — human-readable Sig line builder.
//
// DEV HANDOFF: port of the reference EMR's `sigLine.ts`. The Sig is what the
// patient, the MAR, and the pharmacy all read, so it is built from the
// RECONCILED values (units/volume returned by doseReconcile), never from the
// clinician's raw typing. Combo products spell out each ingredient's delivered
// mg so a co-ingredient is never invisible on the label.
//
// TODO(orders, Phase 2): the reference also supports a manual Sig override with
// a "modified" flag. Deliberately not built in this pass.

import type { DoseProduct, DoseResult } from "@/lib/doseReconcile";
import { isComboProduct } from "@/lib/doseReconcile";

export interface SigInput {
  product?: DoseProduct;
  dose?: DoseResult;
  /** Frequency catalog label, e.g. "twice daily". */
  frequencyLabel?: string;
  isPrn?: boolean;
  prnReason?: string;
  route?: string;
  durationValue?: number;
  durationUnit?: "days" | "doses";
  /**
   * Topical/external forms are dosed by application, not by mg — this text
   * ("thin layer to affected area") IS the dose portion of the Sig.
   */
  applicationInstruction?: string;
}

function unitNoun(doseForm: string | undefined, count: number): string {
  const plural = count !== 1;
  if (!doseForm) return plural ? "units" : "unit";
  if (/capsule/i.test(doseForm)) return plural ? "capsules" : "capsule";
  if (/tablet/i.test(doseForm)) return plural ? "tablets" : "tablet";
  if (/patch/i.test(doseForm)) return plural ? "patches" : "patch";
  if (/film|strip/i.test(doseForm)) return plural ? "films" : "film";
  return plural ? "units" : "unit";
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function buildSigLine(input: SigInput): string {
  const {
    product,
    dose,
    frequencyLabel,
    isPrn,
    prnReason,
    route,
    durationValue,
    durationUnit,
    applicationInstruction,
  } = input;

  const tail = (parts: string[]): string => {
    if (frequencyLabel) parts.push(frequencyLabel);
    if (isPrn) parts.push(prnReason ? `as needed for ${prnReason}` : "as needed");
    if (durationValue && durationUnit)
      parts.push(
        durationUnit === "days" ? `for ${durationValue} days` : `for ${durationValue} doses`,
      );
    return `${parts.join(" ")}.`;
  };

  // Topical: "Apply thin layer to affected area twice daily."
  if (applicationInstruction?.trim()) return tail(["Apply", applicationInstruction.trim()]);

  if (!product || !dose || dose.error) return "";

  // Unit-dosed products (insulin, heparin): the unit count IS the instruction.
  if (dose.isUnitDose && dose.unitsPerAdmin !== undefined) {
    const parts = [`Give ${fmtNum(dose.unitsPerAdmin)} units`];
    if (dose.volumeMl !== undefined) parts.push(`(${fmtNum(dose.volumeMl)} mL)`);
    if (route) parts.push(`by ${route.toLowerCase()} route`);
    return tail(parts);
  }

  const parts: string[] = ["Take"];

  if (dose.volumeMl !== undefined) {
    const mg = dose.totalMg !== undefined ? ` (${fmtNum(dose.totalMg)} mg)` : "";
    parts.push(`${fmtNum(dose.volumeMl)} mL${mg}`);
  } else if (dose.unitsPerAdmin !== undefined) {
    const u = dose.unitsPerAdmin;
    parts.push(`${fmtNum(u)} ${unitNoun(product.doseForm, u)}`);
    if (isComboProduct(product)) {
      const each = dose.perIngredientMg.map((i) => `${i.name} ${fmtNum(i.mg)} mg`).join(" / ");
      parts.push(`(${each})`);
    } else if (dose.totalMg !== undefined) {
      parts.push(`(${fmtNum(dose.totalMg)} mg)`);
    }
  } else {
    return "";
  }

  if (route) parts.push(`by ${route.toLowerCase()} route`);
  return tail(parts);
}
