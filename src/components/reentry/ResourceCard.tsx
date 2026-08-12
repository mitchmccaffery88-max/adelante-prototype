// §Tier 1 Build B — one card, used by the directory and the saved view, with
// the real bookmark toggle. Bookmarks store ids only; the listing itself
// always comes from the real Phase 6 directory, never a parallel copy.
import { Bookmark, BookmarkCheck, Clock, MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
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
        <div className="text-sm font-medium text-foreground">{r.name}</div>
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
    </Card>
  );
}
