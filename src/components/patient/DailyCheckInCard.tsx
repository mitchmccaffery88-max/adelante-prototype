// One patient-private flow; Home uses the greeting host, this card lives on /checkin.
import { Card } from "@/components/ui/card";
import { EmotionCheckIn } from "@/components/patient/EmotionCheckIn";
import { CHECK_IN_COPY } from "@/lib/checkInCopy";
import { useI18n } from "@/lib/i18n";
export function DailyCheckInCard({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  return <Card className="min-w-0 space-y-3 p-5" data-testid="daily-check-in-card"><p className="text-sm font-semibold text-primary">{CHECK_IN_COPY[lang].title}</p><EmotionCheckIn key={patientId} patientId={patientId} presentation="card" /></Card>;
}
