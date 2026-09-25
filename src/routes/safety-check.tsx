import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR } from "@/lib/ehr";
import { useEhr } from "@/lib/useEhr";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CssrsForm } from "@/components/screeners/CssrsForm";

export const Route = createFileRoute("/safety-check")({
  head: () => ({
    meta: [
      { title: "Safety questions — Adelante" },
      { name: "description", content: "A few safety questions your care team asked you to answer." },
      { property: "og:title", content: "Safety questions — Adelante" },
      { property: "og:description", content: "Short safety questions from your care team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SafetyCheck,
});

function SafetyCheck() {
  const { lang } = useI18n();
  const es = lang === "es";
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  return (
    <div className="mx-auto max-w-xl p-4">
      <Card className="p-5 space-y-4">
        <h1 className="text-lg font-semibold text-navy">
          {es ? "Algunas preguntas de seguridad" : "A few safety questions"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {es
            ? "Si estás en peligro ahora, llama o envía un texto al 988, o usa «Necesito ayuda ahora»."
            : "If you are in danger right now, call or text 988, or use “I need help now.”"}
        </p>
        {patientId ? (
          <CssrsForm patientId={patientId} mode="patient_self" lang={es ? "es" : "en"} />
        ) : null}
        <Button asChild variant="outline" size="sm">
          <Link to="/home">{es ? "Volver" : "Back to home"}</Link>
        </Button>
      </Card>
    </div>
  );
}
