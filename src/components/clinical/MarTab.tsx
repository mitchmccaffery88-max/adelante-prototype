// §MAR Phase 1–2 — patient-scoped administration grid.
//
// PATIENT-SCOPED BY DESIGN: this is a tab inside one patient's record, not the
// reference EMR's facility-wide MedPass roster. See src/lib/mar.ts for why.
//
// Phase 2 landed here: PRN eligibility + reason chips (+ "Not indicated"),
// Schedule II witness (with session-witness back-fill), KOP issuance, and the
// Suboxone mouth-check attestation.
// Phase 3 landed here: the Refusal legal document (queued one at a time after
// a batch commit) and the 3-in-7-days provider escalation. Still deferred (not
// dropped): voice pass.
//
// §MAR cart/keyboard mode — a second VIEW over the exact same due-dose queue.
// It is a pure UX layer: it calls the same prnEligibility / requiresDoseWitness
// / chartDose / voidBatch / issueKop paths the grid calls, renders the same
// controls (renderChartControls), and commits through the same `commit()`.
// No gate, reason requirement, or clinical rule is re-implemented here.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdelanteEHR,
  useEhr,
  requiresDoseWitness,
  type DoseAdministration,
  type RefusalForm,
} from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  deriveMarDay,
  isLateEntry,
  isSuboxoneOrder,
  marRowLabel,
  witnessCandidates,
  MOUTH_CHECK_ATTESTATION_TEXT,
  NOT_INDICATED_REASON,
  PRN_REASONS,
  type MarSlot,
} from "@/lib/mar";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import { facilityDateKey, waitLabel } from "@/lib/facilityTime";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { ClientDate } from "@/components/ClientDate";
import { RefusalFormDialog } from "@/components/clinical/refusal/RefusalFormDialog";
import { RefusalRiskTextRecord } from "@/components/clinical/refusal/RefusalRiskTextRecord";
import {
  RefusalEscalationDialog,
  type EscalationTarget,
} from "@/components/clinical/refusal/RefusalEscalationDialog";
import { medClassGuess } from "@/lib/refusal";
import { toast } from "sonner";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSignature,
  Info,
  Keyboard,
  LayoutGrid,
  PackageCheck,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAR_ATTESTATION_TEXT =
  "I attest that I personally administered, or directly observed the outcome of, each dose charted below, and that these entries are accurate and complete.";

type Action = "given" | "refused" | "held";

interface PendingEntry {
  action: Action;
  reason: string;
  lateEntryReason: string;
  witnessedBy: string;
}

const emptyEntry = (): PendingEntry => ({
  action: "given",
  reason: "",
  lateEntryReason: "",
  witnessedBy: "",
});

/**
 * Session-local (not per-user) view preference, as specified. sessionStorage
 * keeps a nurse's choice across chart navigation within one shift without
 * inventing a preferences model.
 */
const VIEW_STORAGE_KEY = "adelante.mar.view";
type MarView = "grid" | "cart";

/** True when the keystroke landed in a field the nurse is typing into. */
function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || !node.tagName) return false;
  const tag = node.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    node.isContentEditable === true ||
    node.getAttribute?.("role") === "combobox"
  );
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
// KOP issuance dialog (port of the reference's KopIssueDialog).
// Every field resets when the dialog opens or the target order changes, so a
// signature captured for one drug can never bleed onto another.
// ---------------------------------------------------------------------------
function KopIssueDialog({
  slot,
  patientId,
  staffName,
  onOpenChange,
}: {
  slot: MarSlot | null;
  patientId: string;
  staffName: string;
  onOpenChange: (v: boolean) => void;
}) {
  const [daysSupply, setDaysSupply] = useState("");
  const [quantity, setQuantity] = useState("");
  const [signature, setSignature] = useState("");
  const [notes, setNotes] = useState("");

  const orderId = slot?.order.id;
  useEffect(() => {
    setDaysSupply("");
    setQuantity("");
    setSignature("");
    setNotes("");
  }, [orderId]);

  return (
    <Dialog open={!!slot} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue keep-on-person supply</DialogTitle>
        </DialogHeader>
        {slot && (
          <div className="space-y-3 text-sm">
            <div className="font-medium">{marRowLabel(slot.order)}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Days supply *</Label>
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  aria-label="Days supply"
                  value={daysSupply}
                  onChange={(e) => setDaysSupply(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Quantity *</Label>
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  aria-label="Quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Patient signature name (typed) *</Label>
              <Input
                className="mt-1"
                aria-label="Patient signature name"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Patient types their full name"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Typed acknowledgment of receipt — not the drawn legal signature used by the
                Refusal document.
              </p>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="mt-1"
                rows={2}
                aria-label="KOP notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!slot) return;
              try {
                AdelanteEHR.issueKop({
                  patientId,
                  orderId: slot.order.id,
                  daysSupply: Number(daysSupply),
                  quantity: Number(quantity),
                  patientSignatureName: signature,
                  issuedBy: staffName,
                  notes,
                });
                toast.success("KOP supply issued.");
                onOpenChange(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not issue supply.");
              }
            }}
          >
            Issue supply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Claim control — mirrors the reference's DoseClaimControl.
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
            AdelanteEHR.takeoverDose(patientId, slot.order.id, slot.scheduledAt, staffName, reason),
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
  const [mouthChecked, setMouthChecked] = useState(false);
  const [sessionWitness, setSessionWitness] = useState("");
  const [voidBatchId, setVoidBatchId] = useState<string | null>(null);
  const [kopSlot, setKopSlot] = useState<MarSlot | null>(null);
  /**
   * Refusal documents awaiting signature from THIS commit, in order. The
   * reference's MedPass signs one, then opens the next automatically.
   */
  const [refusalQueue, setRefusalQueue] = useState<string[]>([]);
  /** A pending document reopened by hand from the to-do list. */
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [escalation, setEscalation] = useState<EscalationTarget | null>(null);

  // ----- Cart / keyboard mode (view-only state) -----------------------------
  const [view, setView] = useState<MarView>("grid");
  const [cartIndex, setCartIndex] = useState(0);
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  // Read the saved view after hydration — a sessionStorage read in the state
  // initializer would mismatch the server render.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "cart" || saved === "grid") setView(saved);
    } catch {
      /* storage unavailable — stay on the grid */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* non-fatal */
    }
  }, [view]);
  useEffect(() => {
    if (view !== "cart") return;
    const on = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [view]);

  /**
   * Ticks while PRN rows are on screen so the "eligible in Nm" countdown and
   * the Given button unblock on their own when a minimum-interval gap
   * elapses. Everything reads this same instant, so the label the nurse sees
   * and the state the button is in can never disagree.
   */
  const [now, setNow] = useState(() => Date.now());

  const day = useMemo(
    () =>
      patient
        ? deriveMarDay(patient, dateKey)
        : { dateKey, slots: [], prn: [], kop: [], deferred: [] },
    [patient, dateKey],
  );

  const hasPrn = day.prn.length > 0;
  useEffect(() => {
    if (!hasPrn) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [hasPrn]);

  const witnesses = useMemo(() => witnessCandidates(staffName), [staffName]);

  if (!patient) return null;

  const chartedForDay = (patient.administrations ?? []).filter((a) =>
    [...day.slots, ...day.prn].some((s) => s.order.id === a.orderId),
  );

  const pendingKeys = Object.keys(entries);
  const pendingCount = pendingKeys.length;
  const allRows = [...day.slots, ...day.prn];
  const rowFor = (key: string) => allRows.find((s) => s.key === key);

  /** Cart mode walks the same rows the grid renders, KOP supplies included. */
  const cartRows = [...day.slots, ...day.prn, ...day.kop];
  const cartIdx = cartRows.length ? Math.min(cartIndex, cartRows.length - 1) : 0;
  const cartSlot: MarSlot | undefined = cartRows[cartIdx];
  const moveCart = (delta: number) =>
    setCartIndex((i) =>
      Math.min(Math.max(Math.min(i, cartRows.length - 1) + delta, 0), Math.max(cartRows.length - 1, 0)),
    );

  const setEntry = (key: string, patch: Partial<PendingEntry>) =>
    setEntries((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyEntry()), ...patch } }));

  const clearEntry = (key: string) =>
    setEntries((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // ----- Session witness: pick once, back-fill every pending CII row --------
  const pendingCiiKeys = pendingKeys.filter((k) => {
    const slot = rowFor(k);
    return !!slot && requiresDoseWitness(slot.order) && entries[k].action === "given";
  });
  const applyWitnessToAll = () => {
    if (!sessionWitness) {
      toast.error("Pick a witness first.");
      return;
    }
    if (!pendingCiiKeys.length) {
      toast.error("No pending Schedule II doses to witness.");
      return;
    }
    setEntries((prev) => {
      const next = { ...prev };
      for (const k of pendingCiiKeys) next[k] = { ...next[k], witnessedBy: sessionWitness };
      return next;
    });
    toast.success(`Witness applied to ${pendingCiiKeys.length} dose(s).`);
  };

  const suboxonePending = pendingKeys.some((k) => {
    const slot = rowFor(k);
    return !!slot && entries[k].action === "given" && isSuboxoneOrder(slot.order);
  });

  const commit = () => {
    const batchId = `batch_${Date.now().toString(36)}`;
    let ok = 0;
    const queued: string[] = [];
    for (const [key, entry] of Object.entries(entries)) {
      const slot = rowFor(key);
      if (!slot) continue;
      // PRN rows have no fixed schedule — stamp the actual administration time.
      const scheduledAt = slot.kind === "prn" ? new Date().toISOString() : slot.scheduledAt;
      try {
        const row = AdelanteEHR.chartDose(
          patientId,
          slot.order.id,
          scheduledAt,
          entry.action,
          entry.reason,
          staffName,
          batchId,
          entry.lateEntryReason,
          { witnessedBy: entry.witnessedBy, mouthCheckAttested: mouthChecked || undefined },
        );
        ok += 1;
        // The refusal is charted above regardless of what happens to the legal
        // document — the shell is created immediately so an abandoned form
        // shows up as outstanding work rather than vanishing.
        if (row.action === "refused") {
          try {
            queued.push(
              AdelanteEHR.createRefusalFormShell(patientId, row.id, staffName).id,
            );
          } catch {
            /* the charted refusal stands even if the document shell fails */
          }
        }
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
      setMouthChecked(false);
    }
    if (queued.length) setRefusalQueue(queued);
  };

  /**
   * Toggle a pending action on a row. Shared by the grid buttons and the cart's
   * keyboard shortcuts so both produce byte-identical pending entries.
   */
  const pickFor = (slot: MarSlot, a: Action, reason?: string) => {
    const entry = entries[slot.key];
    if (entry?.action === a && (reason === undefined || entry.reason === reason)) {
      clearEntry(slot.key);
      return;
    }
    setEntry(slot.key, { action: a, ...(reason !== undefined ? { reason } : {}) });
  };

  // ----- Row renderers ------------------------------------------------------
  const renderChartControls = (slot: MarSlot) => {
    const entry = entries[slot.key];
    const isPrn = slot.kind === "prn";
    const late = !isPrn && isLateEntry(slot.scheduledAt);
    const needsWitness = requiresDoseWitness(slot.order);
    const elig = isPrn
      ? AdelanteEHR.prnEligibility(patientId, slot.order.id, new Date(now))
      : undefined;
    const givenBlocked = !!elig?.blocked;

    const pick = (a: Action, reason?: string) => pickFor(slot, a, reason);

    return (
      <div className="mt-2 space-y-2">
        {elig && (
          <div className="text-xs text-muted-foreground">
            {elig.given}/{elig.max ?? "—"} given in last 24h
            {elig.lastGivenAt && (
              <>
                {" · last "}
                <ClientDate value={elig.lastGivenAt} />
              </>
            )}
            {elig.blockedBy === "gap" && (
              <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">
                {elig.minGapMinutes}m minimum interval — eligible in {waitLabel(elig.waitMs)}.
              </span>
            )}
            {elig.blockedBy === "max" && (
              <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">
                PRN limit reached — cannot chart as given.
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            aria-label={`given ${slot.order.drugName}`}
            variant={entry?.action === "given" ? "default" : "outline"}
            disabled={readOnly || givenBlocked}
            onClick={() => pick("given")}
          >
            Given
          </Button>
          <Button
            size="sm"
            aria-label={`refused ${slot.order.drugName}`}
            variant={entry?.action === "refused" ? "default" : "outline"}
            disabled={readOnly}
            onClick={() => pick("refused")}
          >
            Refused
          </Button>
          <Button
            size="sm"
            aria-label={`held ${slot.order.drugName}`}
            variant={
              entry?.action === "held" && entry.reason !== NOT_INDICATED_REASON
                ? "default"
                : "outline"
            }
            disabled={readOnly}
            onClick={() => pick("held", "")}
          >
            Held
          </Button>
          {isPrn && (
            <Button
              size="sm"
              aria-label={`not indicated ${slot.order.drugName}`}
              variant={
                entry?.action === "held" && entry.reason === NOT_INDICATED_REASON
                  ? "default"
                  : "outline"
              }
              disabled={readOnly}
              onClick={() => pick("held", NOT_INDICATED_REASON)}
            >
              Not indicated
            </Button>
          )}
          {!isPrn && (
            <div className="ml-auto">
              <DoseClaimControl
                slot={slot}
                patientId={patientId}
                staffName={staffName}
                readOnly={readOnly}
              />
            </div>
          )}
        </div>

        {/* PRN indication — chips from the reference set, free text as fallback. */}
        {entry && isPrn && entry.action === "given" && (
          <div>
            <Label className="text-xs text-amber-700 dark:text-amber-400">
              PRN indication (required) *
            </Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {PRN_REASONS.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={entry.reason === r ? "default" : "outline"}
                  aria-label={`PRN reason ${r}`}
                  onClick={() => setEntry(slot.key, { reason: entry.reason === r ? "" : r })}
                >
                  {r}
                </Button>
              ))}
            </div>
            <Input
              className={cn("mt-2", !entry.reason.trim() && "border-amber-500")}
              aria-label="PRN indication"
              value={entry.reason}
              onChange={(e) => setEntry(slot.key, { reason: e.target.value })}
              placeholder="Or type an indication"
            />
          </div>
        )}

        {entry &&
          (entry.action === "refused" ||
            (entry.action === "held" && entry.reason !== NOT_INDICATED_REASON)) && (
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

        {/* Schedule II witness. CIII–CV deliberately do NOT require one. */}
        {entry && entry.action === "given" && needsWitness && (
          <div>
            <Label className="text-xs text-amber-700 dark:text-amber-400">
              Witness (required — Schedule II) *
            </Label>
            <Select
              value={entry.witnessedBy}
              onValueChange={(v) => setEntry(slot.key, { witnessedBy: v })}
            >
              <SelectTrigger
                className={cn("mt-1 w-64", !entry.witnessedBy && "border-amber-500")}
                aria-label={`Witness for ${slot.order.drugName}`}
              >
                <SelectValue placeholder="Select witnessing clinician" />
              </SelectTrigger>
              <SelectContent>
                {witnesses.map((w) => (
                  <SelectItem key={w.id} value={w.name}>
                    {w.name}
                    {w.credential ? ` · ${w.credential}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!slot.order.deaSchedule && (
              <p className="mt-1 text-xs text-muted-foreground">
                No DEA schedule recorded on this order — a witness is required by default.
                Specify the schedule on the order to relax this for CIII–CV.
              </p>
            )}
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
    );
  };

  const renderSlot = (slot: MarSlot) => {
    const late = slot.kind === "scheduled" && isLateEntry(slot.scheduledAt);
    const done = slot.administration;
    return (
      <Card key={slot.key} className="p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{slot.timeLabel}</Badge>
          <span className="font-medium">{marRowLabel(slot.order)}</span>
          {slot.order.frequency && (
            <span className="text-muted-foreground">{slot.order.frequency}</span>
          )}
          {slot.kind === "prn" && <Badge variant="secondary">PRN</Badge>}
          {slot.order.isControlled && (
            <Badge variant="outline">{slot.order.deaSchedule ?? "Controlled"}</Badge>
          )}
          {isSuboxoneOrder(slot.order) && <Badge variant="secondary">Mouth check</Badge>}
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
              {done.witnessedBy ? ` · witnessed by ${done.witnessedBy}` : ""}
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
          renderChartControls(slot)
        )}
      </Card>
    );
  };

  const renderKop = (slot: MarSlot) => {
    const open = AdelanteEHR.activeKopIssuance(patientId, slot.order.id);
    const history = AdelanteEHR.listKopIssuances(patientId, { orderId: slot.order.id });
    return (
      <Card key={slot.key} className="p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">KOP</Badge>
          <span className="font-medium">{marRowLabel(slot.order)}</span>
          {slot.order.frequency && (
            <span className="text-muted-foreground">{slot.order.frequency}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {open ? (
              <Button
                size="sm"
                variant="outline"
                disabled={readOnly}
                onClick={() => {
                  try {
                    AdelanteEHR.returnKop(patientId, open.id, staffName);
                    toast.success("Supply return recorded.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not record return.");
                  }
                }}
              >
                Record return
              </Button>
            ) : null}
            <Button size="sm" disabled={readOnly} onClick={() => setKopSlot(slot)}>
              Issue supply
            </Button>
          </div>
        </div>
        {open && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Active supply: {open.daysSupply} day(s), qty {open.quantity}, issued{" "}
            <ClientDate value={open.issuedAt} /> by {open.issuedBy}. A second issuance is blocked
            until this one is returned.
          </p>
        )}
        {history.length > 0 && (
          <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {history.map((h) => (
              <div key={h.id}>
                {h.daysSupply}d · qty {h.quantity} · signed “{h.patientSignatureName}” ·{" "}
                <ClientDate value={h.issuedAt} />
                {h.returnedAt ? " · returned" : ""}
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };

  const commitBlocked = !attested || (suboxonePending && !mouthChecked);

  // ----- Refusal documents ---------------------------------------------------
  const pendingForms = (patient.refusalForms ?? []).filter(
    (f) => f.status === "pending_signature",
  );
  const finalizedForms = (patient.refusalForms ?? []).filter(
    (f) => f.status === "finalized",
  );

  const exportForm = async (f: RefusalForm) => {
    const admin = (patient.administrations ?? []).find(
      (a) => a.id === f.administrationId,
    );
    const order = (patient.orders ?? []).find((o) => o.id === admin?.orderId);
    const { downloadRefusalFormPdf } = await import("@/lib/refusalPdf");
    const filename = downloadRefusalFormPdf({
      form: f,
      patient,
      order,
      administration: admin,
      medicationLabel: order ? marRowLabel(order) : undefined,
    });
    AdelanteEHR.recordRefusalFormExport({
      patientId,
      formId: f.id,
      filename,
      staffName,
    });
  };
  const activeFormId = escalation ? null : (refusalQueue[0] ?? openFormId);
  const activeForm = activeFormId
    ? ((patient.refusalForms ?? []).find((f) => f.id === activeFormId) ?? null)
    : null;

  const closeActiveForm = () => {
    // "Sign later" / dismiss — the refusal stays charted, the document stays
    // pending, and the next queued document opens.
    setRefusalQueue((q) => q.slice(1));
    setOpenFormId(null);
  };

  const handleFinalized = (form: RefusalForm, orderId: string) => {
    setRefusalQueue((q) => q.slice(1));
    setOpenFormId(null);
    if (orderId && AdelanteEHR.refusalEscalationDue(patientId, orderId)) {
      const order = (patient.orders ?? []).find((o) => o.id === orderId);
      setEscalation({
        formId: form.id,
        orderId,
        drugName: order?.productName ?? order?.drugName ?? "This medication",
        medClass: form.medClass,
        refusalCount: AdelanteEHR.refusalsInWindow(patientId, orderId).length,
      });
    }
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
              setMouthChecked(false);
              setDateKey(e.target.value);
            }}
          />
        </div>
        <div>
          <Label className="text-xs">Session witness (Schedule II)</Label>
          <div className="mt-1 flex items-center gap-2">
            <Select value={sessionWitness} onValueChange={setSessionWitness}>
              <SelectTrigger className="w-60" aria-label="Session witness">
                <SelectValue placeholder="Select witness" />
              </SelectTrigger>
              <SelectContent>
                {witnesses.map((w) => (
                  <SelectItem key={w.id} value={w.name}>
                    {w.name}
                    {w.credential ? ` · ${w.credential}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={readOnly}
              onClick={applyWitnessToAll}
              aria-label="Apply witness to all CII"
            >
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Apply to all CII
            </Button>
          </div>
        </div>
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

      {day.prn.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <Syringe className="h-4 w-4 text-muted-foreground" />
            As-needed (PRN)
          </div>
          {day.prn.map(renderSlot)}
        </div>
      )}

      {day.kop.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
            Keep-on-person supplies
          </div>
          <p className="text-xs text-muted-foreground">
            KOP is a supply event, not a bedside administration — these rows are issued and
            returned, never charted as given/refused/held.
          </p>
          {day.kop.map(renderKop)}
        </div>
      )}

      {!readOnly && pendingCount > 0 && (
        <div className="space-y-3">
          {suboxonePending && (
            <div className="rounded-lg border border-amber-500/60 bg-amber-50/40 p-3 dark:bg-amber-950/10">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={mouthChecked}
                  onCheckedChange={(v) => setMouthChecked(v === true)}
                  aria-label="Mouth check attestation"
                />
                <span>{MOUTH_CHECK_ATTESTATION_TEXT}</span>
              </label>
            </div>
          )}
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
          <Button className="w-full" disabled={commitBlocked} onClick={commit}>
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
                {a.reason ? ` · ${a.reason}` : ""}
                {a.witnessedBy ? ` · witnessed by ${a.witnessedBy}` : ""}
                {a.voided ? ` · voided by ${a.voidedBy}: ${a.voidReason}` : ""}
              </div>
            ))}
          </div>
        </details>
      )}

      <KopIssueDialog
        slot={kopSlot}
        patientId={patientId}
        staffName={staffName}
        onOpenChange={(v) => !v && setKopSlot(null)}
      />

      {pendingForms.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-500/60 bg-amber-50/40 p-3 dark:bg-amber-950/10">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <FileSignature className="h-4 w-4 text-muted-foreground" />
            Refusal documents awaiting signature ({pendingForms.length})
          </div>
          <p className="text-xs text-muted-foreground">
            The refusals themselves are charted. These are the separate legal documents — they
            stay here until finalized.
          </p>
          {pendingForms.map((f) => {
            const admin = (patient.administrations ?? []).find(
              (a) => a.id === f.administrationId,
            );
            const order = (patient.orders ?? []).find((o) => o.id === admin?.orderId);
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">
                  {order ? marRowLabel(order) : "Refused medication"}
                </span>
                <span className="text-muted-foreground">
                  refused <ClientDate value={admin?.chartedAt ?? f.createdAt} />
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={readOnly}
                  onClick={() => setOpenFormId(f.id)}
                >
                  Open document
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {finalizedForms.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <FileSignature className="h-4 w-4 text-muted-foreground" />
            Finalized refusal documents ({finalizedForms.length})
          </div>
          <p className="text-xs text-muted-foreground">
            Export produces the signed legal record — nurse, witness (when one was
            required) and patient signature blocks included. Each export is audited.
          </p>
          {finalizedForms.map((f) => {
            const admin = (patient.administrations ?? []).find(
              (a) => a.id === f.administrationId,
            );
            const order = (patient.orders ?? []).find((o) => o.id === admin?.orderId);
            return (
              <div key={f.id} className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {order ? marRowLabel(order) : "Refused medication"}
                  </span>
                  <span className="text-muted-foreground">
                    finalized <ClientDate value={f.finalizedAt ?? f.createdAt} /> by{" "}
                    {f.finalizedBy ?? f.createdBy}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void exportForm(f)}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Export PDF
                  </Button>
                </div>
                {/* Both frozen wordings stay inspectable on the signed record. */}
                <details>
                  <summary className="cursor-pointer text-muted-foreground">
                    Risk text signed ({(f.languageCode || "en").toUpperCase()} ·{" "}
                    {f.riskTextVersion}
                    {f.riskTextReviewed === false ? " · draft" : " · reviewed"})
                  </summary>
                  <div className="mt-2">
                    <RefusalRiskTextRecord form={f} />
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}

      <RefusalFormDialog
        patientId={patientId}
        form={activeForm}
        staffName={staffName}
        onClose={closeActiveForm}
        onFinalized={handleFinalized}
      />

      <RefusalEscalationDialog
        patientId={patientId}
        target={escalation}
        staffName={staffName}
        onClose={() => setEscalation(null)}
      />

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
