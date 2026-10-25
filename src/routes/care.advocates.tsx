import { createFileRoute } from "@tanstack/react-router";
import { JourneyPage } from "@/components/website/JourneyPage";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/care/advocates")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.advocates"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.advocates.body"] },
  { property: "og:title", content: websiteEn["website.v2.advocates"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.advocates.body"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <JourneyPage id="advocates" />,
});
