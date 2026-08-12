import { createFileRoute } from "@tanstack/react-router";
import { SavedResources } from "@/components/reentry/SavedResources";

export const Route = createFileRoute("/resources/saved")({
  head: () => ({
    meta: [
      { title: "Saved resources — Adelante" },
      {
        name: "description",
        content: "The community resources you bookmarked, kept in one short list.",
      },
      { property: "og:title", content: "Saved resources — Adelante" },
      {
        property: "og:description",
        content: "Your bookmarked housing, food, work and meeting listings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavedResources,
});
