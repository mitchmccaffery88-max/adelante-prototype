// §Advocate Access Redesign Phase 3 — the same real detail view patients see,
// rendered inside the advocate shell so browsing never kicks them out of it.
//
// §Pre-demo B3 — the patient self-search exception does NOT apply here:
// recovery / support-group organisations stay category-only for advocates,
// even by direct URL.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ResourceDetail } from "@/components/reentry/ResourceDetail";
import { patientBrowsableResource } from "@/lib/communityResources";
import { PART2_CAUTION_CATEGORY_IDS } from "@/lib/sdohResourceMatch";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/advocate/resources/$categoryId/$orgId")({
  component: AdvocateResourceDetailRoute,
});

function AdvocateResourceDetailRoute() {
  const { orgId, categoryId } = Route.useParams();
  const org = patientBrowsableResource(orgId);
  const cat = org?.categoryId ?? categoryId;
  if (PART2_CAUTION_CATEGORY_IDS.includes(cat)) {
    return (
      <Card className="m-6 p-6 text-sm text-muted-foreground" data-testid="resources-category-only">
        Recovery services can be confidential under federal Part 2 rules, so named groups aren&apos;t
        shown here.{" "}
        <Link to="/advocate/resources" className="underline">
          Back to resources
        </Link>
      </Card>
    );
  }
  return <ResourceDetail orgId={orgId} surface="advocate" />;
}
