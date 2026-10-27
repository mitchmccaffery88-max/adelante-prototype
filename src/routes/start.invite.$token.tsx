import { createFileRoute } from "@tanstack/react-router";
import { InviteSignup } from "@/components/frontdoor/InviteSignup";

export const Route = createFileRoute("/start/invite/$token")({
  head: () => ({
    meta: [
      { title: "Your Adelante invite — Get started" },
      { name: "description", content: "Your Adelante care team is ready for you. Confirm it's you and set up sign-in." },
      { property: "og:title", content: "Your Adelante invite" },
      { property: "og:description", content: "Your Adelante care team is ready for you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  return <InviteSignup token={token} />;
}
