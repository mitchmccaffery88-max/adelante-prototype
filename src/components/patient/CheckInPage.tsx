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

export function CheckInPage() {
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  if (!patientId) return null;

  return (
    <PatientPage data-testid="check-in-page">
      <PatientPageHeader
        icon={HeartPulse}
        title="Today's check-in"
        lede={
          <>
            A minute at most. Pick whatever fits how today actually feels — nobody is scoring this.
          </>
        }
      />
      <DailyCheckInCard patientId={patientId} />
      <Button asChild variant="ghost" className="min-h-11 rounded-2xl">
        <Link to="/home">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back to My care
        </Link>
      </Button>
    </PatientPage>
  );
}
