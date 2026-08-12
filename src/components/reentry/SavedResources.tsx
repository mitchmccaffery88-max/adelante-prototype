// §Tier 1 Build B — the saved/bookmarked view. Reads the real Phase 6
// directory and intersects it with the patient's private bookmark ids, so a
// listing that later loses its verification disappears from here too.
import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { patientVisibleResources, subscribeResources } from "@/lib/communityResources";
import { savedResourceIds, subscribeSelfTracking } from "@/lib/selfTracking";
import { ResourceCard } from "@/components/reentry/ResourceCard";

export function SavedResources() {
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const savedKey = useSyncExternalStore(
    subscribeSelfTracking,
    () => savedResourceIds(patientId).join(","),
    () => "",
  );
  const liveKey = useSyncExternalStore(
    subscribeResources,
    () => String(patientVisibleResources().length),
    () => "0",
  );
  void liveKey;
  const ids = new Set(savedKey ? savedKey.split(",") : []);
  const resources = patientVisibleResources().filter((r) => ids.has(r.id));

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6" data-testid="saved-resources">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Saved resources</h1>
          <p className="text-sm text-muted-foreground">
            The listings you bookmarked. Only you see this list.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11 shrink-0 rounded-2xl">
          <Link to="/resources">All resources</Link>
        </Button>
      </header>

      {resources.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Tap the bookmark on any resource and it'll be waiting here."
          className="mt-2"
        />
      ) : (
        <ul className="space-y-3" data-testid="saved-resources-list">
          {resources.map((r) => (
            <li key={r.id}>
              <ResourceCard resource={r} patientId={patientId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
