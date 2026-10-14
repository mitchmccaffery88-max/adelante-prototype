// §Standalone route items — /home's entry point into the real daily check-in.
//
// The full flow moved to `/checkin` (see `CheckInPage`); this card is status
// plus a door, never a second copy of the flow. Everything it shows is read
// from the SAME real sources the dashboard streak line already reads
// (`checkInStreakFrom` over dose self-reports, PHQ-2/GAD-2 quick checks and
// daily mood check-ins), so the two can never disagree.
import { useMemo, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Flame, HeartPulse } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { monthlyCheckInCount } from "@/lib/checkInStreak";
import { useI18n } from "@/lib/i18n";
import { CHECK_IN_COPY } from "@/lib/checkInCopy";
import {
  CHECK_IN_EMOTIONS,
  dailyCheckInDayKeys,
  subscribeSelfTracking,
  todaysCheckIn,
} from "@/lib/selfTracking";

export function DailyCheckInSummaryCard({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const c = CHECK_IN_COPY[lang];
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const doseReports = useEhr(() => AdelanteEHR.listDoseSelfReports(patientId));
  const quickCheckDates = useEhr(() => AdelanteEHR.quickCheckDates(patientId));

  const selfTrackingKey = useSyncExternalStore(
    subscribeSelfTracking,
    () => `${dailyCheckInDayKeys(patientId).join(",")}|${JSON.stringify(todaysCheckIn(patientId) ?? null)}`,
    () => "",
  );
  const dailyKeys = useMemo(() => dailyCheckInDayKeys(patientId), [patientId, selfTrackingKey]);
  const today = useMemo(() => todaysCheckIn(patientId), [patientId, selfTrackingKey]);

  const streak = useMemo(
    () =>
      monthlyCheckInCount({
        doseSelfReportDates: doseReports.map((r) => r.facilityDate),
        quickCheckCompletedAt: quickCheckDates,
        dailyCheckInDayKeys: dailyKeys,
      }, new Date(), patient?.facilityTimezone),
    [doseReports, quickCheckDates, dailyKeys, patient?.facilityTimezone],
  );

  const feelings = (today?.emotions ?? []).map(id => c.emotions[id]).filter(Boolean).join(", ");

  return (
    <Card className="p-5" data-testid="daily-check-in-summary-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
          <HeartPulse className="h-4 w-4" aria-hidden="true" /> {c.title}
        </div>
        <Badge variant="outline" data-testid="daily-check-in-status">
          {today ? c.checked : c.open}
        </Badge>
      </div>

      <p className="mt-2 text-base">
        {today
          ? `${c.checked} — ${feelings || c.noFeelings}.`
          : c.ask}
      </p>

      {streak > 0 && (
        <p
          className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"
          data-testid="daily-check-in-streak"
        >
          <Flame className="h-4 w-4 text-primary" aria-hidden="true" />
          {lang === "es" ? `${streak} registros este mes` : `${streak} check-ins this month`}
        </p>
      )}

      <Button
        asChild
        variant={today ? "outline" : "default"}
        data-testid="daily-check-in-open"
        className="mt-3 min-h-11 w-full rounded-2xl"
      >
        <Link to="/checkin">
          {today ? c.change : c.title}
          <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </Card>
  );
}
