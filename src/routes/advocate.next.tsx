// §Advocate Access Redesign Phase 2 (final) — "What you need next" as a real
// destination. Pure outstanding items: the full paperwork ledger moved to
// My documents, so this page never duplicates it.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardSignature } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdvocateNextStepsPanel } from "@/components/advocate/AdvocateNextStepsPanel";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/next")({
  component: AdvocateNextView,
});

function AdvocateNextView() {
  const { linkId, attestedName } = useAdvocateSession();
  const state = useEhr(() => AdelanteEHR.advocateOutstandingRequirements(linkId));
  const nothingOutstanding = state.accessAllowed && state.items.length === 0;

  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={ClipboardSignature}
        title="What you need next"
        lede="Only things still waiting on you or the care team."
      />
      {nothingOutstanding ? (
        <Card className="space-y-3 p-5 text-sm">
          <p className="text-muted-foreground">
            Nothing is outstanding. Your access is active and no paperwork is waiting.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/advocate/my-documents">See all my documents</Link>
          </Button>
        </Card>
      ) : (
        <>
          <AdvocateNextStepsPanel linkId={linkId} attestedName={attestedName} />
          <Card className="p-4 text-sm text-muted-foreground">
            The full record of every authorization document — including the ones already
            verified — lives in{" "}
            <Link to="/advocate/my-documents" className="font-medium text-teal underline">
              My documents
            </Link>
            .
          </Card>
        </>
      )}
    </div>
  );
}
