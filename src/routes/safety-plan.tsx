// §P2 — the full, editable Stanley-Brown safety plan gets its own route.
//
// Reasoning: this is safety-critical content that must be reachable in seconds
// from the crisis surfaces (/crisis, Get help now) and from a summary tile on
// My Care. As a bottom-of-page anchor on a long dashboard it was neither
// linkable nor findable under stress. A dedicated route gives it a stable URL,
// its own head metadata, and one destination every crisis path can point at.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { SafetyPlanPanel } from "@/components/clinical/SafetyPlanPanel";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CRISIS_LIFELINE_NAME, CRISIS_LIFELINE_NUMBER } from "@/lib/safetyPlan";

export const Route = createFileRoute("/safety-plan")({
  head: () => ({
    meta: [
      { title: "My safety plan — Adelante" },
      {
        name: "description",
        content:
          "Your warning signs, coping steps, people to call and reasons to stay — written by you, ready for the hardest hours.",
      },
      { property: "og:title", content: "My safety plan — Adelante" },
      {
        property: "og:description",
        content: "A personal safety plan you write and keep, reachable in seconds from crisis help.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SafetyPlanPage,
});

function SafetyPlanPage() {
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));

  if (!patient) {
    return (
      <PatientPage width="browse">
        <EmptyState
          title="We don't have a record for you yet"
          description="Once your care is set up, your safety plan lives here."
          action={{ label: "Get started", onClick: () => void navigate({ to: "/start" }) }}
        />
      </PatientPage>
    );
  }

  return (
    <PatientPage width="browse">
      <PatientPageHeader
        icon={LifeBuoy}
        title="My safety plan"
        lede="In your own words: what the warning signs look like, what helps, and who to call."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">Back to My care</Link>
          </Button>
        }
      />
      <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm">
        If you are in danger right now, call or text{" "}
        <a className="font-semibold underline" href={`tel:${CRISIS_LIFELINE_NUMBER}`}>
          {CRISIS_LIFELINE_NUMBER}
        </a>{" "}
        ({CRISIS_LIFELINE_NAME}), or{" "}
        <Link to="/crisis" className="font-semibold underline">
          open crisis help
        </Link>
        .
      </Card>
      <SafetyPlanPanel patientId={patient.id} author="patient" actorRole="patient" />
    </PatientPage>
  );
}
