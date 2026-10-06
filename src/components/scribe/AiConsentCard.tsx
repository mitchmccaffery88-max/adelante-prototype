// §Scribe Phase 1 — AI session-recording consent card.
// mode "patient": My care, EN/ES (Spanish draft). mode "staff": assisted
// capture on the patient's behalf (typed name + attestation, same pattern as
// the consent ledger). Both run through runAction.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type Patient } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import { useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { AI_CONSENT_COPY, aiConsentStatus, canRecordAiConsent, COUNSEL_DRAFT_LABEL, patientNeedsPart2 } from "@/lib/scribe";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

function useStatus(patientId: string) {
  return JSON.parse(useEhr(() => JSON.stringify(aiConsentStatus(patientId)))) as ReturnType<typeof aiConsentStatus>;
}

export function AiConsentCard({ patient, mode }: { patient: Patient; mode: "patient" | "staff" }) {
  const { lang } = useI18n();
  const L = mode === "patient" && lang === "es" ? "es" : "en";
  const c = AI_CONSENT_COPY[L];
  const st = useStatus(patient.id);
  const needsP2 = useEhr(() => patientNeedsPart2(AdelanteEHR.getPatient(patient.id) ?? patient));
  const staff = useActingStaff();
  const [name, setName] = useState("");
  const [attested, setAttested] = useState(false);
  const [expiresOn, setExpiresOn] = useState("");
  const active = st.state === "active";

  const actor =
    mode === "patient"
      ? { role: PATIENT_ACTOR_ROLE, staffId: patient.id, staffName: "Patient (self)" }
      : { role: staff.role, staffId: staff.staffId, staffName: staff.staffName, clinicianId: staff.clinicianId };
  const capturedBy = mode === "patient" ? { staffName: "Patient (self)", role: "patient" } : { staffId: staff.staffId, staffName: staff.staffName, role: staff.role };

  const grant = () => {
    const r = runAction("scribe_consent_grant", actor, patient, {
      args: [
        {
          patientId: patient.id,
          signedByName: mode === "patient" ? `${patient.firstName} ${patient.lastName}` : name,
          attested: mode === "patient" ? true : attested,
          part2: needsP2,
          expiresOn: expiresOn || undefined,
          capturedBy,
        },
      ],
    });
    if (r.ok) toast.success(L === "es" ? "Guardado" : "Consent recorded");
    else toast.error(r.reason);
  };
  const withdraw = () => {
    const r = runAction("scribe_consent_withdraw", actor, patient, {
      args: [{ patientId: patient.id, by: mode === "patient" ? `${patient.firstName} ${patient.lastName}` : staff.staffName, role: mode === "patient" ? "patient" : staff.role, staffId: mode === "patient" ? undefined : staff.staffId }],
    });
    if (r.ok) toast.success(L === "es" ? "Retirado" : "Consent withdrawn — any live capture was stopped and discarded");
    else toast.error(r.reason);
  };

  if (mode === "staff" && !canRecordAiConsent(staff.role)) return null;

  return (
    <Card className="p-4" data-testid={`ai-consent-${mode}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base text-navy">{c.title}</h3>
        <Badge variant={active ? "default" : "outline"} data-testid="ai-consent-state">
          {mode === "staff" ? (active ? "Active" : "Not active") : active ? c.active : c.notActive}
          {mode === "staff" && st.state !== "active" && st.state !== "none" ? ` (${st.state.replace("_", " ")})` : ""}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">{COUNSEL_DRAFT_LABEL}{c.draft ? ` · ${c.draft}` : ""}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {c.lines.map((l) => <li key={l}>{l}</li>)}
        {needsP2 && <li className="font-medium" data-testid="ai-consent-part2-line">{c.part2Line}</li>}
      </ul>
      {mode === "staff" && active && st.expiresOn && <p className="mt-2 text-xs text-muted-foreground">In effect until {st.expiresOn}{st.part2 ? " · covers Part 2" : ""}</p>}
      {mode === "staff" && !active && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Patient's typed name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${patient.firstName} ${patient.lastName}`} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expires on (optional)</Label>
            <Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-xs sm:col-span-2">
            <Checkbox checked={attested} onCheckedChange={(v) => setAttested(v === true)} />
            I read this to the patient (or they read it) and they agreed. Recorded on their behalf.
          </label>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {active ? (
          <Button size="sm" variant="outline" onClick={withdraw} data-testid="ai-consent-withdraw">{c.withdraw}</Button>
        ) : (
          <Button size="sm" onClick={grant} data-testid="ai-consent-grant">{c.grant}</Button>
        )}
      </div>
    </Card>
  );
}
