import { createFileRoute } from "@tanstack/react-router";
import { PostIntakeResources } from "@/components/patient/PostIntakeResources";

export const Route = createFileRoute("/next-steps")({
  head: () => ({
    meta: [
      { title: "Next steps — Adelante" },
      {
        name: "description",
        content:
          "Local organisations matched to the everyday needs you shared at intake — housing, food, work, transportation and more.",
      },
      { property: "og:title", content: "Next steps — Adelante" },
      {
        property: "og:description",
        content: "Community help matched to the needs you shared at intake.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostIntakeResources,
});
