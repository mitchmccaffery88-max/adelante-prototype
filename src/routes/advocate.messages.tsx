// §Advocate Access Redesign Phase 2 (final) — Supporting → Messages.
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { AdvocateMessagesPanel } from "@/components/advocate/AdvocateMessagesPanel";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader, AdvocateSupportGate } from "@/components/advocate/AdvocateViewParts";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.f1702b468627": {
    "en": "Messages",
    "es": "Mensajes"
  }
} as const;


export const Route = createFileRoute("/advocate/messages")({
  head: () => ({ meta: [
    { title: "Messages \u2014 Adelante advocate" },
    { name: "description", content: "Your messages in the Adelante advocate portal." },
    { property: "og:title", content: "Messages \u2014 Adelante advocate" },
    { property: "og:description", content: "Your messages in the Adelante advocate portal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvocateMessagesView,
});

function AdvocateMessagesView() {
  const { lang: screenLang } = useI18n();

  const { linkId } = useAdvocateSession();
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={MessageSquare}
        title={SCREEN_COPY["ui.f1702b468627"][screenLang]}
        lede="The care-team thread, as far as your authorization allows."
      />
      <AdvocateSupportGate linkId={linkId}>
        <AdvocateMessagesPanel linkId={linkId} />
      </AdvocateSupportGate>
    </div>
  );
}
