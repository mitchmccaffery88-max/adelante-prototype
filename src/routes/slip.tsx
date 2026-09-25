import { createFileRoute, redirect } from "@tanstack/react-router";
import { SlipSupportFlow } from "@/components/patient/SlipSupportFlow";
import { AdelanteEHR } from "@/lib/ehr";
import { recoveryJourneyVisible } from "@/lib/seeking";

export const Route = createFileRoute("/slip")({
  beforeLoad: () => {
    const patient = AdelanteEHR.getPatient(AdelanteEHR.getCurrentPatientId());
    if (!recoveryJourneyVisible(patient)) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "After a slip — Adelante" },
      {
        name: "description",
        content:
          "A shame-free four-step tool after a lapse: what led up to it, what has helped before, and one step for the next 24 hours. Private to you.",
      },
      { property: "og:title", content: "After a slip — Adelante" },
      {
        property: "og:description",
        content: "You came back. Four short screens and one next move — nobody else sees this.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SlipSupportFlow,
});
