// §Adelante Journey Phase 5 — one lesson, rendered as the eight-step
// instructional sequence the schema encodes. The steps are not a layout
// choice: each maps 1:1 to a required field on `LibraryItem`.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { CheckCircle2, Clock, Lightbulb, Sparkles, Target, Wrench } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import type { LibraryActivity, LibraryItem } from "@/lib/library";
import { toast } from "sonner";

function Activity({ activity }: { activity: LibraryActivity }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [sorted, setSorted] = useState<Record<string, string>>({});
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
                  setChecked((p) => (v ? [...p, item] : p.filter((x) => x !== item)))
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
                  onClick={() => setSorted((s) => ({ ...s, [card]: b }))}
                >
                  {b}
                </Button>
              ))}
            </div>
          ))}
        </div>
      );
  }
}

function Step({
  n,
  label,
  icon,
  children,
}: {
  n: number;
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] text-navy">
          {n}
        </span>
        {icon}
        {label}
      </div>
      {children}
    </section>
  );
}

export function LibraryLesson({
  item,
  patientId,
  onDone,
}: {
  item: LibraryItem;
  patientId: string;
  onDone?: () => void;
}) {
  const completed = useEhr(() =>
    AdelanteEHR.completedLibraryItems(patientId).includes(item.id),
  );

  function complete() {
    const res = AdelanteEHR.completeLibraryItem(patientId, item.id);
    if (!res.completed) return;
    toast.success(
      res.alreadyComplete ? "Already in your toolkit." : `Saved "${item.toolkitLabel}" to your toolkit.`,
    );
    onDone?.();
  }

  return (
    <Card className="space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl text-navy">{item.title}</h1>
          {completed && (
            <Badge className="border-0 bg-teal/15 text-teal">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Completed
            </Badge>
          )}
          {item.placeholder && (
            <Badge variant="outline" className="border-gold text-gold-foreground">
              Placeholder content
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> About {item.minutes} minutes
        </div>
      </header>

      <Step n={1} label="The problem">
        <p className="text-sm text-muted-foreground">{item.problem}</p>
      </Step>

      <Step n={2} label="Check in">
        <p className="text-sm text-muted-foreground">
          Take a breath before you start. Nothing you write here is graded.
        </p>
      </Step>

      <Step n={3} label="Learn" icon={<Sparkles className="h-3.5 w-3.5" />}>
        <h2 className="font-display text-lg text-navy">{item.learnTitle}</h2>
        <p className="text-sm text-muted-foreground">{item.learnBody}</p>
      </Step>

      <Step n={4} label="Try it">
        <Activity activity={item.activity} />
      </Step>

      <Step n={5} label="Reflect">
        <p className="text-sm italic text-muted-foreground">{item.adelReflection}</p>
        <p className="text-sm font-medium text-navy">{item.adelQuestion}</p>
        <Textarea rows={3} aria-label={item.adelQuestion} />
      </Step>

      <Step n={6} label="Insight" icon={<Lightbulb className="h-3.5 w-3.5" />}>
        <p className="rounded-lg bg-secondary/50 p-3 text-sm text-navy">{item.insight}</p>
      </Step>

      <Step n={7} label="Action" icon={<Target className="h-3.5 w-3.5" />}>
        <p className="text-sm text-muted-foreground">{item.action}</p>
      </Step>

      <Step n={8} label="Toolkit" icon={<Wrench className="h-3.5 w-3.5" />}>
        <p className="text-sm text-muted-foreground">
          Finishing saves <span className="font-medium text-navy">{item.toolkitLabel}</span> to your
          toolkit so you can find it again.
        </p>
        <Button type="button" onClick={complete} className="mt-1">
          {completed ? "Mark complete again" : "Finish and save to my toolkit"}
        </Button>
      </Step>
    </Card>
  );
}
