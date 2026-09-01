// §Advocate Access Redesign Phase 2 (final) — Resources is a REAL destination
// now, honestly stubbed: the advocate-side directory linking (which community
// organizations an advocate may be shown for the person they support, and
// under what authorization) is a later phase and is NOT built. No fake list.
import { createFileRoute } from "@tanstack/react-router";
import { Map } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader, useSupportingName } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/resources")({
  component: AdvocateResourcesView,
});

function AdvocateResourcesView() {
  const { linkId } = useAdvocateSession();
  const name = useSupportingName(linkId);
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={Map}
        title="Resources"
        lede={
          name
            ? `Community help near ${name} — housing, food, transport, recovery support.`
            : "Community help — housing, food, transport, recovery support."
        }
      />
      <Card className="space-y-2 border-amber-300/60 bg-amber-50/60 p-5">
        <Badge variant="outline" className="border-amber-500 text-amber-800">
          Not built yet
        </Badge>
        <p className="text-sm text-amber-900">
          The community directory exists in the app, but which organizations an advocate may be
          shown for the person they support — and under which authorization — hasn't been decided
          or built. Rather than show you a list that might not be appropriate to share, this page
          stays empty until that work lands.
        </p>
      </Card>
    </div>
  );
}
