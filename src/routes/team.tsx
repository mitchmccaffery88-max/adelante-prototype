import { createFileRoute } from "@tanstack/react-router";
import { WebsiteTeam } from "@/components/WebsiteContent";
import { websiteEn } from "@/lib/i18n.website";
import { websiteShareMeta } from "@/lib/websiteMetadata";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      ...websiteShareMeta,
      { title: "Our Team — Adelante Health" },
      { name: "description", content: websiteEn.websiteTeamIntro },
      { property: "og:title", content: "Our Team — Adelante Health" },
      { property: "og:description", content: websiteEn.websiteTeamIntro },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://adelmvp1.lovable.app/team" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Our Team — Adelante Health" },
      { name: "twitter:description", content: websiteEn.websiteTeamIntro },
    ],
    links: [{ rel: "canonical", href: "https://adelmvp1.lovable.app/team" }],
  }),
  component: WebsiteTeam,
});
