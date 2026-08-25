// §Adelante Journey Phase 5 — one Library lesson, expressed as the eight-step
// instructional sequence the schema encodes. This file is now an ADAPTER only:
// it maps `LibraryItem` fields onto the shared `ModuleTemplate` steps. The
// Recovery module system renders through that same component, with two extra
// tool-flow steps — there is exactly one lesson renderer in this codebase.
import { Lightbulb, Sparkles, Target, Wrench } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import type { LibraryItem } from "@/lib/library";
import { dimensionsForLesson } from "@/lib/lessonRatings";
import { recommendsForLibraryItem } from "@/lib/lessonRecommends";
import { ModuleTemplate, type ModuleStep } from "./ModuleTemplate";
// §Phase D — optional authored structures. All absent today; the resolver
// falls straight back to the single `learnBody` block and no extra step.
import { hasIfThen } from "@/lib/lessonAuthoring";
import { resolveLearnStages } from "@/lib/lessonLearn";

import { toast } from "sonner";

export function LibraryLesson({
  item,
  patientId,
  onDone,
}: {
  item: LibraryItem;
  patientId: string;
  onDone?: () => void;
}) {
  const { t } = useI18n();
  const completed = useEhr(() => AdelanteEHR.completedLibraryItems(patientId).includes(item.id));
  // §Build 2 — the patient's saved work for this lesson, read through the same
  // subscribed facade every other engagement read uses.
  const response = useEhr(() => AdelanteEHR.lessonResponse(patientId, "library", item.id));
  const checkInOptions = item.checkInOptions?.filter((o) => o.trim()) ?? [];
  // §Phase C — dimensions derived from the lesson's OWN check-in text, and
  // recommendation chips derived from its category. No new authored content.
  const dimensions = dimensionsForLesson(item.checkIn, item.ratingPrimary);
  // §Phase D — teaching stages (enrichment → learnStages → single block) and
  // the optional if/then step. Empty for every lesson until Cathy authors one.
  const learnStages = resolveLearnStages(item, {
    happening: t("modLearnHappening"),
    why: t("modLearnWhy"),
    canChange: t("modLearnCanChange"),
    beforeMovingOn: t("modLearnBeforeMovingOn"),
  });
  const ifThen = hasIfThen(item.ifThenPractice) ? item.ifThenPractice : undefined;
  const recommends = recommendsForLibraryItem(item);


  function complete() {
    const res = AdelanteEHR.completeLibraryItem(patientId, item.id);
    if (!res.completed) return;
    toast.success(
      res.alreadyComplete
        ? "Already in your toolkit."
        : `Saved "${item.toolkitLabel}" to your toolkit.`,
    );
    onDone?.();
  }

  const steps: ModuleStep[] = [
    { kind: "text", label: t("libStepProblem"), body: item.problem },
    // §Build 3 — per-item check-in when authored, the shared line when not.
    // Absent `checkInOptions` keeps this a read-only text step; nothing looks
    // broken while the fields are still empty across the library.
    checkInOptions.length > 0
      ? {
          kind: "select" as const,
          label: t("libStepCheckIn"),
          prompt: item.checkIn?.trim() || t("libCheckInPrompt"),
          options: checkInOptions,
          max: checkInOptions.length,
          value: response?.checked ?? [],
          onChange: (next: string[]) =>
            AdelanteEHR.saveLessonResponse(patientId, "library", item.id, { checked: next }),
        }
      : {
          kind: "text" as const,
          label: t("libStepCheckIn"),
          body: item.checkIn?.trim() || t("libCheckInFallback"),
        },
    // §Phase C — "before" ratings, on the shared derived dimension set.
    { kind: "rating", label: t("modRateBeforeLabel"), phase: "before", dimensions },
    {
      kind: "learn",
      label: t("libStepLearn"),
      icon: <Sparkles className="h-3.5 w-3.5" />,
      heading: item.learnTitle,
      body: item.learnBody,
      ...(learnStages.length > 0 ? { stages: learnStages } : {}),
    },
    { kind: "activity", label: t("libStepActivity"), activity: item.activity },
    ...(ifThen
      ? [
          {
            kind: "ifthen" as const,
            label: t("modIfThenStep"),
            practice: ifThen,
            ifPicks: response?.ifThen?.ifPicks ?? [],
            thenPicks: response?.ifThen?.thenPicks ?? [],
            onChange: (next: { ifPicks: string[]; thenPicks: string[] }) =>
              AdelanteEHR.saveLessonResponse(patientId, "library", item.id, { ifThen: next }),
          },
        ]
      : []),
    {
      kind: "adel",
      label: t("libStepReflect"),
      reflection: item.adelReflection,
      question: item.adelQuestion,
      recommends,
    },
    {
      kind: "text",
      label: t("libStepInsight"),
      icon: <Lightbulb className="h-3.5 w-3.5" />,
      body: item.insight,
      boxed: true,
    },
    {
      kind: "text",
      label: t("libStepAction"),
      icon: <Target className="h-3.5 w-3.5" />,
      body: item.action,
    },
    // §Phase C — "after" ratings, same dimensions, with the delta tiles.
    { kind: "rating", label: t("modRateAfterLabel"), phase: "after", dimensions },
    {
      kind: "text",
      label: t("libStepToolkit"),
      icon: <Wrench className="h-3.5 w-3.5" />,
      body: `Finishing saves "${item.toolkitLabel}" to your toolkit so you can find it again.`,
    },
  ];


  return (
    <ModuleTemplate
      title={item.title}
      minutes={item.minutes}
      completed={completed}
      {...(item.placeholder ? { placeholder: true } : {})}
      steps={steps}
      response={response}
      onResponseChange={(patch) =>
        AdelanteEHR.saveLessonResponse(patientId, "library", item.id, patch)
      }
      completeLabel={completed ? "Mark complete again" : "Finish and save to my toolkit"}
      onComplete={complete}
    />
  );
}
