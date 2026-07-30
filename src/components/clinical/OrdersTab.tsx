// §Orders — cart core (validation gate + attribution + attestation).
//
// DEV HANDOFF: port of BaggaEMR's OrderCart / MedicationAttributionSection /
// SignAttestation, core logic only. Explicitly deferred to a later pass and
// intentionally absent here: dose/route/frequency catalogs and pickers, sig
// editor, dispense-quantity auto-calc, pharmacy routing/transmission,
// duplicate-therapy checking, DEA schedule badges. Free-text inputs below are
// placeholders for those catalogs — keep the field names when swapping them in.

import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr, isProblemClinicallyActive, type MedOrder } from "@/lib/ehr";
import { useActingStaff, staffForRole, getStaffMember, canAccess } from "@/lib/roles";
import {
  validateOrder,
  issueFields,
  requiresAttribution,
  ORDER_SOURCE_OPTIONS,
  ATTESTATION_TEXT,
  REQ_FIELD,
  REQ_LABEL,
  type OrderFieldKey,
} from "@/lib/orders";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CatalogPicker, type CatalogSelection } from "@/components/orders/CatalogPicker";
import { MedicationDoseSection } from "@/components/orders/MedicationDoseSection";
import { EmptyState } from "@/components/EmptyState";
import { ClientDate } from "@/components/ClientDate";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList, Info, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NONE = "__none__";

function num(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

// ---------------------------------------------------------------------------
// Attribution (port of MedicationAttributionSection)
// ---------------------------------------------------------------------------
// Real safety control: a non-prescriber staging an order on a prescriber's
// behalf must name the ordering provider, the source of the order, and — for
// verbal/telephone orders — confirm read-back. Prescribers never see this.
function AttributionSection({
  order,
  blocked,
  onPatch,
}: {
  order: MedOrder;
  blocked: Set<OrderFieldKey>;
  onPatch: (patch: Partial<MedOrder>) => void;
}) {
  const prescribers = staffForRole("pmhnp");
  const needsReadBack = order.orderSource === "verbal" || order.orderSource === "telephone";
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-navy">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        Order attribution required
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        You are not a prescriber. Name the provider this order is placed for and how it was
        received.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className={cn("text-xs", blocked.has("orderingProviderId") && REQ_LABEL)}>
            Ordering provider *
          </Label>
          <Select
            value={order.orderingProviderId ?? ""}
            onValueChange={(v) => onPatch({ orderingProviderId: v })}
          >
            <SelectTrigger
              className={cn("mt-1", blocked.has("orderingProviderId") && REQ_FIELD)}
              aria-label="Ordering provider"
            >
              <SelectValue placeholder="Select prescriber" />
            </SelectTrigger>
            <SelectContent>
              {prescribers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.credential ? `, ${p.credential}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={cn("text-xs", blocked.has("orderSource") && REQ_LABEL)}>
            Order source *
          </Label>
          <Select
            value={order.orderSource ?? ""}
            onValueChange={(v) => onPatch({ orderSource: v as MedOrder["orderSource"] })}
          >
            <SelectTrigger
              className={cn("mt-1", blocked.has("orderSource") && REQ_FIELD)}
              aria-label="Order source"
            >
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {needsReadBack && (
        <label
          className={cn(
            "mt-3 flex items-start gap-2 text-xs",
            blocked.has("readBackConfirmed") && REQ_LABEL,
          )}
        >
          <Checkbox
            checked={!!order.readBackConfirmed}
            onCheckedChange={(v) => onPatch({ readBackConfirmed: v === true })}
            aria-label="Read-back confirmed"
          />
          <span>
            Read-back confirmed — I repeated this order back to the ordering provider and they
            verified it. *
          </span>
        </label>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attestation
// ---------------------------------------------------------------------------
// TODO(auth): This attestation is CHECKBOX-ONLY and does not re-verify
// clinician identity. The reference EMR (BaggaEMR) requires real password
// re-entry against the signing clinician's account before releasing
// orders to the chart — a legal attestation control. Adelante has no
// real per-user authentication yet. Once real auth exists, this MUST
// be upgraded to re-verify credentials before this component can be
// considered a genuine clinical attestation control. Do not treat the
// current checkbox as equivalent — it is a placeholder.
function SignAttestation({
  checked,
  onChange,
  staffName,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  staffName: string;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onChange(v === true)}
          aria-label="Attestation"
        />
        <span>
          {ATTESTATION_TEXT}
          <span className="block text-xs text-muted-foreground">Signing as {staffName}.</span>
        </span>
      </label>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Password re-verification pending real staff authentication.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft order editor
// ---------------------------------------------------------------------------
function DraftOrderCard({
  order,
  patientId,
  needsAttribution,
  problems,
  showIssues,
}: {
  order: MedOrder;
  patientId: string;
  needsAttribution: boolean;
  problems: { id: string; label: string }[];
  showIssues: boolean;
}) {
  const { staffName } = useActingStaff();
  const issues = validateOrder(order, { needsAttribution });
  const blocked = showIssues ? issueFields(issues) : new Set<OrderFieldKey>();
  const patch = (p: Partial<MedOrder>) => AdelanteEHR.updateDraftOrder(patientId, order.id, p);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-navy">{order.drugName}</div>
          <div className="text-xs text-muted-foreground">
            Draft · staged by {order.createdBy ?? staffName}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.isStat && <Badge variant="secondary">STAT</Badge>}
          {order.isControlled && <Badge variant="outline">Controlled</Badge>}
          {order.offCatalog && <Badge variant="destructive">Off-catalog</Badge>}
          {order.manualDose && <Badge variant="destructive">Manual dose</Badge>}
          {order.strengthSource === "dailymed" && <Badge variant="outline">Strength: DailyMed</Badge>}
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Remove ${order.drugName}`}
            onClick={() => AdelanteEHR.removeDraftOrder(patientId, order.id, staffName)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Phase 1: real catalog product + reconciled dose math + frequency
          catalog. TODO(orders, Phase 2): pharmacy routing, duplicate-therapy
          check, manual Sig override. */}
      <MedicationDoseSection order={order} blocked={blocked} onPatch={patch} />

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label className={cn("text-xs", blocked.has("quantity") && REQ_LABEL)}>
            Quantity * {order.quantityManual ? "(manual)" : "(auto)"}
          </Label>
          <Input
            className={cn("mt-1", blocked.has("quantity") && REQ_FIELD)}
            inputMode="numeric"
            value={order.quantity ?? ""}
            onChange={(e) => patch({ quantity: num(e.target.value), quantityManual: true })}
          />
        </div>
        <div>
          <Label className={cn("text-xs", blocked.has("duration") && REQ_LABEL)}>
            Duration {order.isStat ? "" : "*"}
          </Label>
          <Input
            className={cn("mt-1", blocked.has("duration") && REQ_FIELD)}
            inputMode="numeric"
            value={order.durationValue ?? ""}
            onChange={(e) => patch({ durationValue: num(e.target.value) })}
          />
        </div>
        <div>
          <Label className={cn("text-xs", blocked.has("duration") && REQ_LABEL)}>Unit</Label>
          <Select
            value={order.durationUnit ?? ""}
            onValueChange={(v) => patch({ durationUnit: v as MedOrder["durationUnit"] })}
          >
            <SelectTrigger
              className={cn("mt-1", blocked.has("duration") && REQ_FIELD)}
              aria-label="Duration unit"
            >
              <SelectValue placeholder="days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days">days</SelectItem>
              <SelectItem value="doses">doses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={cn("text-xs", blocked.has("daysSupply") && REQ_LABEL)}>
            Days supply {order.isControlled ? "*" : ""}{" "}
            {order.daysSupplyManual ? "(manual)" : "(auto)"}
          </Label>
          <Input
            className={cn("mt-1", blocked.has("daysSupply") && REQ_FIELD)}
            inputMode="numeric"
            value={order.daysSupply ?? ""}
            onChange={(e) => patch({ daysSupply: num(e.target.value), daysSupplyManual: true })}
            disabled={!order.isControlled}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={!!order.isControlled}
            onCheckedChange={(v) => patch({ isControlled: v === true })}
            aria-label="Controlled medication"
          />
          Controlled medication
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={!!order.isStat}
            onCheckedChange={(v) => patch({ isStat: v === true })}
            aria-label="STAT"
          />
          STAT (no duration required)
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className={cn("text-xs", blocked.has("indication") && REQ_LABEL)}>
            Indication — problem on file *
          </Label>
          <Select
            value={order.indicationProblemId ?? NONE}
            onValueChange={(v) => patch({ indicationProblemId: v === NONE ? undefined : v })}
          >
            <SelectTrigger
              className={cn("mt-1", blocked.has("indication") && REQ_FIELD)}
              aria-label="Indication problem"
            >
              <SelectValue placeholder="Link a problem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No linked problem</SelectItem>
              {problems.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={cn("text-xs", blocked.has("indication") && REQ_LABEL)}>
            …or free-text indication
          </Label>
          <Input
            className={cn("mt-1", blocked.has("indication") && REQ_FIELD)}
            value={order.indicationText ?? ""}
            onChange={(e) => patch({ indicationText: e.target.value })}
            placeholder="Reason for this order"
          />
        </div>
      </div>

      {needsAttribution && <AttributionSection order={order} blocked={blocked} onPatch={patch} />}

      {showIssues && issues.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700 dark:text-amber-400">
          {issues.map((i) => (
            <li key={`${i.field}-${i.message}`}>{i.message}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Orders tab
// ---------------------------------------------------------------------------
export function OrdersTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const { role, staffName } = useActingStaff();
  // Defense in depth: even if a caller forgets to pass readOnly, only roles with
  // meds_erx WRITE may author or sign orders. "read" on meds_erx is view-only.
  const viewOnly = readOnly || canAccess(role, "meds_erx").level !== "write";
  const orders = useEhr(() => AdelanteEHR.listOrders(patientId));
  const problemRows = useEhr(() => AdelanteEHR.listProblems(patientId));
  const problems = useMemo(
    () =>
      problemRows.filter(isProblemClinicallyActive).map((p) => ({
        id: p.id,
        label: p.icd10Code ? `${p.icd10Code} — ${p.description}` : p.description,
      })),
    [problemRows],
  );

  const [attested, setAttested] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const needsAttribution = requiresAttribution(role);
  const drafts = orders.filter((o) => o.status === "draft");
  const signed = orders.filter((o) => o.status === "signed");
  const allIssues = drafts.flatMap((o) => validateOrder(o, { needsAttribution }));
  const gatePasses = drafts.length > 0 && allIssues.length === 0;
  const canSign = !viewOnly && gatePasses && attested;

  const stage = (sel: CatalogSelection) => {
    if (viewOnly) return;
    AdelanteEHR.addDraftOrder(patientId, {
      drugName: sel.productName,
      productName: sel.productName,
      rxcui: sel.rxcui,
      strengthText: sel.strengthText,
      strengthSource: sel.strengthSource,
      doseForm: sel.doseForm,
      ingredientNames: sel.ingredientNames,
      offCatalog: sel.offCatalog,
      offCatalogJustification: sel.offCatalogJustification,
      createdBy: staffName,
    });
    setShowIssues(true);
  };

  const sign = () => {
    if (!canSign) return;
    const strengthProvenance = Object.fromEntries(
      drafts.map((d) => [d.id, strengthProvenanceFor(d)]),
    );
    const n = AdelanteEHR.signOrders(
      patientId,
      drafts.map((d) => d.id),
      staffName,
      { strengthProvenance },
    ).length;
    setAttested(false);
    setShowIssues(false);
    toast.success(`${n} order${n === 1 ? "" : "s"} signed.`);
  };

  return (
    <div className="space-y-4">
      {!viewOnly && (
        <Card className="p-4">
          <CatalogPicker onSelect={stage} />
        </Card>
      )}

      {drafts.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No draft orders"
          description={
            viewOnly
              ? "You can view signed orders but cannot create new ones."
              : "Stage a medication above to begin an order."
          }
        />
      ) : (
        <div className="space-y-3">
          {drafts.map((o) => (
            <DraftOrderCard
              key={o.id}
              order={o}
              patientId={patientId}
              needsAttribution={needsAttribution}
              problems={problems}
              showIssues={showIssues}
            />
          ))}
        </div>
      )}

      {!viewOnly && drafts.length > 0 && (
        <div className="space-y-3">
          <SignAttestation checked={attested} onChange={setAttested} staffName={staffName} />
          <Button className="w-full" disabled={!canSign} onClick={sign}>
            Sign {drafts.length} order{drafts.length === 1 ? "" : "s"}
          </Button>
          {!gatePasses && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Complete every highlighted required field before signing.
            </p>
          )}
        </div>
      )}

      {signed.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-navy">Signed orders</div>
          {signed.map((o) => (
            <Card key={o.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{o.drugName}</span>
                {o.dose && <span className="text-muted-foreground">{o.dose}</span>}
                {o.frequency && <span className="text-muted-foreground">{o.frequency}</span>}
                {o.isStat && <Badge variant="secondary">STAT</Badge>}
                {o.isControlled && <Badge variant="outline">Controlled</Badge>}
                {o.offCatalog && <Badge variant="destructive">Off-catalog</Badge>}
                {o.manualDose && <Badge variant="destructive">Manual dose</Badge>}
                {o.strengthSource === "dailymed" && (
                  <Badge variant="outline">Strength: DailyMed</Badge>
                )}
              </div>
              {o.sig && <div className="mt-1 text-xs italic text-muted-foreground">{o.sig}</div>}
              {o.manualDose && o.manualDoseJustification && (
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Dose reconciled manually because: {o.manualDoseJustification}
                </div>
              )}
              {o.offCatalog && o.offCatalogJustification && (
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Off-catalog justification: {o.offCatalogJustification}
                </div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                Attested by {o.attestedBy} ·{" "}
                {o.attestedAt ? <ClientDate value={o.attestedAt} /> : null}
                {o.orderingProviderId
                  ? ` · for ${getStaffMember(o.orderingProviderId)?.name ?? o.orderingProviderId}` +
                    (o.orderSource ? ` (${o.orderSource})` : "")
                  : ""}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
