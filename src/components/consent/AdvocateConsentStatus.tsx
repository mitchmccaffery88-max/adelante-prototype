// §F1 — the ONE advocate consent path. The old typed-name advocate card
// is retired; advocate consent is the versioned "advocate_patient" form signed
// in Forms to sign. This card only shows status and links there (patient) or
// to the chart Consents section (staff). It never writes.
import { Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { advocateConsentFormStatus, CONSENT_DRAFT_LABEL, type AdvocateFormStatus } from "@/lib/consentForms";
import { AdvocateStatusList } from "@/components/advocate/AdvocateStatusList";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export const ADVOCATE_CONSENT_STATUS_COPY = {
  en: {
    title: "Share with my helper (advocate)",
    status: { signed: "Advocate consent form: signed", waiting: "Advocate consent form: waiting for your signature", declined: "Advocate consent form: you said no", none: "Advocate consent form: not sent yet" } satisfies Record<AdvocateFormStatus, string>,
    review: "Review and sign",
    staffOpen: "Open chart consents",
  },
  es: {
    title: "Compartir con mi ayudante (defensor)",
    status: { signed: "Formulario de consentimiento del defensor: firmado", waiting: "Formulario de consentimiento del defensor: espera su firma", declined: "Formulario de consentimiento del defensor: usted dijo que no", none: "Formulario de consentimiento del defensor: aún no enviado" } satisfies Record<AdvocateFormStatus, string>,
    review: "Revisar y firmar",
    staffOpen: "Abrir consentimientos del expediente",
  },
} as const;

export function AdvocateConsentStatus({ patientId, audience = "patient" }: { patientId: string; audience?: "patient" | "staff" }) {
  const { lang } = useI18n();
  const t = ADVOCATE_CONSENT_STATUS_COPY[audience === "patient" && lang === "es" ? "es" : "en"];
  const status = useEhr(() => advocateConsentFormStatus(patientId));
  const anyLinks = useEhr(() => AdelanteEHR.listAdvocateLinks(patientId).length > 0);
  if (!anyLinks && status === "none") return null;
  return (
    <Card className="space-y-3 p-4" data-testid="advocate-consent-status">
      <h2 className="font-medium text-foreground">{t.title}</h2>
      <AdvocateStatusList patientId={patientId} />
      <p className="text-sm text-muted-foreground" data-testid="advocate-form-status" data-status={status}>
        {t.status[status]}
      </p>
      {audience === "patient" && status === "waiting" ? (
        <a href="#forms-to-sign" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline" data-testid="advocate-review-sign">
          {t.review}
        </a>
      ) : null}
      {audience === "staff" ? (
        <Link to="/record/$patientId" params={{ patientId }} search={{ section: "consents" } as never} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">
          {t.staffOpen}
        </Link>
      ) : null}
      <p className="text-[11px] text-muted-foreground">{CONSENT_DRAFT_LABEL}</p>
    </Card>
  );
}
