// §Adelante Journey Phase 6 — Community Resource Center (patient-facing).
//
// Gap-closure Build 1: the directory now lists EVERY sourced organisation via
// `patientBrowsableResources`. Staff-verified entries come from the published
// snapshot; the rest render with a "Pending verification" badge instead of
// being hidden, because hiding real help served nobody. The staff verification
// workflow is unchanged — it now drives a label, not visibility.
import { useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bookmark, MapPinned, Search } from "lucide-react";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import {
  RESOURCE_CATEGORIES,
  matchesResourceQuery,
  patientBrowsableResources,
  subscribeResources,
} from "@/lib/communityResources";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { savedResourceIds, subscribeSelfTracking } from "@/lib/selfTracking";
import { ResourceCard } from "@/components/reentry/ResourceCard";

export function CommunityResourceCenter() {
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const savedCount = useSyncExternalStore(
    subscribeSelfTracking,
    () => String(savedResourceIds(patientId).length),
    () => "0",
  );
  const snapshot = useSyncExternalStore(
    subscribeResources,
    () => JSON.stringify(patientBrowsableResources(category ?? undefined)),
    () => "[]",
  );
  const inCategory = JSON.parse(snapshot) as ReturnType<typeof patientBrowsableResources>;
  // Search NARROWS the chosen category rather than replacing it — both filters
  // apply together, so a category stays selected while you type.
  const resources = inCategory.filter((r) => matchesResourceQuery(r, query));

  return (
    <PatientPage width="browse">
      <PatientPageHeader
        icon={MapPinned}
        title="Community resources"
        lede="Housing, food, work, meetings and more. Listings our team has called and confirmed show their details as confirmed; the rest are marked pending verification so you know to call ahead."
        action={
          <Button asChild variant="outline" size="patient" className="shrink-0">
            <Link to="/resources/saved" data-testid="saved-resources-link">
              <Bookmark className="mr-1 h-4 w-4" aria-hidden="true" /> Saved ({savedCount})
            </Link>
          </Button>
        }
      />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or what they do"
          aria-label="Search community resources"
          data-testid="resource-search"
          className="h-12 pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={category === null ? "default" : "outline"}
          onClick={() => setCategory(null)}
        >
          All
        </Button>
        {RESOURCE_CATEGORIES.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={category === c.id ? "default" : "outline"}
            onClick={() => setCategory(c.id)}
          >
            {c.name}
          </Button>
        ))}
      </div>

      {resources.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground" data-testid="resources-empty">
          {query.trim()
            ? "No listings match that search. Try a shorter word, or clear the category filter."
            : "Nothing is listed here yet — ask your care team and they can connect you directly today."}
        </Card>
      ) : (
        <ul className="space-y-3">
          {resources.map((r) => (
            <li key={r.id}>
              <ResourceCard resource={r} patientId={patientId} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground" data-testid="resources-disclaimer">
        Listings marked &ldquo;Pending verification&rdquo; are real organisations we have sourced but
        nobody on our team has called yet, so the address, phone or hours may be out of date — call
        ahead. Everything else has been confirmed by our team, though details can still change; if
        something is wrong when you get there, tell your care team and we&apos;ll re-check it.
      </p>
    </PatientPage>
  );
}