// §Adelante Journey Phase 5b — one Recovery lesson. ADAPTER ONLY, exactly like
// `LibraryLesson`: it maps `RecoveryLesson` onto the SHARED `ModuleTemplate`.
// The three extra steps (7–9) are the real tool flow, rendered by the shared
// `select` step kind — structured selections, not free text.
import { useState } from "react";
import { CheckCircle2, HeartHandshake, Lightbulb, ShieldAlert, Sparkles, Target, Wrench } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n, useRecoveryText } from "@/lib/i18n";
import type { LibraryActivity } from "@/lib/library";
import { TOOL_FLOW_LIMITS, type RecoveryLesson } from "@/lib/recovery";
import { ModuleTemplate, type ModuleStep } from "@/components/library/ModuleTemplate";
import { toast } from "sonner";

/**
 * Translate one activity through the SAME `rt()` reader. Keys mirror the
 * activity shape: `.act.title`, `.act.prompt`, `.act.i.<n>` (items / cards /
 * steps), `.act.b.<n>` (buckets), `.act.c.<n>.l|.f` (decision choices).
 * Anything without an override falls back to the real English content.
 */
function translateActivity(
  activity: LibraryActivity,
  id: string,
  rt: (key: string, fallback: string) => string,
): LibraryActivity {
  const p = (suffix: string, fallback: string) => rt(`rec.${id}.act.${suffix}`, fallback);
  switch (activity.kind) {
    case "checklist":
      return {
        ...activity,
        prompt: p("prompt", activity.prompt),
        items: activity.items.map((x, i) => p(`i.${i}`, x)),
      };
    case "sort":
      return {
        ...activity,
        prompt: p("prompt", activity.prompt),
        buckets: activity.buckets.map((x, i) => p(`b.${i}`, x)),
        cards: activity.cards.map((x, i) => p(`i.${i}`, x)),
      };
    case "reflection":
      return {
        ...activity,
        title: p("title", activity.title),
        prompt: p("prompt", activity.prompt),
        cards: activity.cards.map((x, i) => p(`i.${i}`, x)),
      };
    case "timeline":
      return {
        ...activity,
        title: p("title", activity.title),
        prompt: p("prompt", activity.prompt),
        steps: activity.steps.map((x, i) => p(`i.${i}`, x)),
      };
    case "decision":
      return {
        ...activity,
        title: p("title", activity.title),
        prompt: p("prompt", activity.prompt),
        choices: activity.choices.map((c, i) => ({
          ...c,
          label: p(`c.${i}.l`, c.label),
          feedback: p(`c.${i}.f`, c.feedback),
        })),
      };
    default:
      return activity;
  }
}

export function RecoveryLessonView({
  lesson,
  patientId,
  onDone,
}: {
  lesson: RecoveryLesson;
  patientId: string;
  onDone?: () => void;
}) {
  const { t } = useI18n();
  const { rt, esPending } = useRecoveryText();
  const completed = useEhr(() =>
    AdelanteEHR.completedRecoveryLessons(patientId).includes(lesson.id),
  );
  const saved = useEhr(() => AdelanteEHR.recoveryToolFlow(patientId, lesson.id));
  // §Build 2 — free text + activity selections for this lesson. Separate from
  // the tool flow above, which was already persisted and stays as it is.
  const response = useEhr(() => AdelanteEHR.lessonResponse(patientId, "recovery", lesson.id));
  const id = lesson.id;
  /** Selections the patient already saved, restored into the same controls. */
  const hasSaved =
    Boolean(saved) &&
    ((saved?.warningSigns.length ?? 0) > 0 ||
      (saved?.supportPeople.length ?? 0) > 0 ||
      Boolean(saved?.todayAction));

  const [warningSigns, setWarningSigns] = useState<string[]>(saved?.warningSigns ?? []);
  const [supportPeople, setSupportPeople] = useState<string[]>(saved?.supportPeople ?? []);
  const [todayAction, setTodayAction] = useState<string[]>(
    saved?.todayAction ? [saved.todayAction] : [],
  );

  function complete() {
    const res = AdelanteEHR.completeRecoveryLesson(patientId, lesson.id, {
      warningSigns,
      supportPeople,
      ...(todayAction[0] ? { todayAction: todayAction[0] } : {}),
    });
    if (!res.completed) return;
    toast.success(
      res.alreadyComplete
        ? "Updated your plan in your toolkit."
        : `Saved "${lesson.toolkitLabel}" to your toolkit.`,
    );
    onDone?.();
  }

  const steps: ModuleStep[] = [
    { kind: "text", label: t("recStepProblem"), body: rt(`rec.${id}.problem`, lesson.problem) },
    { kind: "text", label: t("recStepCheckIn"), body: rt(`rec.${id}.checkIn`, lesson.checkIn) },
    {
      kind: "text",
      label: t("recStepLearn"),
      icon: <Sparkles className="h-3.5 w-3.5" />,
      heading: rt(`rec.${id}.learnTitle`, lesson.learnTitle),
      body: rt(`rec.${id}.learnBody`, lesson.learnBody),
    },
    { kind: "activity", label: t("recStepTryIt"), activity: translateActivity(lesson.activity, id, rt) },
    {
      kind: "reflect",
      label: t("recStepReflect"),
      reflection: rt(`rec.${id}.adelReflection`, lesson.adelReflection),
      question: rt(`rec.${id}.adelQuestion`, lesson.adelQuestion),
    },
    {
      kind: "text",
      label: t("recStepInsight"),
      icon: <Lightbulb className="h-3.5 w-3.5" />,
      body: rt(`rec.${id}.insight`, lesson.insight),
      boxed: true,
    },
    {
      kind: "select",
      label: t("recStepWarnings"),
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      prompt: t("recPromptWarnings"),
      options: lesson.toolFlow.warningSigns,
      labelFor: (opt, i) => rt(`rec.${id}.warn.${i}`, opt),
      max: TOOL_FLOW_LIMITS.warningSigns,
      value: warningSigns,
      onChange: setWarningSigns,
    },
    {
      kind: "select",
      label: t("recStepSupport"),
      icon: <HeartHandshake className="h-3.5 w-3.5" />,
      prompt: t("recPromptSupport"),
      options: lesson.toolFlow.supportPeople,
      labelFor: (opt, i) => rt(`rec.${id}.sup.${i}`, opt),
      max: TOOL_FLOW_LIMITS.supportPeople,
      value: supportPeople,
      onChange: setSupportPeople,
    },
    {
      kind: "select",
      label: t("recStepAction"),
      icon: <Target className="h-3.5 w-3.5" />,
      prompt: t("recPromptAction"),
      options: lesson.toolFlow.todayActions,
      labelFor: (opt, i) => rt(`rec.${id}.todo.${i}`, opt),
      max: TOOL_FLOW_LIMITS.todayActions,
      value: todayAction,
      onChange: setTodayAction,
    },
    {
      kind: "text",
      label: t("recStepToolkit"),
      icon: <Wrench className="h-3.5 w-3.5" />,
      body: `Finishing saves "${rt(`rec.${id}.toolkitLabel`, lesson.toolkitLabel)}" — with what you picked above — to your toolkit.`,
    },
  ];

  return (
    <ModuleTemplate
      title={rt(`rec.${id}.title`, lesson.title)}
      minutes={lesson.minutes}
      completed={completed}
      {...(lesson.placeholder ? { placeholder: true } : {})}
      notice={
        <div className="space-y-2 pt-1">
          <p
            className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
              completed ? "bg-teal/10 text-teal" : "bg-secondary/50 text-muted-foreground"
            }`}
          >
            {completed && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            <span>
              {completed ? t("recLessonDone") : t("recLessonNotDone")}
              {completed && hasSaved ? ` ${t("recLessonSelectionsRestored")}` : ""}
            </span>
          </p>
          {esPending && (
            <p className="rounded-lg border border-gold bg-gold/5 p-3 text-xs text-muted-foreground">
              {t("recEsReviewFlag")}
            </p>
          )}
        </div>
      }
      steps={steps}
      response={response}
      onResponseChange={(patch) =>
        AdelanteEHR.saveLessonResponse(patientId, "recovery", lesson.id, patch)
      }
      completeLabel={completed ? t("recUpdatePlan") : t("recFinishSave")}
      onComplete={complete}
    />
  );
}
