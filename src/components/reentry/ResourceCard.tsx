// §Tier 1 Build B — one card, used by the directory and the saved view, with
// the real bookmark toggle. Bookmarks store ids only; the listing itself
// always comes from the real Phase 6 directory, never a parallel copy.
import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, ChevronRight, Clock, Globe, MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CommunityResource } from "@/lib/communityResources";
import { isResourceSaved, toggleSavedResource } from "@/lib/selfTracking";

export function ResourceCard({
  resource: r,
  patientId,
}: {
  resource: CommunityResource;
  patientId: string;
}) {
  const saved = isResourceSaved(patientId, r.id);
  return (
    <Card className="space-y-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/resources/$categoryId/$orgId"
          params={{ categoryId: r.categoryId, orgId: r.id }}
          className="group flex items-start gap-1 text-sm font-medium text-foreground hover:underline"
          data-testid={`resource-link-${r.id}`}
        >
          {r.name}
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? `Remove ${r.name} from saved` : `Save ${r.name}`}
          data-testid={`bookmark-${r.id}`}
          onClick={() => toggleSavedResource(patientId, r.id)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border hover:bg-secondary"
        >
          {saved ? (
            <BookmarkCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          ) : (
            <Bookmark className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{r.description}</p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> {r.address}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Phone className="h-3.5 w-3.5" /> {r.phone}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> {r.hours}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button asChild size="sm" variant="outline">
          <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} data-testid={`call-${r.id}`}>
            <Phone className="mr-1 h-4 w-4" aria-hidden="true" /> Call
          </a>
        </Button>
        {r.website && (
          <Button asChild size="sm" variant="outline">
            <a
              href={r.website}
              target="_blank"
              rel="noreferrer noopener"
              data-testid={`website-${r.id}`}
            >
              <Globe className="mr-1 h-4 w-4" aria-hidden="true" /> Website
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}
