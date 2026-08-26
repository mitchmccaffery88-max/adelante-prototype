import { createFileRoute } from "@tanstack/react-router";
import { ToolkitPage } from "@/components/patient/ToolkitPage";

export const Route = createFileRoute("/toolkit")({
  // Same reason as /checkin and /patient: the acting patient is a
  // client-only session.
  ssr: false,
  head: () => ({
    meta: [
      { title: "My toolkit — Adelante" },
      {
        name: "description",
        content:
          "Everything you built inside your lessons — warning signs, your people, one action for today, and every saved takeaway — in one private place.",
      },
      { property: "og:title", content: "My toolkit — Adelante" },
      {
        property: "og:description",
        content: "Your warning signs, your people and your saved takeaways, gathered in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ToolkitPage,
});
