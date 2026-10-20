import { useEffect, useState } from "react";
import { ShieldAlert, Lock } from "lucide-react";
import { AdelanteEHR, useEhr, type Patient } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { coordinatorEmergencyFor, coordinatorSudCanRead, EMERGENCY_REASONS, COORDINATOR_SUD_DRAFT, type EmergencyReason } from "@/lib/coordinatorSudAccess";
import { coordinatorSudView, auditCoordinatorSudView } from "@/lib/coordinatorSudView";
import { canUnlockCoordinatorEmergency } from "@/lib/coordinatorSudEmergency";
import { runAction } from "@/lib/actions/runAction";
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
import { FormField } from "@/components/staff/form-field";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CoordinatorSudPanel({ patient }: { patient: Patient }) {
  const { role, staffId, staffName } = useActingStaff();
  const actor = { role, staffId, name: staffName };
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<EmergencyReason | "">("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const version = useEhr(() => JSON.stringify([patient.sudCoordinationConsent, patient.sudCounselingNotesRelease, coordinatorEmergencyFor(actor, patient.id)]));
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const visible = now !== null && coordinatorSudCanRead(actor, patient, "diagnoses", now);
  const counseling = now !== null && coordinatorSudCanRead(actor, patient, "counseling_notes", now);
  const grant = now === null ? undefined : coordinatorEmergencyFor(actor, patient.id, now);
  useEffect(() => {
    if (visible || counseling) auditCoordinatorSudView({ role, staffId, name: staffName }, patient, "section");
  }, [visible, counseling, patient.id, role, staffId, staffName, version]);
  if (role !== "clinical_coordinator" || now === null) return null;
  const view = visible || counseling ? coordinatorSudView(patient, actor, now) : undefined;
  return <section className="space-y-4 border-b border-line pb-5" data-testid="coordinator-sud-panel">
    {grant && <div className="flex items-center gap-2 border border-urgent bg-surface p-3 text-sm text-urgent" role="status" data-testid="emergency-access-banner"><ShieldAlert className="size-5 shrink-0" />Emergency access — ends {new Date(grant.end).toLocaleTimeString()} — reviewed by compliance</div>}
    {view && <>
      <h2 className="text-lg font-semibold text-ink">SUD care — minimum necessary</h2>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {visible && <>
          <DetailList title="SUD diagnoses" rows={view.diagnoses.map((r) => `${r.description}${r.code ? ` (${r.code})` : ""} · ${r.status}`)} />
          <DetailList title="SUD treatment plans" rows={view.treatmentPlans.map((r) => `${r.text} · ${r.status}${r.interventions?.length ? ` · ${r.interventions.join("; ")}` : ""}`)} />
          <DetailList title="MAT/MOUD doses" rows={view.medications.map((r) => `${r.name} · ${r.dose ?? r.sig ?? "Dose not recorded"} · ${r.status}`)} />
          <DetailList title="MAT/MOUD adherence" rows={view.adherence.map((r) => `${r.at} · ${r.status} · ${r.source}`)} />
          <DetailList title="Labs & toxicology" rows={view.labs.map((r) => `${r.testId} · ${r.result ? `${r.result.value} ${r.result.unit} · ${r.result.flag}` : r.status}`)} />
          <DetailList title="Appointment attendance" rows={view.attendance.map((r) => `${new Date(r.start).toLocaleString()} · ${r.status}`)} />
          <DetailList title="Discharge summaries" rows={view.dischargeSummaries.map((r) => r.summary ?? "")} />
          <DetailList title="Standard SUD progress notes" rows={view.progressNotes.map((r) => `${r.date} · ${[r.subjective, r.objective, r.assessment, r.plan].filter(Boolean).join(" · ")}`)} />
        </>}
        {counseling && <DetailList title="Released counseling notes" rows={view.counselingNotes.map((r) => `${r.date} · ${[r.subjective, r.objective, r.assessment, r.plan].filter(Boolean).join(" · ")}`)} />}
      </div>
    </>}
    {!grant && canUnlockCoordinatorEmergency(actor, patient.id) && <Button variant="outline" onClick={() => { setOpen(true); setError(""); }}><Lock className="size-5" />Emergency access</Button>}
    {(view || open) && <p className="text-sm text-ink-muted">{COORDINATOR_SUD_DRAFT} · Simulated</p>}
    <ConfirmDialog open={open} onOpenChange={setOpen} title="Emergency access" description="Patient-specific access for four hours. Counseling notes remain restricted without a separate release. Reviewed by compliance." confirmLabel="Unlock for 4 hours" keepLabel="Keep restricted" requireReason reasonLabel="Free-text detail" reasonHelp="Explain the decision without including clinical content." onConfirm={(detail) => {
      if (!reason) { setError("Choose an allowed reason."); return false; }
      const result = runAction("coordinator_emergency_unlock", { role, staffId, staffName }, AdelanteEHR.getPatient(patient.id), { args: [{ patientId: patient.id, actor, reason, detail, reference }] });
      if (!result.ok) { setError(result.reason); return false; }
      setNow(Date.now()); setReason(""); setReference(""); setError(""); return true;
    }}>
      <Select value={reason} onValueChange={(value) => setReason(value as EmergencyReason)}><SelectTrigger aria-label="Allowed reason"><SelectValue placeholder="Choose a reason" /></SelectTrigger><SelectContent>{Object.entries(EMERGENCY_REASONS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
      {reason && reason !== "medical_emergency" && <FormField label="Reference" required value={reference} onChange={setReference} />}
      {error && <p role="alert" className="text-sm text-attention">{error}</p>}
    </ConfirmDialog>
  </section>;
}
function DetailList({ title, rows }: { title: string; rows: string[] }) {
  return <div className="min-w-0 space-y-2"><h3 className="font-semibold text-ink">{title}</h3>{rows.length ? <ul className="space-y-2 text-sm text-ink-muted">{rows.map((text, i) => <li key={i} className="break-words">{text}</li>)}</ul> : <p className="text-sm text-ink-muted">None recorded.</p>}</div>;
}