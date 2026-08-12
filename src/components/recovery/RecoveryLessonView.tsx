// §Adelante Journey Phase 5b — one Recovery lesson. ADAPTER ONLY, exactly like
// `LibraryLesson`: it maps `RecoveryLesson` onto the SHARED `ModuleTemplate`.
// The three extra steps (7–9) are the real tool flow, rendered by the shared
// `select` step kind — structured selections, not free text.
import { useState } from "react";
import { HeartHandshake, Lightbulb, ShieldAlert, Sparkles, Target, Wrench } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { TOOL_FLOW_LIMITS, type RecoveryLesson } from "@/lib/recovery";
import { ModuleTemplate, type ModuleStep } from "@/components/library/ModuleTemplate";
import { toast } from "sonner";

export function RecoveryLessonView({
  lesson,
  patientId,
  onDone,
}: {
  lesson: RecoveryLesson;
  patientId: string;
  onDone?: () => void;
}) {
  const completed = useEhr(() =>
    AdelanteEHR.completedRecoveryLessons(patientId).includes(lesson.id),
  );
  const saved = useEhr(() => AdelanteEHR.recoveryToolFlow(patientId, lesson.id));

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
    { kind: "text", label: "The problem", body: lesson.problem },
    { kind: "text", label: "Check in", body: lesson.checkIn },
    {
      kind: "text",
      label: "Learn",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      heading: lesson.learnTitle,
      body: lesson.learnBody,
    },
    { kind: "activity", label: "Try it", activity: lesson.activity },
    {
      kind: "reflect",
      label: "Reflect",
      reflection: lesson.adelReflection,
      question: lesson.adelQuestion,
    },
    {
      kind: "text",
      label: "Insight",
      icon: <Lightbulb className="h-3.5 w-3.5" />,
      body: lesson.insight,
      boxed: true,
    },
    {
      kind: "select",
      label: "My warning signs",
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      prompt: "Which of these are showing up for you right now?",
      options: lesson.toolFlow.warningSigns,
      max: TOOL_FLOW_LIMITS.warningSigns,
      value: warningSigns,
      onChange: setWarningSigns,
    },
    {
      kind: "select",
      label: "Who I can reach out to",
      icon: <HeartHandshake className="h-3.5 w-3.5" />,
      prompt: "Pick the people you would actually contact.",
      options: lesson.toolFlow.supportPeople,
      max: TOOL_FLOW_LIMITS.supportPeople,
      value: supportPeople,
      onChange: setSupportPeople,
    },
    {
      kind: "select",
      label: "One action for today",
      icon: <Target className="h-3.5 w-3.5" />,
      prompt: "Just one. Today only.",
      options: lesson.toolFlow.todayActions,
      max: TOOL_FLOW_LIMITS.todayActions,
      value: todayAction,
      onChange: setTodayAction,
    },
    {
      kind: "text",
      label: "Toolkit",
      icon: <Wrench className="h-3.5 w-3.5" />,
      body: `Finishing saves "${lesson.toolkitLabel}" — with what you picked above — to your toolkit.`,
    },
  ];

  return (
    <ModuleTemplate
      title={lesson.title}
      minutes={lesson.minutes}
      completed={completed}
      {...(lesson.placeholder ? { placeholder: true } : {})}
      steps={steps}
      completeLabel={completed ? "Update my plan" : "Finish and save to my toolkit"}
      onComplete={complete}
    />
  );
}
