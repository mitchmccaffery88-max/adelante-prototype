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
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { dailyCheckInDayKeys, subscribeSelfTracking } from "@/lib/selfTracking";
import { subscribeEngagement } from "@/lib/engagement";
import { computeWeeklyRecap, recapIsEmpty, type WeeklyRecapStats } from "@/lib/weeklyRecap";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.97262408def1": {
    "en": "A note from Adel",
    "es": "Una nota de Adel"
  },
  "ui.3ec0a8c191f2": {
    "en": "Adel is reading your week…",
    "es": "Adel está analizando tu semana…"
  },
  "ui.f096a69a36e2": {
    "en": "Adel couldn't write a note just now. Your week is still right here below.",
    "es": "Adel no pudo escribir una nota ahora. Tu semana aparece debajo."
  },
  "ui.ae521bc4d60f": {
    "en": "Check-ins",
    "es": "Registros"
  },
  "ui.de04fa0e29f9": {
    "en": "of",
    "es": "de"
  },
  "ui.6033743702a0": {
    "en": "days had a check-in.",
    "es": "días tuvieron un registro."
  },
  "ui.14ab0cd4836f": {
    "en": "Counts any day you checked in, marked a dose, or did a quick check.",
    "es": "Cuenta cualquier día con registro o dosis marcada."
  },
  "ui.36da837e8b37": {
    "en": "Medication",
    "es": "Medicamento"
  },
  "ui.31583d15fdfb": {
    "en": "You marked",
    "es": "Marcaste"
  },
  "ui.6e3a992a67ca": {
    "en": "doses as taken.",
    "es": "dosis como tomadas."
  },
  "ui.48b796dc86b9": {
    "en": "still unmarked. Nothing here is a judgement.",
    "es": "aún sin marcar. No es un juicio."
  },
  "ui.b75b136580ca": {
    "en": "Open my medications",
    "es": "Abrir mis medicamentos"
  },
  "ui.1016fcb2b4ff": {
    "en": "Learning",
    "es": "Aprendizaje"
  },
  "ui.21ca50e5ce31": {
    "en": "All-time:",
    "es": "Total histórico:"
  },
  "ui.0bee24c7d0f5": {
    "en": "lessons,",
    "es": "lecciones,"
  },
  "ui.81c2887461a1": {
    "en": "recovery-module lessons,",
    "es": "lecciones de recuperación,"
  },
  "ui.92fa74ee240d": {
    "en": "exercises.",
    "es": "ejercicios."
  },
  "ui.3c9f9ad1bfbb": {
    "en": "The app records what you've finished, not the day you finished it, so these are running totals rather than a count for this week.",
    "es": "La aplicación registra lo que has terminado, no el día en que lo terminaste."
  },
  "ui.3637021be858": {
    "en": "Open my library",
    "es": "Abrir mi biblioteca"
  },
  "ui.ebca5e8a002d": {
    "en": "A quiet week is still a week. Today can start the next one.",
    "es": "Una semana tranquila sigue siendo una semana."
  }
} as const;


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
  const { lang: screenLang } = useI18n();

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
    <PatientPage data-testid="weekly-recap">
      <PatientPageHeader
        icon={Sparkles}
        title={`Your week, ${firstName}`}
        lede={`The last 7 days (${stats.weekStartKey} to ${stats.weekEndKey}). Only what the app actually knows.`}
      />

      {/* Adel reflection — enhancement only, never fabricated ---------------- */}
      <Card className="border-accent/40 bg-accent/10 p-5 soft-shadow" data-testid="recap-reflection">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> {SCREEN_COPY["ui.97262408def1"][screenLang]} </div>
        {reflectionState === "loading" && (
          <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {SCREEN_COPY["ui.3ec0a8c191f2"][screenLang]} </p>
        )}
        {reflectionState === "failed" && (
          <p className="mt-2 text-base text-muted-foreground" data-testid="recap-reflection-fallback">
            {SCREEN_COPY["ui.f096a69a36e2"][screenLang]} </p>
        )}
        {reflection && <p className="mt-2 text-base text-foreground">{reflection}</p>}
      </Card>

      {/* Check-ins ---------------------------------------------------------- */}
      <Section icon={CalendarCheck} title={SCREEN_COPY["ui.ae521bc4d60f"][screenLang]} testid="recap-checkins">
        <p className="text-base text-foreground">
          <span className="font-display text-2xl">{stats.checkInDays}</span> {SCREEN_COPY["ui.de04fa0e29f9"][screenLang]} {stats.windowDays}{" "}
          {SCREEN_COPY["ui.6033743702a0"][screenLang]} </p>
        <Progress className="mt-2 h-2" value={(stats.checkInDays / stats.windowDays) * 100} />
        <p className="mt-2 text-xs text-muted-foreground">
          {SCREEN_COPY["ui.14ab0cd4836f"][screenLang]} </p>
      </Section>

      {/* Medication — only when there is real scheduled medication ---------- */}
      {med && (
        <Section icon={Pill} title={SCREEN_COPY["ui.36da837e8b37"][screenLang]} testid="recap-medication">
          <p className="text-base text-foreground">
            {SCREEN_COPY["ui.31583d15fdfb"][screenLang]} <span className="font-display text-2xl">{med.selfMarkedTaken}</span> {SCREEN_COPY["ui.de04fa0e29f9"][screenLang]}{" "}
            {med.scheduled} {SCREEN_COPY["ui.6e3a992a67ca"][screenLang]} </p>
          {med.unmarked > 0 && (
            <p className="mt-1 text-base text-muted-foreground">
              {med.unmarked} {med.unmarked === 1 ? "dose is" : "doses are"} {SCREEN_COPY["ui.48b796dc86b9"][screenLang]} </p>
          )}
          <Button asChild variant="outline" size="patient" className="mt-3">
            <Link to="/medications">
              {SCREEN_COPY["ui.b75b136580ca"][screenLang]} </Link>
          </Button>
        </Section>
      )}

      {/* Learning — TOTALS, honestly labelled ------------------------------- */}
      <Section icon={BookOpen} title={SCREEN_COPY["ui.1016fcb2b4ff"][screenLang]} testid="recap-learning">
        <p className="text-base text-foreground">
          {stats.learning.activeThisWeek
            ? "You spent time in the library or a recovery module this week."
            : "No library or recovery-module activity showed up this week."}
        </p>
        <p className="mt-2 text-base text-muted-foreground">
          {SCREEN_COPY["ui.21ca50e5ce31"][screenLang]} {stats.learning.lessonsCompletedTotal} {SCREEN_COPY["ui.0bee24c7d0f5"][screenLang]}{" "}
          {stats.learning.recoveryLessonsCompletedTotal} {SCREEN_COPY["ui.81c2887461a1"][screenLang]}{" "}
          {stats.learning.exercisesCompletedTotal} {SCREEN_COPY["ui.92fa74ee240d"][screenLang]} </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {SCREEN_COPY["ui.3c9f9ad1bfbb"][screenLang]} </p>
        <Button asChild variant="outline" size="patient" className="mt-3">
          <Link to="/library">{SCREEN_COPY["ui.3637021be858"][screenLang]}</Link>
        </Button>
      </Section>

      {recapIsEmpty(stats) && (
        <p className="text-base text-muted-foreground" data-testid="recap-empty">
          {SCREEN_COPY["ui.ebca5e8a002d"][screenLang]} </p>
      )}
    </PatientPage>
  );
}
