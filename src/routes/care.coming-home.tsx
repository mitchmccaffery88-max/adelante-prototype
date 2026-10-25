import { createFileRoute } from "@tanstack/react-router";
import { JourneyPage } from "@/components/website/JourneyPage";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/care/coming-home")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.first90"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.journey.1.0"] },
  { property: "og:title", content: websiteEn["website.v2.first90"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.journey.1.0"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <JourneyPage id="coming-home" />,
});
