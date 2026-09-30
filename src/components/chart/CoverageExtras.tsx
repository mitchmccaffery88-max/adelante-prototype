// §Batch A2 + A4 — staff-only extras in the chart's Eligibility section:
// the FSP presumptive-eligibility badge (justice-involved only, custody read
// roles only) and every service's funding source + care continuum category.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type FundingLane } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { act, actFor } from "@/lib/actions/act";
import {
  AGE_BAND_LABEL,
  canRecordCustodyDuration,
  CUSTODY_PROVENANCE_LABEL,
  FSP_MIN_MONTHS,
  FSP_RULE_LABEL,
  fspStatusFor,
  reportingAgeBand,
  type CustodyProvenance,
} from "@/lib/fspEligibility";
import {
  CARE_CONTINUUM,
  canOverrideClassification,
  classificationDisplay,
  DRAFT_RULE_LABEL,
  FUNDING_LABEL,
  listServiceClassifications,
  SERVICE_KIND_LABEL,
  type CareContinuum,
  type ServiceClassification,
} from "@/lib/serviceClassification";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export function CoverageExtras({ patientId }: { patientId: string }) {
  return (
    <div className="mt-4 space-y-4">
      <FspCard patientId={patientId} />
      <ServiceFundingCard patientId={patientId} />
    </div>
  );
}

function FspCard({ patientId }: { patientId: string }) {
  const me = useActingStaff();
  const status = useEhr(() => fspStatusFor(me.role, patientId));
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [open, setOpen] = useState(false);
  if (!status || !patient) return null;
  const canEdit = canRecordCustodyDuration(me.role, patient);
  const band = patient.dob ? AGE_BAND_LABEL[reportingAgeBand(patient.dob, new Date().toISOString())] : "—";
  const known = status.history.length > 0;
  return (
    <Card className="p-4 space-y-2" data-testid="fsp-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">FSP presumptive eligibility</span>
        {known ? (
          <Badge variant={status.fspPresumptiveEligible ? "default" : "outline"} data-testid="fsp-badge">
            {status.fspPresumptiveEligible ? "Presumptively eligible" : "Not presumptively eligible"}
          </Badge>
        ) : (
          <Badge variant="outline">Custody time not recorded</Badge>
        )}
        <Badge variant="outline" className="text-[10px]">Staff only</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {known ? `${status.months} month${status.months === 1 ? "" : "s"} in custody (${CUSTODY_PROVENANCE_LABEL[status.provenance]}). ` : ""}
        Rule: {FSP_MIN_MONTHS}+ months in custody. Reporting age band today: {band}. {FSP_RULE_LABEL}.
      </p>
      {canEdit && <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="fsp-edit">{known ? "Update custody time" : "Record custody time"}</Button>}
      {status.history.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Change history ({status.history.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {status.history.slice().reverse().map((h, i) => (
              <li key={i}>{new Date(h.at).toLocaleString()} — {h.by}: {h.months} months, {h.eligible ? "eligible" : "not eligible"}</li>
            ))}
          </ul>
        </details>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetTitle>Custody time</SheetTitle>
          <SheetDescription>Dates if known, otherwise total months. {FSP_RULE_LABEL}.</SheetDescription>
          <CustodyForm patientId={patientId} onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function CustodyForm({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const me = useActingStaff();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [months, setMonths] = useState("");
  const [prov, setProv] = useState<CustodyProvenance>("custody_record");
  const save = () => {
    try {
      act("fsp_custody_record", "recordCustodyDuration", { role: me.role, name: me.staffName }, patientId, {
        custodyStart: start || undefined,
        custodyEnd: end || undefined,
        totalMonths: start ? undefined : months === "" ? undefined : Number(months),
        provenance: prov,
      });
      toast.success("Custody time saved");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="mt-4 space-y-3" data-testid="custody-form">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="cs">Custody start</Label><Input id="cs" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="ce">Custody end</Label><Input id="ce" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="cm">Or total months (dates unknown)</Label><Input id="cm" type="number" inputMode="numeric" value={months} disabled={!!start} onChange={(e) => setMonths(e.target.value)} /></div>
      <div className="space-y-1">
        <Label htmlFor="cp">Where this came from</Label>
        <select id="cp" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={prov} onChange={(e) => setProv(e.target.value as CustodyProvenance)}>
          {Object.entries(CUSTODY_PROVENANCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Button className="w-full" onClick={save}>Save</Button>
    </div>
  );
}

function ServiceFundingCard({ patientId }: { patientId: string }) {
  const me = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const rows = useEhr(() => listServiceClassifications(patientId).slice(0, 8));
  const [editing, setEditing] = useState<ServiceClassification | null>(null);
  if (!rows.length) return null;
  const canOverride = canOverrideClassification(me.role);
  return (
    <Card className="p-4 space-y-2" data-testid="service-funding-card">
      <div>
        <p className="font-medium text-sm">Services: funding &amp; category</p>
        <p className="text-xs text-muted-foreground">Set automatically by rule when each service is created. {DRAFT_RULE_LABEL}.</p>
      </div>
      <ul className="divide-y text-sm">
        {rows.map((r) => {
          const d = classificationDisplay(r, me.role, patient);
          return (
            <li key={`${r.ref.kind}:${r.ref.id}`} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-28">{SERVICE_KIND_LABEL[r.ref.kind]} · {new Date(r.serviceDate).toLocaleDateString()}</span>
              <span className="text-xs">{d.funding}</span>
              <span className="text-xs text-muted-foreground">{d.continuum}</span>
              <Badge variant="outline" className="text-[10px]" data-testid="provenance-chip">{d.provenance}</Badge>
              {canOverride && <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setEditing(r)}>Override</Button>}
            </li>
          );
        })}
      </ul>
      <Sheet open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetTitle>Override funding / category</SheetTitle>
          <SheetDescription>A reason is required. The change is kept in history and audited.</SheetDescription>
          {editing && <OverrideForm row={editing} patientId={patientId} onDone={() => setEditing(null)} />}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function OverrideForm({ row, patientId, onDone }: { row: ServiceClassification; patientId: string; onDone: () => void }) {
  const me = useActingStaff();
  const [funding, setFunding] = useState<FundingLane>(row.fundingSource);
  const [cat, setCat] = useState<CareContinuum>(row.careContinuum);
  const [reason, setReason] = useState("");
  const patient = AdelanteEHR.getPatient(patientId);
  const catLocked = classificationDisplay(row, me.role, patient).continuum === "Restricted";
  const save = () => {
    try {
      actFor("service_classification_override", "overrideServiceClassification", patientId, { role: me.role, name: me.staffName }, row.ref, { fundingSource: funding, careContinuum: catLocked ? undefined : cat, reason });
      toast.success("Override saved");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="mt-4 space-y-3">
      <div className="space-y-1">
        <Label htmlFor="of">Funding source</Label>
        <select id="of" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={funding} onChange={(e) => setFunding(e.target.value as FundingLane)}>
          {Object.entries(FUNDING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="oc">Category (draft list)</Label>
        {catLocked ? <p className="text-sm text-muted-foreground">Restricted</p> : <select id="oc" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value as CareContinuum)}>
          {CARE_CONTINUUM.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>}
      </div>
      <div className="space-y-1"><Label htmlFor="or">Reason</Label><Input id="or" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <Button className="w-full" onClick={save}>Save override</Button>
    </div>
  );
}
