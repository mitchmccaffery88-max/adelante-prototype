import { Badge } from "@/components/ui/badge";
import { simulatedSurfaceLabel, type FeatureId } from "@/lib/features";

// Explicit calls also keep the existing component-label inventory guard intact.
const labels = {
  hie_simulated: () => simulatedSurfaceLabel("hie_simulated"),
  placeholder_lab: () => simulatedSurfaceLabel("placeholder_lab"),
  cures_placeholder: () => simulatedSurfaceLabel("cures_placeholder"),
  eligibility_simulated: () => simulatedSurfaceLabel("eligibility_simulated"),
  erx_simulated: () => simulatedSurfaceLabel("erx_simulated"),
  caloms_export_simulated: () => simulatedSurfaceLabel("caloms_export_simulated"),
  notifications_simulated: () => simulatedSurfaceLabel("notifications_simulated"),
  payments_simulated: () => simulatedSurfaceLabel("payments_simulated"),
  voice_intake: () => simulatedSurfaceLabel("voice_intake"),
  adel_drafts: () => simulatedSurfaceLabel("adel_drafts"),
  telehealth_simulated: () => simulatedSurfaceLabel("telehealth_simulated"),
  scribe_simulated: () => simulatedSurfaceLabel("scribe_simulated"),
  llm_simulated: () => simulatedSurfaceLabel("llm_simulated"),
  calendar_sync_simulated: () => simulatedSurfaceLabel("calendar_sync_simulated"),
  consent_upload_simulated: () => simulatedSurfaceLabel("consent_upload_simulated"),
};
const spanish: Record<keyof typeof labels, string> = {
  hie_simulated: "Simulado — sin conexión real al intercambio de información de salud",
  placeholder_lab: "Simulado — no se envía a un laboratorio",
  cures_placeholder: "Simulado — no se consulta CURES en vivo",
  eligibility_simulated: "Simulado — no se verifica la elegibilidad en vivo",
  erx_simulated: "Simulado — no se envía a una farmacia",
  caloms_export_simulated: "Simulado — no se presenta nada al estado",
  notifications_simulated: "Simulado — no se envía ningún mensaje externo",
  payments_simulated: "Simulado — no se procesa ningún pago ni se transmite una reclamación",
  voice_intake: "Simulado — no se guarda audio",
  adel_drafts: "Simulado — borrador basado en reglas, no en inteligencia artificial",
  telehealth_simulated: "Simulado — proveedor de video de prueba",
  scribe_simulated: "Simulado — transcripción y borrador de prueba; no se guarda audio",
  llm_simulated: "Simulado — resumen de plantilla, sin modelo de inteligencia artificial",
  calendar_sync_simulated: "Simulado — nada sale de Adelante al sincronizar el calendario",
  consent_upload_simulated: "Simulado — la copia en papel no se guarda en un sistema real de documentos",
};

/** Presentation only. Member shells own the single Spanish review notice. */
export function SimulatedBadge({ flag, lang = "en" }: { flag: Exclude<FeatureId, "in_facility">; lang?: "en" | "es" }) {
  return <Badge variant="outline" className="max-w-full whitespace-normal break-words text-sm font-normal" data-simulated-flag={flag}>
    {lang === "es" ? spanish[flag] : labels[flag]()}
  </Badge>;
}