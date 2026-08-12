// §Adelante Journey Phase 5 — exercise renderer.
//
// One component per content variant of the `ExerciseContent` discriminated
// union. Adding a new variant is a compile error here until it is handled,
// which is the point of the union.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import type { Exercise, ExerciseContent } from "@/lib/library";

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The one timer in this app. §Tier 1 Build B reuses it for the guided craving
 * "surf" rather than building a second one — hence the optional `autoStart`
 * and `onComplete` props, which the library player never passes.
 */
export function ExerciseTimer({
  c,
  autoStart,
  onComplete,
}: {
  c: Extract<ExerciseContent, { type: "timer" }>;
  autoStart?: boolean;
  onComplete?: () => void;
}) {
  const [left, setLeft] = useState(c.seconds);
  const [running, setRunning] = useState(Boolean(autoStart));
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => setLeft((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running]);
  useEffect(() => {
    if (left === 0) {
      setRunning(false);
      onComplete?.();
    }
  }, [left]);
  const elapsed = c.seconds - left;
  const promptIdx = Math.min(
    c.prompts.length - 1,
    Math.floor((elapsed / c.seconds) * c.prompts.length),
  );
  return (
    <div className="space-y-3">
      <div className="font-display text-4xl tabular-nums text-navy">{mmss(left)}</div>
      <Progress value={(elapsed / c.seconds) * 100} className="h-2" />
      <p className="text-sm text-muted-foreground">{c.prompts[promptIdx]}</p>
      {left === 0 && c.closing && (
        <p className="rounded-lg bg-teal/10 p-3 text-sm text-teal">{c.closing}</p>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : left === 0 ? "Done" : "Start"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setRunning(false);
            setLeft(c.seconds);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

const PHASES = ["Breathe in", "Hold", "Breathe out", "Hold"] as const;

function BreathingBody({ c }: { c: Extract<ExerciseContent, { type: "breathing" }> }) {
  const durations = [c.inhaleSec, c.holdSec, c.exhaleSec, c.holdAfterSec];
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(c.inhaleSec);
  const [cycle, setCycle] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setCount((v) => {
        if (v > 1) return v - 1;
        setPhase((p) => {
          const next = (p + 1) % 4;
          if (next === 0) setCycle((k) => k + 1);
          setCount(durations[next] ?? 4);
          return next;
        });
        return durations[(phase + 1) % 4] ?? 4;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase]);
  useEffect(() => {
    if (cycle >= c.cycles) setRunning(false);
  }, [cycle, c.cycles]);
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wider text-teal">
        Cycle {Math.min(cycle + 1, c.cycles)} of {c.cycles}
      </div>
      <div className="font-display text-3xl text-navy">{PHASES[phase]}</div>
      <div className="font-display text-5xl tabular-nums text-teal">{count}</div>
      <Button type="button" onClick={() => setRunning((r) => !r)}>
        {running ? "Pause" : "Start"}
      </Button>
    </div>
  );
}

function ChecklistBody({ c }: { c: Extract<ExerciseContent, { type: "checklist" }> }) {
  const [checked, setChecked] = useState<string[]>([]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{c.intro}</p>
      <ul className="space-y-2">
        {c.items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <Checkbox
              id={`chk-${item}`}
              checked={checked.includes(item)}
              onCheckedChange={(v) =>
                setChecked((prev) => (v ? [...prev, item] : prev.filter((x) => x !== item)))
              }
            />
            <label htmlFor={`chk-${item}`}>{item}</label>
          </li>
        ))}
      </ul>
      {c.closing && <p className="text-sm text-muted-foreground">{c.closing}</p>}
    </div>
  );
}

function WorksheetBody({ c }: { c: Extract<ExerciseContent, { type: "worksheet" }> }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{c.intro}</p>
      {c.fields.map((f) => (
        <div key={f.id} className="space-y-1">
          <label className="text-sm font-medium text-navy" htmlFor={`ws-${f.id}`}>
            {f.label}
          </label>
          {f.multiline ? (
            <Textarea
              id={`ws-${f.id}`}
              placeholder={f.placeholder ?? ""}
              rows={3}
              value={vals[f.id] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [f.id]: e.target.value }))}
            />
          ) : (
            <Input
              id={`ws-${f.id}`}
              placeholder={f.placeholder ?? ""}
              value={vals[f.id] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [f.id]: e.target.value }))}
            />
          )}
          {f.options && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {f.options.map((o) => (
                <Button
                  key={o}
                  type="button"
                  size="sm"
                  variant={vals[f.id] === o ? "default" : "outline"}
                  onClick={() => setVals((v) => ({ ...v, [f.id]: o }))}
                >
                  {o}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MapperBody({ c }: { c: Extract<ExerciseContent, { type: "mapper" }> }) {
  const [zones, setZones] = useState<Record<string, string>>({});
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{c.intro}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {c.columns.map((col) => (
          <div key={col.id} className="space-y-1 rounded-lg border p-3">
            <div className="text-sm font-medium text-navy">{col.label}</div>
            <p className="text-xs text-muted-foreground">{col.hint}</p>
            <Textarea
              rows={3}
              aria-label={col.label}
              value={zones[col.id] ?? ""}
              onChange={(e) => setZones((z) => ({ ...z, [col.id]: e.target.value }))}
            />
            {col.suggestions && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {col.suggestions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setZones((z) => {
                        const cur = z[col.id] ?? "";
                        return { ...z, [col.id]: cur ? `${cur}\n${s}` : s };
                      })
                    }
                  >
                    {s}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalculatorBody({ c }: { c: Extract<ExerciseContent, { type: "calculator" }> }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [against, setAgainst] = useState("");
  const total = c.rows.reduce((sum, r) => sum + (Number(vals[r.id]) || 0), 0);
  const income = c.incomeRows
    ? c.incomeRows.reduce((sum, r) => sum + (Number(vals[r.id]) || 0), 0)
    : Number(against) || 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{c.intro}</p>
      <div className="space-y-2">
        <div className="text-sm font-medium text-navy">{c.againstLabel}</div>
        {c.incomeRows ? (
          c.incomeRows.map((r) => (
            <div key={r.id} className="space-y-1">
              <label className="text-sm" htmlFor={`calc-${r.id}`}>
                {r.label}
              </label>
              <Input
                id={`calc-${r.id}`}
                inputMode="decimal"
                value={vals[r.id] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [r.id]: e.target.value }))}
              />
            </div>
          ))
        ) : (
          <Input
            id="calc-income"
            aria-label={c.againstLabel}
            inputMode="decimal"
            value={against}
            onChange={(e) => setAgainst(e.target.value)}
          />
        )}
        <div className="pt-2 text-sm font-medium text-navy">{c.totalLabel}</div>
        {c.rows.map((r) => (
          <div key={r.id} className="space-y-1">
            <label className="text-sm" htmlFor={`calc-${r.id}`}>
              {r.label}
            </label>
            <Input
              id={`calc-${r.id}`}
              inputMode="decimal"
              value={vals[r.id] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [r.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-secondary/50 p-3 text-sm">
        <div className="flex justify-between">
          <span>{c.totalLabel}</span>
          <span className="font-medium tabular-nums">{total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Left over</span>
          <span className="font-medium tabular-nums">{(income - total).toFixed(2)}</span>
        </div>
      </div>
      {c.closing && <p className="text-sm text-muted-foreground">{c.closing}</p>}
    </div>
  );
}

function ScaleBody({ c }: { c: Extract<ExerciseContent, { type: "scale" }> }) {
  const [value, setValue] = useState(c.min);
  const band = c.bands.find((b) => value <= b.upTo) ?? c.bands[c.bands.length - 1];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{c.intro}</p>
      <Slider
        value={[value]}
        min={c.min}
        max={c.max}
        step={1}
        onValueChange={(v) => setValue(v[0] ?? c.min)}
        aria-label={c.intro}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{c.minLabel}</span>
        <span className="font-display text-lg text-navy">{value}</span>
        <span>{c.maxLabel}</span>
      </div>
      {band && (
        <div className="rounded-lg bg-secondary/50 p-3 text-sm">
          <div className="font-medium text-navy">{band.label}</div>
          {band.guidance && <p className="text-muted-foreground">{band.guidance}</p>}
          {band.moves && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {band.moves.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ExerciseBody({ exercise }: { exercise: Exercise }) {
  const c = exercise.content;
  switch (c.type) {
    case "timer":
      return <ExerciseTimer c={c} />;
    case "breathing":
      return <BreathingBody c={c} />;
    case "checklist":
      return <ChecklistBody c={c} />;
    case "worksheet":
      return <WorksheetBody c={c} />;
    case "mapper":
      return <MapperBody c={c} />;
    case "calculator":
      return <CalculatorBody c={c} />;
    case "scale":
      return <ScaleBody c={c} />;
  }
}
