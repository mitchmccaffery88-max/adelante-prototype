import { createFileRoute } from "@tanstack/react-router";
import { ContentAdminWorkspace } from "@/components/admin/ContentAdminWorkspace";

export const Route = createFileRoute("/admin-content")({
  head: () => ({
    meta: [
      { title: "Patient Content & Resources Center — Adelante" },
      {
        name: "description",
        content:
          "Manage what patients see: education, recovery content, community resources and naloxone sites. Verify resources with the provider before they go live.",
      },
      { property: "og:title", content: "Patient Content & Resources Center — Adelante" },
      {
        property: "og:description",
        content: "Manage what patients see: education, recovery content, community resources and naloxone sites. Verify resources with the provider before they go live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Access is enforced by the app-wide RouteAccessGuard via the nav registry
  // entry's `content_authoring` gate, the same as every other admin route.
  component: ContentAdminWorkspace,
});