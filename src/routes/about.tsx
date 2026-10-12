import { createFileRoute } from "@tanstack/react-router";
import { WebsiteAbout } from "@/components/WebsiteContent";
import { websiteEn } from "@/lib/i18n.website";
import { websiteShareMeta } from "@/lib/websiteMetadata";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      ...websiteShareMeta,
      { title: "About Us — Adelante Health" },
      { name: "description", content: websiteEn.websiteDescription },
      { property: "og:title", content: "About Us — Adelante Health" },
      { property: "og:description", content: websiteEn.websiteDescription },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://adelmvp1.lovable.app/about" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "About Us — Adelante Health" },
      { name: "twitter:description", content: websiteEn.websiteDescription },
    ],
    links: [{ rel: "canonical", href: "https://adelmvp1.lovable.app/about" }],
  }),
  component: WebsiteAbout,
});
