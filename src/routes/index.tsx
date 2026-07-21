import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adelante — Forward starts here." },
      {
        name: "description",
        content:
          "Adelante helps you feel better and build a steady life after coming home — with real people in your corner. Free with Medi-Cal.",
      },
      { property: "og:title", content: "Adelante — Forward starts here." },
      {
        property: "og:description",
        content:
          "Behavioral health and reentry support for your first 90 days back in the community.",
      },
    ],
  }),
  component: Landing,
});
