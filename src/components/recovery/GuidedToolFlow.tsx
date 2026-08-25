// §Lesson-player Phase B — the Recovery "Part A / Part B" tools step.
//
// This replaces the three separate select steps (7–9) with ONE step that has
// the reference's real shape:
//
//   Part A · Practice   — a theme-matched tool from the real Exercise Library,
//                         rendered by the SAME `ExerciseBody` the standalone
//                         exercise player uses. No second renderer.
//   Part B · My plan    — the real `toolFlow` data as sub-paginated steps
//                         (warning signs → support people → today's action)
//                         plus a "Create My Toolkit" summary of the patient's
//                         actual picks.
//
// Zero new content: everything shown here already exists on the lesson.
import { CheckCircle2, Dumbbell, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectStep, SubTabProgress } from "@/components/library/ModuleTemplate";
import { ExerciseBody } from "@/components/library/ExercisePlayer";
import { useI18n } from "@/lib/i18n";
import type { ExerciseMatch } from "@/lib/recovery.exerciseMatch";

export interface ToolGroup {
  key: string;
  label: string;
  prompt: string;
  options: string[];
  labelFor?: (option: string, index: number) => string;
  max: number;
  value: string[];
  onChange: (next: string[]) => void;
}

export function GuidedToolFlow({
  match,
  groups,
  part,
  onPartChange,
  subIndex,
  onSubIndexChange,
}: {
  match: ExerciseMatch;
  groups: ToolGroup[];
  part: "a" | "b";
  onPartChange: (p: "a" | "b") => void;
  subIndex: number;
  onSubIndexChange: (i: number) => void;
}) {
  const { t } = useI18n();
  const total = groups.length + 1; // + toolkit summary
  const idx = Math.min(Math.max(subIndex, 0), total - 1);
  const group = groups[idx];
  const titles = [...groups.map((g) => g.label), t("modToolkitTitle")];
  const canAdvance = group ? group.value.length > 0 : true;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("recToolsStep")}>
        <Button
          type="button"
          size="sm"
          role="tab"
          aria-selected={part === "a"}
          variant={part === "a" ? "default" : "outline"}
          onClick={() => onPartChange("a")}
        >
          <Dumbbell className="mr-1 h-3.5 w-3.5" aria-hidden /> {t("modPartA")}
        </Button>
        <Button
          type="button"
          size="sm"
          role="tab"
          aria-selected={part === "b"}
          variant={part === "b" ? "default" : "outline"}
          onClick={() => onPartChange("b")}
        >
          <Wrench className="mr-1 h-3.5 w-3.5" aria-hidden /> {t("modPartB")}
        </Button>
      </div>

      {part === "a" ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-1">
            <h3 className="font-display text-lg text-navy">{match.exercise.title}</h3>
            <p className="text-sm text-muted-foreground">{match.exercise.subtitle}</p>
            <p className="text-xs text-muted-foreground">
              {match.tier === "keyword" ? t("modPartAMatched") : t("modPartAGeneral")}
            </p>
          </div>
          <ExerciseBody exercise={match.exercise} />
          <p className="text-xs text-muted-foreground">{t("modPartANote")}</p>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <SubTabProgress
            label={t("modPartB")}
            index={idx}
            total={total}
            titles={titles}
            onJump={onSubIndexChange}
          />
          {group ? (
            <>
              <h3 className="font-display text-lg text-navy">{group.label}</h3>
              <SelectStep
                prompt={group.prompt}
                options={group.options}
                {...(group.labelFor ? { labelFor: group.labelFor } : {})}
                max={group.max}
                value={group.value}
                onChange={group.onChange}
              />
              {!canAdvance && (
                <p className="text-xs text-muted-foreground">{t("modNeedOnePick")}</p>
              )}
            </>
          ) : (
            <ToolkitSummary groups={groups} />
          )}
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={idx === 0}
              onClick={() => onSubIndexChange(idx - 1)}
            >
              {t("modBack")}
            </Button>
            {idx < total - 1 && (
              <Button
                type="button"
                size="sm"
                disabled={!canAdvance}
                onClick={() => onSubIndexChange(idx + 1)}
              >
                {idx === total - 2 ? t("modToolkitTitle") : t("modContinue")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolkitSummary({ groups }: { groups: ToolGroup[] }) {
  const { t } = useI18n();
  const empty = groups.every((g) => g.value.length === 0);
  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-navy">{t("modToolkitTitle")}</h3>
      {empty ? (
        <p className="text-sm text-muted-foreground">{t("modToolkitEmpty")}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.key} className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wider text-teal">{g.label}</div>
              {g.value.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("modToolkitNonePicked")}</p>
              ) : (
                <ul className="space-y-1">
                  {g.value.map((v) => (
                    <li key={v} className="flex items-start gap-2 text-sm text-navy">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                      <span>{g.labelFor ? g.labelFor(v, g.options.indexOf(v)) : v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("modToolkitSaveNote")}</p>
    </div>
  );
}
