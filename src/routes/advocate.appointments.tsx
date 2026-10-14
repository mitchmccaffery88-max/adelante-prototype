// §Advocate Access Redesign Phase 2 (final) — Supporting → Appointments.
import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { AdvocateAppointmentsPanel } from "@/components/advocate/AdvocateAppointmentsPanel";
import { AdvocatePoAwarenessPanel } from "@/components/advocate/AdvocatePoAwarenessPanel";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import {
  AdvocateViewHeader,
  AdvocateSupportGate,
  useSupportingName,
} from "@/components/advocate/AdvocateViewParts";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.1f3f4957c553": {
    "en": "Appointments",
    "es": "Citas"
  }
} as const;


export const Route = createFileRoute("/advocate/appointments")({
  head: () => ({ meta: [
    { title: "Appointments \u2014 Adelante advocate" },
    { name: "description", content: "Your appointments in the Adelante advocate portal." },
    { property: "og:title", content: "Appointments \u2014 Adelante advocate" },
    { property: "og:description", content: "Your appointments in the Adelante advocate portal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvocateAppointmentsView,
});

function AdvocateAppointmentsView() {
  const { lang: screenLang } = useI18n();

  const { linkId } = useAdvocateSession();
  const link = useEhr(() => AdelanteEHR.getAdvocateLink(linkId));
  const name = useSupportingName(linkId);
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={Calendar}
        title={SCREEN_COPY["ui.1f3f4957c553"][screenLang]}
        lede={name ? `${name}'s upcoming visits and groups.` : "Upcoming visits and groups."}
      />
      <AdvocateSupportGate linkId={linkId}>
        <AdvocateAppointmentsPanel linkId={linkId} />
        {link && <AdvocatePoAwarenessPanel linkId={linkId} patientId={link.patientId} />}
      </AdvocateSupportGate>
    </div>
  );
}
