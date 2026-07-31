// §MAR Phase 1 — patient-scoped administration grid (scheduled doses only).
//
// PATIENT-SCOPED BY DESIGN: this is a tab inside one patient's record, not the
// reference EMR's facility-wide MedPass roster. See src/lib/mar.ts for why.
//
// Deferred to later phases (present in the deferred section, NOT dropped): PRN
// eligibility/reason chips, controlled-substance witness, KOP issuance,
// Suboxone mouth-check attestation, cart/keyboard mode, voice pass, and the
// full Refusal legal document.

import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr, type DoseAdministration } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { deriveMarDay, isLateEntry, marRowLabel, MAR_DEFERRAL_LABEL, type MarSlot } from "@/lib/mar";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import { facilityDateKey } from "@/lib/facilityTime";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { ClientDate } from "@/components/ClientDate";
import { toast } from "sonner";
import { CalendarClock, Info, Lock, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";

const MAR_ATTESTATION_TEXT =
  "I attest that I personally administered, or directly observed the outcome of, each dose charted below, and that these entries are accurate and complete.";

type Action = "given" | "refused" | "held";

interface PendingEntry {
  action: Action;
  reason: string;
  lateEntryReason: string;
}

// ---------------------------------------------------------------------------
// Reason dialog — same mandatory-reason gate as the Orders lifecycle dialogs.
// ---------------------------------------------------------------------------
function ReasonDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  minLength = 1,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  minLength?: number;
  destructive?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setReason("");
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{body}</p>
          <Label htmlFor="mar-reason">Reason</Label>
          <Textarea
            id="mar-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              const t = reason.trim();
              if (t.length < minLength) {
                toast.error(
                  minLength > 1
                    ? `A reason of at least ${minLength} characters is required.`
                    : "A reason is required.",
                );
                return;
              }
              onConfirm(t);
              setReason("");
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Claim control — mirrors the reference's DoseClaimControl: shows whose claim
// this is, lets the owner release, and requires a reason to take over.
// ---------------------------------------------------------------------------
function DoseClaimControl({
  slot,
  patientId,
  staffName,
  readOnly,
}: {
  slot: MarSlot;
  patientId: string;
  staffName: string;
  readOnly?: boolean;
}) {
  const [takeover, setTakeover] = useState(false);
  const claim = slot.claim;
  const mine = claim?.claimedBy === staffName;
  const run = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the claim.");
    }
  };

  if (!claim) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={readOnly}
        onClick={() =>
          run(() => AdelanteEHR.claimDose(patientId, slot.order.id, slot.scheduledAt, staffName))
        }
      >
        Claim
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={mine ? "default" : "secondary"}>
        {mine ? "Claimed by you" : `Claimed by ${claim.claimedBy}`}
      </Badge>
      {mine ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={readOnly}
          onClick={() =>
            run(() =>
              AdelanteEHR.releaseDose(patientId, slot.order.id, slot.scheduledAt, staffName),
            )
          }
        >
          Release
        </Button>
      ) : (
        <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setTakeover(true)}>
          Take over
        </Button>
      )}
      <ReasonDialog
        open={takeover}
        onOpenChange={setTakeover}
        title="Take over this dose"
        body={`This dose is claimed by ${claim.claimedBy}. Taking it over is audit-logged and a reason is required.`}
        confirmLabel="Take over"
        onConfirm={(reason) =>
          run(() =>
            AdelanteEHR.takeoverDose(
              patientId,
              slot.order.id,
              slot.scheduledAt,
              staffName,
              reason,
            ),
          )
        }
      />
    </div>
  );
}

export function MarTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const { staffName } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [dateKey, setDateKey] = useState(() => facilityDateKey(new Date(), undefined));
  const [entries, setEntries] = useState<Record<string, PendingEntry>>({});
  const [attested, setAttested] = useState(false);
  const [voidBatchId, setVoidBatchId] = useState<string | null>(null);

  const day = useMemo(
    () => (patient ? deriveMarDay(patient, dateKey) : { dateKey, slots: [], deferred: [] }),
    [patient, dateKey],
  );

  if (!patient) return null;

  const chartedForDay = (patient.administrations ?? []).filter((a) =>
    day.slots.some((s) => s.order.id === a.orderId && s.scheduledAt === a.scheduledAt),
  );

  const pendingCount = Object.keys(entries).length;

  const setEntry = (key: string, patch: Partial<PendingEntry>) =>
    setEntries((prev) => {
      const base: PendingEntry = prev[key] ?? { action: "given", reason: "", lateEntryReason: "" };
      return { ...prev, [key]: { ...base, ...patch } };
    });

  const clearEntry = (key: string) =>
    setEntries((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const commit = () => {
    const batchId = `batch_${Date.now().toString(36)}`;
    let ok = 0;
    for (const [key, entry] of Object.entries(entries)) {
      const slot = day.slots.find((s) => s.key === key);
      if (!slot) continue;
      try {
        AdelanteEHR.chartDose(
          patientId,
          slot.order.id,
          slot.scheduledAt,
          entry.action,
          entry.reason,
          staffName,
          batchId,
          entry.lateEntryReason,
        );
        ok += 1;
      } catch (e) {
        toast.error(
          `${marRowLabel(slot.order)}: ${e instanceof Error ? e.message : "Could not chart dose."}`,
        );
      }
    }
    if (ok) {
      toast.success(`${ok} dose${ok === 1 ? "" : "s"} charted.`);
      setEntries({});
      setAttested(false);
    }
  };

  const renderSlot = (slot: MarSlot) => {
    const entry = entries[slot.key];
    const late = isLateEntry(slot.scheduledAt);
    const done = slot.administration;
    return (
      <Card key={slot.key} className="p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{slot.timeLabel}</Badge>
          <span className="font-medium">{marRowLabel(slot.order)}</span>
          {slot.order.frequency && (
            <span className="text-muted-foreground">{slot.order.frequency}</span>
          )}
          {slot.order.status !== "signed" && (
            <Badge variant="secondary">{ORDER_STATUS_LABEL[slot.order.status]}</Badge>
          )}
          {late && !done && <Badge variant="destructive">Late</Badge>}
        </div>
        {(slot.order.sigOverride ?? slot.order.sig) && (
          <div className="mt-1 text-xs italic text-muted-foreground">
            {slot.order.sigOverride ?? slot.order.sig}
          </div>
        )}

        {done ? (
          <div className="mt-2 space-y-1">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium capitalize text-foreground">{done.action}</span> by{" "}
              {done.chartedBy} · <ClientDate value={done.chartedAt} />
              {done.reason ? ` · ${done.reason}` : ""}
            </div>
            {done.lateEntryReason && (
              <div className="text-xs text-amber-700 dark:text-amber-400">
                Late entry: {done.lateEntryReason}
              </div>
            )}
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={() => setVoidBatchId(done.batchId)}>
                Void
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {(["given", "refused", "held"] as Action[]).map((a) => (
                <Button
                  key={a}
                  size="sm"
                  aria-label={`${a} ${slot.order.drugName}`}
                  variant={entry?.action === a ? "default" : "outline"}
                  disabled={readOnly}
                  onClick={() =>
                    entry?.action === a ? clearEntry(slot.key) : setEntry(slot.key, { action: a })
                  }
                  className="capitalize"
                >
                  {a}
                </Button>
              ))}
              <div className="ml-auto">
                <DoseClaimControl
                  slot={slot}
                  patientId={patientId}
                  staffName={staffName}
                  readOnly={readOnly}
                />
              </div>
            </div>
            {entry && (entry.action === "refused" || entry.action === "held") && (
              <div>
                <Label className="text-xs text-amber-700 dark:text-amber-400">
                  Reason (required) *
                </Label>
                <Input
                  className={cn("mt-1", !entry.reason.trim() && "border-amber-500")}
                  aria-label={`Reason for ${entry.action} dose`}
                  value={entry.reason}
                  onChange={(e) => setEntry(slot.key, { reason: e.target.value })}
                  placeholder="e.g. Patient declined — nausea"
                />
              </div>
            )}
            {entry && late && (
              <div>
                <Label className="text-xs text-amber-700 dark:text-amber-400">
                  Late-entry reason (required — more than 4 hours past due) *
                </Label>
                <Input
                  className={cn("mt-1", !entry.lateEntryReason.trim() && "border-amber-500")}
                  aria-label="Late entry reason"
                  value={entry.lateEntryReason}
                  onChange={(e) => setEntry(slot.key, { lateEntryReason: e.target.value })}
                  placeholder="e.g. Charted after end of shift — cart offline"
                />
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="mar-date" className="text-xs">
            Date
          </Label>
          <Input
            id="mar-date"
            type="date"
            className="mt-1 w-44"
            value={dateKey}
            onChange={(e) => {
              setEntries({});
              setAttested(false);
              setDateKey(e.target.value);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Scheduled doses for this patient, in facility local time. Phase 1 covers scheduled doses
          only.
        </p>
      </div>

      {day.slots.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No scheduled doses"
          description="No active order projects a scheduled administration on this date."
        />
      ) : (
        <div className="space-y-2">{day.slots.map(renderSlot)}</div>
      )}

      {!readOnly && pendingCount > 0 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={attested}
                onCheckedChange={(v) => setAttested(v === true)}
                aria-label="MAR attestation"
              />
              <span>
                {MAR_ATTESTATION_TEXT}
                <span className="block text-xs text-muted-foreground">
                  Charting as {staffName}.
                </span>
              </span>
            </label>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Password re-verification pending real staff authentication.
            </p>
          </div>
          <Button className="w-full" disabled={!attested} onClick={commit}>
            Chart {pendingCount} dose{pendingCount === 1 ? "" : "s"}
          </Button>
        </div>
      )}

      {chartedForDay.length > 0 && (
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-navy">
            Charted this day ({chartedForDay.length})
          </summary>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {chartedForDay.map((a: DoseAdministration) => (
              <div key={a.id} className={cn(a.voided && "line-through")}>
                <span className="capitalize">{a.action}</span> · {a.chartedBy} ·{" "}
                <ClientDate value={a.chartedAt} />
                {a.voided ? ` · voided by ${a.voidedBy}: ${a.voidReason}` : ""}
              </div>
            ))}
          </div>
        </details>
      )}

      {day.deferred.length > 0 && (
        <div className="rounded-lg border border-dashed border-amber-500/60 bg-amber-50/40 p-3 dark:bg-amber-950/10">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <Lock className="h-4 w-4 text-amber-600" />
            Not yet available in this view (Phase 2)
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            These active orders exist on the chart but cannot be charted here until their
            workflows land. Nothing is hidden.
          </p>
          <div className="mt-2 space-y-1">
            {day.deferred.map(({ order, reason }) => (
              <div key={order.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Syringe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{marRowLabel(order)}</span>
                <Badge variant="outline">{MAR_DEFERRAL_LABEL[reason]}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReasonDialog
        open={!!voidBatchId}
        onOpenChange={(v) => !v && setVoidBatchId(null)}
        title="Void charted doses"
        body="Voiding retains the original entries and marks them void — nothing is deleted (HIPAA / 42 CFR Part 2). A reason of at least 3 characters is required."
        confirmLabel="Void batch"
        minLength={3}
        destructive
        onConfirm={(reason) => {
          if (!voidBatchId) return;
          try {
            AdelanteEHR.voidBatch(patientId, voidBatchId, staffName, reason);
            toast.success("Batch voided.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not void batch.");
          }
          setVoidBatchId(null);
        }}
      />
    </div>
  );
}
