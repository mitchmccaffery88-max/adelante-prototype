import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/website/InformationPages";
import { websiteEn } from "@/lib/i18n.website";
import { websiteShareMeta } from "@/lib/websiteMetadata";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      ...websiteShareMeta,
      { title: "About Us — Adelante Health" },
      { name: "description", content: websiteEn['website.diana.about.description'] },
      { property: "og:title", content: "About Us — Adelante Health" },
      { property: "og:description", content: websiteEn['website.diana.about.description'] },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://adelmvp1.lovable.app/about" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "About Us — Adelante Health" },
      { name: "twitter:description", content: websiteEn['website.diana.about.description'] },
    ],
    links: [{ rel: "canonical", href: "https://adelmvp1.lovable.app/about" }],
  }),
  component: AboutPage,
});
