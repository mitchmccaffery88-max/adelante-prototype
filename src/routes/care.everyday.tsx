import { createFileRoute } from "@tanstack/react-router";
import { JourneyPage } from "@/components/website/JourneyPage";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/care/everyday")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.everyday"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.journey.0.0"] },
  { property: "og:title", content: websiteEn["website.v2.everyday"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.journey.0.0"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <JourneyPage id="everyday" />,
});
