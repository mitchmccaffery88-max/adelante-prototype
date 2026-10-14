import { StatusChip } from "@/components/ui/status-chip";
// §Advocate build 3 Part A — "what you need next".
//
// Reads the REAL Build 1 requirement rows (`advocateDocumentRequirements`) and
// the REAL live gate (`advocateAccess`) through one store method,
// `advocateOutstandingRequirements`. There is no second tracking mechanism
// here: this component only renders what those rows already say.
//
// It disappears entirely once access is effective and nothing is outstanding —
// same source of truth as the identity banner sitting directly above it.
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { ADVOCATE_DOC_REQUIREMENTS } from "@/lib/advocateDocs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { ClipboardList, Hourglass, BellRing } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.68d418873d1a": {
    "en": "What you need next",
    "es": "Lo que sigue"
  },
  "ui.4efc76aabdc4": {
    "en": "There's no paperwork outstanding on your side. The care team is working through the rest.",
    "es": "No tienes documentación pendiente. El equipo de atención se encargará del resto."
  },
  "ui.139ce0e48313": {
    "en": "Asked for on",
    "es": "Solicitado el"
  },
  "ui.2e077d89a0bb": {
    "en": "Let them know I'm waiting",
    "es": "Avísales que estoy esperando"
  },
  "ui.6c467fe10441": {
    "en": "Last told",
    "es": "Última actualización"
  },
  "ui.67bb408ad3bc": {
    "en": "It's on file / I'm sending it",
    "es": "Está en el archivo / La estoy enviando"
  }
} as const;


export function AdvocateNextStepsPanel({
  linkId,
  attestedName,
}: {
  linkId: string;
  attestedName: string;
}) {
  const { lang: screenLang } = useI18n();

  const state = useEhr(() => AdelanteEHR.advocateOutstandingRequirements(linkId));

  // Nothing pending AND access is live — the panel has nothing to say.
  if (state.accessAllowed && state.items.length === 0) return null;

  function attest(key: (typeof state.items)[number]["key"]) {
    try {
      AdelanteEHR.attestAdvocateDocumentRequirement({ linkId, key, attestedName });
      toast.success("Thanks — the care team has been told.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record that.");
    }
  }

  function nudge(key: (typeof state.items)[number]["key"]) {
    const r = AdelanteEHR.advocateNudgeCareTeam({ linkId, key });
    if (r.sent) toast.success(r.reason);
    else toast.error(r.reason);
  }

  return (
    <Card className="space-y-3 p-4" data-testid="advocate-next-steps">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-navy">
          <ClipboardList className="h-4 w-4 text-teal" /> {SCREEN_COPY["ui.68d418873d1a"][screenLang]} </p>
        {!state.accessAllowed && (
          <p className="mt-1 text-xs text-muted-foreground">{state.accessReason}</p>
        )}
      </div>

      {state.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {SCREEN_COPY["ui.4efc76aabdc4"][screenLang]} </p>
      ) : (
        <ul className="space-y-3">
          {state.items.map((item) => {
            const def = ADVOCATE_DOC_REQUIREMENTS[item.key];
            return (
              <li key={item.key} className="space-y-1.5 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-navy">{def.label}</span>
                  <StatusChip state={item.staffAction ? "team" : "yourturn"} />
                </div>
                <p className="text-xs text-muted-foreground">{def.plainLanguage}</p>
                {item.requestedAt && (
                  <p className="text-xs text-attention">
                    {SCREEN_COPY["ui.139ce0e48313"][screenLang]} <ClientDate value={item.requestedAt} />.
                  </p>
                )}

                {item.staffAction ? (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Hourglass className="h-3.5 w-3.5" />
                      {item.status === "attested"
                        ? "You've done your part. A staff member has to check the real document before this opens."
                        : def.attestation}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => nudge(item.key)}
                    >
                      <BellRing className="h-3.5 w-3.5" /> {SCREEN_COPY["ui.2e077d89a0bb"][screenLang]} </Button>
                    {item.nudgedAt && (
                      <p className="text-[11px] text-muted-foreground">
                        {SCREEN_COPY["ui.6c467fe10441"][screenLang]} <ClientDate value={item.nudgedAt} />.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs">{def.attestation}</p>
                    <Button size="sm" variant="outline" onClick={() => attest(item.key)}>
                      {SCREEN_COPY["ui.67bb408ad3bc"][screenLang]} </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
