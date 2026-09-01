// §Adelante Journey sync Build B — the org detail screen.
//
// DIRECTIONS ARE HONEST. Nobody has geocoded this directory, so
// `lat`/`lng` are empty on every entry and we refuse to invent a point. The
// button opens a maps SEARCH for the address string we actually confirmed,
// and it disappears entirely for countywide / confidential-location entries
// where there is no address to search.
import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Clock,
  Globe,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { EmptyState } from "@/components/EmptyState";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  RESOURCE_CATEGORIES,
  directionsUrl,
  isResourceVerified,
  patientBrowsableResource,
  subscribeResources,
} from "@/lib/communityResources";
import { isResourceSaved, subscribeSelfTracking, toggleSavedResource } from "@/lib/selfTracking";
import type { ResourceSurface } from "@/components/reentry/ResourceCard";

export function ResourceDetail({
  orgId,
  surface = "patient",
}: {
  orgId: string;
  surface?: ResourceSurface;
}) {
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const snapshot = useSyncExternalStore(
    subscribeResources,
    () => JSON.stringify(patientBrowsableResource(orgId) ?? null),
    () => "null",
  );
  const savedKey = useSyncExternalStore(
    subscribeSelfTracking,
    () => String(isResourceSaved(patientId, orgId)),
    () => "false",
  );
  const r = JSON.parse(snapshot) as ReturnType<typeof patientBrowsableResource>;
  const saved = savedKey === "true";

  if (!r) {
    return (
      <PatientPage width="reading" data-testid="resource-detail-missing">
        <EmptyState
          icon={MapPinFallback}
          title="This listing isn't available"
          description="It may have been taken down. Your care team can connect you directly."
        />
        <Button asChild variant="outline" size="patient">
          {surface === "advocate" ? (
            <Link to="/advocate/resources">Back to resources</Link>
          ) : (
            <Link to="/resources">Back to resources</Link>
          )}
        </Button>
      </PatientPage>
    );
  }

  const category = RESOURCE_CATEGORIES.find((c) => c.id === r.categoryId);
  const directions = directionsUrl(r);
  const tel = r.phone.replace(/[^\d+]/g, "");

  return (
    <PatientPage width="reading" data-testid="resource-detail">
      <PatientPageHeader icon={MapPin} title={r.name} lede={r.description} />

      {!isResourceVerified(r) && (
        <p
          className="rounded-2xl border border-amber-warm bg-amber-soft p-3 text-sm text-amber-warm-foreground"
          data-testid="resource-detail-unverified"
        >
          Pending verification — nobody on our team has called this listing yet, so the address,
          phone or hours may have changed. Call ahead before you go.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {category && <span className="rounded-full bg-secondary px-3 py-1">{category.name}</span>}
        {surface === "advocate" ? (
          <Link to="/advocate/resources" className="underline">
            All resources
          </Link>
        ) : (
          <Link to="/resources" className="underline">
            All resources
          </Link>
        )}
      </div>

      <Card className="space-y-3 p-5">
        <Fact icon={MapPin} label="Address" value={r.address} />
        <Fact icon={Phone} label="Phone" value={r.phone} />
        <Fact icon={Clock} label="Hours" value={r.hours} />
        {r.website && <Fact icon={Globe} label="Website" value={r.website} />}

        <div className="flex flex-wrap gap-2 pt-1">
          {tel && (
            <Button asChild size="patient" data-testid="detail-call">
              <a href={`tel:${tel}`}>
                <Phone className="mr-1 h-4 w-4" aria-hidden="true" /> Call
              </a>
            </Button>
          )}
          {r.website && (
            <Button asChild size="patient" variant="outline" data-testid="detail-website">
              <a href={r.website} target="_blank" rel="noreferrer noopener">
                <Globe className="mr-1 h-4 w-4" aria-hidden="true" /> Website
              </a>
            </Button>
          )}
          {directions && (
            <Button asChild size="patient" variant="outline" data-testid="detail-directions">
              <a href={directions} target="_blank" rel="noreferrer noopener">
                <Navigation className="mr-1 h-4 w-4" aria-hidden="true" /> Directions
              </a>
            </Button>
          )}
          <Button
            type="button"
            size="patient"
            variant="outline"
            aria-pressed={saved}
            data-testid="detail-save"
            onClick={() => toggleSavedResource(patientId, r.id)}
          >
            {saved ? (
              <>
                <BookmarkCheck className="mr-1 h-4 w-4" aria-hidden="true" /> Saved
              </>
            ) : (
              <>
                <Bookmark className="mr-1 h-4 w-4" aria-hidden="true" /> Save
              </>
            )}
          </Button>
        </div>
        {!directions && (
          <p className="text-xs text-muted-foreground">
            No street address to map — this one is reached by phone or online.
          </p>
        )}
      </Card>

      {surface === "patient" && (
        <Button asChild variant="outline" size="patient" data-testid="detail-ask-adel">
          <Link to="/adel" search={{ resource: r.id }}>
            <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" /> Ask Adel about {r.name}
          </Link>
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Someone on our team called this organisation and confirmed the address, phone and hours
        above. Details can still change after a call — and listings that are still waiting on that
        confirmation aren't shown here yet, so this isn't the whole list of help nearby. Ask your
        care team if you can't find what you need.
      </p>
    </PatientPage>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

const MapPinFallback = MapPin;
