import { createFileRoute } from "@tanstack/react-router";
import { PatientHome } from "@/components/PatientHome";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "My care — Adelante" },
      {
        name: "description",
        content:
          "Your 90-day care plan, sessions, and intake. HIPAA + 42 CFR Part 2 compliant.",
      },
    ],
  }),
  component: PatientHome,
});