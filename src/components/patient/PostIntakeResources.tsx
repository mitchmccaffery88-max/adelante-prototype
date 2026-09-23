// §Intake/SDOH Redesign Phase 4 — what the person sees right after intake.
//
// For every real, open, patient-visible `SdohPlanItem` the intake just
// confirmed or created, this screen shows REAL matching organisations from the
// one real directory (`patientBrowsableResources`), rendered with the same
// `ResourceCard` the /resources directory uses. No parallel lookup, no
// generated listings.
//
// NOTHING HERE CREATES A REFERRAL. Showing someone a place is not referring
// them to it; a `ResourceReferral` stays a staff act.
import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { HeartPulse, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { ResourceCard } from "@/components/reentry/ResourceCard";
import { AdelanteEHR, useEhr, SDOH_SOURCE_LABEL, type SdohPlanItem } from "@/lib/ehr";
import {
  RESOURCE_CATEGORIES,
  patientBrowsableResources,
  subscribeResources,
} from "@/lib/communityResources";
import { matchResourcesForNeed } from "@/lib/sdohResourceMatch";
import { NeedThreadList } from "@/components/patient/NeedThreadList";

const MAX_ORGS_PER_NEED = 3;

function categoryName(id: string): string {
  return RESOURCE_CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

function openVisibleNeeds(patientId: string): SdohPlanItem[] {
  const p = AdelanteEHR.getPatient(patientId);
  return (p?.sdohPlan?.items ?? []).filter(
    (i) =>
      i.visibleToPatient !== false && i.status !== "completed" && i.status !== "not_completed",
  );
}

export function PostIntakeResources() {
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const needsJson = useEhr(() => JSON.stringify(openVisibleNeeds(patientId)));
  const needs = JSON.parse(needsJson) as SdohPlanItem[];
  const dirJson = useSyncExternalStore(
    subscribeResources,
    () => JSON.stringify(patientBrowsableResources()),
    () => "[]",
  );
  const directory = JSON.parse(dirJson) as ReturnType<typeof patientBrowsableResources>;

  return (
    <PatientPage width="browse" data-testid="post-intake-resources">
      <PatientPageHeader
        icon={HeartPulse}
        eyebrow="Next steps"
        title="Help that matches what you told us"
        lede="These are local organisations from our community directory. Nothing has been sent on your behalf — looking at a place is not the same as being referred to it. Tell your care team if you want them to make the connection."
      />

      {/* §5d-4 — the unified thread: each need with what actually happened,
          plus closure messages. It sits ABOVE the directory browse block so
          the person sees their own situation before a generic list. */}
      <NeedThreadList patientId={patientId} />



      {needs.length === 0 ? (
        <Card className="p-5" data-testid="post-intake-empty">
          <div className="text-sm font-medium text-navy">
            You didn&apos;t flag any everyday needs
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            That&apos;s fine — nothing was marked, so there&apos;s nothing to match here. If
            something changes, tell your care team, or browse the full community directory
            whenever you like.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/resources">Browse all community resources</Link>
          </Button>
        </Card>
      ) : (
        needs.map((need) => {
          const match = matchResourcesForNeed(need);
          return (
            <Card key={need.id} className="p-5" data-testid={`need-block-${need.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-navy">{need.need}</div>
                <Badge variant="outline" className="text-[10px]">
                  {SDOH_SOURCE_LABEL[need.source]}
                </Badge>
              </div>

              {!match ? (
                <p className="mt-2 text-sm text-muted-foreground" data-testid="need-no-match">
                  We don&apos;t have a directory category that matches this one. Your care team
                  will follow up with you directly.
                </p>
              ) : !match.showOrgs ? (
                <div className="mt-2 space-y-2" data-testid="need-category-only">
                  <p className="text-sm text-muted-foreground">{match.reason}</p>
                  <div className="flex flex-wrap gap-2">
                    {match.categoryIds.map((cid) => (
                      <Button key={cid} asChild size="sm" variant="outline">
                        <Link to="/resources">
                          {categoryName(cid)}
                          <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {match.categoryIds.map((cid) => {
                    const orgs = directory
                      .filter((r) => r.categoryId === cid)
                      .slice(0, MAX_ORGS_PER_NEED);
                    if (orgs.length === 0) return null;
                    return (
                      <div key={cid} className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-wider text-teal">
                          {categoryName(cid)}
                        </div>
                        {orgs.map((r) => (
                          <ResourceCard key={r.id} resource={r} patientId={patientId} />
                        ))}
                      </div>
                    );
                  })}
                  <Button asChild size="sm" variant="outline">
                    <Link to="/resources">See everything in the directory</Link>
                  </Button>
                </div>
              )}
            </Card>
          );
        })
      )}
    </PatientPage>
  );
}
