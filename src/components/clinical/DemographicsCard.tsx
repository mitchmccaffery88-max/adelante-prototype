// §Demographics & identifiers — staff edit with reason + history.
import { act, actFor } from "@/lib/actions/act";
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  DEMOGRAPHIC_FIELDS,
  DEMOGRAPHIC_LABEL,
  ELIGIBILITY_RECHECK_NOTE,
  REASON_REQUIRED_FIELDS,
  editableDemographicFields,
  type DemographicField,
} from "@/lib/demographics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientDate } from "@/components/ClientDate";

export function DemographicsCard({ patientId }: { patientId: string }) {
  const { role, staffName, staffId, clinicianId } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Record<DemographicField, string>>>({});
  const [reason, setReason] = useState("");
  if (!patient) return null;
  const isPrimary =
    !!patient.primaryClinicianId && [clinicianId, staffId].includes(patient.primaryClinicianId);
  const allowed = editableDemographicFields(role, isPrimary);
  const read = (f: DemographicField): string => {
    if (f === "emergencyContactName") return patient.emergencyContact?.name ?? "";
    if (f === "emergencyContactPhone") return patient.emergencyContact?.phone ?? "";
    return String((patient as unknown as Record<string, unknown>)[f] ?? "");
  };
  const changed = allowed.filter((f) => form[f] !== undefined && form[f]!.trim() !== read(f));
  const needsReason = changed.some((f) => REASON_REQUIRED_FIELDS.includes(f));
  const history = [...(patient.demographicsHistory ?? [])].reverse();

  const save = () => {
    try {
      const patch: Partial<Record<DemographicField, string>> = {};
      for (const f of changed) patch[f] = form[f];
      act("demographics_edit", "updatePatientDemographics",
        patientId,
        patch,
        { staffId, clinicianId, name: staffName, role },
        reason,
      );
      toast.success("Patient details updated");
      setEditing(false);
      setForm({});
      setReason("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className="mb-4 p-4" data-testid="demographics-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base text-navy">Demographics &amp; identifiers</h3>
        {allowed.length > 0 && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {allowed.length < DEMOGRAPHIC_FIELDS.length ? "Edit contact info" : "Edit details"}
          </Button>
        )}
      </div>
      {patient.eligibilityRecheck && (
        <p className="mt-2 rounded border border-gold/60 bg-gold/10 p-2 text-xs text-navy" data-testid="eligibility-recheck">
          {ELIGIBILITY_RECHECK_NOTE}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {DEMOGRAPHIC_FIELDS.map((f) => (
          <div key={f} className="min-w-0">
            {editing && allowed.includes(f) ? (
              <>
                <Label htmlFor={`demo-${f}`} className="text-xs">
                  {DEMOGRAPHIC_LABEL[f]}
                  {REASON_REQUIRED_FIELDS.includes(f) ? " (reason required)" : ""}
                </Label>
                <Input
                  id={`demo-${f}`}
                  className="h-8"
                  value={form[f] ?? read(f)}
                  onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
                />
              </>
            ) : (
              <>
                <dt className="text-xs text-muted-foreground">{DEMOGRAPHIC_LABEL[f]}</dt>
                <dd className="break-words text-navy">{read(f) || "—"}</dd>
              </>
            )}
          </div>
        ))}
      </dl>
      {editing && (
        <div className="mt-3 space-y-2">
          {needsReason && (
            <div>
              <Label htmlFor="demo-reason" className="text-xs">
                Reason for changing legal name, date of birth or CIN
              </Label>
              <Input id="demo-reason" className="h-8" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={changed.length === 0 || (needsReason && reason.trim().length < 3)}>
              Save changes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm({}); setReason(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {history.length > 0 && (
        <details className="mt-3 text-xs" data-testid="demographics-history">
          <summary className="cursor-pointer font-medium text-navy">Change history ({history.length})</summary>
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded border border-border p-2">
                <p className="text-muted-foreground">
                  {h.byName} · <ClientDate value={h.at} />
                  {h.reason ? ` · Reason: ${h.reason}` : ""}
                </p>
                <ul className="mt-1">
                  {h.changes.map((c) => (
                    <li key={c.field} className="break-words">
                      {DEMOGRAPHIC_LABEL[c.field]}: <span className="line-through">{c.before || "—"}</span> → {c.after || "—"}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
