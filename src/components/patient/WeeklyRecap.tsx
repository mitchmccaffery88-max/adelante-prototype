// §Weekly recap — real stats first, Adel reflection second.
//
// The stats render with no network at all. The reflection is an enhancement:
// if the real Adel backend is unreachable, unconfigured or rate limited, this
// page stays a complete, honest stats view — it never shows a fabricated or
// templated "reflection" pretending to be Adel.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarCheck, Loader2, Pill, Sparkles } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { dailyCheckInDayKeys, subscribeSelfTracking } from "@/lib/selfTracking";
import { subscribeEngagement } from "@/lib/engagement";
import { computeWeeklyRecap, recapIsEmpty, type WeeklyRecapStats } from "@/lib/weeklyRecap";

function Section({
  icon: Icon,
  title,
  children,
  testid,
}: {
  icon: typeof Pill;
  title: string;
  children: React.ReactNode;
  testid: string;
}) {
  return (
    <Card className="p-5 soft-shadow" data-testid={testid}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" /> {title}
      </div>
      <div className="mt-2">{children}</div>
    </Card>
  );
}

export function WeeklyRecap() {
  const patientId = AdelanteEHR.getCurrentPatientId();
  const patient = useEhr(() => (patientId ? AdelanteEHR.getPatient(patientId) : undefined));
  const doseReports = useEhr(() => (patientId ? AdelanteEHR.listDoseSelfReports(patientId) : []));
  const quickCheckDates = useEhr(() => (patientId ? AdelanteEHR.quickCheckDates(patientId) : []));
  const adherence = useEhr(() =>
    patientId ? AdelanteEHR.adherenceWeek(patientId, { days: 7 }) : [],
  );

  const engagementKey = useSyncExternalStore(
    subscribeEngagement,
    () => (patientId ? JSON.stringify(AdelanteEHR.engagementSummary(patientId)) : "{}"),
    () => "{}",
  );
  const selfTrackingKey = useSyncExternalStore(
    subscribeSelfTracking,
    () => (patientId ? dailyCheckInDayKeys(patientId).join(",") : ""),
    () => "",
  );

  const stats = useMemo<WeeklyRecapStats | undefined>(() => {
    if (!patientId) return undefined;
    return computeWeeklyRecap({
      doseSelfReportDates: doseReports.map((r) => r.facilityDate),
      quickCheckCompletedAt: quickCheckDates,
      dailyCheckInDayKeys: dailyCheckInDayKeys(patientId),
      adherence,
      engagement: AdelanteEHR.engagementSummary(patientId),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, doseReports, quickCheckDates, adherence, engagementKey, selfTrackingKey]);

  const [reflection, setReflection] = useState<string | null>(null);
  const [reflectionState, setReflectionState] = useState<"idle" | "loading" | "failed">("idle");

  const statsKey = stats ? JSON.stringify(stats) : "";
  useEffect(() => {
    if (!stats) return;
    let cancelled = false;
    setReflectionState("loading");
    setReflection(null);
    fetch("/api/adel-recap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stats),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as { reflection?: string };
      })
      .then((json) => {
        if (cancelled) return;
        if (json.reflection) {
          setReflection(json.reflection);
          setReflectionState("idle");
        } else {
          setReflectionState("failed");
        }
      })
      .catch(() => {
        if (!cancelled) setReflectionState("failed");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsKey]);

  if (!patient || !stats) return null;
  const firstName = patient.preferredName || patient.firstName;
  const med = stats.medication;

  return (
    <div className="space-y-5" data-testid="weekly-recap">
      <header>
        <h1 className="font-display text-3xl text-foreground sm:text-4xl">Your week, {firstName}</h1>
        <p className="mt-1 text-base text-muted-foreground">
          The last 7 days ({stats.weekStartKey} to {stats.weekEndKey}). Only what the app actually
          knows.
        </p>
      </header>

      {/* Adel reflection — enhancement only, never fabricated ---------------- */}
      <Card className="border-accent/40 bg-accent/10 p-5 soft-shadow" data-testid="recap-reflection">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> A note from Adel
        </div>
        {reflectionState === "loading" && (
          <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Adel is reading your
            week…
          </p>
        )}
        {reflectionState === "failed" && (
          <p className="mt-2 text-base text-muted-foreground" data-testid="recap-reflection-fallback">
            Adel couldn't write a note just now. Your week is still right here below.
          </p>
        )}
        {reflection && <p className="mt-2 text-base text-foreground">{reflection}</p>}
      </Card>

      {/* Check-ins ---------------------------------------------------------- */}
      <Section icon={CalendarCheck} title="Check-ins" testid="recap-checkins">
        <p className="text-base text-foreground">
          <span className="font-display text-2xl">{stats.checkInDays}</span> of {stats.windowDays}{" "}
          days had a check-in.
        </p>
        <Progress className="mt-2 h-2" value={(stats.checkInDays / stats.windowDays) * 100} />
        <p className="mt-2 text-xs text-muted-foreground">
          Counts any day you checked in, marked a dose, or did a quick check.
        </p>
      </Section>

      {/* Medication — only when there is real scheduled medication ---------- */}
      {med && (
        <Section icon={Pill} title="Medication" testid="recap-medication">
          <p className="text-base text-foreground">
            You marked <span className="font-display text-2xl">{med.selfMarkedTaken}</span> of{" "}
            {med.scheduled} doses as taken.
          </p>
          {med.unmarked > 0 && (
            <p className="mt-1 text-base text-muted-foreground">
              {med.unmarked} {med.unmarked === 1 ? "dose is" : "doses are"} still unmarked. Nothing
              here is a judgement.
            </p>
          )}
          <Button asChild variant="outline" className="mt-3 min-h-11 rounded-2xl">
            <Link to="/home" hash="my-medications">
              Open my medications
            </Link>
          </Button>
        </Section>
      )}

      {/* Learning — TOTALS, honestly labelled ------------------------------- */}
      <Section icon={BookOpen} title="Learning" testid="recap-learning">
        <p className="text-base text-foreground">
          {stats.learning.activeThisWeek
            ? "You spent time in the library or a recovery module this week."
            : "No library or recovery-module activity showed up this week."}
        </p>
        <p className="mt-2 text-base text-muted-foreground">
          All-time: {stats.learning.lessonsCompletedTotal} lessons,{" "}
          {stats.learning.recoveryLessonsCompletedTotal} recovery-module lessons,{" "}
          {stats.learning.exercisesCompletedTotal} exercises.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          The app records what you've finished, not the day you finished it, so these are running
          totals rather than a count for this week.
        </p>
        <Button asChild variant="outline" className="mt-3 min-h-11 rounded-2xl">
          <Link to="/library">Open my library</Link>
        </Button>
      </Section>

      {recapIsEmpty(stats) && (
        <p className="text-base text-muted-foreground" data-testid="recap-empty">
          A quiet week is still a week. Today can start the next one.
        </p>
      )}
    </div>
  );
}
