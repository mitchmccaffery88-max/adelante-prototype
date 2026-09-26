// §Needs step 2 — patient-side outputs of the "What would help you" step.
//
// ConnectMeButton: "Want your care team to connect you?" → one de-duplicated
// request per need (AdelanteEHR.requestNeedConnect). It never refers anyone;
// a case manager makes the referral with the existing Refer action.
//
// IntakeMatchPreview: top directory resources for the topics being chosen,
// shown at the end of the step. Recovery / support-group categories stay
// category-only (never listed here — they are not optional topics).
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import {
  RESOURCE_CATEGORIES,
  patientBrowsableResources,
  subscribeResources,
} from "@/lib/communityResources";

const COPY = {
  en: {
    ask: "Want your care team to connect you?",
    done: "Requested — your care team will reach out.",
    previewTitle: "Places that match so far",
    previewNote:
      "From our community directory. After you finish, you can ask your care team to connect you from My Care.",
  },
  es: {
    ask: "¿Quiere que su equipo de atención le ayude a conectarse?",
    done: "Solicitado — su equipo de atención se comunicará con usted.",
    previewTitle: "Lugares que coinciden hasta ahora",
    previewNote:
      "De nuestro directorio comunitario. Al terminar, puede pedir a su equipo que le conecte desde Mi atención. (Traducción pendiente de revisión bilingüe.)",
  },
} as const;

export function ConnectMeButton({ patientId, itemId }: { patientId: string; itemId: string }) {
  const { lang } = useI18n();
  const c = COPY[lang === "es" ? "es" : "en"];
  const state = useEhr(() => {
    const item = AdelanteEHR.getPatient(patientId)?.sdohPlan?.items.find((i) => i.id === itemId);
    if (!item || item.visibleToPatient === false) return "hidden";
    return item.connectRequestedAt ? "requested" : "open";
  });
  if (state === "hidden") return null;
  if (state === "requested")
    return (
      <p className="mt-2 text-xs font-medium text-teal" data-testid={`connect-requested-${itemId}`}>
        {c.done}
      </p>
    );
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="mt-2 min-h-11"
      data-testid={`connect-me-${itemId}`}
      onClick={() => AdelanteEHR.requestNeedConnect(patientId, itemId, { id: patientId, role: "patient" })}
    >
      {c.ask}
    </Button>
  );
}

export function IntakeMatchPreview({
  categoryIds,
  lang,
}: {
  categoryIds: string[];
  lang: "en" | "es";
}) {
  const c = COPY[lang];
  const dirJson = useSyncExternalStore(
    subscribeResources,
    () => JSON.stringify(patientBrowsableResources()),
    () => "[]",
  );
  const unique = [...new Set(categoryIds)];
  if (unique.length === 0) return null;
  const directory = JSON.parse(dirJson) as ReturnType<typeof patientBrowsableResources>;
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3" data-testid="intake-match-preview">
      <div className="text-sm font-medium">{c.previewTitle}</div>
      <p className="text-[11px] text-muted-foreground">{c.previewNote}</p>
      {unique.map((cid) => {
        const orgs = directory.filter((r) => r.categoryId === cid).slice(0, 2);
        const name = RESOURCE_CATEGORIES.find((x) => x.id === cid)?.name ?? cid;
        return (
          <div key={cid} className="text-xs">
            <span className="font-medium">{name}:</span>{" "}
            {orgs.length ? orgs.map((o) => o.name).join(" · ") : "—"}
          </div>
        );
      })}
    </div>
  );
}
