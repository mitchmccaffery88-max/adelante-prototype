import { createFileRoute } from "@tanstack/react-router";
import { ContentAdminWorkspace } from "@/components/admin/ContentAdminWorkspace";
export const Route = createFileRoute("/content-library")({
  head: () => ({ meta: [{ title: "Staff content library — Adelante" }, { name: "description", content: "Browse and privately preview patient lessons, exercises, Journeys and resources." }, { property: "og:title", content: "Staff content library — Adelante" }, { property: "og:description", content: "Role-gated patient content reference library." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: () => <ContentAdminWorkspace browseOnly />,
});
