import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/components/website/InformationPages";
import { websiteEn } from "@/lib/i18n.website";
export const Route = createFileRoute("/how-it-works")({
 head: () => ({ meta: [
  { title: websiteEn["website.v2.how"] + " — Adelante Health" },
  { name: "description", content: websiteEn["website.v2.how.body"] },
  { property: "og:title", content: websiteEn["website.v2.how"] + " — Adelante Health" },
  { property: "og:description", content: websiteEn["website.v2.how.body"] },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
 ] }),
 component: HowItWorksPage,
});
