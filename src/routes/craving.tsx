import { createFileRoute } from "@tanstack/react-router";
import { CravingFlow } from "@/components/patient/CravingFlow";

export const Route = createFileRoute("/craving")({
  head: () => ({
    meta: [
      { title: "Riding out a craving — Adelante" },
      {
        name: "description",
        content:
          "A guided craving tool: rate it, ride the wave out with the urge-surfing timer, then see where it landed. Private to you.",
      },
      { property: "og:title", content: "Riding out a craving — Adelante" },
      {
        property: "og:description",
        content: "Cravings rise, peak and pass. Rate it, ride it out, log it — just for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CravingFlow,
});
