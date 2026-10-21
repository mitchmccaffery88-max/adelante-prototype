// §B2-2 — an advocate sees only whether their OWN release is on file. No other
// consent record, recipient or purpose is read here. Draft — pending counsel.
import { useEhr } from "@/lib/ehr";
import { advocateOwnReleaseStatus } from "@/lib/consentCapture";
import { StatusChip } from "@/components/ui/status-chip";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

const COPY = {
  en: { title: "Your release from the person you support", active: "On file", ended: "Ended", draft: "Draft — pending counsel" },
  es: { title: "Tu permiso de la persona a la que apoyas", active: "Registrado", ended: "Terminado", draft: "Borrador — pendiente de revisión legal" },
} as const;

export function AdvocateOwnReleaseStatus({ linkId }: { linkId: string }) {
  const { lang } = useI18n();
  const t = COPY[lang === "es" ? "es" : "en"];
  const status = useEhr(() => advocateOwnReleaseStatus(linkId));
  if (status === "none") return null;
  return (
    <Card className="space-y-2 p-5" data-testid="advocate-own-release">
      <h2 className="font-medium text-foreground">{t.title}</h2>
      <StatusChip lang={lang === "es" ? "es" : "en"} state={status === "active" ? "done" : "closed"} label={status === "active" ? t.active : t.ended} />
      <p className="text-sm text-muted-foreground">{t.draft}</p>
    </Card>
  );
}
