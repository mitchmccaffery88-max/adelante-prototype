import { createFileRoute } from "@tanstack/react-router";
import { CommunityResourceCenter } from "@/components/reentry/CommunityResourceCenter";

export const Route = createFileRoute("/resources")({
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
  component: CommunityResourceCenter,
});