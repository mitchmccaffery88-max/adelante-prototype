// §Crisis escalation — shared UI: flag dialog, resolve dialog, and the
// patient-scoped panel rendered at the top of the Alerts tab.
//
// Placement rationale: the escalation IS a PatientAlert, so the Alerts tab is
// where a clinician already looks for the flag. Keeping both in one place
// means the flag and its workflow record can never drift visually.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type CrisisEscalation } from "@/lib/ehr";
import { canFlagCrisis, useActingStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClientDate } from "@/components/ClientDate";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Siren } from "lucide-react";

export function timeOpenLabel(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.round((now - +new Date(iso)) / 60000));
  if (mins < 60) return `${mins}m open`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m open`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h open`;
}

export function FlagCrisisButton({
  patientId,
  size = "sm",
}: {
  patientId: string;
  size?: "sm" | "default";
}) {
  const { role, staffName } = useActingStaff();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!canFlagCrisis(role)) return null;

  const submit = () => {
    try {
      AdelanteEHR.flagCrisis(patientId, staffName, reason);
      toast.success("Crisis flagged — critical alert created and added to the crisis queue.");
      setReason("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not flag crisis.");
    }
  };

  return (
    <>
      <Button size={size} variant="destructive" onClick={() => setOpen(true)}>
        <Siren className="h-3.5 w-3.5 mr-1.5" /> Flag crisis
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag crisis escalation</DialogTitle>
            <DialogDescription>
              Creates a critical patient alert and an open escalation in the crisis queue. There is
              no paging, SMS, or email — the queue is the notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Reason (required)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="What you observed or were told."
              aria-label="Crisis reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={reason.trim().length < 3} onClick={submit}>
              Flag crisis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ResolveCrisisDialog({
  patientId,
  escalation,
  onClose,
}: {
  patientId: string;
  escalation: CrisisEscalation | null;
  onClose: () => void;
}) {
  const { staffName } = useActingStaff();
  const [contactedWhom, setContactedWhom] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [disposition, setDisposition] = useState("");

  const submit = () => {
    if (!escalation) return;
    try {
      AdelanteEHR.resolveCrisisEscalation(patientId, escalation.id, staffName, {
        contactedWhom,
        actionsTaken,
        disposition,
      });
      toast.success("Escalation resolved — the critical alert has been closed.");
      setContactedWhom("");
      setActionsTaken("");
      setDisposition("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resolve.");
    }
  };

  return (
    <Dialog open={Boolean(escalation)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve crisis escalation</DialogTitle>
          <DialogDescription>
            Resolving closes the linked critical alert. Disposition is required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Who was contacted</Label>
            <Input
              value={contactedWhom}
              onChange={(e) => setContactedWhom(e.target.value)}
              placeholder="e.g. On-call PMHNP, county crisis line"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Actions taken</Label>
            <Textarea
              value={actionsTaken}
              onChange={(e) => setActionsTaken(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Disposition (required)</Label>
            <Textarea
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
              rows={2}
              aria-label="Disposition"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={disposition.trim().length === 0} onClick={submit}>
            Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PatientCrisisPanel({ patientId }: { patientId: string }) {
  const rows = useEhr(() => AdelanteEHR.listCrisisEscalations(patientId));
  const open = rows.filter((r) => r.status === "open");
  const [resolving, setResolving] = useState<CrisisEscalation | null>(null);

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-navy">Crisis escalation</div>
        <FlagCrisisButton patientId={patientId} />
      </div>
      {open.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No open crisis escalation.</p>
      ) : (
        <ul className="space-y-2">
          {open.map((e) => (
            <li
              key={e.id}
              className="rounded border border-destructive/40 bg-destructive/5 p-2 text-[11px]"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                  Open
                </Badge>
                <span className="capitalize text-muted-foreground">
                  {e.triggerSource.replace("_", " ")}
                </span>
                <span className="text-muted-foreground">· {timeOpenLabel(e.triggeredAt)}</span>
              </div>
              <p className="mt-1 text-navy">{e.triggerDetail}</p>
              <p className="text-muted-foreground">
                Flagged by {e.triggeredBy} · <ClientDate value={e.triggeredAt} />
              </p>
              <Button size="sm" variant="outline" className="mt-1.5" onClick={() => setResolving(e)}>
                Resolve
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ResolveCrisisDialog
        patientId={patientId}
        escalation={resolving}
        onClose={() => setResolving(null)}
      />
    </Card>
  );
}
