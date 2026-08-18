// §Adelante Journey Phase 5 — THE ONE shared module-rendering component.
//
// Both surfaces render through this and only this:
//   • Self-Help Library  — 8-step lessons  (src/components/library/LibraryLesson.tsx)
//   • Recovery Modules   — 10-step lessons (src/components/recovery/RecoveryLessonView.tsx)
//
// It knows nothing about either content model. Callers hand it an ordered list
// of `ModuleStep`s; the extra recovery steps (the tool-flow selects) are just
// another step kind here, not a second renderer. Do NOT add a parallel lesson
// component — add a step kind.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { LibraryActivity } from "@/lib/library";
import type { LessonResponse, LessonResponsePatch } from "@/lib/engagement";

/**
 * §Lesson-player Build 2 — the activity is CONTROLLED now. Every control used
 * to be component-local `useState` that vanished on unmount; the value and the
 * writer both come from the caller, which persists them into the engagement
 * store. Nothing a patient touches is thrown away.
 */
function Activity({
  activity,
  response,
  onChange,
}: {
  activity: LibraryActivity;
  response: LessonResponse | undefined;
  onChange: (patch: LessonResponsePatch) => void;
}) {
  const checked = response?.checked ?? [];
  const rating = response?.rating ?? 0;
  const sorted = response?.sorted ?? {};
  const scores = response?.scores ?? {};
  const choice = response?.choice ?? null;
  const setChecked = (next: string[]) => onChange({ checked: next });
  const setRating = (n: number) => onChange({ rating: n });
  const setSorted = (next: Record<string, string>) => onChange({ sorted: next });
  const setScores = (next: Record<string, number>) => onChange({ scores: next });
  const setChoice = (label: string) => onChange({ choice: label });
  const text = (key: string) => response?.text?.[key] ?? "";
  const setText = (key: string, value: string) => onChange({ text: { [key]: value } });
  switch (activity.kind) {
    case "checklist":
      return (
        <div className="space-y-2">
          <p className="text-sm">{activity.prompt}</p>
          {activity.items.map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm">
              <Checkbox
                id={`act-${item}`}
                checked={checked.includes(item)}
                onCheckedChange={(v) =>
                  setChecked(v ? [...checked, item] : checked.filter((x) => x !== item))
                }
              />
              <label htmlFor={`act-${item}`}>{item}</label>
            </div>
          ))}
        </div>
      );
    case "write":
      return (
        <div className="space-y-2">
          <p className="text-sm">{activity.prompt}</p>
          <Textarea
            rows={activity.lines}
            placeholder={activity.placeholder ?? ""}
            aria-label={activity.prompt}
            value={text("activity")}
            onChange={(e) => setText("activity", e.target.value)}
          />
        </div>
      );
    case "rate":
      return (
        <div className="space-y-2">
          <p className="text-sm">{activity.prompt}</p>
          <Slider
            value={[rating]}
            min={activity.min}
            max={activity.max}
            step={1}
            onValueChange={(v) => setRating(v[0] ?? activity.min)}
            aria-label={activity.prompt}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{activity.minLabel}</span>
            <span className="font-display text-base text-navy">{rating}</span>
            <span>{activity.maxLabel}</span>
          </div>
        </div>
      );
    case "sort":
      return (
        <div className="space-y-2">
          <p className="text-sm">{activity.prompt}</p>
          {activity.cards.map((card) => (
            <div key={card} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1">{card}</span>
              {activity.buckets.map((b) => (
                <Button
                  key={b}
                  type="button"
                  size="sm"
                  variant={sorted[card] === b ? "default" : "outline"}
                  onClick={() => setSorted({ ...sorted, [card]: b })}
                >
                  {b}
                </Button>
              ))}
            </div>
          ))}
        </div>
      );
    case "reflection":
      return (
        <div className="space-y-2">
          <h3 className="font-display text-base text-navy">{activity.title}</h3>
          <p className="text-sm">{activity.prompt}</p>
          <div className="flex flex-wrap gap-2">
            {activity.cards.map((card) => (
              <Button
                key={card}
                type="button"
                size="sm"
                variant={checked.includes(card) ? "default" : "outline"}
                aria-pressed={checked.includes(card)}
                onClick={() =>
                  setChecked(
                    checked.includes(card)
                      ? checked.filter((x) => x !== card)
                      : [...checked, card],
                  )
                }
              >
                {card}
              </Button>
            ))}
          </div>
        </div>
      );
    case "timeline":
      return (
        <div className="space-y-2">
          <h3 className="font-display text-base text-navy">{activity.title}</h3>
          <p className="text-sm">{activity.prompt}</p>
          <ol className="space-y-2">
            {activity.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] text-navy">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "breathing":
      return (
        <div className="space-y-2">
          <h3 className="font-display text-base text-navy">{activity.title}</h3>
          <p className="text-sm">{activity.prompt}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary/60 px-3 py-1">In {activity.inhaleSec}</span>
            <span className="rounded-full bg-secondary/60 px-3 py-1">Hold {activity.holdSec}</span>
            <span className="rounded-full bg-secondary/60 px-3 py-1">Out {activity.exhaleSec}</span>
            <span className="rounded-full bg-secondary/60 px-3 py-1">
              {activity.rounds} rounds
            </span>
          </div>
        </div>
      );
    case "sliders":
      return (
        <div className="space-y-3">
          <h3 className="font-display text-base text-navy">{activity.title}</h3>
          <p className="text-sm">{activity.prompt}</p>
          {activity.sliders.map((s) => (
            <div key={s.id} className="space-y-1">
              <p className="text-sm">{s.label}</p>
              <Slider
                value={[scores[s.id] ?? 0]}
                min={0}
                max={10}
                step={1}
                onValueChange={(v) => setScores({ ...scores, [s.id]: v[0] ?? 0 })}
                aria-label={s.label}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{s.minLabel}</span>
                <span className="text-navy">{scores[s.id] ?? 0}</span>
                <span>{s.maxLabel}</span>
              </div>
            </div>
          ))}
        </div>
      );
    case "grounding":
      return (
        <div className="space-y-2">
          <h3 className="font-display text-base text-navy">{activity.title}</h3>
          <p className="text-sm">{activity.prompt}</p>
          {activity.senses.map((s) => (
            <div key={s.label} className="space-y-1">
              <label className="text-sm font-medium text-navy" htmlFor={`gr-${s.label}`}>
                {s.count} things you can {s.label.toLowerCase()}
              </label>
              <Textarea
                id={`gr-${s.label}`}
                rows={2}
                value={text(`grounding:${s.label}`)}
                onChange={(e) => setText(`grounding:${s.label}`, e.target.value)}
              />
            </div>
          ))}
        </div>
      );
    case "decision":
      return (
        <div className="space-y-2">
          <h3 className="font-display text-base text-navy">{activity.title}</h3>
          <p className="text-sm">{activity.prompt}</p>
          <div className="space-y-2">
            {activity.choices.map((c) => (
              <div key={c.label} className="space-y-1">
                <Button
                  type="button"
                  variant={choice === c.label ? "default" : "outline"}
                  className="h-auto w-full justify-start whitespace-normal text-left"
                  onClick={() => setChoice(c.label)}
                >
                  {c.label}
                </Button>
                {choice === c.label && (
                  <p
                    className={`rounded-lg p-2 text-sm ${c.good ? "bg-teal/10 text-teal" : "bg-secondary/60 text-muted-foreground"}`}
                  >
                    {c.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      );
  }
}

/**
 * One step, presented on its own: a small numbered eyebrow AND a real step
 * title. Previously the label was only the tiny eyebrow, so nine of ten steps
 * had no heading at all.
 */
function Step({
  n,
  total,
  label,
  icon,
  children,
}: {
  n: number;
  total: number;
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-teal">
          {icon}
          {t("modStepLabel")} {n} {t("modStepOf")} {total}
        </div>
        <h2 className="font-display text-xl text-navy">{label}</h2>
      </div>
      {children}
    </section>
  );
}

/** Segmented progress — one bar per step, filled up to where the patient is. */
function StepProgress({ index, total }: { index: number; total: number }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5">
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-label={`${t("modStepLabel")} ${index + 1} ${t("modStepOf")} ${total}`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= index ? "bg-teal" : "bg-secondary"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {index + 1}/{total} {t("modStepsWord")}
      </p>
    </div>
  );
}


/**
 * A single step in a module lesson. `select` is the structured skill-building
 * step the recovery tool flow uses (warning signs / support people / today's
 * action); it is controlled by the caller so selections can be persisted.
 */
export type ModuleStep =
  | { kind: "text"; label: string; icon?: React.ReactNode; body: string; heading?: string; boxed?: boolean }
  | { kind: "activity"; label: string; icon?: React.ReactNode; activity: LibraryActivity }
  | { kind: "reflect"; label: string; icon?: React.ReactNode; reflection: string; question: string }
  | {
      kind: "select";
      label: string;
      icon?: React.ReactNode;
      prompt: string;
      options: string[];
      /**
       * Display-only label for an option. The VALUE stored/selected is always
       * the canonical English option, so translated UI never changes the data.
       */
      labelFor?: (option: string, index: number) => string;
      /** Max selections. 1 renders as a single-select. */
      max: number;
      value: string[];
      onChange: (next: string[]) => void;
    }
  | { kind: "custom"; label: string; icon?: React.ReactNode; content: React.ReactNode };

function SelectStep({
  prompt,
  options,
  labelFor,
  max,
  value,
  onChange,
}: {
  prompt: string;
  options: string[];
  labelFor?: (option: string, index: number) => string;
  max: number;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const single = max === 1;
  function toggle(opt: string) {
    if (single) {
      onChange(value[0] === opt ? [] : [opt]);
      return;
    }
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else if (value.length < max) onChange([...value, opt]);
  }
  return (
    <div className="space-y-2">
      <p className="text-sm">{prompt}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const on = value.includes(opt);
          const full = !single && !on && value.length >= max;
          return (
            <Button
              key={opt}
              type="button"
              size="sm"
              variant={on ? "default" : "outline"}
              aria-pressed={on}
              disabled={full}
              className="h-auto whitespace-normal text-left"
              onClick={() => toggle(opt)}
            >
              {labelFor ? labelFor(opt, i) : opt}
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {single
          ? t("modPickOne")
          : `${t("modPickUpTo")} ${max}. ${value.length} ${t("modSelectedOf")} ${max} ${t("modSelectedSuffix")}`}
      </p>
    </div>
  );
}

export function ModuleTemplate({
  title,
  subtitle,
  minutes,
  completed,
  placeholder,
  badges,
  notice,
  steps,
  completeLabel,
  onComplete,
}: {
  title: string;
  subtitle?: string;
  minutes: number;
  completed?: boolean;
  placeholder?: boolean;
  badges?: React.ReactNode;
  /** Optional banner under the header (completion / restored-selection notes). */
  notice?: React.ReactNode;
  steps: ModuleStep[];
  completeLabel: string;
  onComplete: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl text-navy">{title}</h1>
          {completed && (
            <Badge className="border-0 bg-teal/15 text-teal">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {t("modCompleted")}
            </Badge>
          )}
          {placeholder && (
            <Badge variant="outline" className="border-gold text-gold-foreground">
              {t("modPlaceholderBadge")}
            </Badge>
          )}
          {badges}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {t("modAbout")} {minutes} {t("modMinutes")}
        </div>
        {notice}
      </header>

      {steps.map((step, i) => (
        <Step key={`${step.label}-${i}`} n={i + 1} label={step.label} icon={step.icon}>
          {step.kind === "text" && (
            <>
              {step.heading && <h2 className="font-display text-lg text-navy">{step.heading}</h2>}
              <p
                className={
                  step.boxed
                    ? "rounded-lg bg-secondary/50 p-3 text-sm text-navy"
                    : "text-sm text-muted-foreground"
                }
              >
                {step.body}
              </p>
            </>
          )}
          {step.kind === "activity" && <Activity activity={step.activity} />}
          {step.kind === "reflect" && (
            <>
              <p className="text-sm italic text-muted-foreground">{step.reflection}</p>
              <p className="text-sm font-medium text-navy">{step.question}</p>
              <Textarea rows={3} aria-label={step.question} />
            </>
          )}
          {step.kind === "select" && (
            <SelectStep
              prompt={step.prompt}
              options={step.options}
              {...(step.labelFor ? { labelFor: step.labelFor } : {})}
              max={step.max}
              value={step.value}
              onChange={step.onChange}
            />
          )}
          {step.kind === "custom" && step.content}
        </Step>
      ))}

      <Button type="button" onClick={onComplete}>
        {completeLabel}
      </Button>
    </Card>
  );
}
