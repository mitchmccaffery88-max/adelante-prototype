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

export const Route = createFileRoute("/advocate/appointments")({
  component: AdvocateAppointmentsView,
});

function AdvocateAppointmentsView() {
  const { linkId } = useAdvocateSession();
  const link = useEhr(() => AdelanteEHR.getAdvocateLink(linkId));
  const name = useSupportingName(linkId);
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={Calendar}
        title="Appointments"
        lede={name ? `${name}'s upcoming visits and groups.` : "Upcoming visits and groups."}
      />
      <AdvocateSupportGate linkId={linkId}>
        <AdvocateAppointmentsPanel linkId={linkId} />
        {link && <AdvocatePoAwarenessPanel linkId={linkId} patientId={link.patientId} />}
      </AdvocateSupportGate>
    </div>
  );
}
