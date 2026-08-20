// §Tier 1 Build B — the saved/bookmarked view. Reads the real Phase 6
// directory and intersects it with the patient's private bookmark ids, so a
// listing that later loses its verification disappears from here too.
import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { patientBrowsableResources, subscribeResources } from "@/lib/communityResources";
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
    () => String(patientBrowsableResources().length),
    () => "0",
  );
  void liveKey;
  const ids = new Set(savedKey ? savedKey.split(",") : []);
  const resources = patientBrowsableResources().filter((r) => ids.has(r.id));

  return (
    <PatientPage width="browse" data-testid="saved-resources">
      <PatientPageHeader
        icon={Bookmark}
        title="Saved resources"
        lede="The listings you bookmarked. Only you see this list."
        action={
          <Button asChild variant="outline" size="patient" className="shrink-0">
            <Link to="/resources">All resources</Link>
          </Button>
        }
      />

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
    </PatientPage>
  );
}
