import { createFileRoute } from "@tanstack/react-router";
import { PeerChatPage } from "@/components/patient/PeerChatPage";

export const Route = createFileRoute("/peer")({
  // Same reason as /checkin and /patient: the acting patient is a client-only
  // session, so there is nothing meaningful to render on the server.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Talk with a peer specialist — Adelante" },
      {
        name: "description",
        content:
          "Message a certified peer specialist with lived recovery experience. Part of your one care-team conversation, not a separate channel.",
      },
      { property: "og:title", content: "Talk with a peer specialist — Adelante" },
      {
        property: "og:description",
        content: "Peer support you can write to any time — answered by someone who has been there.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeerChatPage,
});
