// Patient-side advocate sharing consent. Advocate invitations are held until
// `roi_collateral` is authorized; this is where the patient signs it. The new
// record copies every section of the one in force, so nothing else changes.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { advocateInvitationConsentActive } from "@/lib/advocateInviteDelivery";
import { signAdvocateConsent } from "@/lib/advocateConsentSign";
import { AdvocateStatusList } from "@/components/advocate/AdvocateStatusList";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";

/** §Group 2 S4/O4 — EN/ES (ES Draft). */
export const ADVOCATE_CONSENT_COPY = {
  en: { title: "Share with my helper (advocate)", signed: "Signed. Your helper can get their invitation.", intro: (n: number) => `You named ${n} helper${n === 1 ? "" : "s"}. Sign here so we can send the invitation. This does not share substance-use records.`, name: "Type your full name", agree: "I agree to share with my helper.", sign: "Sign consent", done: "Consent signed. Your helper's invitation is on its way.", fail: "Could not sign that." },
  es: { title: "Compartir con mi ayudante (defensor)", signed: "Firmado. Tu ayudante puede recibir su invitación.", intro: (n: number) => `Nombraste ${n} ayudante${n === 1 ? "" : "s"}. Firma aquí para enviar la invitación. Esto no comparte registros de uso de sustancias. (Borrador)`, name: "Escribe tu nombre completo", agree: "Acepto compartir con mi ayudante.", sign: "Firmar consentimiento", done: "Consentimiento firmado. La invitación va en camino.", fail: "No se pudo firmar." },
} as const;

export function AdvocateConsentCard({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const t = ADVOCATE_CONSENT_COPY[lang === "es" ? "es" : "en"];
  const pending = useEhr(() =>
    AdelanteEHR.listAdvocateLinks(patientId).filter((l) => l.status === "invited" && !l.notificationSentAt).length,
  );
  const active = useEhr(() => advocateInvitationConsentActive(patientId));
  const [name, setName] = useState("");
  const [ok, setOk] = useState(false);
  const anyLinks = useEhr(() => AdelanteEHR.listAdvocateLinks(patientId).length > 0);
  if (pending === 0 && !active && !anyLinks) return null;
  const sign = () => {
    try {
      signAdvocateConsent(patientId, name, ok);
      toast.success(t.done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.fail);
    }
  };
  return (
    <Card className="p-4 space-y-3" data-testid="advocate-consent-card">
      <h2 className="font-medium text-navy">{t.title}</h2>
      <AdvocateStatusList patientId={patientId} />
      {active || pending === 0 ? (
        <p className="text-sm text-muted-foreground">{t.signed}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t.intro(pending)}
          </p>
          <Input placeholder={t.name} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={ok} onCheckedChange={(v) => setOk(v === true)} /> {t.agree}
          </label>
          <Button onClick={sign} disabled={!ok || name.trim().length < 2} data-testid="advocate-consent-sign">
            {t.sign}
          </Button>
        </>
      )}
    </Card>
  );
}
