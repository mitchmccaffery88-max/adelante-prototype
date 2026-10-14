// §Standalone route items — the daily mood check-in now owns a real route
// (`/checkin`). This page is a HOST, not a second implementation: it renders
// the one real `DailyCheckInCard`, so /home's entry card and this route read
// and write exactly the same self-tracking store, streak sources and summary
// logic. Nothing about the flow itself changed.
import { Link } from "@tanstack/react-router";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { DailyCheckInCard } from "@/components/patient/DailyCheckInCard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.6cce84d783ef": {
    "en": "Today's check-in",
    "es": "Registro de hoy"
  },
  "ui.2ccf6ed1f2ca": {
    "en": "A minute at most. Pick whatever fits how today actually feels — nobody is scoring this.",
    "es": "Un minuto como máximo. Elige lo que sientas hoy; nadie te califica."
  },
  "ui.f5b8ed165f42": {
    "en": "Back to My care",
    "es": "Volver a Mi cuidado"
  }
} as const;


export function CheckInPage() {
  const { lang: screenLang } = useI18n();

  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  if (!patientId) return null;

  return (
    <PatientPage data-testid="check-in-page">
      <PatientPageHeader
        icon={HeartPulse}
        title={SCREEN_COPY["ui.6cce84d783ef"][screenLang]}
        lede={
          <>
            {SCREEN_COPY["ui.2ccf6ed1f2ca"][screenLang]} </>
        }
      />
      <DailyCheckInCard patientId={patientId} />
      <Button asChild variant="ghost" className="min-h-11 rounded-2xl">
        <Link to="/home">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> {SCREEN_COPY["ui.f5b8ed165f42"][screenLang]} </Link>
      </Button>
    </PatientPage>
  );
}
