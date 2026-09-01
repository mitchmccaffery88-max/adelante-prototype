// §Advocate Access Redesign Phase 2 (final) — Supporting → Documents.
// The PATIENT's shared documents. Distinct owner from "My documents" (the
// advocate's own authorization paperwork), and the two are cross-linked so
// the distinction is visible rather than implied.
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, FileStack } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdvocateDocumentsPanel } from "@/components/advocate/AdvocateWorkspace";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import {
  AdvocateViewHeader,
  AdvocateSupportGate,
  useSupportingName,
} from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/documents")({
  component: AdvocateSharedDocumentsView,
});

function AdvocateSharedDocumentsView() {
  const { linkId } = useAdvocateSession();
  const name = useSupportingName(linkId);
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={FileText}
        title={name ? `${name}'s documents` : "Their documents"}
        lede="Paperwork belonging to the person you support. A care team member reviews everything before it enters the medical record."
      />
      <AdvocateSupportGate linkId={linkId}>
        <AdvocateDocumentsPanel linkId={linkId} />
      </AdvocateSupportGate>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <FileStack className="h-4 w-4" /> My documents
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your own authorization paperwork is kept separately.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/advocate/my-documents">Open my documents</Link>
        </Button>
      </Card>
    </div>
  );
}
