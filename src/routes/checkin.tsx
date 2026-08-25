import { createFileRoute } from "@tanstack/react-router";
import { CheckInPage } from "@/components/patient/CheckInPage";

export const Route = createFileRoute("/checkin")({
  // Same reason as /patient: the acting patient is a client-only session.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Today's check-in — Adelante" },
      {
        name: "description",
        content:
          "The daily check-in: pick how today feels, add a reason if you want, and get one small next step. Private to you.",
      },
      { property: "og:title", content: "Today's check-in — Adelante" },
      {
        property: "og:description",
        content: "One minute, nine feelings, no scoring — and one small next step afterwards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckInPage,
});
