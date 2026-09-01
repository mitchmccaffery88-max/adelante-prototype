// §Advocate Access Redesign Phase 2 (final) — Supporting → Messages.
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { AdvocateMessagesPanel } from "@/components/advocate/AdvocateMessagesPanel";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader, AdvocateSupportGate } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/messages")({
  component: AdvocateMessagesView,
});

function AdvocateMessagesView() {
  const { linkId } = useAdvocateSession();
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={MessageSquare}
        title="Messages"
        lede="The care-team thread, as far as your authorization allows."
      />
      <AdvocateSupportGate linkId={linkId}>
        <AdvocateMessagesPanel linkId={linkId} />
      </AdvocateSupportGate>
    </div>
  );
}
