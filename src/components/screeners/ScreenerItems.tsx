// §Phase 10a — ONE item renderer for every screener surface (intake, re-screen).
// Always renders each item's OWN answer choices (`optionsForItem`), honours
// gate items (PC-PTSD-5 trauma-exposure question), and uses the option INDEX
// as the radio value so instruments whose choices share a score (AHC-HRSN
// housing, utilities) still render as distinct, selectable choices.
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { itemVisible, optionsForItem, type ScreenerDef } from "@/lib/screeners";

export function ScreenerItems({
  def,
  answers,
  choices = {},
  onChange,
  testIdPrefix = "screener-q",
}: {
  def: ScreenerDef;
  answers: (number | undefined)[];
  /** Chosen option index per item (needed where two choices share a score). */
  choices?: Record<number, number>;
  /** Receives item-score answers plus the chosen option index per item. */
  onChange: (answers: (number | undefined)[], choiceIndex: Record<number, number>) => void;
  testIdPrefix?: string;
}) {
  return (
    <div className="space-y-5">
      {def.questions.map((q, qi) => {
        if (!itemVisible(def, qi, answers)) return null;
        const opts = optionsForItem(def, qi);
        const chosen =
          choices[qi] ?? (typeof answers[qi] === "number" ? opts.findIndex((o) => o.value === answers[qi]) : -1);
        return (
          <div key={qi} className="rounded-lg border p-3" data-testid={`${testIdPrefix}-${qi}`}>
            <Label className="text-sm leading-snug">
              {def.gate && qi === def.gate.itemIndex ? "" : `${def.gate ? qi : qi + 1}. `}
              {q}
            </Label>
            <RadioGroup
              className="mt-2 flex flex-wrap gap-2"
              value={chosen >= 0 ? String(chosen) : ""}
              onValueChange={(v) => {
                const idx = Number(v);
                const next = [...answers];
                next[qi] = opts[idx].value;
                // Clearing the gate to "stop" drops follow-up answers.
                if (def.gate && qi === def.gate.itemIndex && opts[idx].value === def.gate.stopWhenValue) {
                  for (let i = 0; i < def.questions.length; i++) if (i !== qi) next[i] = undefined;
                }
                const nextChoices = { ...choices, [qi]: idx };
                onChange(next, nextChoices);
              }}
            >
              {opts.map((o, oi) => (
                <label
                  key={oi}
                  className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3 py-2.5 text-xs hover:border-teal"
                >
                  <RadioGroupItem value={String(oi)} />
                  {o.label}
                </label>
              ))}
            </RadioGroup>
          </div>
        );
      })}
    </div>
  );
}
