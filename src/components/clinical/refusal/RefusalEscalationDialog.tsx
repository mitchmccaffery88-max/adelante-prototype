// §MAR Phase 3 — 3-refusals-in-7-days escalation (port of the reference's
// RefusalEscalationDialog). Either branch is audit-logged; there is no silent
// dismissal path.
import { useEffect, useState } from "react";
import { AdelanteEHR } from "@/lib/ehr";
import {
  DEFERRAL_REASONS,
  ESCALATION_DISCIPLINES,
  ESCALATION_MAX_HOURS,
  ESCALATION_MIN_MINUTES,
  defaultEscalationDiscipline,
  type MedClass,
} from "@/lib/refusal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";

export interface EscalationTarget {
  formId: string;
  orderId: string;
  drugName: string;
  medClass: MedClass;
  refusalCount: number;
}

export function RefusalEscalationDialog({
  patientId,
  target,
  staffName,
  onClose,
}: {
  patientId: string;
  target: EscalationTarget | null;
  staffName: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"scheduled" | "deferred">("scheduled");
  const [discipline, setDiscipline] = useState("medical_provider");
  const [when, setWhen] = useState("");
  const [deferralReason, setDeferralReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setMode("scheduled");
    setDiscipline(target ? defaultEscalationDiscipline(target.medClass) : "medical_provider");
    setWhen("");
    setDeferralReason("");
    setNotes("");
  }, [target?.formId, target?.medClass]);

  if (!target) return null;

  const submit = () => {
    try {
      AdelanteEHR.recordRefusalEscalation(
        patientId,
        {
          formId: target.formId,
          orderId: target.orderId,
          decision: mode,
          discipline: mode === "scheduled" ? discipline : undefined,
          // datetime-local has no zone; interpret as the browser's local time.
          followUpAt: mode === "scheduled" && when ? new Date(when).toISOString() : undefined,
          deferralReason: mode === "deferred" ? deferralReason : undefined,
          notes,
        },
        staffName,
      );
      toast.success(
        mode === "scheduled" ? "Provider follow-up scheduled." : "Escalation deferral recorded.",
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the escalation decision.");
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repeated refusals — provider escalation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {target.drugName} has been refused {target.refusalCount} times in the last 7 days.
            Schedule a provider follow-up or document why escalation is being deferred.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "scheduled" ? "default" : "outline"}
              aria-label="schedule follow-up"
              onClick={() => setMode("scheduled")}
            >
              Schedule follow-up
            </Button>
            <Button
              size="sm"
              variant={mode === "deferred" ? "default" : "outline"}
              aria-label="defer escalation"
              onClick={() => setMode("deferred")}
            >
              Defer
            </Button>
          </div>

          {mode === "scheduled" ? (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Discipline *</Label>
                <Select value={discipline} onValueChange={setDiscipline}>
                  <SelectTrigger aria-label="Escalation discipline" className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESCALATION_DISCIPLINES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">
                  Follow-up date &amp; time * ({ESCALATION_MIN_MINUTES} minutes to{" "}
                  {ESCALATION_MAX_HOURS} hours from now)
                </Label>
                <Input
                  className="mt-1"
                  type="datetime-local"
                  aria-label="Follow-up date and time"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Deferral reason *</Label>
              <Select value={deferralReason} onValueChange={setDeferralReason}>
                <SelectTrigger aria-label="Deferral reason" className="mt-1 w-full">
                  <SelectValue placeholder="Why is escalation not needed now?" />
                </SelectTrigger>
                <SelectContent>
                  {DEFERRAL_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              className="mt-1"
              rows={2}
              aria-label="Escalation notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Record decision</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
