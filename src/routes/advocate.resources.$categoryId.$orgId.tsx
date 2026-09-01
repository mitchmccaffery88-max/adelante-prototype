// §Advocate Access Redesign Phase 3 — the same real detail view patients see,
// rendered inside the advocate shell so browsing never kicks them out of it.
import { createFileRoute } from "@tanstack/react-router";
import { ResourceDetail } from "@/components/reentry/ResourceDetail";

export const Route = createFileRoute("/advocate/resources/$categoryId/$orgId")({
  component: AdvocateResourceDetailRoute,
});

function AdvocateResourceDetailRoute() {
  const { orgId } = Route.useParams();
  return <ResourceDetail orgId={orgId} surface="advocate" />;
}
