import { createFileRoute } from "@tanstack/react-router";
import { RescreenForm } from "@/components/reassessment/RescreenForm";

export const Route = createFileRoute("/rescreen/$key")({
  head: () => ({
    meta: [
      { title: "Check-in — Adelante" },
      { name: "description", content: "A short check-in questionnaire your care team asked for." },
      { property: "og:title", content: "Check-in — Adelante" },
      { property: "og:description", content: "One short questionnaire, not the whole intake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RescreenRoute,
});

function RescreenRoute() {
  const { key } = Route.useParams();
  return <RescreenForm key={key} screenerKey={key} />;
}
