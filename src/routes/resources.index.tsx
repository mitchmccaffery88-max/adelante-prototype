import { createFileRoute } from "@tanstack/react-router";
import { CommunityResourceCenter } from "@/components/reentry/CommunityResourceCenter";

export const Route = createFileRoute("/resources/")({
  head: () => ({
    meta: [
      { title: "Community resources — Adelante" },
      {
        name: "description",
        content:
          "Housing, shelter, food, work, transportation, meetings and legal help — listings our team has called and confirmed.",
      },
      { property: "og:title", content: "Community resources — Adelante" },
      {
        property: "og:description",
        content: "Verified local help with housing, food, work, recovery meetings and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // §Pre-demo B3 — Adel's "find me a meeting" lands on ?category=recovery_meetings.
  validateSearch: (search: Record<string, unknown>): { category?: string } =>
    typeof search.category === "string" ? { category: search.category } : {},
  component: PatientDirectory,

});

function PatientDirectory() {
  const { category } = Route.useSearch();
  return <CommunityResourceCenter key={category ?? "all"} initialCategory={category} />;
}
