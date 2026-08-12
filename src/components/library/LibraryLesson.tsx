// §Adelante Journey Phase 5 — one Library lesson, expressed as the eight-step
// instructional sequence the schema encodes. This file is now an ADAPTER only:
// it maps `LibraryItem` fields onto the shared `ModuleTemplate` steps. The
// Recovery module system renders through that same component, with two extra
// tool-flow steps — there is exactly one lesson renderer in this codebase.
import { Lightbulb, Sparkles, Target, Wrench } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
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
  const completed = useEhr(() => AdelanteEHR.completedLibraryItems(patientId).includes(item.id));

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
    { kind: "text", label: "The problem", body: item.problem },
    {
      kind: "text",
      label: "Check in",
      body: "Take a breath before you start. Nothing you write here is graded.",
    },
    {
      kind: "text",
      label: "Learn",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      heading: item.learnTitle,
      body: item.learnBody,
    },
    { kind: "activity", label: "Try it", activity: item.activity },
    {
      kind: "reflect",
      label: "Reflect",
      reflection: item.adelReflection,
      question: item.adelQuestion,
    },
    {
      kind: "text",
      label: "Insight",
      icon: <Lightbulb className="h-3.5 w-3.5" />,
      body: item.insight,
      boxed: true,
    },
    { kind: "text", label: "Action", icon: <Target className="h-3.5 w-3.5" />, body: item.action },
    {
      kind: "text",
      label: "Toolkit",
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
      completeLabel={completed ? "Mark complete again" : "Finish and save to my toolkit"}
      onComplete={complete}
    />
  );
}
