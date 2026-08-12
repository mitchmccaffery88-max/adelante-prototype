// §Patient portal Tier 1 Build B — the real daily mood check-in.
//
// Deliberately NOT the PHQ-2/GAD-2 quick check (`QuickCheckCard`): that one is
// a scored clinical instrument stored as a `ScreenerResult`; this one is nine
// emotions and an optional, skippable reason, stored in the patient-private
// self-tracking store. They sit side by side on /home on purpose.
import { useState } from "react";
import { useSyncExternalStore } from "react";
import { Check, HeartPulse } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CHECK_IN_EMOTIONS,
  CHECK_IN_REASONS,
  recordDailyCheckIn,
  subscribeSelfTracking,
  todaysCheckIn,
  type CheckInReasonId,
  type EmotionId,
} from "@/lib/selfTracking";

export function DailyCheckInCard({ patientId }: { patientId: string }) {
  const todayJson = useSyncExternalStore(
    subscribeSelfTracking,
    () => JSON.stringify(todaysCheckIn(patientId) ?? null),
    () => "null",
  );
  const today = JSON.parse(todayJson) as ReturnType<typeof todaysCheckIn> | null;

  const [step, setStep] = useState<"emotions" | "reason">("emotions");
  const [emotions, setEmotions] = useState<EmotionId[]>([]);
  const [editing, setEditing] = useState(false);

  const done = today && !editing;

  function save(reasonId?: CheckInReasonId) {
    recordDailyCheckIn(patientId, { emotions, ...(reasonId ? { reasonId } : {}) });
    setEditing(false);
    setStep("emotions");
    setEmotions([]);
    toast.success("Checked in. That's today done.");
  }

  return (
    <Card className="p-5" data-testid="daily-check-in-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
        <HeartPulse className="h-4 w-4" aria-hidden="true" /> Daily check-in
      </div>

      {done ? (
        <div className="mt-2" data-testid="daily-check-in-done">
          <p className="text-base">
            You checked in today —{" "}
            {today.emotions
              .map((id) => CHECK_IN_EMOTIONS.find((e) => e.id === id))
              .filter(Boolean)
              .map((e) => `${e!.emoji} ${e!.label.toLowerCase()}`)
              .join(", ") || "no feelings picked"}
            .
          </p>
          {today.reasonId && (
            <p className="mt-1 text-sm text-muted-foreground">
              {CHECK_IN_REASONS.find((r) => r.id === today.reasonId)?.label}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 rounded-2xl"
            onClick={() => {
              setEmotions(today.emotions);
              setEditing(true);
              setStep("emotions");
            }}
          >
            Change it
          </Button>
        </div>
      ) : step === "emotions" ? (
        <div className="mt-2">
          <p className="text-base">How are you doing today? Pick anything that fits.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CHECK_IN_EMOTIONS.map((e) => {
              const on = emotions.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  data-testid={`emotion-${e.id}`}
                  aria-pressed={on}
                  onClick={() =>
                    setEmotions((prev) =>
                      prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id],
                    )
                  }
                  className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 text-base ${
                    on ? "border-primary bg-primary/10 text-foreground" : "bg-card hover:bg-secondary"
                  }`}
                >
                  <span aria-hidden="true">{e.emoji}</span>
                  {e.label}
                  {on && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            data-testid="daily-check-in-next"
            disabled={emotions.length === 0}
            className="mt-4 min-h-11 w-full rounded-2xl"
            onClick={() => setStep("reason")}
          >
            Next
          </Button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-base">Anything behind it? Only if you want to say.</p>
          <div className="mt-3 space-y-2">
            {CHECK_IN_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                data-testid={`reason-${r.id}`}
                onClick={() => save(r.id)}
                className="flex min-h-12 w-full items-center rounded-2xl border px-4 text-left text-base hover:bg-secondary"
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            data-testid="daily-check-in-skip"
            className="mt-3 min-h-11 w-full rounded-2xl"
            onClick={() => save()}
          >
            Skip this part
          </Button>
        </div>
      )}
    </Card>
  );
}
