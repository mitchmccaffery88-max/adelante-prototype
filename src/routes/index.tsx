import { websiteEn } from "@/lib/i18n.website";
import { websiteShareMeta } from "@/lib/websiteMetadata";
import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      ...websiteShareMeta,
      { title: websiteEn.websiteTitle },
      { name: "description", content: websiteEn.websiteDescription },
      { property: "og:title", content: websiteEn.websiteTitle },
      { property: "og:description", content: websiteEn.websiteDescription },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://adelmvp1.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: websiteEn.websiteTitle },
      { name: "twitter:description", content: websiteEn.websiteDescription },
    ],
    links: [{ rel: "canonical", href: "https://adelmvp1.lovable.app/" }],
  }),
  component: Landing,
});
