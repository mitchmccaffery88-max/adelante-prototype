import { createFileRoute } from "@tanstack/react-router";
import { WebsitePlaceholder } from "@/components/WebsitePlaceholder";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/partners")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.partner.title"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.partner.body"] },
  { property: "og:title", content: websiteEn["website.v2.partner.title"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.partner.body"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <WebsitePlaceholder title="website.v2.partner.title" intro="website.v2.partner.body" menu="website.v2.partners" anchors={[]} />,
});
