import { useState } from "react";
import {
  AdelanteEHR,
  useEhr,
  isProblemClinicallyActive,
  type Problem,
  type Allergy,
  type PatientAlert,
} from "@/lib/ehr";
import { useActingStaff, canAccess } from "@/lib/roles";
import { PatientCrisisPanel } from "@/components/clinical/CrisisPanel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { DiagnosisPicker, type DiagnosisPick } from "./DiagnosisPicker";
import { ClientDate } from "@/components/ClientDate";
import { toast } from "sonner";
import { AlertTriangle, Lock, Plus, RotateCcw, ShieldAlert, Trash2, Check } from "lucide-react";

// ---------- Removal-reason dialog (soft-delete gate) ----------
function RemovalReasonDialog({
  open,
  onOpenChange,
  title,
  itemLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  itemLabel: string;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("A reason is required.");
      return;
    }
    onConfirm(trimmed);
    setReason("");
    onOpenChange(false);
  };
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
          <p className="text-muted-foreground">
            Removing <span className="font-medium text-navy">{itemLabel}</span>. This is
            audit-logged. A reason is required.
          </p>
          <Label htmlFor="removal-reason">Reason</Label>
          <Textarea
            id="removal-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Entered in error; duplicate of ICD-10 F32.9"
            rows={3}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit}>
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Problems tab
// ============================================================================

export function ProblemsTab({ patientId }: { patientId: string }) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const problems = useEhr(() => AdelanteEHR.listProblems(patientId));
  const { role, staffName } = useActingStaff();
  const gate = canAccess(role, "problems", patient);
  const sudGate = canAccess(role, "sud_treatment", patient);
  const canWrite = gate.level === "write";
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<Problem | null>(null);

  if (gate.locked || !patient) {
    return <LockedNote reason={gate.reason} />;
  }

  const handlePick = (pick: DiagnosisPick) => {
    try {
      AdelanteEHR.addProblem(patientId, {
        description: pick.description,
        icd10Code: pick.icd10Code,
        snomedCode: pick.snomedCode,
        snomedDisplay: pick.snomedDisplay,
        category: pick.category,
        enteredBy: staffName,
      });
      toast.success(`Added: ${pick.icd10Code ?? ""} ${pick.description}`.trim());
      setAdding(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add problem.");
    }
  };

  return (
    <div className="space-y-3">
      {canWrite && (
        <Card className="p-3">
          {adding ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-navy">Add problem</div>
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
              <DiagnosisPicker onPick={handlePick} autoFocus />
            </div>
          ) : (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add problem
            </Button>
          )}
        </Card>
      )}

      {problems.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No problems recorded"
          description="Use the search above to add a diagnosis."
        />
      ) : (
        <ul className="space-y-2">
          {problems.map((p) => (
            <ProblemRow
              key={p.id}
              problem={p}
              canWrite={canWrite}
              sudLocked={sudGate.locked}
              onResolve={() => AdelanteEHR.resolveProblem(patientId, p.id, staffName)}
              onReactivate={() => AdelanteEHR.reactivateProblem(patientId, p.id, staffName)}
              onRemove={() => setToRemove(p)}
            />
          ))}
        </ul>
      )}

      <RemovalReasonDialog
        open={!!toRemove}
        onOpenChange={(v) => !v && setToRemove(null)}
        title="Remove problem"
        itemLabel={toRemove ? `${toRemove.icd10Code ?? ""} ${toRemove.description}`.trim() : ""}
        onConfirm={(reason) => {
          if (!toRemove) return;
          try {
            AdelanteEHR.softDeleteProblem(patientId, toRemove.id, reason, staffName);
            toast.success("Problem removed.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not remove.");
          }
          setToRemove(null);
        }}
      />
    </div>
  );
}

function ProblemRow({
  problem,
  canWrite,
  sudLocked,
  onResolve,
  onReactivate,
  onRemove,
}: {
  problem: Problem;
  canWrite: boolean;
  sudLocked: boolean;
  onResolve: () => void;
  onReactivate: () => void;
  onRemove: () => void;
}) {
  const isSudMasked = problem.category === "sud" && sudLocked;
  const active = isProblemClinicallyActive(problem);
  return (
    <li>
      <Card className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isSudMasked ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                <span>SUD diagnosis — 42 CFR Part 2 consent required</span>
              </div>
            ) : (
              <>
                <div className="text-sm text-navy font-medium truncate">
                  {problem.icd10Code ? `${problem.icd10Code} — ` : ""}
                  {problem.description}
                </div>
                {problem.snomedDisplay && problem.snomedDisplay !== problem.description && (
                  <div className="text-[11px] text-muted-foreground">
                    SNOMED: {problem.snomedDisplay}
                  </div>
                )}
                {(problem.clinicianComment || problem.notes) && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {problem.clinicianComment || problem.notes}
                  </div>
                )}
              </>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                className={
                  active
                    ? "bg-teal/20 text-teal border-0 text-[10px]"
                    : "bg-muted text-muted-foreground border-0 text-[10px]"
                }
              >
                {active ? "Active" : "Resolved"}
              </Badge>
              {problem.category === "sud" && (
                <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                  42 CFR 2
                </Badge>
              )}
              {problem.category === "mental_health" && (
                <Badge className="bg-teal/20 text-teal border-0 text-[10px]">MH</Badge>
              )}
              {problem.category === "pregnancy" && (
                <Badge className="bg-gold/30 text-navy border-0 text-[10px]">Pregnancy</Badge>
              )}
              <span className="text-[10px] text-muted-foreground">
                Added <ClientDate value={problem.createdAt} /> · {problem.enteredBy}
              </span>
              {problem.resolvedDate && (
                <span className="text-[10px] text-muted-foreground">
                  · Resolved <ClientDate value={problem.resolvedDate} />
                </span>
              )}
            </div>
          </div>
          {canWrite && !isSudMasked && (
            <div className="flex items-center gap-1 shrink-0">
              {active ? (
                <Button size="sm" variant="outline" onClick={onResolve}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Resolve
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={onReactivate}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reactivate
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onRemove}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </Card>
    </li>
  );
}

// ============================================================================
// Allergies tab
// ============================================================================

export function AllergiesTab({ patientId }: { patientId: string }) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const allergies = useEhr(() => AdelanteEHR.listAllergies(patientId));
  const { role, staffName } = useActingStaff();
  const gate = canAccess(role, "allergies", patient);
  const canWrite = gate.level === "write";
  const [substance, setSubstance] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<Allergy["severity"]>("mild");
  const [notes, setNotes] = useState("");
  const [toRemove, setToRemove] = useState<Allergy | null>(null);

  if (gate.locked) return <LockedNote reason={gate.reason} />;

  const submit = () => {
    const s = substance.trim();
    if (!s) {
      toast.error("Substance is required.");
      return;
    }
    try {
      AdelanteEHR.addAllergy(patientId, {
        substance: s,
        reaction: reaction.trim() || undefined,
        severity,
        notes: notes.trim() || undefined,
        enteredBy: staffName,
      });
      setSubstance("");
      setReaction("");
      setSeverity("mild");
      setNotes("");
      toast.success("Allergy added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add.");
    }
  };

  return (
    <div className="space-y-3">
      {canWrite && (
        <Card className="p-3 space-y-2">
          <div className="text-xs font-medium text-navy">Add allergy</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Substance</Label>
              <Input value={substance} onChange={(e) => setSubstance(e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as Allergy["severity"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-[11px]">Reaction</Label>
              <Input value={reaction} onChange={(e) => setReaction(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-[11px]">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={submit}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
            </Button>
          </div>
        </Card>
      )}

      {allergies.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No allergies recorded"
          description="Ask on intake and record here."
        />
      ) : (
        <ul className="space-y-2">
          {allergies.map((a) => (
            <li key={a.id}>
              <Card className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-navy font-medium">{a.substance}</div>
                    {a.reaction && (
                      <div className="text-[11px] text-muted-foreground">
                        Reaction: {a.reaction}
                      </div>
                    )}
                    {a.notes && <div className="text-[11px] text-muted-foreground">{a.notes}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <SeverityBadge severity={a.severity} />
                      <span className="text-[10px] text-muted-foreground">
                        Added <ClientDate value={a.enteredAt} /> · {a.enteredBy}
                      </span>
                    </div>
                  </div>
                  {canWrite && (
                    <Button size="sm" variant="ghost" onClick={() => setToRemove(a)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <RemovalReasonDialog
        open={!!toRemove}
        onOpenChange={(v) => !v && setToRemove(null)}
        title="Remove allergy"
        itemLabel={toRemove?.substance ?? ""}
        onConfirm={(reason) => {
          if (!toRemove) return;
          try {
            AdelanteEHR.softDeleteAllergy(patientId, toRemove.id, reason, staffName);
            toast.success("Allergy removed.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not remove.");
          }
          setToRemove(null);
        }}
      />
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Allergy["severity"] }) {
  const map = {
    mild: "bg-muted text-muted-foreground",
    moderate: "bg-gold/30 text-navy",
    severe: "bg-destructive/15 text-destructive",
  } as const;
  return <Badge className={`${map[severity]} border-0 text-[10px] capitalize`}>{severity}</Badge>;
}

// ============================================================================
// Alerts tab
// ============================================================================

export function AlertsTab({ patientId }: { patientId: string }) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const alerts = useEhr(() => AdelanteEHR.listAlerts(patientId));
  const { role, staffName } = useActingStaff();
  const gate = canAccess(role, "alerts", patient);
  const canWrite = gate.level === "write";
  const [label, setLabel] = useState("");
  const [severity, setSeverity] = useState<PatientAlert["severity"]>("info");
  const [notes, setNotes] = useState("");
  const [toRemove, setToRemove] = useState<PatientAlert | null>(null);

  if (gate.locked) return <LockedNote reason={gate.reason} />;

  const submit = () => {
    const l = label.trim();
    if (!l) {
      toast.error("Label is required.");
      return;
    }
    try {
      AdelanteEHR.addAlert(patientId, {
        label: l,
        severity,
        notes: notes.trim() || undefined,
        enteredBy: staffName,
      });
      setLabel("");
      setSeverity("info");
      setNotes("");
      toast.success("Alert added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add.");
    }
  };

  return (
    <div className="space-y-3">
      <PatientCrisisPanel patientId={patientId} />
      {canWrite && (
        <Card className="p-3 space-y-2">
          <div className="text-xs font-medium text-navy">Add alert</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-[11px]">Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Fall Risk, Suicide Watch"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-[11px]">Severity</Label>
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as PatientAlert["severity"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-[11px]">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={submit}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
            </Button>
          </div>
        </Card>
      )}

      {alerts.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No active alerts"
          description="Staff-coordination flags (fall risk, suicide watch, etc.)."
        />
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id}>
              <Card className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-navy font-medium">{a.label}</div>
                    {a.notes && <div className="text-[11px] text-muted-foreground">{a.notes}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <AlertSeverityBadge severity={a.severity} />
                      <span className="text-[10px] text-muted-foreground">
                        Added <ClientDate value={a.enteredAt} /> · {a.enteredBy}
                      </span>
                    </div>
                  </div>
                  {canWrite && (
                    <Button size="sm" variant="ghost" onClick={() => setToRemove(a)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <RemovalReasonDialog
        open={!!toRemove}
        onOpenChange={(v) => !v && setToRemove(null)}
        title="Remove alert"
        itemLabel={toRemove?.label ?? ""}
        onConfirm={(reason) => {
          if (!toRemove) return;
          try {
            AdelanteEHR.softDeleteAlert(patientId, toRemove.id, reason, staffName);
            toast.success("Alert removed.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not remove.");
          }
          setToRemove(null);
        }}
      />
    </div>
  );
}

function AlertSeverityBadge({ severity }: { severity: PatientAlert["severity"] }) {
  const map = {
    info: "bg-muted text-muted-foreground",
    warning: "bg-gold/30 text-navy",
    critical: "bg-destructive/15 text-destructive",
  } as const;
  return <Badge className={`${map[severity]} border-0 text-[10px] capitalize`}>{severity}</Badge>;
}

function LockedNote({ reason }: { reason?: string }) {
  return (
    <Card className="p-4 flex items-start gap-2 border-destructive/30 bg-destructive/5">
      <Lock className="h-4 w-4 text-destructive mt-0.5" />
      <div className="text-sm">
        <div className="font-medium text-destructive">Access restricted</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {reason ?? "Your role does not have access to this section."}
        </div>
      </div>
    </Card>
  );
}
