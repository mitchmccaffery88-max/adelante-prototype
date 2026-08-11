// §Adelante Journey Phase 6 — "I Just Got Out" Day-0 module (patient-facing).
//
// This card renders ONLY when the real front-door Phase 2 safety-net path put
// something on the record (missed-handoff flag, day-one catch-up episode, or
// a released pre-release episode) AND Phase 2's population resolver puts the
// person in a confirmed justice-involved track. `PopulationGate` is the outer
// gate; `dayZeroAvailability` is the trigger.
import { useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, LifeBuoy } from "lucide-react";
import { PopulationGate } from "@/components/PopulationGate";
import {
  DAY_ZERO_PLAN_STEPS,
  DAY_ZERO_STEPS,
  completeDayZeroStep,
  dayZeroAvailability,
  getDayZeroProgress,
  saveDayZeroPlan,
  saveReentryToolkit,
  setImmediateNeeds,
  subscribeDayZero,
  type DayZeroStep,
} from "@/lib/reentryDayZero";

function useDayZero(patientId: string) {
  return useSyncExternalStore(
    subscribeDayZero,
    () => JSON.stringify(getDayZeroProgress(patientId) ?? {}),
    () => "{}",
  );
}

export function ReentryDayZeroModule({ patientId }: { patientId: string }) {
  return (
    <PopulationGate patientId={patientId} allow={["pre_release_ji", "post_release_ji"]}>
      <DayZeroBody patientId={patientId} />
    </PopulationGate>
  );
}

function DayZeroBody({ patientId }: { patientId: string }) {
  const snapshot = useDayZero(patientId);
  const progress = JSON.parse(snapshot) as Partial<ReturnType<typeof getDayZeroProgress>> & object;
  const availability = dayZeroAvailability(patientId);
  const [open, setOpen] = useState<string | null>(null);

  if (!availability.available) return null;

  const completed: string[] = (progress as { completedSteps?: string[] }).completedSteps ?? [];
  const pct = Math.round((completed.length / DAY_ZERO_STEPS.length) * 100);
  const step = DAY_ZERO_STEPS.find((s) => s.id === open);

  return (
    <Card className="p-5" data-testid="reentry-day-zero">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <LifeBuoy className="h-4 w-4" /> I just got out
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        You don't have to figure everything out today. Ten short steps, in any order.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Progress value={pct} className="h-2" />
        <span className="shrink-0 text-xs text-muted-foreground">
          {completed.length}/{DAY_ZERO_STEPS.length}
        </span>
      </div>

      {step ? (
        <StepBody
          patientId={patientId}
          step={step}
          progress={progress as never}
          onBack={() => setOpen(null)}
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {DAY_ZERO_STEPS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpen(s.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-secondary/50"
              >
                <span className="mt-0.5">
                  {completed.includes(s.id) ? (
                    <CheckCircle2 className="h-4 w-4 text-teal" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.subtitle}</span>
                </span>
                <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                  {s.minutes} min
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StepBody({
  patientId,
  step,
  progress,
  onBack,
}: {
  patientId: string;
  step: DayZeroStep;
  progress: { immediateNeeds?: string[]; plan?: { picks: Record<string, string[]> } };
  onBack: () => void;
}) {
  const [needs, setNeeds] = useState<string[]>(progress.immediateNeeds ?? []);
  const [picks, setPicks] = useState<Record<string, string[]>>(progress.plan?.picks ?? {});

  const toggleNeed = (n: string) =>
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const togglePick = (stepId: string, option: string, maxPicks: number) =>
    setPicks((prev) => {
      const cur = prev[stepId] ?? [];
      if (cur.includes(option)) return { ...prev, [stepId]: cur.filter((o) => o !== option) };
      if (maxPicks === 1) return { ...prev, [stepId]: [option] };
      if (cur.length >= maxPicks) return prev;
      return { ...prev, [stepId]: [...cur, option] };
    });

  const finish = () => {
    if (step.kind === "checklist") setImmediateNeeds(patientId, needs);
    if (step.kind === "plan") saveDayZeroPlan(patientId, picks);
    if (step.kind === "toolkit") saveReentryToolkit(patientId);
    completeDayZeroStep(patientId, step.id);
    onBack();
  };

  return (
    <div className="mt-4 space-y-3" data-testid={`day-zero-step-${step.id}`}>
      <div>
        <h3 className="font-display text-lg text-navy">{step.title}</h3>
        <p className="text-sm text-muted-foreground">{step.subtitle}</p>
      </div>

      {step.kind === "checklist" && step.options && (
        <div className="space-y-2">
          {step.options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggleNeed(o)}
              className={`block w-full rounded-lg border p-2.5 text-left text-sm ${
                needs.includes(o) ? "border-teal bg-teal/10 text-navy" : "border-border"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {step.kind === "plan" && (
        <div className="space-y-4">
          {DAY_ZERO_PLAN_STEPS.map((ps) => (
            <div key={ps.id} className="space-y-2">
              <div>
                <div className="text-sm font-medium text-foreground">{ps.title}</div>
                <div className="text-xs text-muted-foreground">
                  {ps.prompt}
                  {ps.maxPicks > 1 ? ` Pick up to ${ps.maxPicks}.` : ""}
                </div>
              </div>
              {ps.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => togglePick(ps.id, o, ps.maxPicks)}
                  className={`block w-full rounded-lg border p-2.5 text-left text-sm ${
                    (picks[ps.id] ?? []).includes(o)
                      ? "border-teal bg-teal/10 text-navy"
                      : "border-border"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {step.kind === "toolkit" && (
        <p className="rounded-lg bg-secondary/50 p-3 text-sm text-navy">
          Save this so it's here on a hard day — your 24-hour plan, what you asked for help with,
          and the people you said you'd contact.
        </p>
      )}

      <div className="flex gap-2">
        <Button type="button" onClick={finish}>
          {step.kind === "plan" ? "Save my 24-hour plan" : "Done"}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}