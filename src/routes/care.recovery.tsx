import { createFileRoute } from "@tanstack/react-router";
import { JourneyPage } from "@/components/website/JourneyPage";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/care/recovery")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.recovery"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.recovery.body"] },
  { property: "og:title", content: websiteEn["website.v2.recovery"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.recovery.body"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <JourneyPage id="recovery" />,
});
