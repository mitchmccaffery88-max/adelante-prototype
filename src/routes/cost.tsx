import { createFileRoute } from "@tanstack/react-router";
import { WebsitePlaceholder } from "@/components/WebsitePlaceholder";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/cost")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.cost"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.cost.body"] },
  { property: "og:title", content: websiteEn["website.v2.cost"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.cost.body"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <WebsitePlaceholder title="website.v2.cost" intro="website.v2.cost.body" menu="website.v2.care" anchors={[]} />,
});
