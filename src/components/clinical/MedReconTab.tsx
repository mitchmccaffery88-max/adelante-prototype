// §Medication reconciliation — patient-scoped intake/transfer/release review.
//
// Port of BaggaEMR's MedReconciliationDialog + MedReconciliationHistory onto
// the existing Orders layer: seeding reads the patient's active orders, and
// completing a session discontinues stopped/modified meds through the normal
// order lifecycle path (audit + reason included). Home meds are informational
// only — placing a real order is an explicit Orders-tab action.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AdelanteEHR,
  useEhr,
  MED_RECON_DECISION_LABEL,
  MED_RECON_TYPE_LABEL,
  type MedReconItem,
  type MedReconciliation,
} from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientDate } from "@/components/ClientDate";
import { AlertTriangle, ChevronDown, ChevronRight, Pill, Trash2 } from "lucide-react";

const DECISIONS: MedReconItem["decision"][] = ["continue", "modify", "stop"];

function fallbackReason(decision: "stop" | "modify") {
  return `${decision === "stop" ? "Stopped" : "Modified"} via medication reconciliation`;
}

export function MedReconTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const active = useEhr(() => AdelanteEHR.activeMedReconciliation(patientId));
  const history = useEhr(() => AdelanteEHR.listMedReconciliations(patientId));
  const past = history.filter((r) => r.status !== "in_progress");

  return (
    <div className="space-y-6">
      {active ? (
        <ActiveSession patientId={patientId} recon={active} readOnly={readOnly} />
      ) : (
        <StartSession patientId={patientId} readOnly={readOnly} />
      )}
      <HistorySection patientId={patientId} rows={past} />
    </div>
  );
}

function StartSession({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const { staffName } = useActingStaff();
  const activeOrders = useEhr(
    () =>
      AdelanteEHR.listOrders(patientId).filter(
        (o) => o.status === "signed" || o.status === "held",
      ).length,
  );
  const [type, setType] = useState<MedReconciliation["type"]>("intake");
  const [notes, setNotes] = useState("");

  const start = () => {
    try {
      AdelanteEHR.startMedReconciliation(patientId, type, notes, staffName);
      toast.success("Reconciliation started — active medications seeded.");
      setNotes("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h3 className="font-semibold">Start a medication reconciliation</h3>
        <p className="text-xs text-muted-foreground">
          Seeds one review row per currently active order ({activeOrders} today). Home / prior
          medications can be added once the session is open.
        </p>
      </div>
      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          Your role can view reconciliations but not start one.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as MedReconciliation["type"])}>
              <SelectTrigger aria-label="Reconciliation type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MED_RECON_TYPE_LABEL) as MedReconciliation["type"][]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {MED_RECON_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" onClick={start}>
              Start &amp; seed active meds
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ActiveSession({
  patientId,
  recon,
  readOnly,
}: {
  patientId: string;
  recon: MedReconciliation;
  readOnly?: boolean;
}) {
  const { staffName } = useActingStaff();
  const items = useEhr(() => AdelanteEHR.listReconItems(patientId, recon.id));
  const unreviewed = items.filter((i) => i.source === "active_order" && i.decision === "not_reviewed");
  const [notes, setNotes] = useState(recon.notes ?? "");
  const [home, setHome] = useState({ drugName: "", dose: "", frequency: "", route: "" });
  const [pendingDecision, setPendingDecision] = useState<{
    item: MedReconItem;
    decision: MedReconItem["decision"];
  } | null>(null);

  const applyDecision = (item: MedReconItem, decision: MedReconItem["decision"]) => {
    try {
      AdelanteEHR.updateReconItem(patientId, recon.id, item.id, { decision }, staffName);
      toast.success(`${item.drugName} marked ${MED_RECON_DECISION_LABEL[decision]}.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPendingDecision(null);
    }
  };

  const decide = (item: MedReconItem, decision: MedReconItem["decision"]) => {
    if (
      item.source === "active_order" &&
      (decision === "stop" || decision === "modify") &&
      !item.decisionNote?.trim()
    ) {
      setPendingDecision({ item, decision });
      return;
    }
    applyDecision(item, decision);
  };


  const patch = (item: MedReconItem, p: Partial<MedReconItem>) => {
    try {
      AdelanteEHR.updateReconItem(patientId, recon.id, item.id, p, staffName);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const addHome = () => {
    try {
      AdelanteEHR.addHomeReconItem(patientId, recon.id, home, staffName);
      setHome({ drugName: "", dose: "", frequency: "", route: "" });
      toast.success("Home medication added to this review.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const complete = () => {
    try {
      const { discontinuedOrderIds } = AdelanteEHR.completeMedReconciliation(
        patientId,
        recon.id,
        staffName,
      );
      toast.success(
        discontinuedOrderIds.length
          ? `Reconciliation completed — ${discontinuedOrderIds.length} order(s) discontinued.`
          : "Reconciliation completed.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const discard = () => {
    try {
      AdelanteEHR.cancelMedReconciliation(patientId, recon.id, staffName);
      toast.success("Reconciliation discarded — no orders were changed.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            {MED_RECON_TYPE_LABEL[recon.type]} reconciliation in progress
          </h3>
          <p className="text-xs text-muted-foreground">
            Started by {recon.performedBy} · <ClientDate value={recon.performedAt} />
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/record/$patientId" params={{ patientId }} search={{ section: "orders" }}>
            <Pill className="h-3.5 w-3.5" /> Go to Orders to place a new order
          </Link>
        </Button>
      </div>

      {unreviewed.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {unreviewed.length} active medication{unreviewed.length === 1 ? "" : "s"} still need a
            decision. Complete is blocked until every active med is reviewed.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No active orders were found to seed. Add home / prior medications below.
          </p>
        )}
        {items.map((item) => (
          <div key={item.id} className="rounded border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.drugName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {item.source === "active_order" ? "Active order" : "Home / prior"}
                  </Badge>
                  {item.decision !== "not_reviewed" && (
                    <Badge className="text-[10px]">
                      {MED_RECON_DECISION_LABEL[item.decision]}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[item.dose, item.frequency, item.route].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              {!readOnly && (
                <div className="flex flex-wrap items-center gap-1">
                  {DECISIONS.map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={item.decision === d ? "default" : "outline"}
                      onClick={() => decide(item, d)}
                    >
                      {MED_RECON_DECISION_LABEL[d]}
                    </Button>
                  ))}
                  {item.source === "home" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${item.drugName}`}
                      onClick={() => {
                        try {
                          AdelanteEHR.removeReconItem(patientId, recon.id, item.id, staffName);
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {!readOnly && item.decision === "modify" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">New dose</Label>
                  <Input
                    defaultValue={item.newDose ?? ""}
                    onBlur={(e) => patch(item, { newDose: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">New frequency</Label>
                  <Input
                    defaultValue={item.newFrequency ?? ""}
                    onBlur={(e) => patch(item, { newFrequency: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">New route</Label>
                  <Input
                    defaultValue={item.newRoute ?? ""}
                    onBlur={(e) => patch(item, { newRoute: e.target.value })}
                  />
                </div>
              </div>
            )}
            {!readOnly && (item.decision === "modify" || item.decision === "stop") && (
              <div className="mt-2">
                <Label className="text-xs">
                  Note (used as the discontinue reason on the linked order)
                </Label>
                <Input
                  defaultValue={item.decisionNote ?? ""}
                  onBlur={(e) => patch(item, { decisionNote: e.target.value })}
                />
              </div>
            )}
            {readOnly && item.decisionNote && (
              <p className="mt-2 text-xs text-muted-foreground">{item.decisionNote}</p>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <Card className="grid gap-3 p-3 sm:grid-cols-4">
          <div className="sm:col-span-4 text-xs text-muted-foreground">
            Add home / prior-to-arrival medication. Informational only — it does not create an
            order.
          </div>
          <div>
            <Label className="text-xs">Medication</Label>
            <Input
              value={home.drugName}
              onChange={(e) => setHome({ ...home, drugName: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Dose</Label>
            <Input value={home.dose} onChange={(e) => setHome({ ...home, dose: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Frequency</Label>
            <Input
              value={home.frequency}
              onChange={(e) => setHome({ ...home, frequency: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Route</Label>
            <Input
              value={home.route}
              onChange={(e) => setHome({ ...home, route: e.target.value })}
            />
          </div>
          <div className="sm:col-span-4">
            <Button size="sm" variant="outline" onClick={addHome}>
              Add home / prior medication
            </Button>
          </div>
        </Card>
      )}

      {!readOnly && (
        <div className="space-y-2">
          <Label className="text-xs">Session notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                AdelanteEHR.saveMedReconciliationNotes(patientId, recon.id, notes);
                toast.success("Draft saved.");
              }}
            >
              Save draft
            </Button>
            <Button size="sm" onClick={complete} disabled={unreviewed.length > 0}>
              Complete reconciliation
            </Button>
            <Button size="sm" variant="ghost" onClick={discard}>
              Discard
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingDecision} onOpenChange={() => setPendingDecision(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continue without a reason note?</AlertDialogTitle>
            <AlertDialogDescription>
              You selected <strong>{pendingDecision && MED_RECON_DECISION_LABEL[pendingDecision.decision]}</strong>{" "}
              for <strong>{pendingDecision?.item.drugName}</strong> but did not enter a note. If you complete this
              reconciliation, the linked order will be discontinued with the fallback reason:
              <em>
                {" "}
                {pendingDecision && fallbackReason(pendingDecision.decision as "stop" | "modify")}
              </em>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDecision(null)}>Go back and add a note</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDecision) applyDecision(pendingDecision.item, pendingDecision.decision);
              }}
            >
              Continue with fallback reason
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>

  );
}

function HistorySection({
  patientId,
  rows,
}: {
  patientId: string;
  rows: MedReconciliation[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No past reconciliations.</p>;
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">History</h3>
      {rows.map((r) => (
        <HistoryRow
          key={r.id}
          patientId={patientId}
          recon={r}
          open={openId === r.id}
          onToggle={() => setOpenId(openId === r.id ? null : r.id)}
        />
      ))}
    </div>
  );
}

function HistoryRow({
  patientId,
  recon,
  open,
  onToggle,
}: {
  patientId: string;
  recon: MedReconciliation;
  open: boolean;
  onToggle: () => void;
}) {
  const items = useEhr(() => AdelanteEHR.listReconItems(patientId, recon.id));
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.decision] = (c[i.decision] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <Card className="p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{MED_RECON_TYPE_LABEL[recon.type]}</span>
          <Badge variant={recon.status === "completed" ? "default" : "outline"}>
            {recon.status === "completed" ? "Completed" : "Canceled"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            <ClientDate value={recon.completedAt ?? recon.performedAt} /> · {recon.performedBy}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {DECISIONS.filter((d) => counts[d])
            .map((d) => `${MED_RECON_DECISION_LABEL[d]} ${counts[d]}`)
            .join(" · ") || `${items.length} item(s)`}
        </span>
      </button>
      {open && (
        <ul className="mt-3 divide-y text-sm">
          {items.map((i) => (
            <li key={i.id} className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.drugName}</span>
                <Badge variant="outline" className="text-[10px]">
                  {i.source === "active_order" ? "Active order" : "Home / prior"}
                </Badge>
                <Badge className="text-[10px]">{MED_RECON_DECISION_LABEL[i.decision]}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {[i.dose, i.frequency, i.route].filter(Boolean).join(" · ") || "—"}
                {(i.newDose || i.newFrequency || i.newRoute) &&
                  ` → ${[i.newDose, i.newFrequency, i.newRoute].filter(Boolean).join(" · ")}`}
              </div>
              {i.decisionNote && <div className="text-xs">{i.decisionNote}</div>}
            </li>
          ))}
          {recon.notes && (
            <li className="py-2 text-xs text-muted-foreground">Notes: {recon.notes}</li>
          )}
        </ul>
      )}
    </Card>
  );
}
