// 26 Oct evening (Mitch) — the patient signs telehealth or group
// confidentiality on their own, from Forms or right where a group asks for it.
// Runs the registry action "patient_consent_self_sign"; the gate updates at
// once. Spanish is a draft pending translation review (the shell owns the notice).
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { hasSignedForm, publishedForm, type FormKey, type SelfSignContext } from "@/lib/consentForms";
import { runAction } from "@/lib/actions/runAction";
import { PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";

const T = {
  en: { read: "Read the full form", agree: "I agree to this form", name: "Type your full name to sign", sign: "Sign", signed: "Signed", done: "Signed. Thank you." },
  es: { read: "Leer el formulario completo", agree: "Acepto este formulario", name: "Escribe tu nombre completo para firmar", sign: "Firmar", signed: "Firmado", done: "Firmado. Gracias." },
};

export function SelfSignConsentCard({ patientId, formKey, context, lang }: { patientId: string; formKey: FormKey; context: SelfSignContext; lang: "en" | "es" }) {
  const t = T[lang];
  const form = useEhr(() => publishedForm(formKey));
  const signed = useEhr(() => hasSignedForm(patientId, formKey));
  const [open, setOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState("");
  if (!form) return null;
  const sign = () => {
    const actor = { role: PATIENT_ACTOR_ROLE, staffId: patientId, staffName: "Patient (self)" };
    const r = runAction("patient_consent_self_sign", actor, AdelanteEHR.getPatient(patientId), { args: [{ patientId, formKey, typedName: name, attested: agree, context, language: lang }] });
    if (!r.ok) { toast.error(r.reason); return; }
    toast.success(t.done);
  };
  return (
    <div className="rounded-md border border-line-strong bg-surface p-4 space-y-3" data-testid={`self-sign-${formKey}`}>
      <h3 className="text-lg font-bold text-ink">{form.title[lang]}</h3>
      <p className="text-ink">{form.summary[lang]}</p>
      <button type="button" className="min-h-12 text-path underline" onClick={() => setOpen(!open)}>{t.read}</button>
      {open && <p className="whitespace-pre-wrap text-ink-muted">{form.body[lang]}</p>}
      {signed ? <StatusChip state="done" lang={lang} label={t.signed} /> : <>
        <label className="flex min-h-12 items-center gap-3"><Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} aria-label={`${t.agree}: ${form.title[lang]}`} />{t.agree}</label>
        <Input aria-label={t.name} placeholder={t.name} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="min-h-12" />
        <Button disabled={!agree || name.trim().length < 2} onClick={sign}>{t.sign}</Button>
      </>}
    </div>
  );
}

const LIST = {
  en: { title: "Forms you can sign yourself", intro: "Sign these any time. You can stop them later in Forms." },
  es: { title: "Formularios que puedes firmar tú", intro: "Fírmalos cuando quieras. Puedes detenerlos después en Formularios." },
};
export function SelfSignForms({ patientId, lang }: { patientId: string; lang: "en" | "es" }) {
  const c = LIST[lang];
  return (
    <section className="mt-4 space-y-3" data-testid="self-sign-forms">
      <h2 className="text-xl font-bold text-ink">{c.title}</h2>
      <p className="text-ink-muted">{c.intro}</p>
      <SelfSignConsentCard patientId={patientId} formKey="telehealth" context="forms" lang={lang} />
      <SelfSignConsentCard patientId={patientId} formKey="group" context="forms" lang={lang} />
    </section>
  );
}
