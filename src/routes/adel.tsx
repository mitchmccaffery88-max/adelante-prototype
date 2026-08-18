import { createFileRoute } from "@tanstack/react-router";
import { AdelChat } from "@/components/patient/AdelChat";

export const Route = createFileRoute("/adel")({
  // §Build B — `?resource=<id>` opens Adel with a real directory listing as
  // context, the same shape the library route already uses for `?item=`.
  validateSearch: (search: Record<string, unknown>): { resource?: string } =>
    typeof search.resource === "string" && search.resource
      ? { resource: search.resource }
      : {},
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
  const { resource } = Route.useSearch();
  return <AdelChat resourceId={resource} />;
}
