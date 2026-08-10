import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface ChoiceOption<T extends string> {
  key: T;
  label: string;
  hint?: string;
}

/**
 * One front-door question, one route. Answers commit on click — there is no
 * "next" button to get stuck behind, and every question that needs one offers
 * a real "not sure" option rather than a forced binary.
 */
export function QuestionCard<T extends string>({
  step,
  total,
  question,
  help,
  options,
  onAnswer,
  footer,
}: {
  step: number;
  total: number;
  question: string;
  help?: string;
  options: ChoiceOption<T>[];
  onAnswer: (value: T) => void;
  footer?: ReactNode;
}) {
  return (
    <Card className="space-y-5 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Question {step} of {total}
        </p>
        <h1 className="font-display mt-2 text-2xl text-navy">{question}</h1>
        {help && <p className="mt-2 text-sm text-muted-foreground">{help}</p>}
      </div>
      <div className="grid gap-2">
        {options.map((o) => (
          <Button
            key={o.key}
            variant="outline"
            className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
            onClick={() => onAnswer(o.key)}
          >
            <span>
              <span className="block font-medium">{o.label}</span>
              {o.hint && (
                <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>
              )}
            </span>
          </Button>
        ))}
      </div>
      {footer}
    </Card>
  );
}
