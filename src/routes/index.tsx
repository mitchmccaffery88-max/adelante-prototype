import { createFileRoute } from "@tanstack/react-router";
import { PatientHome } from "@/components/PatientHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My care — Adelante" },
      {
        name: "description",
        content:
          "Your 90-day care plan, sessions, and intake. HIPAA + 42 CFR Part 2 compliant.",
      },
      { property: "og:title", content: "Adelante — Your care" },
      {
        property: "og:description",
        content: "Teletherapy, screeners, and reentry support that meets you where you are.",
      },
    ],
  }),
  component: PatientHome,
});
