// §Batch E — staff exact-match step: "This person may already exist".
// Open existing, or Create anyway (reason required, runAction, audited).
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import type { StaffRole } from "@/lib/roles";

export function ExistingPersonStep({
  operator,
  existingIds,
  input,
  onBack,
  onCreated,
}: {
  operator: { staffId: string; staffName: string; role: string };
  existingIds: string[];
  input: Record<string, unknown>;
  onBack: () => void;
  onCreated: (p: Patient) => void;
}) {
  const [reason, setReason] = useState("");
  const existing = existingIds.map((id) => AdelanteEHR.getPatient(id)).filter((p): p is Patient => Boolean(p));
  const createAnyway = () => {
    const r = runAction<Patient>("patient_create_anyway", { role: operator.role as StaffRole, staffId: operator.staffId, staffName: operator.staffName }, undefined, {
      args: [{ ...input, createAnyway: { reason, actorId: operator.staffId, actorRole: operator.role } }],
    });
    if (!r.ok) return toast.error(r.reason);
    toast.success("New record created — the match is queued for coordinator review");
    onCreated(r.value);
  };
  return (
    <Card className="space-y-4 p-6" data-testid="existing-person-step">
      <div>
        <h1 className="font-display text-2xl text-navy">This person may already exist</h1>
        <p className="mt-1 text-sm text-muted-foreground">An existing record matches exactly. Open it instead of creating a second one.</p>
      </div>
      <ul className="space-y-2">
        {existing.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <span>
              {p.firstName} {p.lastName} · DOB {p.dob} · {p.programId ?? p.id}
            </span>
            <Button asChild size="sm">
              <Link to="/record/$patientId" params={{ patientId: p.id }}>Open existing</Link>
            </Button>
          </li>
        ))}
      </ul>
      <div className="space-y-1.5">
        <Label htmlFor="ca-reason">Reason to create anyway (required)</Label>
        <Textarea id="ca-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Different person — confirmed by photo ID" />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={!reason.trim()} onClick={createAnyway}>Create anyway</Button>
        <Button variant="ghost" onClick={onBack}>Back</Button>
      </div>
    </Card>
  );
}
