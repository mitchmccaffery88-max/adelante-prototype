// §P1 My Care de-clutter — Medication is a real route now, not a `/home` anchor.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pill } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { MedCheckInCard } from "@/components/clinical/MedCheckInCard";
import { MyMedicationsCard } from "@/components/patient/MyMedicationsCard";
import { RefillRunwayCard } from "@/components/patient/RefillRunwayCard";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.b4cee43de8d4": {
    "en": "We don't have a record for you yet",
    "es": "Aún no tenemos un registro tuyo"
  },
  "ui.cc158d0cc4b6": {
    "en": "My medication",
    "es": "Mi medicación"
  },
  "ui.f5b8ed165f42": {
    "en": "Back to My care",
    "es": "Volver a Mi cuidado"
  }
} as const;


export const Route = createFileRoute("/medications")({
  head: () => ({
    meta: [
      { title: "My medication — Adelante" },
      {
        name: "description",
        content:
          "Mark today's doses, see everything you're prescribed through Adelante, and request a refill from your care team.",
      },
      { property: "og:title", content: "My medication — Adelante" },
      {
        property: "og:description",
        content: "Today's dose tracker and your full medication list in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MedicationsPage,
});

function MedicationsPage() {
  const { lang: screenLang } = useI18n();

  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));

  if (!patient) {
    return (
      <PatientPage width="browse">
        <EmptyState
          title={SCREEN_COPY["ui.b4cee43de8d4"][screenLang]}
          description="Once your care is set up, your medication list lives here."
          action={{ label: "Get started", onClick: () => void navigate({ to: "/start" }) }}
        />
      </PatientPage>
    );
  }

  return (
    <PatientPage width="browse">
      <PatientPageHeader
        icon={Pill}
        title={SCREEN_COPY["ui.cc158d0cc4b6"][screenLang]}
        lede="Mark what you've taken today, and see everything your care team has prescribed."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">{SCREEN_COPY["ui.f5b8ed165f42"][screenLang]}</Link>
          </Button>
        }
      />
      <MedCheckInCard patientId={patient.id} />
      <RefillRunwayCard patientId={patient.id} />
      <MyMedicationsCard patientId={patient.id} />

    </PatientPage>
  );
}
