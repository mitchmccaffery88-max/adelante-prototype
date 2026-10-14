import { createFileRoute } from "@tanstack/react-router";
import { PatientHome } from "@/components/PatientHome";

export const Route = createFileRoute("/home")({
  // §Group sessions — `msg` prefills the existing care-team message composer
  // (see MessagesCard in PatientHome). No second composition flow.
  validateSearch: (search: Record<string, unknown>): { msg?: string } =>
    typeof search["msg"] === "string" ? { msg: search["msg"] as string } : {},
  head: () => ({
    meta: [
      { property: "og:title", content: "My care — Adelante" },
      { property: "og:description", content: "Your appointments, care plan and private daily check-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "My care — Adelante" },
      {
        name: "description",
        content: "Your 90-day care plan, sessions, and intake. HIPAA + 42 CFR Part 2 compliant.",
      },
    ],
  }),
  component: PatientHome,
});
