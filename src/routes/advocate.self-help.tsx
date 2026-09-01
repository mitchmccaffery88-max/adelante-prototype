// §Advocate Access Redesign Phase 2 (final) — Self-help progress, moved off
// the dashboard into its own real destination. Unchanged panel, unchanged gate.
import { createFileRoute } from "@tanstack/react-router";
import { HandHeart } from "lucide-react";
import { AdvocateSelfHelpPanel } from "@/components/advocate/AdvocateWorkspace";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader, AdvocateSupportGate } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/self-help")({
  component: AdvocateSelfHelpView,
});

function AdvocateSelfHelpView() {
  const { linkId } = useAdvocateSession();
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={HandHeart}
        title="Self-help progress"
        lede="What you've worked through in the advocate self-help material."
      />
      <AdvocateSupportGate linkId={linkId}>
        <AdvocateSelfHelpPanel linkId={linkId} />
      </AdvocateSupportGate>
    </div>
  );
}
