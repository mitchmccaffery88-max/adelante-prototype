// §Consent W6 — patient "Stop sharing" for signed forms: confirm step with a
// plain care-impact warning and an optional reason. Draft — pending counsel review.
import { useState } from "react";
import { toast } from "sonner";
import { useEhr } from "@/lib/ehr";
import { listSignedCopies, revokeForm, CARE_IMPACT, groupConsentGate, reopenForPatient, type FormKey } from "@/lib/consentForms";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormsToSign } from "./FormsToSign";

export function PatientSignedForms({ patientId, lang = "en" }: { patientId: string; lang?: "en" | "es" }) {
  const rows = JSON.parse(useEhr(() => JSON.stringify(listSignedCopies(patientId).filter((r) => !r.ended)))) as ReturnType<typeof listSignedCopies>;
  const [confirm, setConfirm] = useState<FormKey | null>(null);
  const [reason, setReason] = useState("");
  const es = lang === "es";
  if (!rows.length) return null;
  return (
    <div className="mt-4 space-y-2" data-testid="patient-signed-forms">
      <div className="text-sm font-medium">{es ? "Formularios firmados" : "Forms you signed"}</div>
      <ul className="space-y-2">
        {rows.map(({ copy: c }) => (
          <li key={c.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>{c.title}</span>
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => { setConfirm(c.formKey); setReason(""); }} aria-label={`${es ? "Dejar de compartir" : "Stop sharing"}: ${c.title}`}>{es ? "Dejar de compartir" : "Stop sharing"}</Button>
            </div>
            {confirm === c.formKey && (
              <div className="mt-3 space-y-2" data-testid="stop-sharing-confirm">
                <p className="rounded bg-amber-500/10 p-2">{CARE_IMPACT[c.formKey][lang]}</p>
                <Textarea aria-label={es ? "Motivo (opcional)" : "Reason (optional)"} placeholder={es ? "Motivo (opcional)" : "Reason (optional)"} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="destructive" className="min-h-11" onClick={() => { try { revokeForm({ patientId, formKey: c.formKey, by: "patient", ...(reason.trim() ? { reason } : {}) }); toast.success(es ? "Se dejó de compartir" : "Sharing stopped"); setConfirm(null); } catch (e) { toast.error((e as Error).message); } }}>{es ? "Sí, dejar de compartir" : "Yes, stop sharing"}</Button>
                  <Button variant="ghost" className="min-h-11" onClick={() => setConfirm(null)}>{es ? "Mantener" : "Keep it"}</Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** W7 one-card group prompt — shown only when group booking is blocked by consent. */
export function GroupConsentPrompt({ patientId, lang = "en" }: { patientId: string; lang?: "en" | "es" }) {
  const blocked = useEhr(() => groupConsentGate(patientId));
  const [opened, setOpened] = useState(false);
  if (!blocked) return null;
  const es = lang === "es";
  return (
    <div className="patient-theme rounded-3xl border p-4" data-testid="group-consent-prompt">
      <h2 className="text-lg font-semibold">{es ? "Para unirse a un grupo" : "To join a group"}</h2>
      <p className="text-[17px] text-foreground/80">{es ? "Firme el formulario de participación en grupos." : "Sign the group participation form."}</p>
      {opened ? <FormsToSign patientId={patientId} lang={lang} only={["group"]} /> : <Button className="mt-2 min-h-11 rounded-full" onClick={() => { reopenForPatient(patientId, "group"); setOpened(true); }}>{es ? "Revisar el formulario" : "Review the form"}</Button>}
    </div>
  );
}
