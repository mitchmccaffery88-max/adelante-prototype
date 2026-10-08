import { createFileRoute } from "@tanstack/react-router";
import { ContentAdminWorkspace } from "@/components/admin/ContentAdminWorkspace";
import { useActingStaff } from "@/lib/roles";
import { canBrowseContent } from "@/lib/contentStaff";

// §F2 Route gate: clinical delivery, coordination and content authors only.
// The app-wide RouteAccessGuard redirects every other role (same registry
// gate as the menu); nothing on this page renders for them meanwhile.
function ContentLibraryPage() {
  const { role } = useActingStaff();
  if (!canBrowseContent(role)) return <p className="p-6 text-sm text-muted-foreground" data-testid="content-library-denied">Content library isn't available for your role.</p>;
  return <ContentAdminWorkspace browseOnly />;
}

export const Route = createFileRoute("/content-library")({
  head: () => ({ meta: [{ title: "Staff content library — Adelante" }, { name: "description", content: "Browse and privately preview patient lessons, exercises, Journeys and resources." }, { property: "og:title", content: "Staff content library — Adelante" }, { property: "og:description", content: "Role-gated patient content reference library." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ContentLibraryPage,
});
