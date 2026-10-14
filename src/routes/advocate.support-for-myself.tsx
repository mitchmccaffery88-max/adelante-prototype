// §Advocate Access Redesign Phase 2 (final) — the self-referral offer, moved
// off the dashboard into its own real destination. Unchanged component: this
// opens a record for the ADVOCATE, kept entirely separate from the record of
// the person they support.
import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { AdvocateSelfCareCard } from "@/components/advocate/AdvocateWorkspace";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader } from "@/components/advocate/AdvocateViewParts";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.ba055ea8d9ed": {
    "en": "Support for myself",
    "es": "Apoyo para mí"
  }
} as const;


export const Route = createFileRoute("/advocate/support-for-myself")({
  head: () => ({ meta: [
    { title: "Support for myself \u2014 Adelante advocate" },
    { name: "description", content: "Your support for myself in the Adelante advocate portal." },
    { property: "og:title", content: "Support for myself \u2014 Adelante advocate" },
    { property: "og:description", content: "Your support for myself in the Adelante advocate portal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvocateSupportForMyself,
});

function AdvocateSupportForMyself() {
  const { lang: screenLang } = useI18n();

  const { linkId } = useAdvocateSession();
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={Heart}
        title={SCREEN_COPY["ui.ba055ea8d9ed"][screenLang]}
        lede="Care of your own, with its own record and care team — nothing is shared with the person you support."
      />
      <AdvocateSelfCareCard linkId={linkId} />
    </div>
  );
}
