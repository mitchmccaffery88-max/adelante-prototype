// §Batch B1 — compact, staff-only "Timely access" line. Stamps are
// system-set and read-only; coordinators can add a correction NOTE (reason
// required, audited) that shows beside the original, never replacing it.
import { useState } from "react";
import { toast } from "sonner";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { act, actFor } from "@/lib/actions/act";
import {
  canCorrectTimely,
  canRecordOffer,
  canSeeTimely,
  STAMP_LABEL,
  TIMELY_TARGETS_DRAFT,
  timelyAccessFor,
  timelyLine,
  type StampKind,
} from "@/lib/timelyAccess";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export function TimelyAccessLine({ patientId }: { patientId: string }) {
  const staff = useActingStaff();
  const v = useEhr(() => timelyAccessFor(patientId));
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<StampKind>("request");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  if (!canSeeTimely(staff.role)) return null;
  const actor = { name: staff.staffName, role: staff.role };
  const save = () => {
    try {
      actFor("timely_correction", "addTimelyCorrection", patientId, actor, { patientId, kind, correctedAt: date ? new Date(date).toISOString() : "", reason });
      toast.success("Correction note added — the original stamp is unchanged");
      setOpen(false);
      setReason("");
      setDate("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Card className="p-3" data-testid="timely-access">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-teal">Timely access</p>
          <p className="text-sm tabular-nums">{timelyLine(v)}</p>
          <p className="text-xs text-muted-foreground">Set by the system clock · can't be edited · {TIMELY_TARGETS_DRAFT.label}</p>
        </div>
        <div className="flex gap-1">
          {!v.request && canRecordOffer(staff.role) && (
            <Button size="sm" variant="outline" onClick={() => { try { act("timely_offer_record", "recordServiceRequest", actor, patientId); toast.success("Service request recorded now"); } catch (e) { toast.error((e as Error).message); } }}>
              Record request now
            </Button>
          )}
          {canCorrectTimely(staff.role) && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Add correction note</Button>
          )}
        </div>
      </div>
      {v.corrections.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {v.corrections.map((c) => (
            <li key={c.id}>
              <Badge variant="secondary" className="mr-1">Correction note</Badge>
              {STAMP_LABEL[c.kind]} should read {new Date(c.correctedAt).toLocaleDateString()} — {c.reason} ({c.byName}, {new Date(c.at).toLocaleDateString()}). Original stamp kept.
            </li>
          ))}
        </ul>
      )}
      {v.offers.some((o) => o.outcome !== "accepted") && (
        <p className="mt-1 text-xs text-muted-foreground">
          Offers declined or unanswered: {v.offers.filter((o) => o.outcome !== "accepted").length}
        </p>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetTitle>Add a correction note</SheetTitle>
          <SheetDescription>The original stamp never changes. Your note is shown next to it and audited.</SheetDescription>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-1">
              {(["request", "offered", "kept"] as StampKind[]).map((k) => (
                <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>{STAMP_LABEL[k]}</Button>
              ))}
            </div>
            <div><Label htmlFor="tc-date">Correct date</Label><Input id="tc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label htmlFor="tc-reason">Reason (required)</Label><Input id="tc-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <Button className="w-full" onClick={save}>Save correction note</Button>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
