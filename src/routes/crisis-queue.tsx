// §U1 — the crisis queue now lives inside the unified Escalations view.
// Old links (nav entries, notifications, bookmarks) keep working: this route
// redirects to /escalations with the matching crisis filter.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/crisis-queue")({
  validateSearch: (s: Record<string, unknown>) => ({
    scope: s["scope"] === "mine" ? ("mine" as const) : undefined,
    lane: s["lane"] === "sdoh" ? ("sdoh" as const) : s["lane"] === "clinical" ? ("clinical" as const) : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/escalations",
      search: {
        type: search.lane === "sdoh" ? "urgent_social_need" : "crisis",
        view: search.scope === "mine" ? "mine" : undefined,
        owner: undefined,
        overdue: undefined,
      },
      replace: true,
    });
  },
  head: () => ({
    meta: [
      { title: "Crisis queue — Adelante" },
      { name: "description", content: "Crisis escalations now live in the unified Escalations queue." },
      { property: "og:title", content: "Crisis queue — Adelante" },
      { property: "og:description", content: "Crisis escalations now live in the unified Escalations queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
