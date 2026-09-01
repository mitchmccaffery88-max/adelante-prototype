// §Advocate Access Redesign Phase 2 (final) — Supporting → Coordination.
// Same four panels as before (SDOH needs, care plan participation, coverage
// eligibility, clinical/coming-home), now on one real destination instead of
// an anchor inside a long scroll.
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import {
  AdvocateCoordinationPanel,
  AdvocateCarePlanParticipationPanel,
  AdvocateEligibilityPanel,
  AdvocateClinicalPanel,
} from "@/components/advocate/AdvocateWorkspace";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader, AdvocateSupportGate } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/coordination")({
  component: AdvocateCoordinationView,
});

function AdvocateCoordinationView() {
  const { linkId } = useAdvocateSession();
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={Users}
        title="Coordination"
        lede="Practical needs, the care plan, coverage, and what's coming next."
      />
      <AdvocateSupportGate linkId={linkId}>
        <div className="space-y-4">
          <AdvocateCoordinationPanel linkId={linkId} />
          <AdvocateCarePlanParticipationPanel linkId={linkId} />
          <AdvocateEligibilityPanel linkId={linkId} />
          <AdvocateClinicalPanel linkId={linkId} />
        </div>
      </AdvocateSupportGate>
    </div>
  );
}
