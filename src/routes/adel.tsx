import { createFileRoute } from "@tanstack/react-router";
import { AdelChat } from "@/components/patient/AdelChat";

export const Route = createFileRoute("/adel")({
  // §Build B — `?resource=<id>` opens Adel with a real directory listing as
  // context, the same shape the library route already uses for `?item=`.
  // `?ask=<text>` — sent from the Adel tile on My care; AdelChat sends it once
  // through its normal path (same crisis scanner, same guardrails).
  validateSearch: (search: Record<string, unknown>): { resource?: string; ask?: string } => ({
    ...(typeof search.resource === "string" && search.resource ? { resource: search.resource } : {}),
    ...(typeof search.ask === "string" && search.ask.trim() ? { ask: search.ask.slice(0, 500) } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Adel — Adelante" },
      {
        name: "description",
        content:
          "Adel, your Adelante guide. Ask questions in your own words and get pointed to the right lesson, tool or support.",
      },
      { property: "og:title", content: "Adel — Adelante" },
      { property: "og:description", content: "Your Adelante guide — ask anything, any hour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdelRoute,
});

function AdelRoute() {
  const { resource, ask } = Route.useSearch();
  return <AdelChat resourceId={resource} initialAsk={ask} />;
}
