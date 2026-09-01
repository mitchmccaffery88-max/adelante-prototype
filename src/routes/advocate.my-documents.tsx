// §Advocate Access Redesign Phase 2 (final) — My documents.
//
// Consolidates the advocate's OWN authorization paperwork (HIPAA ROI, DHCS AR
// designation, AHCD document, conservatorship order — whichever the held
// instrument requires) into one destination, reusing the existing status panel
// rather than re-deriving requirement state here.
//
// The cross-link at the bottom is deliberate and one-directional in meaning:
// the patient's shared documents are a DIFFERENT owner's records, so they are
// named as such and reached by a link, never merged into this list.
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileStack, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdvocateDocumentStatusPanel } from "@/components/advocate/AdvocateDocumentChecklist";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader, useSupportingName } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/my-documents")({
  component: AdvocateMyDocuments,
});

function AdvocateMyDocuments() {
  const { linkId, attestedName } = useAdvocateSession();
  const supportingName = useSupportingName(linkId);

  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={FileStack}
        title="My documents"
        lede="The authorization paperwork that lets you act as an advocate — what's on file, what's still needed, and who it's waiting on."
      />

      <Card className="p-5">
        <AdvocateDocumentStatusPanel linkId={linkId} attestedName={attestedName} />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <FileText className="h-4 w-4" />{" "}
            {supportingName ? `${supportingName}'s documents` : "Their documents"}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Paperwork belonging to the person you support — separate from your own authorization
            documents above. You can send documents on their behalf there.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/advocate/documents">Open their documents</Link>
        </Button>
      </Card>
    </div>
  );
}
