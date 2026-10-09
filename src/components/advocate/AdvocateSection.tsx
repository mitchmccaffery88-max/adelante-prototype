// §Group 2 O1/O2 — "Your advocate (optional)": separate from emergency
// contacts, linked when made from one. Mobile-first, one decision per card.
import type { AdvocateDraft, AdvocateDraftError } from "@/lib/contactAdvocate";
import { ADVOCATE_TYPES, RELATIONSHIPS } from "@/lib/contactAdvocate";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export const ADVOCATE_SECTION_COPY = {
  en: {
    title: "Your advocate (optional)",
    explain: "An advocate is someone you choose to help with your care — they can talk with your team and help you keep track of things. This is different from an emergency contact, who we only call if something happens. Your advocate can't see anything until both of you sign.",
    add: "Add an advocate",
    remove: "Don't add an advocate",
    name: "Advocate's name",
    relationship: "Relationship",
    relOther: "Tell us the relationship",
    type: "Type of advocate",
    phone: "Phone",
    email: "Email",
    sendBy: "Send invite by",
    text: "Text",
    emailOpt: "Email",
    signNow: "Sign consent now",
    signLater: "Sign later",
    signName: "Type your full name",
    agree: "I agree to share with my advocate. This does not share substance-use records.",
    later: "The invitation waits until you sign. You'll see a reminder in My care.",
    choose: "Choose…",
    linked: "Made from your emergency contact",
    errors: {
      name: "Enter the advocate's name.",
      type: "Choose the type of advocate.",
      contact_missing: "Enter a phone or an email (at least one).",
      phone_invalid: "That phone number doesn't look right.",
      email_invalid: "That email doesn't look right.",
      send_by: "We need that phone or email to send the invite that way.",
      sign: "Type your name and tick the box to sign now, or choose Sign later.",
    } satisfies Record<AdvocateDraftError, string>,
  },
  es: {
    title: "Tu defensor (opcional)",
    explain: "Un defensor es alguien que tú eliges para ayudar con tu cuidado: puede hablar con tu equipo y ayudarte a llevar el control. Es diferente de un contacto de emergencia, a quien solo llamamos si algo pasa. Tu defensor no puede ver nada hasta que ambos firmen. (Borrador)",
    add: "Agregar un defensor",
    remove: "No agregar defensor",
    name: "Nombre del defensor",
    relationship: "Relación",
    relOther: "Dinos la relación",
    type: "Tipo de defensor",
    phone: "Teléfono",
    email: "Correo electrónico",
    sendBy: "Enviar invitación por",
    text: "Texto",
    emailOpt: "Correo",
    signNow: "Firmar consentimiento ahora",
    signLater: "Firmar después",
    signName: "Escribe tu nombre completo",
    agree: "Acepto compartir con mi defensor. Esto no comparte registros de uso de sustancias.",
    later: "La invitación espera hasta que firmes. Verás un recordatorio en Mi cuidado.",
    choose: "Elige…",
    linked: "Creado desde tu contacto de emergencia",
    errors: {
      name: "Escribe el nombre del defensor.",
      type: "Elige el tipo de defensor.",
      contact_missing: "Escribe un teléfono o un correo (al menos uno).",
      phone_invalid: "Ese teléfono no parece correcto.",
      email_invalid: "Ese correo no parece correcto.",
      send_by: "Necesitamos ese teléfono o correo para enviar la invitación así.",
      sign: "Escribe tu nombre y marca la casilla para firmar ahora, o elige Firmar después.",
    } satisfies Record<AdvocateDraftError, string>,
  },
} as const;

const sel = "min-h-11 w-full rounded-md border bg-background px-3 text-sm";

export function RelationshipSelect({ value, other, onChange, lang, label }: { value: string; other: string; onChange: (id: string, other: string) => void; lang: "en" | "es"; label: string }) {
  const t = ADVOCATE_SECTION_COPY[lang];
  return (
    <div className="space-y-2">
      <select aria-label={label} className={sel} value={value} onChange={(e) => onChange(e.target.value, e.target.value === "other" ? other : "")}>
        <option value="">{t.relationship} — {t.choose}</option>
        {RELATIONSHIPS.map((r) => (
          <option key={r.id} value={r.id}>{r[lang]}</option>
        ))}
      </select>
      {value === "other" && (
        <Input aria-label={`${t.relOther} — ${label}`} placeholder={t.relOther} maxLength={60} value={other} onChange={(e) => onChange("other", e.target.value)} />
      )}
    </div>
  );
}

export function AdvocateSection({ draft, onChange, on, onToggle, errors, lang }: { draft: AdvocateDraft; onChange: (d: AdvocateDraft) => void; on: boolean; onToggle: (on: boolean) => void; errors: AdvocateDraftError[]; lang: "en" | "es" }) {
  const t = ADVOCATE_SECTION_COPY[lang];
  const set = (p: Partial<AdvocateDraft>) => onChange({ ...draft, ...p });
  return (
    <section className="space-y-3 rounded-lg border bg-secondary/40 p-4" data-testid="advocate-section" aria-labelledby="advocate-section-title">
      <div>
        <h3 id="advocate-section-title" className="text-sm font-medium text-navy">{t.title}</h3>
        <p className="text-xs text-muted-foreground">{t.explain}</p>
      </div>
      {!on ? (
        <Button type="button" variant="outline" className="min-h-11" data-testid="advocate-add" onClick={() => onToggle(true)}>{t.add}</Button>
      ) : (
        <div className="space-y-3">
          {draft.contactId && <p className="text-xs text-teal" data-testid="advocate-linked">{t.linked}</p>}
          <div className="rounded-md border bg-card p-3 space-y-2">
            <Input aria-label={t.name} placeholder={t.name} value={draft.name} maxLength={100} data-testid="advocate-name" onChange={(e) => set({ name: e.target.value })} />
            <RelationshipSelect lang={lang} label={t.relationship} value={draft.relationshipId} other={draft.relationshipOther} onChange={(id, other) => set({ relationshipId: id, relationshipOther: other })} />
          </div>
          <div className="rounded-md border bg-card p-3">
            <select aria-label={t.type} className={sel} value={draft.typeId} data-testid="advocate-type" onChange={(e) => set({ typeId: e.target.value })}>
              <option value="">{t.type} — {t.choose}</option>
              {ADVOCATE_TYPES.map((x) => (
                <option key={x.id} value={x.id}>{x[lang]}</option>
              ))}
            </select>
          </div>
          <div className="rounded-md border bg-card p-3 space-y-2">
            <Input type="tel" aria-label={t.phone} placeholder={t.phone} value={draft.phone} maxLength={20} data-testid="advocate-phone" onChange={(e) => set({ phone: e.target.value })} />
            <Input type="email" aria-label={t.email} placeholder={t.email} value={draft.email} maxLength={255} data-testid="advocate-email" onChange={(e) => set({ email: e.target.value })} />
            <fieldset className="flex flex-wrap items-center gap-3 text-sm">
              <legend className="sr-only">{t.sendBy}</legend>
              <span className="text-muted-foreground">{t.sendBy}:</span>
              {(["sms", "email"] as const).map((c) => (
                <label key={c} className="inline-flex min-h-11 items-center gap-2">
                  <input type="radio" name="advocate-send-by" checked={draft.sendBy === c} onChange={() => set({ sendBy: c })} /> {c === "sms" ? t.text : t.emailOpt}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="rounded-md border bg-card p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11" variant={draft.consent === "now" ? "default" : "outline"} data-testid="advocate-sign-now" onClick={() => set({ consent: "now" })}>{t.signNow}</Button>
              <Button type="button" className="min-h-11" variant={draft.consent === "later" ? "default" : "outline"} data-testid="advocate-sign-later" onClick={() => set({ consent: "later" })}>{t.signLater}</Button>
            </div>
            {draft.consent === "now" ? (
              <>
                <Input aria-label={t.signName} placeholder={t.signName} maxLength={100} value={draft.signName} data-testid="advocate-sign-name" onChange={(e) => set({ signName: e.target.value })} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox checked={draft.signAgree} data-testid="advocate-sign-agree" onCheckedChange={(v) => set({ signAgree: v === true })} /> {t.agree}
                </label>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t.later}</p>
            )}
          </div>
          {errors.length > 0 && (
            <ul role="alert" className="space-y-1 text-xs text-destructive" data-testid="advocate-errors">
              {errors.map((e) => <li key={e}>{t.errors[e]}</li>)}
            </ul>
          )}
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => onToggle(false)}>{t.remove}</Button>
        </div>
      )}
    </section>
  );
}
