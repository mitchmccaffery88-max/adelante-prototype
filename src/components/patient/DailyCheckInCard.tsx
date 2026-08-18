// §Patient portal Tier 1 Build B — the real daily mood check-in.
//
// Deliberately NOT the PHQ-2/GAD-2 quick check (`QuickCheckCard`): that one is
// a scored clinical instrument stored as a `ScreenerResult`; this one is nine
// emotions and an optional, skippable reason, stored in the patient-private
// self-tracking store. They sit side by side on /home on purpose.
//
// §Build A item 3 — completing the check-in now ends on a real summary screen
// (reflection + one Library lesson + one Resource), not a toast. The mapping
// is rules-based and pure (`checkInSummaryPlan`); the lesson and the resource
// are resolved from the REAL live catalogues, and anything that resolves to
// nothing is simply not shown rather than faked.
import { useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, HeartPulse, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePopulation } from "@/components/PopulationGate";
import { isLibraryItemVisible } from "@/lib/library";
import { liveLibraryItems, usePublishedContentVersion } from "@/lib/contentCatalog";
import {
  patientVisibleResources,
  RESOURCE_CATEGORIES,
  subscribeResources,
} from "@/lib/communityResources";
import { checkInSummaryPlan } from "@/lib/checkInSummary";
import {
  CHECK_IN_EMOTIONS,
  CHECK_IN_REASONS,
  recordDailyCheckIn,
  subscribeSelfTracking,
  todaysCheckIn,
  type CheckInReasonId,
  type EmotionId,
} from "@/lib/selfTracking";

function CheckInSummary({
  patientId,
  emotions,
  onDone,
}: {
  patientId: string;
  emotions: EmotionId[];
  onDone: () => void;
}) {
  const population = usePopulation(patientId);
  const contentVersion = usePublishedContentVersion();
  const resourceKey = useSyncExternalStore(
    subscribeResources,
    () => String(patientVisibleResources().length),
    () => "0",
  );
  const plan = useMemo(() => checkInSummaryPlan(emotions), [emotions]);

  const lesson = useMemo(() => {
    if (!plan) return undefined;
    return liveLibraryItems()
      .filter((i) => i.categoryId === plan.libraryCategoryId && isLibraryItemVisible(i, population))
      .sort((a, b) => a.order - b.order)[0];
  }, [plan, population, contentVersion]);

  const resource = useMemo(() => {
    if (!plan) return undefined;
    return patientVisibleResources(plan.resourceCategoryId)[0];
  }, [plan, resourceKey]);

  const resourceCategoryName = plan
    ? RESOURCE_CATEGORIES.find((c) => c.id === plan.resourceCategoryId)?.name
    : undefined;

  return (
    <div className="mt-2" data-testid="check-in-summary">
      <p className="text-base">Thanks for checking in. That's today done.</p>
      {plan && (
        <p className="mt-2 rounded-2xl bg-secondary p-3 text-base" data-testid="check-in-reflection">
          {plan.reflection}
        </p>
      )}

      {lesson && (
        <Link
          to="/library"
          search={{ item: lesson.id }}
          data-testid="check-in-library-rec"
          className="mt-3 flex min-h-16 items-center gap-3 rounded-2xl border p-3 hover:bg-secondary"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{lesson.title}</span>
            <span className="block text-xs text-muted-foreground">
              From the library · about {lesson.minutes} min
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      )}

      {resource && (
        <Link
          to="/resources"
          data-testid="check-in-resource-rec"
          className="mt-2 flex min-h-16 items-center gap-3 rounded-2xl border p-3 hover:bg-secondary"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{resource.name}</span>
            <span className="block text-xs text-muted-foreground">
              {resourceCategoryName ?? "Nearby"} · {plan?.resourceReason}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      )}

      <Button
        type="button"
        variant="outline"
        data-testid="check-in-summary-done"
        className="mt-3 min-h-11 w-full rounded-2xl"
        onClick={onDone}
      >
        Done for now
      </Button>
    </div>
  );
}

export function DailyCheckInCard({ patientId }: { patientId: string }) {
  const todayJson = useSyncExternalStore(
    subscribeSelfTracking,
    () => JSON.stringify(todaysCheckIn(patientId) ?? null),
    () => "null",
  );
  const today = JSON.parse(todayJson) as ReturnType<typeof todaysCheckIn> | null;

  const [step, setStep] = useState<"emotions" | "reason" | "summary">("emotions");
  const [emotions, setEmotions] = useState<EmotionId[]>([]);
  const [editing, setEditing] = useState(false);

  const done = today && !editing && step !== "summary";

  function save(reasonId?: CheckInReasonId) {
    recordDailyCheckIn(patientId, { emotions, ...(reasonId ? { reasonId } : {}) });
    setEditing(false);
    setStep("summary");
  }

  return (
    <Card className="p-5" data-testid="daily-check-in-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
        <HeartPulse className="h-4 w-4" aria-hidden="true" /> Daily check-in
      </div>

      {step === "summary" ? (
        <CheckInSummary
          patientId={patientId}
          emotions={emotions}
          onDone={() => {
            setStep("emotions");
            setEmotions([]);
          }}
        />
      ) : done ? (
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
