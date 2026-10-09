// §Consent W3 — patient "Forms to sign". One card per form, one checkbox,
// ONE signature step at the end. Part 2 has its own card naming who receives
// what and why. State lives in the store (save & resume). Draft — pending counsel review.
import { useState } from "react";
import { toast } from "sonner";
import { useEhr } from "@/lib/ehr";
import { formsToSign, setChecked, declineForm, signChecked, markViewed, CONSENT_DRAFT_LABEL, type FormKey } from "@/lib/consentForms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LessonReadAloud } from "@/components/voice/LessonReadAloud";

const T = {
  en: { title: "Forms to sign", done: (a: number, b: number) => `${a} of ${b} done`, read: "Read the full form", agree: "I agree to this form", decline: "No thanks", declined: "You said no", signed: "Signed", sign: "I agree to the items I checked", name: "Your full name", typed: "Type your full name to sign", draw: "Draw your signature", who: "Who can receive it", what: "What", why: "Why", relationship: "Signing for the patient as", self: "Myself", guardian: "Guardian", proxy: "Proxy", allDone: "All done. Thank you.", voice: "Read aloud (Simulated voice)", optional: "Optional" },
  es: { title: "Formularios para firmar", done: (a: number, b: number) => `${a} de ${b} listos`, read: "Leer el formulario completo", agree: "Acepto este formulario", decline: "No, gracias", declined: "Usted dijo que no", signed: "Firmado", sign: "Acepto los puntos que marqué", name: "Su nombre completo", typed: "Escriba su nombre completo para firmar", draw: "Dibuje su firma", who: "Quién puede recibirla", what: "Qué", why: "Por qué", relationship: "Firma por el paciente como", self: "Yo mismo", guardian: "Tutor", proxy: "Apoderado", allDone: "Todo listo. Gracias.", voice: "Leer en voz alta (voz simulada)", optional: "Opcional" },
};

export function FormsToSign({ patientId, lang = "en", channel = "portal", only, onSigned, patientName }: { patientId: string; lang?: "en" | "es"; channel?: "portal" | "in_person"; only?: FormKey[]; onSigned?: () => void; patientName?: string }) {
  const data = JSON.parse(useEhr(() => JSON.stringify(formsToSign(patientId)))) as ReturnType<typeof formsToSign>;
  const t = T[lang];
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState(patientName ?? "");
  const [typed, setTyped] = useState("");
  const [drawn, setDrawn] = useState(false);
  const [rel, setRel] = useState<"patient" | "guardian" | "proxy">("patient");
  const items = data.items.filter((i) => !only || only.includes(i.request.formKey));
  if (!items.length) return null;
  const done = items.filter((i) => i.request.status === "signed" || i.request.status === "declined").length;
  const pending = items.filter((i) => i.request.status === "sent" || i.request.status === "viewed");
  const checked = pending.filter((i) => i.request.checked);
  const needTyped = checked.some((i) => i.form.signatureMethod === "typed_name");
  const needDrawn = checked.some((i) => i.form.signatureMethod === "drawn");
  const sign = () => {
    try {
      signChecked({ patientId, signerName: name, relationship: rel, channel, language: lang, ...(needTyped ? { typedName: typed } : {}), ...(needDrawn && drawn ? { drawn: "drawn-signature (prototype)" } : {}) });
      toast.success(lang === "es" ? "Firmado" : "Signed");
      onSigned?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <section className="patient-theme space-y-3 rounded-3xl bg-card p-4 sm:p-5" data-testid="forms-to-sign">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-foreground">{t.title}</h2>
        <span className="text-sm font-medium text-muted-foreground" data-testid="forms-progress">{t.done(done, items.length)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{CONSENT_DRAFT_LABEL}</p>
      <ul className="space-y-3">
        {items.map(({ request: r, form: f }) => (
          <li key={r.id} className="rounded-2xl border p-4" data-testid={`form-card-${f.key}`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[17px] font-semibold leading-snug">{f.title[lang]}</h3>
              {!r.required && <span className="text-xs text-muted-foreground">{t.optional}</span>}
            </div>
            <p className="mt-1 text-[17px] leading-relaxed text-foreground/80">{f.summary[lang]}</p>
            {f.part2 && (
              <dl className="mt-2 space-y-1 rounded-xl bg-secondary/60 p-3 text-sm" data-testid="part2-card">
                <div><dt className="inline font-semibold">{t.who}: </dt><dd className="inline">{f.part2.recipient}</dd></div>
                <div><dt className="inline font-semibold">{t.what}: </dt><dd className="inline">{f.part2.what}</dd></div>
                <div><dt className="inline font-semibold">{t.why}: </dt><dd className="inline">{f.part2.why}</dd></div>
              </dl>
            )}
            <button type="button" className="mt-2 min-h-11 text-sm font-medium text-teal underline" onClick={() => { setOpen(open === r.id ? null : r.id); markViewed(patientId, f.key); }}>{t.read}</button>
            {open === r.id && <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{f.body[lang]}</p>}
            <div className="mt-2"><LessonReadAloud text={`${f.title[lang]}. ${f.summary[lang]}`} stepKey={`consent-${f.key}`} /></div>
            <p className="text-[11px] text-muted-foreground">{t.voice}</p>
            {r.status === "signed" ? (
              <p className="mt-2 font-medium text-teal">{t.signed}</p>
            ) : r.status === "declined" ? (
              <p className="mt-2 text-muted-foreground">{t.declined}</p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex min-h-11 items-center gap-2 text-[17px]">
                  <Checkbox checked={!!r.checked} aria-label={`${t.agree}: ${f.title[lang]}`} onCheckedChange={(v) => setChecked(patientId, f.key, v === true)} /> {t.agree}
                </label>
                <Button variant="ghost" className="min-h-11 rounded-full" onClick={() => declineForm(patientId, f.key, { channel })} aria-label={`${t.decline}: ${f.title[lang]}`}>{t.decline}</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {checked.length > 0 && (
        <div className="space-y-3 rounded-2xl border-2 border-teal/40 p-4" data-testid="forms-signature">
          {channel === "in_person" && (
            <label className="block text-sm">{t.relationship}
              <select className="mt-1 block min-h-11 w-full rounded-xl border bg-background px-3" value={rel} onChange={(e) => setRel(e.target.value as typeof rel)} aria-label={t.relationship}>
                <option value="patient">{t.self}</option><option value="guardian">{t.guardian}</option><option value="proxy">{t.proxy}</option>
              </select>
            </label>
          )}
          <Input aria-label={t.name} placeholder={t.name} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="min-h-11" />
          {needTyped && <Input aria-label={t.typed} placeholder={t.typed} value={typed} maxLength={100} onChange={(e) => setTyped(e.target.value)} className="min-h-11" />}
          {needDrawn && <button type="button" className="min-h-20 w-full rounded-xl border border-dashed text-sm" onClick={() => setDrawn(true)}>{drawn ? "✓" : t.draw}</button>}
          <Button className="min-h-11 w-full rounded-full" onClick={sign} data-testid="forms-sign">{t.sign}</Button>
        </div>
      )}
      {pending.length === 0 && <p className="text-sm text-teal">{t.allDone}</p>}
    </section>
  );
}
