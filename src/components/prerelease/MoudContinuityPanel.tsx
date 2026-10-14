// §Phase 3 Part B — staff-only continuity status + side drawer. Shared by the
// pre-release episode detail and the chart Reentry tab; both read one record.
// Renders nothing for viewers without Part 2 access (no record, no title).
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import {
  canViewMoudContinuity, getMoudContinuity, moudContinuityView, moudOrdersFor, moudWriterCheck, releaseCycleFor, supplyView,
  MOUD_CLINICAL_DEFAULT_NOTE, MOUD_CONFIRM_LABEL, MOUD_PLAN_LABEL, type MoudConfirmType, type MoudPlanType,
} from "@/lib/moudContinuity";
import { StatusChip } from "@/components/ui/status-chip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function MoudContinuityPanel({ patientId }: { patientId: string }) {
  const { role, staffId, staffName } = useActingStaff();
  const actor = { role, staffId };
  // Re-read on every store change.
  const tick = useEhr(() => AdelanteEHR.listAuditEvents({ patientId }).length);
  void tick;
  const [open, setOpen] = useState<null | "plan" | "confirm">(null);
  const [kind, setKind] = useState<string>("");
  const [at, setAt] = useState(new Date().toISOString().slice(0, 10));

  if (!canViewMoudContinuity(actor, patientId)) return null;
  const orders = moudOrdersFor(patientId);
  if (!orders.length) return null;
  const cycle = releaseCycleFor(patientId);
  const record = getMoudContinuity(patientId, actor);
  const view = moudContinuityView(record, cycle);
  const writer = moudWriterCheck(actor, patientId);
  const supply = orders.map((o) => ({ o, v: supplyView(o) })).filter((x) => x.v);

  const save = () => {
    const patient = AdelanteEHR.getPatient(patientId);
    const id = open === "plan" ? "moud_plan_record" : "moud_continuity_confirm";
    const r = runAction(id, { role, staffId, staffName }, patient, {
      args: [{ patientId, type: kind, at, actor: { role, staffId } }],
    });
    if (!r.ok) { toast(r.reason); return; }
    toast(open === "plan" ? "Plan saved." : "Continuity confirmed.");
    setOpen(null);
  };
  const begin = (m: "plan" | "confirm") => { setKind(""); setAt(new Date().toISOString().slice(0, 10)); setOpen(m); };
  const options: [string, string][] = open === "plan"
    ? (Object.entries(MOUD_PLAN_LABEL) as [MoudPlanType, string][])
    : (Object.entries(MOUD_CONFIRM_LABEL) as [MoudConfirmType, string][]);

  return (
    <Card className="p-3" data-testid="moud-continuity" lang="en">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="text-sm font-medium">MOUD continuity</div>
          <div className="flex flex-wrap items-center gap-2">
            {view ? <StatusChip state={view.state} label={view.label} lang="en" data-testid="moud-continuity-chip" />
              : <span className="text-sm text-muted-foreground">No confirmed release date on record.</span>}
            {supply.map(({ o, v }) => <StatusChip key={o.id} state={v!.state} label={v!.label} lang="en" data-testid={`moud-supply-${o.id}`} />)}
          </div>
          <p className="text-sm text-muted-foreground">
            {record?.planInPlace ? `Plan: ${MOUD_PLAN_LABEL[record.planInPlace.type]} · ${record.planInPlace.at}` : "No plan recorded."}
            {record?.confirmed ? ` · Confirmed: ${MOUD_CONFIRM_LABEL[record.confirmed.type]} · ${record.confirmed.at}` : ""}
            {cycle?.releaseDate ? ` · Released ${cycle.releaseDate}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">{MOUD_CLINICAL_DEFAULT_NOTE}</p>
        </div>
        {writer.ok ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => begin("plan")} data-testid="moud-plan-open">
              {record?.planInPlace ? "Change plan" : "Record plan"}
            </Button>
            {cycle?.released && !record?.confirmed && (
              <Button size="sm" variant="outline" onClick={() => begin("confirm")} data-testid="moud-confirm-open">Confirm continuity</Button>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground" data-testid="moud-read-only">Read only — {writer.reason}</span>
        )}
      </div>

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" lang="en" data-testid="moud-drawer">
          <SheetHeader>
            <SheetTitle>{open === "plan" ? "Record MOUD plan" : "Confirm MOUD continuity"}</SheetTitle>
            <SheetDescription>
              {open === "plan" ? "What is in place for the first days after release?" : "What confirmed continuity in the community?"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <RadioGroup value={kind} onValueChange={setKind} aria-label="Type">
              {options.map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  <RadioGroupItem value={k} id={`moud-${k}`} />
                  <Label htmlFor={`moud-${k}`}>{label}</Label>
                </div>
              ))}
            </RadioGroup>
            <div className="space-y-1">
              <Label htmlFor="moud-at">Date</Label>
              <Input id="moud-at" type="date" value={at} onChange={(e) => setAt(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">{MOUD_CLINICAL_DEFAULT_NOTE}</p>
            <div className="flex gap-2">
              <Button onClick={save} disabled={!kind || !at} data-testid="moud-save">Save</Button>
              <Button variant="ghost" onClick={() => setOpen(null)}>Not now</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
