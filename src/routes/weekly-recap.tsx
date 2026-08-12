import { createFileRoute } from "@tanstack/react-router";
import { WeeklyRecap } from "@/components/patient/WeeklyRecap";

export const Route = createFileRoute("/weekly-recap")({
  head: () => ({
    meta: [
      { title: "Your week — Adelante" },
      {
        name: "description",
        content:
          "Your weekly recap: check-in days, medication you marked, and what you've finished — with a short note from Adel.",
      },
      { property: "og:title", content: "Your week — Adelante" },
      {
        property: "og:description",
        content: "A warm, honest look back at your last seven days in Adelante.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WeeklyRecap,
});
