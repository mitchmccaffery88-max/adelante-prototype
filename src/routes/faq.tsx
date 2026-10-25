import { createFileRoute } from "@tanstack/react-router";
import { WebsitePlaceholder } from "@/components/WebsitePlaceholder";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/faq")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.faq.full"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.faq.body"] },
  { property: "og:title", content: websiteEn["website.v2.faq.full"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.faq.body"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <WebsitePlaceholder title="website.v2.faq.full" intro="website.v2.faq.body" menu="website.v2.about" anchors={[]} />,
});
