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
import {
  Bookmark,
  Bus,
  Baby,
  Briefcase,
  BedDouble,
  Coins,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  LayoutGrid,
  MapPinned,
  Salad,
  Scale,
  Search,
  Users,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

// Category tile iconography. Kept local and explicit rather than pulled from
// lucide's full map, so the patient bundle only carries these fourteen.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  housing: Home,
  emergency_shelter: BedDouble,
  food: Salad,
  employment: Briefcase,
  transportation: Bus,
  recovery_meetings: Users,
  support_groups: UsersRound,
  family_reunification: Heart,
  healthcare: HeartPulse,
  education: GraduationCap,
  parenting: Baby,
  financial: Coins,
  legal: Scale,
  life_skills: Wrench,
};

function placesLabel(n: number): string {
  return `${n} ${n === 1 ? "place" : "places"}`;
}

export function CommunityResourceCenter() {
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const savedCount = useSyncExternalStore(
    subscribeSelfTracking,
    () => String(savedResourceIds(patientId).length),
    () => "0",
  );
  const allSnapshot = useSyncExternalStore(
    subscribeResources,
    () => JSON.stringify(patientBrowsableResources()),
    () => "[]",
  );
  const all = JSON.parse(allSnapshot) as ReturnType<typeof patientBrowsableResources>;
  // Real, live per-category counts over exactly what the patient can browse
  // (published + pending-verification), not just the verified subset.
  const counts = new Map<string, number>();
  for (const r of all) counts.set(r.categoryId, (counts.get(r.categoryId) ?? 0) + 1);
  const inCategory = category ? all.filter((r) => r.categoryId === category) : all;
  // Search NARROWS the chosen category rather than replacing it — both filters
  // apply together, so a category stays selected while you type.
  const resources = inCategory.filter((r) => matchesResourceQuery(r, query));

  return (
    <PatientPage width="browse">
      <PatientPageHeader
        icon={MapPinned}
        eyebrow="Tulare County, CA · updated regularly by your care team"
        title="Resources near you"
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

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="resource-categories">
        <li>
          <CategoryTile
            icon={LayoutGrid}
            name="All resources"
            count={all.length}
            selected={category === null}
            onSelect={() => setCategory(null)}
            testId="category-tile-all"
          />
        </li>
        {RESOURCE_CATEGORIES.map((c) => (
          <li key={c.id}>
            <CategoryTile
              icon={CATEGORY_ICONS[c.id] ?? MapPinned}
              name={c.name}
              count={counts.get(c.id) ?? 0}
              selected={category === c.id}
              onSelect={() => setCategory(category === c.id ? null : c.id)}
              testId={`category-tile-${c.id}`}
            />
          </li>
        ))}
      </ul>

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

function CategoryTile({
  icon: Icon,
  name,
  count,
  selected,
  onSelect,
  testId,
}: {
  icon: LucideIcon;
  name: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      data-testid={testId}
      className={cn(
        "flex h-full w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
        selected ? "border-primary bg-secondary" : "hover:bg-secondary/60",
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{name}</span>
        <span className="block text-xs text-muted-foreground" data-testid={`${testId}-count`}>
          {placesLabel(count)}
        </span>
      </span>
    </button>
  );
}