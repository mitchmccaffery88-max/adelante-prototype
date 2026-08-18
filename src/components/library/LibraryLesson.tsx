// §Adelante Journey Phase 5 — one Library lesson, expressed as the eight-step
// instructional sequence the schema encodes. This file is now an ADAPTER only:
// it maps `LibraryItem` fields onto the shared `ModuleTemplate` steps. The
// Recovery module system renders through that same component, with two extra
// tool-flow steps — there is exactly one lesson renderer in this codebase.
import { Lightbulb, Sparkles, Target, Wrench } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import type { LibraryItem } from "@/lib/library";
import { ModuleTemplate, type ModuleStep } from "./ModuleTemplate";
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
    {
      kind: "text",
      label: t("libStepLearn"),
      icon: <Sparkles className="h-3.5 w-3.5" />,
      heading: item.learnTitle,
      body: item.learnBody,
    },
    { kind: "activity", label: t("libStepActivity"), activity: item.activity },
    {
      kind: "reflect",
      label: t("libStepReflect"),
      reflection: item.adelReflection,
      question: item.adelQuestion,
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
