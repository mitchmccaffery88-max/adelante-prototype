import { createFileRoute } from "@tanstack/react-router";
import { PatientHome } from "@/components/PatientHome";

export const Route = createFileRoute("/home")({
  // §Group sessions — `msg` prefills the existing care-team message composer
  // (see MessagesCard in PatientHome). No second composition flow.
  validateSearch: (search: Record<string, unknown>) => ({
    msg: typeof search["msg"] === "string" ? (search["msg"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "My care — Adelante" },
      {
        name: "description",
        content: "Your 90-day care plan, sessions, and intake. HIPAA + 42 CFR Part 2 compliant.",
      },
    ],
  }),
  component: PatientHome,
});
