import { useState } from "react";
import { useContentPreviewMode } from "@/lib/contentPreviewMode";
// §Adelante Journey Phase 5 — one Library lesson, expressed as the eight-step
// instructional sequence the schema encodes. This file is now an ADAPTER only:
// it maps `LibraryItem` fields onto the shared `ModuleTemplate` steps. The
// Recovery module system renders through that same component, with two extra
// tool-flow steps — there is exactly one lesson renderer in this codebase.
import { savePlayerResponse, completePlayerLesson } from "@/lib/patientPlayerActions";
import { relatedPlayerContent } from "@/lib/playerEngagement";
import { matchExerciseForLibraryLesson } from "@/lib/playerPractice";
import { publishedContent } from "@/lib/contentPublishing";
import { GuidedToolFlow } from "@/components/recovery/GuidedToolFlow";
import { ClosingPreview } from "./ClosingPreview";
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
import { recoveryJourneyVisible } from "@/lib/seeking";

export function LibraryLesson({
  item,
  patientId,
  onDone,
}: {
  item: LibraryItem;
  patientId: string;
  onDone?: () => void;
}) {
  const { t, lang } = useI18n();
  const preview = useContentPreviewMode();
  const [previewResponse, setPreviewResponse] = useState<import("@/lib/engagement").LessonResponse>();
  const saveResponse: typeof savePlayerResponse = (pid, surface, id, patch) => {
    if (!preview) return savePlayerResponse(pid, surface, id, patch);
    setPreviewResponse((prev) => ({ ...prev, ...patch, text: { ...prev?.text, ...patch.text }, updatedAt: new Date().toISOString() }));
    return { ...previewResponse, ...patch, updatedAt: new Date().toISOString() };
  };
  // Translation overlays never alter the content identity or saved answer keys.
  const es = publishedContent("library_lesson", item.id)?.es;
  if (lang === "es" && es && typeof es === "object") item = { ...item, ...es as Partial<LibraryItem>, id: item.id };
  const completed = useEhr(() => !preview && AdelanteEHR.completedLibraryItems(patientId).includes(item.id));
  // §Build 2 — the patient's saved work for this lesson, read through the same
  // subscribed facade every other engagement read uses.
  const savedResponse = useEhr(() => preview ? undefined : AdelanteEHR.lessonResponse(patientId, "library", item.id));
  const response = preview ? previewResponse : savedResponse;
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
  const showRecovery = useEhr(() => recoveryJourneyVisible(AdelanteEHR.getPatient(patientId)));
  const recommends = relatedPlayerContent(item.id, lang).filter(
    (recommendation) => recommendation.to !== "/recovery-journey" || showRecovery,
  );


  function complete() {
    if (preview) { onDone?.(); return; }
    completePlayerLesson(patientId, item.id, "library", undefined, lang);
  }

  const match = matchExerciseForLibraryLesson(item);
  const write = (patch: import("@/lib/engagement").LessonResponsePatch) => saveResponse(patientId, "library", item.id, patch);
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
          value: response?.checkIn ?? [],
          onChange: (next: string[]) =>
            saveResponse(patientId, "library", item.id, { checkIn: next }),
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
    ...(match ? [{ kind: "custom" as const, label: t("playerPractice"), canContinue: Boolean(response?.todayAction), continueHint: t("playerChoose"), content: <GuidedToolFlow patientId={patientId} lessonId={item.id} surface="library" match={match} groups={[{ key: "action", label: t("playerToday"), prompt: t("playerChoose"), options: [item.action].filter(Boolean), max: 1, value: response?.todayAction ? [response.todayAction] : [], onChange: (next) => write({ todayAction: next[0] }) }]} part={response?.toolPart ?? "a"} onPartChange={(part) => write({ toolPart: part })} subIndex={response?.subIndex ?? 0} onSubIndexChange={(subIndex) => write({ subIndex })} /> }] : []),
    ...(ifThen
      ? [
          {
            kind: "ifthen" as const,
            label: t("modIfThenStep"),
            practice: ifThen,
            ifPicks: response?.ifThen?.ifPicks ?? [],
            thenPicks: response?.ifThen?.thenPicks ?? [],
            onChange: (next: { ifPicks: string[]; thenPicks: string[] }) =>
              saveResponse(patientId, "library", item.id, { ifThen: next }),
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
      kind: "select", label: t("playerToday"), prompt: t("playerChoose"), options: [item.action].filter(Boolean), max: 1, value: response?.todayAction ? [response.todayAction] : [], onChange: (next) => write({ todayAction: next[0] }),
    },
    // §Phase C — "after" ratings, same dimensions, with the delta tiles.
    { kind: "rating", label: t("modRateAfterLabel"), phase: "after", dimensions },
    {
      kind: "custom", label: t("playerPreview"), content: <ClosingPreview tool={item.toolkitLabel} response={response} onChange={write} />,
    },
  ];


  return (
    <ModuleTemplate
      patientId={patientId} sensitive={item.part2Sensitive}
      title={item.title}
      minutes={item.minutes}
      completed={completed}
      {...(item.placeholder ? { placeholder: true } : {})}
      steps={steps}
      response={response}
      onResponseChange={(patch) =>
        saveResponse(patientId, "library", item.id, patch)
      }
      completeLabel={t("playerFinish")}
      onComplete={complete}
    />
  );
}
