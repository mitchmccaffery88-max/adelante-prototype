import { createFileRoute } from "@tanstack/react-router";
import { ResourceDetail } from "@/components/reentry/ResourceDetail";

export const Route = createFileRoute("/resources/$categoryId/$orgId")({
  head: () => ({
    meta: [
      { title: "Resource details — Adelante" },
      {
        name: "description",
        content:
          "Address, hours, phone and website for a community organisation our team has confirmed.",
      },
      { property: "og:title", content: "Resource details — Adelante" },
      {
        property: "og:description",
        content: "Call, visit the website, get directions or save this organisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResourceDetailRoute,
});

function ResourceDetailRoute() {
  const { orgId } = Route.useParams();
  return <ResourceDetail orgId={orgId} />;
}
