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
import { commonDosesFor, isComboProduct, smallestUnitFraction } from "@/lib/doseReconcile";
import {
  doseModeFor,
  productFromOrder,
  reconcileForOrder,
  REQ_FIELD,
  REQ_LABEL,
  type OrderFieldKey,
} from "@/lib/orders";
import { FREQUENCY_CATALOG, frequencyByCode } from "@/lib/frequencies";
import { computeDispenseQuantity } from "@/lib/medSchedule";
import { buildSigLine } from "@/lib/sigLine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info } from "lucide-react";

function num(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
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
  // NOTE: the order row is mutated in place by the store, so its identity is a
  // useless memo key — these derivations are cheap and must run every render.
  const product = productFromOrder(order);
  const mode = doseModeFor(order);
  const combo = isComboProduct(product);
  const dose = reconcileForOrder(order);
  const freq = frequencyByCode(order.frequencyCode);
  const unitsPerMl = product?.ingredients.find((i) => i.unitsPerMl)?.unitsPerMl;
  // Persisted axis, so downstream readers know which model produced `dose`.
  const axisValue: NonNullable<MedOrder["doseAxis"]> =
    mode === "topical"
      ? "topical"
      : mode === "manual"
        ? "manual"
        : mode === "units"
          ? "drugUnits"
          : combo && order.doseAxis === "ingredient"
            ? "ingredient"
            : combo
              ? "units"
              : "mg";

  // Amount actually dispensed per administration: mL for liquids, units otherwise.
  const amountPerAdmin = dose?.volumeMl ?? dose?.unitsPerAdmin;
  // Unit-dosed pens/vials are not dispensed in bottle sizes, so they do not use
  // the liquid rounding table even though a fill volume exists.
  const isLiquid = dose?.volumeMl !== undefined && !dose.isUnitDose;

  // Quick-pick chips are keyed to the axis ingredient (combo) or the single
  // ingredient, matching the reference's common-dose shortcuts.
  const axisIngredient =
    combo && order.doseAxis === "ingredient"
      ? product?.ingredients[order.doseIngredientIndex ?? 0]?.name
      : product?.ingredients[0]?.name;
  const quickDoses = commonDosesFor(axisIngredient);

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
        applicationInstruction: mode === "topical" ? order.applicationInstruction : undefined,
      }),
    [
      product,
      dose,
      freq,
      mode,
      order.applicationInstruction,
      order.route,
      order.durationValue,
      order.durationUnit,
    ],
  );

  // Derived-output sync + dispense auto-calc.
  useEffect(() => {
    const patch: Partial<MedOrder> = {};

    const doseLabel =
      mode === "topical"
        ? (order.applicationInstruction ?? "")
        : mode === "manual"
          ? (order.manualDose ?? "")
          : dose && !dose.error
            ? dose.isUnitDose
              ? `${dose.unitsPerAdmin} units`
              : dose.volumeMl !== undefined
                ? `${dose.volumeMl} mL`
                : combo
                  ? dose.perIngredientMg.map((i) => `${i.mg} mg`).join(" / ")
                  : `${dose.totalMg} mg`
            : "";
    if ((order.dose ?? "") !== doseLabel) patch.dose = doseLabel;
    if ((order.frequency ?? "") !== (freq?.sigLabel ?? "")) patch.frequency = freq?.sigLabel ?? "";
    const manualSig =
      mode === "manual" && order.manualDose?.trim()
        ? `${order.manualDose.trim()}${freq?.sigLabel ? ` ${freq.sigLabel}` : ""}.`
        : sig;
    if ((order.sig ?? "") !== manualSig) patch.sig = manualSig;
    if ((order.doseAxis ?? "") !== axisValue) patch.doseAxis = axisValue;
    if (dose && !dose.error && dose.unitsPerAdmin !== order.unitsPerAdmin && !combo)
      patch.unitsPerAdmin = dose.unitsPerAdmin;

    const calc = computeDispenseQuantity({
      frequencyCode: order.frequencyCode,
      amountPerAdmin,
      durationValue: order.durationValue,
      durationUnit: order.durationUnit,
      isStat: order.isStat,
      isLiquid,
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
    order.doseTargetMg,
    order.doseTargetUnits,
    order.doseIngredientIndex,
    order.unitsPerAdmin,
    order.frequencyCode,
    order.durationValue,
    order.durationUnit,
    order.isStat,
    order.quantityManual,
    order.daysSupplyManual,
    order.applicationInstruction,
    order.manualDose,
    mode,
    axisValue,
    amountPerAdmin,
    isLiquid,
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
        {order.strengthSource === "dailymed" && (
          <Badge variant="outline">Strength from DailyMed label</Badge>
        )}
        {order.manualDose && <Badge variant="destructive">Manual dose</Badge>}
        {mode === "topical" && <Badge variant="secondary">Topical — dosed by application</Badge>}
        {mode === "units" && <Badge variant="secondary">Unit-dosed product</Badge>}
      </div>

      {/* Topical / external: no mg reconciliation at all — the clinically
          correct model for creams, ointments, gels, lotions, foams, patches. */}
      {mode === "topical" && (
        <div className="[.chart-pane_&]:max-w-2xl">
          <Label className={cn("text-xs", blocked.has("dose") && REQ_LABEL)}>
            Apply amount / site *
          </Label>
          <Input
            className={cn("mt-1", blocked.has("dose") && REQ_FIELD)}
            value={order.applicationInstruction ?? ""}
            onChange={(e) => onPatch({ applicationInstruction: e.target.value })}
            placeholder="thin layer to affected area"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Topical products are dosed by application, not by a systemic mg target.
          </p>
        </div>
      )}

      {/* Reconciliation exhausted: unit axis N/A, not topical, and DailyMed
          also came back empty. Same governance shape as off-catalog entry. */}
      {mode === "manual" && (
        <div className="space-y-2 rounded-lg border border-dashed border-amber-500 p-3 [.chart-pane_&]:grid [.chart-pane_&]:grid-cols-2 [.chart-pane_&]:gap-3 [.chart-pane_&]:space-y-0">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400 [.chart-pane_&]:col-span-2">
            <AlertTriangle className="h-4 w-4" />
            Dose cannot be machine-verified for this product
          </div>
          <p className="text-xs text-muted-foreground [.chart-pane_&]:col-span-2">
            No usable strength from RxNorm or the DailyMed label. Enter the dose manually — it will
            be flagged everywhere this order appears.
          </p>
          <div>
            <Label className={cn("text-xs", blocked.has("dose") && REQ_LABEL)}>Dose (manual) *</Label>
            <Input
              className={cn("mt-1", blocked.has("dose") && REQ_FIELD)}
              value={order.manualDose ?? ""}
              onChange={(e) => onPatch({ manualDose: e.target.value })}
              placeholder="e.g. 1 tablet"
            />
          </div>
          <div>
            <Label className={cn("text-xs", blocked.has("manualDoseJustification") && REQ_LABEL)}>
              Dose reconciled manually because… *
            </Label>
            <Textarea
              className={cn("mt-1", blocked.has("manualDoseJustification") && REQ_FIELD)}
              rows={2}
              value={order.manualDoseJustification ?? ""}
              onChange={(e) => onPatch({ manualDoseJustification: e.target.value })}
              placeholder="Clinical justification (required)"
              aria-label="Manual dose justification"
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3 [.chart-pane_&]:xl:grid-cols-4">
        {/* Unit axis — insulin, heparin, some biologics. */}
        {mode === "units" && (
          <div>
            <Label className={cn("text-xs", blocked.has("dose") && REQ_LABEL)}>Dose (units) *</Label>
            <Input
              className={cn("mt-1", blocked.has("dose") && REQ_FIELD)}
              inputMode="decimal"
              value={order.doseTargetUnits ?? ""}
              onChange={(e) => onPatch({ doseTargetUnits: num(e.target.value) })}
              placeholder="18"
              aria-label="Dose in units"
            />
            {unitsPerMl && (
              <p className="mt-1 text-xs text-muted-foreground">
                Concentration {unitsPerMl} units/mL — fill volume is shown as a convenience.
              </p>
            )}
          </div>
        )}

        {/* Axis picker — combos only, mirroring the reference. */}
        {mode === "mg" && combo && (
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

        {mode === "mg" && combo && order.doseAxis === "ingredient" && (
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

        {mode === "mg" && combo && order.doseAxis !== "ingredient" ? (
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
        ) : mode === "mg" ? (
          <div>
            <Label className={cn("text-xs", blocked.has("dose") && REQ_LABEL)}>Dose (mg) *</Label>
            <Input
              className={cn("mt-1", blocked.has("dose") && REQ_FIELD)}
              inputMode="decimal"
              value={order.doseTargetMg ?? ""}
              onChange={(e) => onPatch({ doseTargetMg: num(e.target.value) })}
              placeholder="50"
              aria-label="Dose in mg"
            />
            {quickDoses.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {quickDoses.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={order.doseTargetMg === d ? "default" : "outline"}
                    className="h-7 px-2 text-xs"
                    onClick={() => onPatch({ doseTargetMg: d })}
                    aria-label={`Common dose ${d} mg`}
                  >
                    {d} mg
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : null}

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
          <Label className={cn("text-xs", blocked.has("frequency") && REQ_LABEL)}>
            Frequency *
          </Label>
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

      {dose?.warnings?.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {w}
        </p>
      ))}

      {/* Sig manual override. `order.sig` always holds the auto-generated
          text; the override is stored separately so downstream readers can
          tell a hand-edited Sig from a derived one. */}
      <div className="[.chart-pane_&]:max-w-3xl">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs" htmlFor={`sig-${order.id}`}>
            Sig line {order.sigManualOverride ? "(edited)" : "(auto-generated)"}
          </Label>
          {order.sigManualOverride && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => onPatch({ sigOverride: undefined, sigManualOverride: false })}
            >
              Reset to auto-generated
            </Button>
          )}
        </div>
        <Textarea
          id={`sig-${order.id}`}
          aria-label="Sig line"
          rows={2}
          className="mt-1"
          value={order.sigOverride ?? order.sig ?? ""}
          onChange={(e) => onPatch({ sigOverride: e.target.value, sigManualOverride: true })}
          placeholder="Sig will generate from the dose and frequency above"
        />
        {order.sigManualOverride && (order.sig ?? "").trim() && (
          <p className="mt-1 text-xs text-muted-foreground">Auto-generated: {order.sig}</p>
        )}
      </div>
    </div>
  );
}
