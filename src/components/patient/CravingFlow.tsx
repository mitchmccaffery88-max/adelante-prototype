// §Patient portal Tier 1 Build B — the guided craving flow.
//
// Arrival → rate 0–10 → guided surf (the REAL Phase 5 urge-surfing-timer
// exercise, rendered by the one shared `ExerciseTimer`; no second timer) →
// after-rating → logged.
//
// No escalation of any kind. Repeated craving logs do not notify, score or
// flag anybody — that belongs to the already-held escalation-policy decision.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Waves } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { liveExercise as getExercise } from "@/lib/contentCatalog";
import { completeExercise } from "@/lib/engagement";
import { ExerciseTimer } from "@/components/library/ExercisePlayer";
import { completeCravingLog, startCravingLog } from "@/lib/selfTracking";
import { CravingMoreHelp } from "@/components/patient/CravingMoreHelp";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.047af0381091": {
    "en": "A craving is a wave",
    "es": "Un antojo es como una ola"
  },
  "ui.8702e4aa1108": {
    "en": "It rises, it peaks, and it passes — whether or not you act on it. You don't have to make it stop. You just have to still be here when it goes.",
    "es": "Sube, llega a su punto más alto y pasa, hagas algo o no. No tienes que detenerlo. Solo tienes que seguir aquí cuando pase."
  },
  "ui.3d312bc9062b": {
    "en": "Nothing you do in here is shared with anyone. Take it one screen at a time.",
    "es": "Nada de lo que hagas aquí se comparte. Ve paso a paso."
  },
  "ui.952f375412e8": {
    "en": "Start",
    "es": "Empezar"
  },
  "ui.5b8217f822a8": {
    "en": "How strong is it right now?",
    "es": "¿Qué tan fuerte es en este momento?"
  },
  "ui.7bfaaae13b75": {
    "en": "Craving strength right now, 0 to 10",
    "es": "Intensidad del antojo ahora, 0 a 10"
  },
  "ui.193beed6b924": {
    "en": "0 · barely there",
    "es": "0 · casi imperceptible"
  },
  "ui.08b5b8cfb0eb": {
    "en": "10 · all-consuming",
    "es": "10 · incontrolable"
  },
  "ui.29d3c33e82a7": {
    "en": "Ride it out with me",
    "es": "Superémoslo juntos"
  },
  "ui.9a5ee672ff39": {
    "en": "This is the real Urge Surfing Timer from your library — same tool, opened here.",
    "es": "Este es el Temporizador de Surf de Urgencia de tu biblioteca."
  },
  "ui.c7b65c8bbef8": {
    "en": "The timer tool isn't available.",
    "es": "La herramienta del temporizador no está disponible."
  },
  "ui.36155dc2e805": {
    "en": "I'm ready to rate it again",
    "es": "Quiero calificarlo de nuevo"
  },
  "ui.e75831415277": {
    "en": "Where is it now?",
    "es": "¿En qué nivel está ahora?"
  },
  "ui.4d4eb518b2ce": {
    "en": "Craving strength now, 0 to 10",
    "es": "Intensidad del antojo ahora, 0 a 10"
  },
  "ui.dc2171d21279": {
    "en": "Log it",
    "es": "Registrarlo"
  },
  "ui.5def2f06b443": {
    "en": "Skip — I'd rather not rate it",
    "es": "Saltar: prefiero no calificarlo"
  },
  "ui.4c899a33398b": {
    "en": "Back to my care",
    "es": "Volver a mi cuidado"
  },
  "ui.410176a1c487": {
    "en": "I need more than this",
    "es": "Necesito algo más que esto"
  }
} as const;


type Step = "arrive" | "before" | "surf" | "after" | "done";

export function CravingFlow() {
  const { lang: screenLang } = useI18n();

  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const navigate = useNavigate();
  const exercise = useEhr(() => getExercise("urge-surfing-timer"));
  const [step, setStep] = useState<Step>("arrive");
  const [before, setBefore] = useState(5);
  const [after, setAfter] = useState(5);
  const [logId, setLogId] = useState<string | null>(null);
  const [surfDone, setSurfDone] = useState(false);

  const timer =
    exercise && exercise.content.type === "timer" ? exercise.content : undefined;

  return (
    <PatientPage data-testid="craving-flow">
      <PatientPageHeader
        icon={Waves}
        title={SCREEN_COPY["ui.047af0381091"][screenLang]}
        lede={
          <>
            {SCREEN_COPY["ui.8702e4aa1108"][screenLang]} </>
        }
      />

      {step === "arrive" && (
        <Card className="space-y-3 p-5">
          <p className="text-base">
            {SCREEN_COPY["ui.3d312bc9062b"][screenLang]} </p>
          <Button
            type="button"
            data-testid="craving-start"
            size="patient"
            className="w-full"
            onClick={() => setStep("before")}
          >
            {SCREEN_COPY["ui.952f375412e8"][screenLang]} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === "before" && (
        <Card className="space-y-4 p-5">
          <p className="text-base">{SCREEN_COPY["ui.5b8217f822a8"][screenLang]}</p>
          <Slider
            value={[before]}
            min={0}
            max={10}
            step={1}
            aria-label={SCREEN_COPY["ui.7bfaaae13b75"][screenLang]}
            data-testid="craving-before-slider"
            onValueChange={(v) => setBefore(v[0] ?? 0)}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{SCREEN_COPY["ui.193beed6b924"][screenLang]}</span>
            <span className="font-display text-2xl text-foreground" data-testid="craving-before-value">
              {before}
            </span>
            <span>{SCREEN_COPY["ui.08b5b8cfb0eb"][screenLang]}</span>
          </div>
          <Button
            type="button"
            data-testid="craving-to-surf"
            size="patient"
            className="w-full"
            onClick={() => {
              const log = startCravingLog(patientId, before);
              setLogId(log.id);
              setStep("surf");
            }}
          >
            {SCREEN_COPY["ui.29d3c33e82a7"][screenLang]} </Button>
        </Card>
      )}

      {step === "surf" && (
        <Card className="space-y-3 p-5" data-testid="craving-surf">
          <p className="text-sm text-muted-foreground">
            {SCREEN_COPY["ui.9a5ee672ff39"][screenLang]} </p>
          {timer ? (
            <ExerciseTimer
              c={timer}
              autoStart
              onComplete={() => {
                if (surfDone) return;
                setSurfDone(true);
                completeExercise(patientId, "urge-surfing-timer");
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{SCREEN_COPY["ui.c7b65c8bbef8"][screenLang]}</p>
          )}
          <Button
            type="button"
            variant="outline"
            data-testid="craving-to-after"
            size="patient"
            className="w-full"
            onClick={() => {
              setAfter(before);
              setStep("after");
            }}
          >
            {SCREEN_COPY["ui.36155dc2e805"][screenLang]} </Button>
        </Card>
      )}

      {step === "after" && (
        <Card className="space-y-4 p-5">
          <p className="text-base">{SCREEN_COPY["ui.e75831415277"][screenLang]}</p>
          <Slider
            value={[after]}
            min={0}
            max={10}
            step={1}
            aria-label={SCREEN_COPY["ui.4d4eb518b2ce"][screenLang]}
            data-testid="craving-after-slider"
            onValueChange={(v) => setAfter(v[0] ?? 0)}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>0</span>
            <span className="font-display text-2xl text-foreground" data-testid="craving-after-value">
              {after}
            </span>
            <span>10</span>
          </div>
          <Button
            type="button"
            data-testid="craving-log"
            size="patient"
            className="w-full"
            onClick={() => {
              if (logId) {
                completeCravingLog(patientId, logId, { levelAfter: after, surfCompleted: surfDone });
              }
              toast.success("Logged. Only you can see it.");
              setStep("done");
            }}
          >
            {SCREEN_COPY["ui.dc2171d21279"][screenLang]} </Button>
          <Button
            type="button"
            variant="ghost"
            size="patient"
            className="w-full"
            onClick={() => navigate({ to: "/home" })}
          >
            {SCREEN_COPY["ui.5def2f06b443"][screenLang]} </Button>
        </Card>
      )}

      {step === "done" && (
        <Card className="space-y-3 p-5" data-testid="craving-done">
          <p className="text-base">
            {after < before
              ? `From ${before} down to ${after}. That's the wave doing what waves do.`
              : "You stayed with it. That's the whole skill — the number matters less than that."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="min-h-12 rounded-2xl">
              <Link to="/home">{SCREEN_COPY["ui.4c899a33398b"][screenLang]}</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-12 rounded-2xl">
              <Link to="/crisis">{SCREEN_COPY["ui.410176a1c487"][screenLang]}</Link>
            </Button>
          </div>
        </Card>
      )}
      <CravingMoreHelp />
    </PatientPage>
  );
}
