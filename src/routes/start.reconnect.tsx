import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdelanteEHR } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import { PHASE9A_COPY } from "@/lib/phase9aCopy";
import { RedeemCodePanel } from "@/components/frontdoor/SignupFlow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Search, Ticket } from "lucide-react";
/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.82f562f28a63": {
    "en": "Record lookup coming soon",
    "es": "Próximamente: búsqueda de registros"
  },
  "ui.53d573f216ba": {
    "en": "We'll help you find your record",
    "es": "Te ayudaremos a encontrar tu registro"
  },
  "ui.48b914845d54": {
    "en": "You told us you already have a care plan or case manager with us. Automatic record lookup isn't switched on yet, so a person does this part.",
    "es": "Nos indicaste que ya tienes un plan o un gestor de casos. La búsqueda automática aún no está activa, por lo que alguien se encargará de esto."
  },
  "ui.c72bbf404643": {
    "en": "Call or text your care team",
    "es": "Llama o envía un mensaje a tu equipo de cuidado"
  },
  "ui.458e8a0a6959": {
    "en": "Give them your name and date of birth and they'll pull up your plan. If you don't have your case manager's number, call the main Adelante line and say you're trying to reconnect.",
    "es": "Dales tu nombre y fecha de nacimiento para encontrar tu plan. Si no tienes el número de tu gestor de casos, llama a la línea principal de Adelante y di que intentas reconectarte."
  },
  "ui.ad2a1581c927": {
    "en": "Would rather not wait? You can start fresh — we'll merge it with your existing record when we find it.",
    "es": "¿Prefieres no esperar? Puedes empezar de nuevo. Uniremos tu información al registro existente cuando lo encontremos."
  },
  "ui.efa1914a707b": {
    "en": "Keep going anyway",
    "es": "Seguir de todos modos"
  },
  "ui.4019dd34013f": {
    "en": "Back to the first question",
    "es": "Volver a la primera pregunta"
  }
} as const;


export const Route = createFileRoute("/start/reconnect")({
  head: () => ({
    meta: [
      { title: "Finding your record — Adelante" },
      {
        name: "description",
        content: "We'll help you get back into your existing Adelante care plan and care team.",
      },
      { property: "og:title", content: "Finding your record — Adelante" },
      {
        property: "og:description",
        content: "Reconnect with your existing Adelante care plan and case manager.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReconnectPlaceholder,
});

/**
 * PLACEHOLDER (Phase 1). Patient-reconnection matching is not built — this
 * screen deliberately contains no lookup logic. It exists so Q1 = "yes" has a
 * real, non-dead-end destination: a human contact path plus a way back into
 * the flow if the person would rather just start.
 */
function ReconnectPlaceholder() {
  const { lang: screenLang } = useI18n();

  const navigate = useNavigate();
  const { lang } = useI18n();
  const c = PHASE9A_COPY[lang === "es" ? "es" : "en"];
  const [redeeming, setRedeeming] = useState(false);
  // §Phase 9a — the same redemption panel as /start/signup: claims the
  // EXISTING record via redeemEnrollmentCode, never creates one.
  if (redeeming) {
    return (
      <div className="space-y-4">
        <RedeemCodePanel
          onBack={() => setRedeeming(false)}
          onComplete={(patient) => {
            AdelanteEHR.setCurrentPatientId(patient.id);
            toast.success(`Welcome back, ${patient.firstName}`, {
              description: "We found the record your care team set up for you.",
            });
            navigate({ to: "/intake" });
          }}
        />
      </div>
    );
  }
  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-gold/50 text-navy">
          {SCREEN_COPY["ui.82f562f28a63"][screenLang]} </Badge>
        <h1 className="font-display mt-2 flex items-center gap-2 text-2xl text-navy">
          <Search className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.53d573f216ba"][screenLang]} </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {SCREEN_COPY["ui.48b914845d54"][screenLang]} </p>
      </div>

      <div className="rounded-lg border-2 border-teal/40 bg-teal/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Ticket className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
          <div className="flex-1">
            <div className="font-medium text-navy">{c.haveCode}</div>
            <p className="mt-1 text-muted-foreground">{c.haveCodeBody}</p>
            <Button
              size="sm"
              className="mt-3"
              data-testid="reconnect-have-code"
              onClick={() => setRedeeming(true)}
            >
              {c.haveCode}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-5 w-5 shrink-0 text-navy" />
          <div>
            <div className="font-medium text-navy">{SCREEN_COPY["ui.c72bbf404643"][screenLang]}</div>
            <p className="mt-1 text-muted-foreground">
              {SCREEN_COPY["ui.458e8a0a6959"][screenLang]} </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {SCREEN_COPY["ui.ad2a1581c927"][screenLang]} </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/start/helping">{SCREEN_COPY["ui.efa1914a707b"][screenLang]}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/start">{SCREEN_COPY["ui.4019dd34013f"][screenLang]}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
