// §Phase 8b — "Record reported benefits" on the chart's Eligibility section.
// Staff enter what the person tells them using the SAME shared step, saved as
// staff_recorded_patient_report with the staff member attributed. Unverified.
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { canAccess, useActingStaff } from "@/lib/roles";
import { BenefitsStep, benefitsCinProblem, selectedPlanSnapshot } from "@/components/intake/BenefitsStep";
import {
  benefitsAnswers,
  benefitsFormFromPatient,
  recordIntakeBenefits,
  type BenefitsFormState,
} from "@/lib/intakeBenefits";

export function ReportedBenefitsCard({ patientId }: { patientId: string }) {
  const acting = useActingStaff();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BenefitsFormState | null>(null);
  if (canAccess(acting.role, "eligibility").level !== "write") return null;

  const save = () => {
    if (!form) return;
    if (benefitsCinProblem(form)) return void toast.error("A Medi-Cal ID is 9 letters or numbers.");
    const answers = benefitsAnswers(form, selectedPlanSnapshot(form.planId));
    if (!answers) return void toast.error("Choose a coverage type first.");
    const r = recordIntakeBenefits(patientId, answers, {
      source: "staff_recorded_patient_report",
      via: "chart",
      actorId: acting.staffId,
      actorName: acting.staffName || acting.staffId,
      actorRole: acting.role,
    });
    if (!r.ok) return void toast.error(r.error ?? "Couldn't save.");
    const bits = [
      r.cinWritten && "CIN saved",
      r.cinMismatch && "a different CIN is already on file — not changed",
      r.planSpanAdded && "plan added",
      r.verificationAdded && "needs verification",
      r.taskId && "billing asked to set a payment arrangement",
    ].filter(Boolean);
    toast.success(`Reported benefits saved${bits.length ? ` · ${bits.join(" · ")}` : ""}`);
    setOpen(false);
  };

  return (
    <Card className="p-3 space-y-2" data-testid="reported-benefits-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Reported benefits</div>
          <p className="text-xs text-muted-foreground">
            Record what the client tells you. Saved as a patient report under your name — not a verification.
          </p>
        </div>
        {!open && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setForm(benefitsFormFromPatient(patientId));
              setOpen(true);
            }}
          >
            Record reported benefits
          </Button>
        )}
      </div>
      {open && form && (
        <div className="space-y-3">
          <BenefitsStep value={form} onChange={setForm} patientId={patientId} showHeading={false} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} data-testid="reported-benefits-save">
              Save
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
