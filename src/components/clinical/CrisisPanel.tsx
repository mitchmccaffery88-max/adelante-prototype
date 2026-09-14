// §Crisis escalation — shared UI: flag dialog, resolve dialog, and the
// patient-scoped panel rendered at the top of the Alerts tab.
//
// Placement rationale: the escalation IS a PatientAlert, so the Alerts tab is
// where a clinician already looks for the flag. Keeping both in one place
// means the flag and its workflow record can never drift visually.
import { useState } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  CRISIS_CLASSIFICATION_DRAFT_LABEL,
  useEhr,
  type CrisisEscalation,
} from "@/lib/ehr";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CRISIS_DISPOSITIONS,
  CRISIS_DISPOSITION_DRAFT_LABEL,
  CRISIS_POLICY_DRAFT_LABEL,
  composeDisposition,
  crisisSlaState,
  overdueByLabel,
  type CrisisDispositionCode,
} from "@/lib/crisisPolicy";
import { AlarmClock, FlaskConical, RefreshCw, Siren } from "lucide-react";

export function timeOpenLabel(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.round((now - +new Date(iso)) / 60000));
  if (mins < 60) return `${mins}m open`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m open`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h open`;
}

/**
 * §Crisis Redesign Phase 1 — draft severity/category, always rendered WITH the
 * pending-clinical-review caveat so nobody reads these as a settled taxonomy.
 */
export function CrisisClassification({ escalation }: { escalation: CrisisEscalation }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant="outline" className="border-dashed text-[10px] capitalize">
        {escalation.severity}
      </Badge>
      <Badge variant="outline" className="border-dashed text-[10px] capitalize">
        {escalation.category}
      </Badge>
      {escalation.classificationStatus === "draft" && (
        <span
          title={CRISIS_CLASSIFICATION_DRAFT_LABEL}
          className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900"
        >
          <FlaskConical className="h-3 w-3" /> {CRISIS_CLASSIFICATION_DRAFT_LABEL}
        </span>
      )}
    </span>
  );
}

/** Visible marker that a further signal arrived while this row sat open. */
export function CrisisRetriggerBadge({ escalation }: { escalation: CrisisEscalation }) {
  const n = escalation.retriggers?.length ?? 0;
  if (n === 0) return null;
  return (
    <Badge className="bg-destructive text-destructive-foreground border-0 text-[10px]">
      <RefreshCw className="mr-1 h-3 w-3" /> Re-triggered ×{n}
    </Badge>
  );
}

/**
 * §Crisis Redesign Phase 2 — aging / SLA. Visible "overdue" state once an open
 * row passes its DRAFT response target. Claiming does not exempt a row.
 */
export function CrisisOverdueBadge({ escalation }: { escalation: CrisisEscalation }) {
  const state = crisisSlaState(escalation);
  if (!state.overdue) return null;
  return (
    <Badge
      className="border-0 bg-amber-500 text-[10px] text-amber-950"
      title={`${CRISIS_POLICY_DRAFT_LABEL} — draft target ${state.thresholdLabel}`}
    >
      <AlarmClock className="mr-1 h-3 w-3" /> Overdue · {overdueByLabel(state.overdueByMs)} (draft{" "}
      {state.thresholdLabel})
    </Badge>
  );
}

/** Claim / unclaim control. Advisory — it never blocks resolution. */
export function CrisisClaimControl({
  patientId,
  escalation,
}: {
  patientId: string;
  escalation: CrisisEscalation;
}) {
  const { staffName } = useActingStaff();
  const mine = escalation.claimedBy === staffName;
  const act = (fn: () => void, ok: string) => {
    try {
      fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the claim.");
    }
  };

  if (!escalation.claimedBy) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          act(
            () => AdelanteEHR.claimCrisisEscalation(patientId, escalation.id, staffName),
            "Claimed — other staff can see you have this.",
          )
        }
      >
        Claim this
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant="secondary" className="text-[10px]">
        Claimed by {mine ? "you" : escalation.claimedBy}
      </Badge>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          act(
            () => AdelanteEHR.unclaimCrisisEscalation(patientId, escalation.id, staffName),
            "Claim released.",
          )
        }
      >
        {mine ? "Unclaim" : "Release claim"}
      </Button>
    </span>
  );
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
  // §Crisis Redesign Phase 2 — structured disposition. The picked DRAFT code
  // plus free text; `other` (and "Escalated to…") keep the real words so a
  // disposition that does not fit the draft list is never lost.
  const [code, setCode] = useState<CrisisDispositionCode | "">("");
  const [detail, setDetail] = useState("");
  const picked = CRISIS_DISPOSITIONS.find((d) => d.code === code);
  const detailRequired = Boolean(picked?.requiresDetail);
  const canSubmit = Boolean(code) && (!detailRequired || detail.trim().length > 0);

  const reset = () => {
    setContactedWhom("");
    setActionsTaken("");
    setCode("");
    setDetail("");
  };

  const submit = () => {
    if (!escalation || !code) return;
    try {
      AdelanteEHR.resolveCrisisEscalation(patientId, escalation.id, staffName, {
        contactedWhom,
        actionsTaken,
        dispositionCode: code,
        disposition: composeDisposition(code, detail),
      });
      toast.success("Escalation resolved — the critical alert has been closed.");
      reset();
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
            <Label className="text-[11px]">Disposition (required)</Label>
            <Select value={code} onValueChange={(v) => setCode(v as CrisisDispositionCode)}>
              <SelectTrigger aria-label="Disposition">
                <SelectValue placeholder="Choose a disposition" />
              </SelectTrigger>
              <SelectContent>
                {CRISIS_DISPOSITIONS.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">
              <FlaskConical className="h-3 w-3" /> {CRISIS_DISPOSITION_DRAFT_LABEL}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">
              {code === "escalated"
                ? "Escalated to whom (required)"
                : detailRequired
                  ? "Describe the disposition (required)"
                  : "Disposition detail (optional)"}
            </Label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={2}
              aria-label="Disposition detail"
              placeholder={
                code === "other"
                  ? "What actually happened, in your words."
                  : "Anything the category does not capture."
              }
            />
          </div>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
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
  // §Crisis Redesign Phase 1 — resolved escalations used to vanish from the
  // chart face entirely, so continuity of care at the next visit meant digging
  // through the audit log. They are shown here now, newest first.
  const resolved = rows
    .filter((r) => r.status === "resolved")
    .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""));
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
                <CrisisRetriggerBadge escalation={e} />
                <span className="capitalize text-muted-foreground">
                  {e.triggerSource.replace("_", " ")}
                </span>
                <span className="text-muted-foreground">· {timeOpenLabel(e.triggeredAt)}</span>
              </div>
              <div className="mt-1">
                <CrisisClassification escalation={e} />
              </div>
              <p className="mt-1 text-navy">{e.triggerDetail}</p>
              <p className="text-muted-foreground">
                Flagged by {e.triggeredBy} · <ClientDate value={e.triggeredAt} />
              </p>
              {(e.retriggers?.length ?? 0) > 0 && (
                <ul className="mt-1 space-y-0.5 border-l-2 border-destructive/40 pl-2">
                  {e.retriggers!.map((r, i) => (
                    <li key={i} className="text-muted-foreground">
                      Further signal <ClientDate value={r.at} /> — {r.detail}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <CrisisClaimControl patientId={patientId} escalation={e} />
                <Button size="sm" variant="outline" onClick={() => setResolving(e)}>
                  Resolve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <div className="space-y-1.5 border-t pt-2">
          <div className="text-[11px] font-medium text-navy">
            Resolved history ({resolved.length})
          </div>
          <ul className="space-y-1.5">
            {resolved.map((e) => (
              <li key={e.id} className="rounded border bg-muted/30 p-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    Resolved
                  </Badge>
                  <CrisisRetriggerBadge escalation={e} />
                  <span className="capitalize text-muted-foreground">
                    {e.triggerSource.replace("_", " ")}
                  </span>
                  {e.resolvedAt && (
                    <span className="text-muted-foreground">
                      · <ClientDate value={e.resolvedAt} />
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <CrisisClassification escalation={e} />
                </div>
                <p className="mt-1 text-navy">Disposition: {e.disposition}</p>
                {e.contactedWhom && (
                  <p className="text-muted-foreground">Contacted: {e.contactedWhom}</p>
                )}
                {e.actionsTaken && (
                  <p className="text-muted-foreground">Actions: {e.actionsTaken}</p>
                )}
                <p className="text-muted-foreground">
                  Resolved by {e.resolvedBy} · flagged by {e.triggeredBy}{" "}
                  <ClientDate value={e.triggeredAt} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ResolveCrisisDialog
        patientId={patientId}
        escalation={resolving}
        onClose={() => setResolving(null)}
      />
    </Card>
  );
}
