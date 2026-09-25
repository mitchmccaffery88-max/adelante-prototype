import { createFileRoute, redirect } from "@tanstack/react-router";
import { RecoveryModuleBrowser } from "@/components/recovery/RecoveryModuleBrowser";
import { AdelanteEHR } from "@/lib/ehr";
import { recoveryJourneyVisible } from "@/lib/seeking";

/** `?lesson=<id>` deep-links straight into one recovery lesson. */
function validateSearch(search: Record<string, unknown>): { lesson?: string } {
  return typeof search["lesson"] === "string" ? { lesson: search["lesson"] } : {};
}

function RecoveryJourney() {
  const { lesson } = Route.useSearch();
  return <RecoveryModuleBrowser initialLesson={lesson} />;
}

export const Route = createFileRoute("/recovery-journey")({
  beforeLoad: () => {
    const patient = AdelanteEHR.getPatient(AdelanteEHR.getCurrentPatientId());
    if (!recoveryJourneyVisible(patient)) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "Recovery journey — Adelante" },
      {
        name: "description",
        content:
          "Nine recovery modules — from surviving your first days out to building a life that works — with warning signs, support people and one action for today.",
      },
      { property: "og:title", content: "Recovery journey — Adelante" },
      {
        property: "og:description",
        content: "Work through your recovery modules at your own pace, one mission at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch,
  component: RecoveryJourney,
});
