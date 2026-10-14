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
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.1ee7c90411d8": {
    "en": "Saved resources",
    "es": "Recursos guardados"
  },
  "ui.be79cc83f91c": {
    "en": "All resources",
    "es": "Todos los recursos"
  },
  "ui.b54a5380d13e": {
    "en": "Nothing saved yet",
    "es": "Aún no hay nada guardado"
  }
} as const;


export function SavedResources() {
  const { lang: screenLang } = useI18n();

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
        title={SCREEN_COPY["ui.1ee7c90411d8"][screenLang]}
        lede="The listings you bookmarked. Only you see this list."
        action={
          <Button asChild variant="outline" size="patient" className="shrink-0">
            <Link to="/resources">{SCREEN_COPY["ui.be79cc83f91c"][screenLang]}</Link>
          </Button>
        }
      />

      {resources.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={SCREEN_COPY["ui.b54a5380d13e"][screenLang]}
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
