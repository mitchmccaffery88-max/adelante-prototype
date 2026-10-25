import { createFileRoute } from "@tanstack/react-router";
import { WebsitePlaceholder } from "@/components/WebsitePlaceholder";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/privacy")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.privacy"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.hipaa"] },
  { property: "og:title", content: websiteEn["website.v2.privacy"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.hipaa"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: () => <WebsitePlaceholder title="website.v2.privacy" intro="website.v2.hipaa" menu="website.v2.about" anchors={[]} />,
});
