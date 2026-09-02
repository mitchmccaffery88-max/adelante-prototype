// §Advocate Access Redesign Phase 5 — the advocate Library reads the SAME live
// content overlay the patient Library uses (`contentCatalog.ts` →
// `contentPublishing.ts`), filtered to categories whose audience is
// "advocate". There is no parallel content system and no advocate-tier gate:
// the bucket is universal to anyone in an advocate role.
//
// Until the clinical content manager publishes lessons into it, this shows a
// real "content pending" state — no placeholder articles.
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdvocateViewHeader } from "@/components/advocate/AdvocateViewParts";
import {
  liveAdvocateLibraryCategories,
  liveAdvocateLibraryItems,
  usePublishedContentVersion,
} from "@/lib/contentCatalog";
import { resolveContentIcon } from "@/lib/contentIcons";

export const Route = createFileRoute("/advocate/library")({
  component: AdvocateLibraryView,
});

function AdvocateLibraryView() {
  // Re-render when something is actually published into the bucket.
  usePublishedContentVersion();
  const categories = liveAdvocateLibraryCategories();

  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={BookOpen}
        title="Library"
        lede="Reading and guidance written for people supporting someone in care."
      />

      {categories.length === 0 ? (
        <PendingCard />
      ) : (
        categories.map((cat) => {
          const items = liveAdvocateLibraryItems(cat.id);
          const Icon = resolveContentIcon(cat.icon);
          return (
            <Card key={cat.id} className="space-y-3 p-5" data-testid={`advocate-library-${cat.id}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-teal">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <h2 className="font-display text-lg text-navy">{cat.name}</h2>
                  <p className="text-sm text-muted-foreground">{cat.desc}</p>
                </div>
              </div>
              {items.length === 0 ? (
                <PendingCard compact />
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-border bg-card p-4 text-sm font-medium text-navy"
                    >
                      {item.title}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

function PendingCard({ compact }: { compact?: boolean }) {
  return (
    <Card
      data-testid="advocate-library-pending"
      className={`space-y-2 border-amber-300/60 bg-amber-50/60 ${compact ? "p-4" : "p-5"}`}
    >
      <Badge variant="outline" className="border-amber-500 text-amber-800">
        Content pending authoring
      </Badge>
      <p className="text-sm text-amber-900">
        Nothing has been published here yet. The advocate library is being written by the clinical
        team, and this page will fill in as those pieces are approved — we'd rather show you nothing
        than placeholder text.
      </p>
    </Card>
  );
}
