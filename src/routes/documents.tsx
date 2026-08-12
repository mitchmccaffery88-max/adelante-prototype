// §P1 My Care de-clutter — Documents gets its own route.
//
// Placement call: this is not a profile field. It is a real lifecycle —
// upload, staff verification (`DocumentVerifyQueue`), a Part 2 flag, a
// rejection reason, and a gated download that audits every read. Burying that
// under Profile would hide the one surface a member is sent to when staff ask
// for paperwork, and it would be three taps deep on mobile. It stays one
// destination, cross-linked from Profile.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { PatientDocumentsCard } from "@/components/documents/PatientDocumentsCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Your documents — Adelante" },
      {
        name: "description",
        content:
          "Send your care team ID and paperwork, and see the status of everything you've uploaded.",
      },
      { property: "og:title", content: "Your documents — Adelante" },
      {
        property: "og:description",
        content: "Upload paperwork and track what your care team has reviewed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));

  if (!patient) {
    return (
      <PatientPage width="browse">
        <EmptyState
          title="We don't have a record for you yet"
          description="Once your care is set up, you can send paperwork here."
          action={{ label: "Get started", onClick: () => void navigate({ to: "/start" }) }}
        />
      </PatientPage>
    );
  }

  return (
    <PatientPage width="browse">
      <PatientPageHeader
        icon={FileText}
        title="Your documents"
        lede="Send your care team what they've asked for, and see what's been reviewed."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/profile">Back to profile</Link>
          </Button>
        }
      />
      <PatientDocumentsCard patientId={patient.id} />
    </PatientPage>
  );
}
