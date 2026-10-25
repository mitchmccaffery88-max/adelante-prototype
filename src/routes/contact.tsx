import { createFileRoute } from "@tanstack/react-router";
import { WebsitePlaceholder } from "@/components/WebsitePlaceholder";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/contact")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.contact"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.care.promo.title"] },
  { property: "og:title", content: websiteEn["website.v2.contact"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.care.promo.title"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <WebsitePlaceholder title="website.v2.contact" intro="website.v2.care.promo.title" menu="website.v2.about" anchors={[]} />,
});
