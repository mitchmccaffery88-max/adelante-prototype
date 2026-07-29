// §Orders — dose entry wired to the real reconciliation engine.
//
// DEV HANDOFF: port of the reference EMR's MedicationDoseSection. The clinician
// never types a free-text dose string here — they state an INTENT on a chosen
// axis and the engine either produces a dispensable instruction or refuses with
// a specific reason. The rendered `order.dose` string is derived output, kept
// only so downstream/legacy readers (signed-order list, Sig) still work.
//
// Axis model (identical to the reference):
//   single ingredient / liquid -> mg
//   combo product              -> units, OR mg of one named ingredient
//
// Auto-calc: quantity and days supply mirror OrderCart.tsx's useEffect — they
// recompute from frequency + duration + reconciled amount UNLESS the clinician
// has hand-edited the field (quantityManual / daysSupplyManual), exactly like
// the reference's quantity_manual / days_supply_manual columns.

import { useEffect, useMemo } from "react";
import type { MedOrder } from "@/lib/ehr";
import {
  isComboProduct,
  reconcileComboByIngredient,
  reconcileComboByUnits,
  reconcileDose,
  smallestUnitFraction,
  type DoseResult,
} from "@/lib/doseReconcile";
import { productFromOrder, REQ_FIELD, REQ_LABEL, type OrderFieldKey } from "@/lib/orders";
import { FREQUENCY_CATALOG, frequencyByCode } from "@/lib/frequencies";
import { computeDispenseQuantity } from "@/lib/medSchedule";
import { buildSigLine } from "@/lib/sigLine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

function num(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

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

export function MedicationDoseSection({
  order,
  blocked,
  onPatch,
}: {
  order: MedOrder;
  blocked: Set<OrderFieldKey>;
  onPatch: (patch: Partial<MedOrder>) => void;
}) {
  const product = useMemo(() => productFromOrder(order), [order]);
  const combo = isComboProduct(product);
  const dose = useMemo(() => reconcileForOrder(order), [order]);
  const freq = frequencyByCode(order.frequencyCode);

  // Amount actually dispensed per administration: mL for liquids, units otherwise.
  const amountPerAdmin = dose?.volumeMl ?? dose?.unitsPerAdmin;

  const sig = useMemo(
    () =>
      buildSigLine({
        product,
        dose,
        frequencyLabel: freq?.sigLabel,
        isPrn: freq?.isPrn,
        route: order.route,
        durationValue: order.durationValue,
        durationUnit: order.durationUnit,
      }),
    [product, dose, freq, order.route, order.durationValue, order.durationUnit],
  );

  // Derived-output sync + dispense auto-calc.
  useEffect(() => {
    const patch: Partial<MedOrder> = {};

    const doseLabel =
      dose && !dose.error
        ? dose.volumeMl !== undefined
          ? `${dose.volumeMl} mL`
          : combo
            ? dose.perIngredientMg.map((i) => `${i.mg} mg`).join(" / ")
            : `${dose.totalMg} mg`
        : "";
    if ((order.dose ?? "") !== doseLabel) patch.dose = doseLabel;
    if ((order.frequency ?? "") !== (freq?.sigLabel ?? "")) patch.frequency = freq?.sigLabel ?? "";
    if ((order.sig ?? "") !== sig) patch.sig = sig;
    if (dose && !dose.error && dose.unitsPerAdmin !== order.unitsPerAdmin && !combo)
      patch.unitsPerAdmin = dose.unitsPerAdmin;

    const calc = computeDispenseQuantity({
      frequencyCode: order.frequencyCode,
      amountPerAdmin,
      durationValue: order.durationValue,
      durationUnit: order.durationUnit,
      isStat: order.isStat,
    });
    if (!order.quantityManual && calc.quantity !== undefined && calc.quantity !== order.quantity)
      patch.quantity = calc.quantity;
    // Days supply only matters for controlled meds (validation gate), but we
    // keep it current whenever it can be derived so the toggle is instant.
    if (
      !order.daysSupplyManual &&
      calc.daysSupply !== undefined &&
      calc.daysSupply !== order.daysSupply
    )
      patch.daysSupply = calc.daysSupply;

    if (Object.keys(patch).length > 0) onPatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    order.id,
    order.frequencyCode,
    order.durationValue,
    order.durationUnit,
    order.isStat,
    order.quantityManual,
    order.daysSupplyManual,
    amountPerAdmin,
    sig,
    dose?.error?.code,
  ]);

  const step = smallestUnitFraction(order.doseForm);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {order.strengthText && <Badge variant="outline">{order.strengthText}</Badge>}
        {order.doseForm && <Badge variant="outline">{order.doseForm}</Badge>}
        {order.offCatalog && <Badge variant="destructive">Off-catalog</Badge>}
        {!order.offCatalog && !product?.ingredients.length && (
          <span>No machine-readable strength — dose math unavailable for this product.</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Axis picker — combos only, mirroring the reference. */}
        {combo && (
          <div>
            <Label className="text-xs">Dose by</Label>
            <Select
              value={order.doseAxis === "ingredient" ? "ingredient" : "units"}
              onValueChange={(v) =>
                onPatch({
                  doseAxis: v as MedOrder["doseAxis"],
                  doseTargetMg: undefined,
                  unitsPerAdmin: undefined,
                })
              }
            >
              <SelectTrigger className="mt-1" aria-label="Dose axis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="units">Units per dose</SelectItem>
                <SelectItem value="ingredient">mg of one ingredient</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {combo && order.doseAxis === "ingredient" && (
          <div>
            <Label className="text-xs">Ingredient</Label>
            <Select
              value={String(order.doseIngredientIndex ?? 0)}
              onValueChange={(v) => onPatch({ doseIngredientIndex: Number(v) })}
            >
              <SelectTrigger className="mt-1" aria-label="Dose ingredient">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(product?.ingredients ?? []).map((i, idx) => (
                  <SelectItem key={i.name + idx} value={String(idx)}>
                    {i.name} ({i.strengthMg} mg)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {combo && order.doseAxis !== "ingredient" ? (
          <div>
            <Label className={cn("text-xs", blocked.has("dose") && REQ_LABEL)}>
              Units per dose * (step {step})
            </Label>
            <Input
              className={cn("mt-1", blocked.has("dose") && REQ_FIELD)}
              inputMode="decimal"
              value={order.unitsPerAdmin ?? ""}
              onChange={(e) => onPatch({ unitsPerAdmin: num(e.target.value) })}
              placeholder={String(step)}
            />
          </div>
        ) : (
          <div>
            <Label className={cn("text-xs", blocked.has("dose") && REQ_LABEL)}>
              Dose (mg) *
            </Label>
            <Input
              className={cn("mt-1", blocked.has("dose") && REQ_FIELD)}
              inputMode="decimal"
              value={order.doseTargetMg ?? ""}
              onChange={(e) => onPatch({ doseTargetMg: num(e.target.value) })}
              placeholder="50"
            />
          </div>
        )}

        <div>
          <Label className="text-xs">Route</Label>
          <Input
            className="mt-1"
            value={order.route ?? ""}
            onChange={(e) => onPatch({ route: e.target.value })}
            placeholder="oral"
          />
        </div>

        <div>
          <Label className={cn("text-xs", blocked.has("frequency") && REQ_LABEL)}>Frequency *</Label>
          <Select
            value={order.frequencyCode ?? ""}
            onValueChange={(v) => onPatch({ frequencyCode: v })}
          >
            <SelectTrigger
              className={cn("mt-1", blocked.has("frequency") && REQ_FIELD)}
              aria-label="Frequency"
            >
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_CATALOG.map((f) => (
                <SelectItem key={f.code} value={f.code}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {dose?.error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {dose.error.message}
        </p>
      )}

      {dose && !dose.error && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <div className="font-medium text-navy">
            {dose.volumeMl !== undefined
              ? `${dose.volumeMl} mL per dose`
              : `${dose.unitsPerAdmin} unit(s) per dose`}
          </div>
          <div className="mt-0.5 text-muted-foreground">
            {dose.perIngredientMg.map((i) => `${i.name}: ${i.mg} mg`).join(" · ")}
          </div>
          {sig && <div className="mt-1.5 italic">{sig}</div>}
        </div>
      )}
    </div>
  );
}
