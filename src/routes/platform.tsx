import { createFileRoute } from "@tanstack/react-router";
import { WebsitePlaceholder } from "@/components/WebsitePlaceholder";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/platform")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.platform.promo.title"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.platform.promo.body"] },
  { property: "og:title", content: websiteEn["website.v2.platform.promo.title"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.platform.promo.body"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <WebsitePlaceholder title="website.v2.platform.promo.title" intro="website.v2.platform.promo.body" menu="website.v2.partners" anchors={["portal", "record", "adel", "practice"]} />,
});
