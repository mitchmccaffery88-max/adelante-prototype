// §Advocate Access Redesign Phase 2 (final) — "What you need next" as a real
// destination. Pure outstanding items: the full paperwork ledger moved to
// My documents, so this page never duplicates it.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardSignature } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdvocateNextStepsPanel } from "@/components/advocate/AdvocateNextStepsPanel";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader } from "@/components/advocate/AdvocateViewParts";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.68d418873d1a": {
    "en": "What you need next",
    "es": "Lo que sigue"
  },
  "ui.444705b26c97": {
    "en": "Nothing is outstanding. Your access is active and no paperwork is waiting.",
    "es": "No hay pendientes. Tu acceso está activo y no hay documentos en espera."
  },
  "ui.92988efd5102": {
    "en": "See all my documents",
    "es": "Ver todos mis documentos"
  },
  "ui.fa7be0bb8980": {
    "en": "The full record of every authorization document — including the ones already verified — lives in",
    "es": "El registro completo de los documentos de autorización, incluidos los verificados, está en"
  },
  "ui.143f7ba1fed6": {
    "en": "My documents",
    "es": "Mis documentos"
  }
} as const;


export const Route = createFileRoute("/advocate/next")({
  head: () => ({ meta: [
    { title: "Next steps \u2014 Adelante advocate" },
    { name: "description", content: "Your next steps in the Adelante advocate portal." },
    { property: "og:title", content: "Next steps \u2014 Adelante advocate" },
    { property: "og:description", content: "Your next steps in the Adelante advocate portal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvocateNextView,
});

function AdvocateNextView() {
  const { lang: screenLang } = useI18n();

  const { linkId, attestedName } = useAdvocateSession();
  const state = useEhr(() => AdelanteEHR.advocateOutstandingRequirements(linkId));
  const nothingOutstanding = state.accessAllowed && state.items.length === 0;

  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={ClipboardSignature}
        title={SCREEN_COPY["ui.68d418873d1a"][screenLang]}
        lede="Only things still waiting on you or the care team."
      />
      {nothingOutstanding ? (
        <Card className="space-y-3 p-5 text-sm">
          <p className="text-muted-foreground">
            {SCREEN_COPY["ui.444705b26c97"][screenLang]} </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/advocate/my-documents">{SCREEN_COPY["ui.92988efd5102"][screenLang]}</Link>
          </Button>
        </Card>
      ) : (
        <>
          <AdvocateNextStepsPanel linkId={linkId} attestedName={attestedName} />
          <Card className="p-4 text-sm text-muted-foreground">
            {SCREEN_COPY["ui.fa7be0bb8980"][screenLang]}{" "}
            <Link to="/advocate/my-documents" className="font-medium text-teal underline">
              {SCREEN_COPY["ui.143f7ba1fed6"][screenLang]} </Link>
            .
          </Card>
        </>
      )}
    </div>
  );
}
