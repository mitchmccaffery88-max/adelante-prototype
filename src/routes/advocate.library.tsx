// §Advocate Access Redesign Phase 2 (final) — Library is a REAL destination
// now, and honestly empty: the advocate-facing library content is authored
// separately (Phase 3+) and does not exist yet. Same "content pending"
// pattern used elsewhere in the app — no filler articles.
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdvocateViewHeader } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/library")({
  component: AdvocateLibraryView,
});

function AdvocateLibraryView() {
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={BookOpen}
        title="Library"
        lede="Reading and guidance written for people supporting someone in care."
      />
      <Card className="space-y-2 border-amber-300/60 bg-amber-50/60 p-5">
        <Badge variant="outline" className="border-amber-500 text-amber-800">
          Content pending authoring
        </Badge>
        <p className="text-sm text-amber-900">
          Nothing has been published here yet. The advocate library is being written by the
          clinical team, and this page will fill in as those pieces are approved — we'd rather show
          you nothing than placeholder text.
        </p>
      </Card>
    </div>
  );
}
