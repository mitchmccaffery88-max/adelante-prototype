// §Advocate Access Redesign Phase 2 (final) — Supporting → Coordination.
// Same four panels as before (SDOH needs, care plan participation, coverage
// eligibility, clinical/coming-home), now on one real destination instead of
// an anchor inside a long scroll.
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import {
  AdvocateCoordinationPanel,
  AdvocateCarePlanParticipationPanel,
  AdvocateEligibilityPanel,
  AdvocateClinicalPanel,
} from "@/components/advocate/AdvocateWorkspace";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader, AdvocateSupportGate } from "@/components/advocate/AdvocateViewParts";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.ffb26168922f": {
    "en": "Coordination",
    "es": "Coordinación"
  }
} as const;


export const Route = createFileRoute("/advocate/coordination")({
  head: () => ({ meta: [
    { title: "Coordination \u2014 Adelante advocate" },
    { name: "description", content: "Your coordination in the Adelante advocate portal." },
    { property: "og:title", content: "Coordination \u2014 Adelante advocate" },
    { property: "og:description", content: "Your coordination in the Adelante advocate portal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvocateCoordinationView,
});

function AdvocateCoordinationView() {
  const { lang: screenLang } = useI18n();

  const { linkId } = useAdvocateSession();
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={Users}
        title={SCREEN_COPY["ui.ffb26168922f"][screenLang]}
        lede="Practical needs, the care plan, coverage, and what's coming next."
      />
      <AdvocateSupportGate linkId={linkId}>
        <div className="space-y-4">
          <AdvocateCoordinationPanel linkId={linkId} />
          <AdvocateCarePlanParticipationPanel linkId={linkId} />
          <AdvocateEligibilityPanel linkId={linkId} />
          <AdvocateClinicalPanel linkId={linkId} />
        </div>
      </AdvocateSupportGate>
    </div>
  );
}
