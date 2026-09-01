// §Advocate Access Redesign Phase 2 (final) — the self-referral offer, moved
// off the dashboard into its own real destination. Unchanged component: this
// opens a record for the ADVOCATE, kept entirely separate from the record of
// the person they support.
import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { AdvocateSelfCareCard } from "@/components/advocate/AdvocateWorkspace";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/support-for-myself")({
  component: AdvocateSupportForMyself,
});

function AdvocateSupportForMyself() {
  const { linkId } = useAdvocateSession();
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={Heart}
        title="Support for myself"
        lede="Care of your own, with its own record and care team — nothing is shared with the person you support."
      />
      <AdvocateSelfCareCard linkId={linkId} />
    </div>
  );
}
