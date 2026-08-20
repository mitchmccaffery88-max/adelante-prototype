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
import { PoDisclosureCard } from "@/components/consent/PoDisclosureCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));

  if (!patient) {
    return (
      <PatientPage width="browse">
        <EmptyState
          title="We don't have a record for you yet"
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
        title="My profile & privacy"
        lede="Your details, what you've agreed to share, and who can see what."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">Back to My care</Link>
          </Button>
        }
      />
      <MyProfileCard patientId={patient.id} />
      <RecoveryDateCard patientId={patient.id} />
      <PrivacyConsentCard patientId={patient.id} />
      {/* Reused consent-ledger tooling: read-only per-person form record. */}
      <PatientConsentStatusCard patientId={patient.id} />
      {/* Justice-involved only — the gate lives inside the component. */}
      <PoDisclosureCard patientId={patient.id} />
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <FileText className="h-4 w-4" /> Your documents
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            ID, paperwork and anything you've sent your care team.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/documents">Open documents</Link>
        </Button>
      </Card>
      <SignOutCard />
    </PatientPage>
  );
}
