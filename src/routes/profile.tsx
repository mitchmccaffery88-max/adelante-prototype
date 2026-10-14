// §P1 My Care de-clutter — Profile is a real route, and it is now the single
// home for identity + privacy: profile details, the consent toggles, the
// read-only consent-form ledger (reused, not rebuilt), and — for
// justice-involved members only — what probation/parole can see.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserCog, FileText } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { MyProfileCard, PrivacyConsentCard, SignOutCard } from "@/components/patient/ProfilePanels";
import { RecoveryDateCard } from "@/components/patient/RecoveryDateCard";
import { PatientConsentStatusCard } from "@/components/consent/PatientConsentStatusCard";
import { AiConsentCard } from "@/components/scribe/AiConsentCard";
import { PoDisclosureCard } from "@/components/consent/PoDisclosureCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.b4cee43de8d4": {
    "en": "We don't have a record for you yet",
    "es": "Aún no tenemos un registro tuyo"
  },
  "ui.22c9de289155": {
    "en": "My profile & privacy",
    "es": "Mi perfil y privacidad"
  },
  "ui.f5b8ed165f42": {
    "en": "Back to My care",
    "es": "Volver a Mi cuidado"
  },
  "ui.8485be9e7b3e": {
    "en": "Your documents",
    "es": "Tus documentos"
  },
  "ui.bdf67342b4bc": {
    "en": "ID, paperwork and anything you've sent your care team.",
    "es": "Identificación, documentos y cualquier cosa que hayas enviado a tu equipo."
  },
  "ui.4fab3f051369": {
    "en": "Open documents",
    "es": "Abrir documentos"
  }
} as const;


export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile & privacy — Adelante" },
      {
        name: "description",
        content:
          "Your details, your privacy choices, the consent forms on file, and exactly what probation or parole can see.",
      },
      { property: "og:title", content: "My profile & privacy — Adelante" },
      {
        property: "og:description",
        content: "Profile details and every privacy and consent choice in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { lang: screenLang } = useI18n();

  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));

  if (!patient) {
    return (
      <PatientPage width="browse">
        <EmptyState
          title={SCREEN_COPY["ui.b4cee43de8d4"][screenLang]}
          description="Once your care is set up, your profile and privacy choices live here."
          action={{ label: "Get started", onClick: () => void navigate({ to: "/start" }) }}
        />
      </PatientPage>
    );
  }

  return (
    <PatientPage width="browse">
      <PatientPageHeader
        icon={UserCog}
        title={SCREEN_COPY["ui.22c9de289155"][screenLang]}
        lede="Your details, what you've agreed to share, and who can see what."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">{SCREEN_COPY["ui.f5b8ed165f42"][screenLang]}</Link>
          </Button>
        }
      />
      <MyProfileCard patientId={patient.id} />
      <RecoveryDateCard patientId={patient.id} />
      <PrivacyConsentCard patientId={patient.id} />
      {/* Reused consent-ledger tooling: read-only per-person form record. */}
      <PatientConsentStatusCard patientId={patient.id} />
      <AiConsentCard patient={patient} mode="patient" />
      {/* Justice-involved only — the gate lives inside the component. */}
      <PoDisclosureCard patientId={patient.id} />
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <FileText className="h-4 w-4" /> {SCREEN_COPY["ui.8485be9e7b3e"][screenLang]} </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {SCREEN_COPY["ui.bdf67342b4bc"][screenLang]} </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/documents">{SCREEN_COPY["ui.4fab3f051369"][screenLang]}</Link>
        </Button>
      </Card>
      <SignOutCard />
    </PatientPage>
  );
}
