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
import { getExercise } from "@/lib/library";
import { completeExercise } from "@/lib/engagement";
import { ExerciseTimer } from "@/components/library/ExercisePlayer";
import { completeCravingLog, startCravingLog } from "@/lib/selfTracking";

type Step = "arrive" | "before" | "surf" | "after" | "done";

export function CravingFlow() {
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const navigate = useNavigate();
  const exercise = useMemo(() => getExercise("urge-surfing-timer"), []);
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
        title="A craving is a wave"
        lede={
          <>
            It rises, it peaks, and it passes — whether or not you act on it. You don&apos;t have to
            make it stop. You just have to still be here when it goes.
          </>
        }
      />

      {step === "arrive" && (
        <Card className="space-y-3 p-5">
          <p className="text-base">
            Nothing you do in here is shared with anyone. Take it one screen at a time.
          </p>
          <Button
            type="button"
            data-testid="craving-start"
            size="patient"
            className="w-full"
            onClick={() => setStep("before")}
          >
            Start <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === "before" && (
        <Card className="space-y-4 p-5">
          <p className="text-base">How strong is it right now?</p>
          <Slider
            value={[before]}
            min={0}
            max={10}
            step={1}
            aria-label="Craving strength right now, 0 to 10"
            data-testid="craving-before-slider"
            onValueChange={(v) => setBefore(v[0] ?? 0)}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>0 · barely there</span>
            <span className="font-display text-2xl text-foreground" data-testid="craving-before-value">
              {before}
            </span>
            <span>10 · all-consuming</span>
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
            Ride it out with me
          </Button>
        </Card>
      )}

      {step === "surf" && (
        <Card className="space-y-3 p-5" data-testid="craving-surf">
          <p className="text-sm text-muted-foreground">
            This is the real Urge Surfing Timer from your library — same tool, opened here.
          </p>
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
            <p className="text-sm text-muted-foreground">The timer tool isn&apos;t available.</p>
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
            I&apos;m ready to rate it again
          </Button>
        </Card>
      )}

      {step === "after" && (
        <Card className="space-y-4 p-5">
          <p className="text-base">Where is it now?</p>
          <Slider
            value={[after]}
            min={0}
            max={10}
            step={1}
            aria-label="Craving strength now, 0 to 10"
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
            Log it
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="patient"
            className="w-full"
            onClick={() => navigate({ to: "/home" })}
          >
            Skip — I&apos;d rather not rate it
          </Button>
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
              <Link to="/home">Back to my care</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-12 rounded-2xl">
              <Link to="/crisis">I need more than this</Link>
            </Button>
          </div>
        </Card>
      )}
    </PatientPage>
  );
}
