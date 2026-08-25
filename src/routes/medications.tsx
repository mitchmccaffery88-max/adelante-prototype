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
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));

  if (!patient) {
    return (
      <PatientPage width="browse">
        <EmptyState
          title="We don't have a record for you yet"
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
        title="My medication"
        lede="Mark what you've taken today, and see everything your care team has prescribed."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">Back to My care</Link>
          </Button>
        }
      />
      <MedCheckInCard patientId={patient.id} />
      <RefillRunwayCard patientId={patient.id} />
      <MyMedicationsCard patientId={patient.id} />

    </PatientPage>
  );
}
