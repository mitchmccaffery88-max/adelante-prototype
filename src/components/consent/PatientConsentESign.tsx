// §B2-2 — patient e-sign of typed consent records sent by the care team, and
// the patient's own "My forms" list. Typed name + attestation (same mechanism
// as Forms to sign). Writes run through runAction as the patient. Spanish is
// a draft pending native review (the member shell shows the one notice).
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { CONSENT_TYPE_LABEL, listESignRequests, myConsentRecords, requestSelfReSign, type ESignRequest } from "@/lib/consentCapture";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { useConfirmDialog } from "@/components/staff/use-confirm-dialog";

const COPY = {
  en: { title: "Consent forms from your team", who: "Who can receive it", why: "Why", what: "What", ends: "Ends", name: "Type your full name", agree: "I have read this and I agree", sign: "Sign", signed: "Signed", draft: "Draft — pending counsel", mine: "My forms", active: "In effect", expired: "Expired", ended: "Ended", none: "No end date", revoke: "Revoke", revokeTitle: "Revoke this consent?", revokeBody: "This stops new sharing from now on. It does not undo sharing that already happened. (Draft — pending counsel)", revokeYes: "Yes, revoke it", revokeKeep: "Keep it", revoked: "Revoked", signAgain: "Sign again", signAgainSent: "Added to the forms above — sign it there" },
  es: { title: "Formularios de consentimiento de tu equipo", who: "Quién puede recibirla", why: "Por qué", what: "Qué", ends: "Termina", name: "Escribe tu nombre completo", agree: "Lo leí y estoy de acuerdo", sign: "Firmar", signed: "Firmado", draft: "Borrador — pendiente de revisión legal", mine: "Mis formularios", active: "Vigente", expired: "Vencido", ended: "Terminado", none: "Sin fecha de fin", revoke: "Revocar", revokeTitle: "¿Revocar este consentimiento?", revokeBody: "Esto detiene los nuevos envíos a partir de ahora. No deshace lo que ya se compartió. (Borrador — pendiente de revisión legal)", revokeYes: "Sí, revocar", revokeKeep: "Conservarlo", revoked: "Revocado", signAgain: "Firmar de nuevo", signAgainSent: "Se agregó a los formularios de arriba — fírmalo ahí" },
} as const;

export function PatientConsentESign({ patientId, lang = "en" }: { patientId: string; lang?: "en" | "es" }) {
  const t = COPY[lang];
  const waiting = JSON.parse(useEhr(() => JSON.stringify(listESignRequests(patientId).filter((r) => r.status === "waiting")))) as ESignRequest[];
  if (!waiting.length) return null;
  return (
    <section className="member-overlay space-y-3 rounded-3xl bg-card p-4 sm:p-5" data-testid="patient-consent-esign">
      <h2 className="text-xl font-semibold text-foreground">{t.title}</h2>
      <p className="text-sm text-muted-foreground">{t.draft}</p>
      <ul className="space-y-3">{waiting.map((r) => <SignCard key={r.id} req={r} lang={lang} />)}</ul>
    </section>
  );
}

function SignCard({ req, lang }: { req: ESignRequest; lang: "en" | "es" }) {
  const t = COPY[lang];
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const d = req.draft;
  const sign = () => {
    const patient = AdelanteEHR.getPatient(req.patientId);
    const r = runAction("consent_record_patient_sign", { role: PATIENT_ACTOR_ROLE }, patient, { args: [{ requestId: req.id, typedName: name, attested: agree, language: lang }] });
    if (r.ok) toast.success(t.signed);
    else toast.error(r.reason);
  };
  return (
    <li className="rounded-2xl border p-4" data-testid={`esign-card-${d.consentType}`}>
      <h3 className="text-[18px] font-semibold leading-snug">{CONSENT_TYPE_LABEL[d.consentType][lang]}</h3>
      <dl className="mt-2 space-y-1 text-base">
        <div><dt className="inline font-semibold">{t.who}: </dt><dd className="inline">{d.recipients.map((x) => x.name).join(", ")}</dd></div>
        <div><dt className="inline font-semibold">{t.what}: </dt><dd className="inline">{d.items.join(", ")}</dd></div>
        <div><dt className="inline font-semibold">{t.why}: </dt><dd className="inline">{d.purpose}</dd></div>
        <div><dt className="inline font-semibold">{t.ends}: </dt><dd className="inline">{d.expiresOn ?? d.expiresOnEvent ?? t.none}</dd></div>
      </dl>
      <div className="mt-3 space-y-3">
        <Input aria-label={t.name} placeholder={t.name} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="min-h-12" />
        <label className="flex min-h-12 items-center gap-2 text-base"><Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} aria-label={t.agree} /> {t.agree}</label>
        <Button className="min-h-12 w-full rounded-full" onClick={sign} data-testid="esign-submit">{t.sign}</Button>
      </div>
    </li>
  );
}

export function MyConsentRecords({ patientId, lang = "en" }: { patientId: string; lang?: "en" | "es" }) {
  const t = COPY[lang];
  const confirm = useConfirmDialog();
  const rows = JSON.parse(useEhr(() => JSON.stringify(myConsentRecords(patientId)))) as ReturnType<typeof myConsentRecords>;
  if (!rows.length) return null;
  const revoke = (id: string) =>
    confirm.ask({
      title: t.revokeTitle,
      description: t.revokeBody,
      confirmLabel: t.revokeYes,
      keepLabel: t.revokeKeep,
      onConfirm: () => {
        const patient = AdelanteEHR.getPatient(patientId);
        const r = runAction("consent_record_patient_revoke", { role: PATIENT_ACTOR_ROLE }, patient, { via: "revokeTypedConsent", args: [{ recordId: id, method: "e_sign", actor: { role: "patient", name: patient ? `${patient.firstName} ${patient.lastName}` : "Patient" } }] });
        if (r.ok) toast.success(t.revoked);
        else toast.error(r.reason);
        return r.ok;
      },
    });
  const signAgain = (id: string) => {
    try {
      requestSelfReSign(id);
      toast.success(t.signAgainSent);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="mt-4 space-y-2" data-testid="my-consent-records">
      <div className="text-sm font-medium">{t.mine}</div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <span>{CONSENT_TYPE_LABEL[r.consentType][lang]} · {r.recipients.join(", ")}</span>
            <span className="flex flex-wrap items-center gap-2">
              <StatusChip lang={lang} state={r.status === "active" ? "done" : "closed"} label={r.status === "active" ? t.active : r.status === "expired" ? t.expired : t.ended} />
              {r.status === "active" && <Button size="sm" variant="outline" className="min-h-12" onClick={() => revoke(r.id)} data-testid={`my-consent-revoke-${r.id}`}>{t.revoke}</Button>}
              {r.status === "expired" && <Button size="sm" className="min-h-12" onClick={() => signAgain(r.id)} data-testid={`my-consent-sign-again-${r.id}`}>{t.signAgain}</Button>}
            </span>
          </li>
        ))}
      </ul>
      {confirm.dialog}
    </div>
  );
}
