import { createFileRoute } from "@tanstack/react-router";
import { ContentAdminWorkspace } from "@/components/admin/ContentAdminWorkspace";

export const Route = createFileRoute("/admin-content")({
  head: () => ({
    meta: [
      { title: "Patient content management — Adelante" },
      {
        name: "description",
        content:
          "Author, review and publish the Library and Recovery-module lessons patients see, with revision history and a second-reviewer approval step.",
      },
      { property: "og:title", content: "Patient content management — Adelante" },
      {
        property: "og:description",
        content: "Draft, review and publish patient-facing lesson content without a deployment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Access is enforced by the app-wide RouteAccessGuard via the nav registry
  // entry's `content_authoring` gate, the same as every other admin route.
  component: ContentAdminWorkspace,
});