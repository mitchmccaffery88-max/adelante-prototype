// §F4 Designed forms for structured practice: every exercise kind and every
// rich lesson activity kind gets plain-language labels instead of raw keys.
import { useActingStaff } from "@/lib/roles";
import { staffContentInventory } from "@/lib/contentStaff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { contentType } from "@/lib/contentTypes";

type Obj = Record<string, unknown>;
type FieldSpec =
  | { key: string; label: string; kind: "text" | "textarea" | "number" | "toggle" }
  | { key: string; label: string; kind: "minutes" }
  | { key: string; label: string; kind: "strings"; addLabel: string }
  | { key: string; label: string; kind: "rows"; addLabel: string; rowLabel: string; fields: FieldSpec[] };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

function StringList({ label, value, onChange, addLabel }: { label: string; value: string[]; onChange: (v: string[]) => void; addLabel: string }) {
  return <div className="space-y-1">{value.map((row, i) => <div key={i} className="flex gap-2"><Input aria-label={`${label} ${i + 1}`} value={row} onChange={(e) => onChange(value.map((x, n) => (n === i ? e.target.value : x)))} /><Button variant="ghost" size="icon" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(value.filter((_, n) => n !== i))}><Trash2 className="size-4" /></Button></div>)}<Button variant="outline" size="sm" onClick={() => onChange([...value, ""])}><Plus className="mr-1 size-4" />{addLabel}</Button></div>;
}

function emptyRow(fields: FieldSpec[], prefix: string, n: number): Obj {
  return { id: `${prefix}-${n}`, ...Object.fromEntries(fields.map((f) => [f.key, f.kind === "number" ? 0 : f.kind === "toggle" ? false : f.kind === "strings" ? [] : ""])) };
}

export function DesignedFields({ specs, value, onChange }: { specs: FieldSpec[]; value: Obj; onChange: (v: Obj) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return <div className="space-y-3">{specs.map((f) => <div key={f.key} className="space-y-1"><Label className="text-xs">{f.label}</Label>
    {f.kind === "text" && <Input aria-label={f.label} value={str(value[f.key])} onChange={(e) => set(f.key, e.target.value)} />}
    {f.kind === "textarea" && <Textarea aria-label={f.label} rows={2} value={str(value[f.key])} onChange={(e) => set(f.key, e.target.value)} />}
    {f.kind === "number" && <Input aria-label={f.label} type="number" value={num(value[f.key])} onChange={(e) => set(f.key, Number(e.target.value))} />}
    {f.kind === "minutes" && <Input aria-label={f.label} type="number" min={0} step={0.5} value={num(value[f.key]) / 60} onChange={(e) => set(f.key, Math.round(Number(e.target.value) * 60))} />}
    {f.kind === "toggle" && <div><Checkbox aria-label={f.label} checked={value[f.key] === true} onCheckedChange={(c) => set(f.key, c === true)} /></div>}
    {f.kind === "strings" && <StringList label={f.label} addLabel={f.addLabel} value={Array.isArray(value[f.key]) ? (value[f.key] as string[]) : []} onChange={(v) => set(f.key, v)} />}
    {f.kind === "rows" && (() => { const rows = Array.isArray(value[f.key]) ? (value[f.key] as Obj[]) : []; return <div className="space-y-2">{rows.map((row, i) => <div key={i} className="space-y-2 rounded-md border border-border p-2"><div className="flex items-center justify-between"><span className="text-xs font-medium">{f.rowLabel} {i + 1}</span><Button variant="ghost" size="icon" aria-label={`Remove ${f.rowLabel.toLowerCase()} ${i + 1}`} onClick={() => set(f.key, rows.filter((_, n) => n !== i))}><Trash2 className="size-4" /></Button></div><DesignedFields specs={f.fields} value={row} onChange={(next) => set(f.key, rows.map((x, n) => (n === i ? next : x)))} /></div>)}<Button variant="outline" size="sm" onClick={() => set(f.key, [...rows, emptyRow(f.fields, f.key, rows.length + 1)])}><Plus className="mr-1 size-4" />{f.addLabel}</Button></div>; })()}
  </div>)}</div>;
}

// --- Exercise kinds --------------------------------------------------------
export const EXERCISE_FORMS: Record<string, { label: string; fields: FieldSpec[]; defaults: Obj }> = {
  timer: { label: "Timer", defaults: { seconds: 60, prompts: [], closing: "" }, fields: [{ key: "seconds", label: "Minutes", kind: "minutes" }, { key: "prompts", label: "Prompt", kind: "strings", addLabel: "Add prompt" }, { key: "closing", label: "Closing message", kind: "textarea" }] },
  breathing: { label: "Breathing", defaults: { inhaleSec: 4, holdSec: 4, exhaleSec: 4, holdAfterSec: 0, cycles: 3 }, fields: [{ key: "inhaleSec", label: "Breathe in (seconds)", kind: "number" }, { key: "holdSec", label: "Hold after breathing in (seconds)", kind: "number" }, { key: "exhaleSec", label: "Breathe out (seconds)", kind: "number" }, { key: "holdAfterSec", label: "Hold after breathing out (seconds)", kind: "number" }, { key: "cycles", label: "Number of cycles", kind: "number" }] },
  checklist: { label: "Checklist", defaults: { intro: "", items: [], closing: "" }, fields: [{ key: "intro", label: "Introduction", kind: "textarea" }, { key: "items", label: "Checklist item", kind: "strings", addLabel: "Add item" }, { key: "closing", label: "Closing message", kind: "textarea" }] },
  worksheet: { label: "Worksheet", defaults: { intro: "", fields: [] }, fields: [{ key: "intro", label: "Introduction", kind: "textarea" }, { key: "fields", label: "Questions", kind: "rows", addLabel: "Add question", rowLabel: "Question", fields: [{ key: "label", label: "Question text", kind: "text" }, { key: "placeholder", label: "Example answer (hint)", kind: "text" }, { key: "multiline", label: "Long answer", kind: "toggle" }, { key: "options", label: "Suggested answer", kind: "strings", addLabel: "Add suggested answer" }] }] },
  mapper: { label: "Mapper", defaults: { intro: "", columns: [] }, fields: [{ key: "intro", label: "Introduction", kind: "textarea" }, { key: "columns", label: "Columns", kind: "rows", addLabel: "Add column", rowLabel: "Column", fields: [{ key: "label", label: "Column name", kind: "text" }, { key: "hint", label: "Hint for the patient", kind: "text" }, { key: "suggestions", label: "Suggestion chip", kind: "strings", addLabel: "Add suggestion chip" }] }] },
  calculator: { label: "Budget calculator", defaults: { intro: "", incomeRows: [], rows: [], totalLabel: "", againstLabel: "", closing: "" }, fields: [{ key: "intro", label: "Introduction", kind: "textarea" }, { key: "incomeRows", label: "Income rows", kind: "rows", addLabel: "Add income row", rowLabel: "Income", fields: [{ key: "label", label: "Income name", kind: "text" }] }, { key: "rows", label: "Expense rows", kind: "rows", addLabel: "Add expense row", rowLabel: "Expense", fields: [{ key: "label", label: "Expense name", kind: "text" }] }, { key: "totalLabel", label: "Total label", kind: "text" }, { key: "againstLabel", label: "Compared against (label)", kind: "text" }, { key: "closing", label: "Closing message", kind: "textarea" }] },
  scale: { label: "Scale", defaults: { intro: "", min: 0, max: 10, minLabel: "", maxLabel: "", bands: [] }, fields: [{ key: "intro", label: "Introduction", kind: "textarea" }, { key: "min", label: "Lowest number", kind: "number" }, { key: "max", label: "Highest number", kind: "number" }, { key: "minLabel", label: "Low end words", kind: "text" }, { key: "maxLabel", label: "High end words", kind: "text" }, { key: "bands", label: "Levels", kind: "rows", addLabel: "Add level", rowLabel: "Level", fields: [{ key: "upTo", label: "Up to (number)", kind: "number" }, { key: "label", label: "Level name", kind: "text" }, { key: "guidance", label: "What to say at this level", kind: "textarea" }, { key: "moves", label: "Move to try", kind: "strings", addLabel: "Add move" }] }] },
};

export function ExerciseEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const c = value && typeof value === "object" ? (value as Obj) : { type: "breathing", ...EXERCISE_FORMS.breathing!.defaults };
  const form = EXERCISE_FORMS[String(c.type)] ?? EXERCISE_FORMS.breathing!;
  return <div className="space-y-3" data-testid="exercise-editor"><Label className="text-xs">Exercise kind</Label><Select value={String(c.type)} onValueChange={(type) => onChange({ type, ...structuredClone(EXERCISE_FORMS[type]!.defaults) })}><SelectTrigger aria-label="Exercise kind"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EXERCISE_FORMS).map(([type, f]) => <SelectItem key={type} value={type}>{f.label}</SelectItem>)}</SelectContent></Select><DesignedFields specs={form.fields} value={c} onChange={(next) => onChange({ ...next, type: c.type })} /></div>;
}

// --- Rich lesson activity kinds -------------------------------------------
export const ACTIVITY_FORMS: Record<string, FieldSpec[]> = {
  breathing: [{ key: "inhaleSec", label: "Breathe in (seconds)", kind: "number" }, { key: "holdSec", label: "Hold (seconds)", kind: "number" }, { key: "exhaleSec", label: "Breathe out (seconds)", kind: "number" }, { key: "rounds", label: "Number of cycles", kind: "number" }],
  sliders: [{ key: "sliders", label: "Sliders", kind: "rows", addLabel: "Add slider", rowLabel: "Slider", fields: [{ key: "label", label: "Slider label", kind: "text" }, { key: "minLabel", label: "Low end words", kind: "text" }, { key: "maxLabel", label: "High end words", kind: "text" }] }],
  grounding: [{ key: "senses", label: "Sense prompts", kind: "rows", addLabel: "Add sense prompt", rowLabel: "Sense", fields: [{ key: "label", label: "Prompt (e.g. Things you can see)", kind: "text" }, { key: "count", label: "How many", kind: "number" }] }],
  decision: [{ key: "choices", label: "Options", kind: "rows", addLabel: "Add option", rowLabel: "Option", fields: [{ key: "label", label: "Option text", kind: "text" }, { key: "feedback", label: "Feedback after choosing", kind: "textarea" }, { key: "good", label: "Recommended choice", kind: "toggle" }] }],
  rate: [{ key: "min", label: "Lowest number", kind: "number" }, { key: "max", label: "Highest number", kind: "number" }, { key: "minLabel", label: "Low end words", kind: "text" }, { key: "maxLabel", label: "High end words", kind: "text" }],
};

/** Plain-word validation for rich activities and exercise content. */
export function activityProblems(kind: string, a: Obj): string[] {
  const out: string[] = [];
  const rows = (k: string) => (Array.isArray(a[k]) ? (a[k] as Obj[]) : []);
  if (kind === "breathing" && ![a.inhaleSec, a.exhaleSec, a.rounds].every((n) => typeof n === "number" && n > 0)) out.push("Breathing needs seconds above zero for breathing in and out, and at least one cycle.");
  if (kind === "sliders" && (!rows("sliders").length || rows("sliders").some((r) => !str(r.label).trim()))) out.push("Add at least one slider, and give every slider a label.");
  if (kind === "grounding" && (rows("senses").length !== 5 || rows("senses").some((r) => !str(r.label).trim()))) out.push("Grounding needs five sense prompts, each with words.");
  if (kind === "decision" && (rows("choices").length < 2 || rows("choices").some((r) => !str(r.label).trim() || !str(r.feedback).trim()))) out.push("Add at least two options, each with feedback.");
  if (kind === "rate" && !(num(a.max) > num(a.min))) out.push("The highest number must be bigger than the lowest number.");
  if (kind === "rate" && (!str(a.minLabel).trim() || !str(a.maxLabel).trim())) out.push("Add words for both ends of the scale.");
  return out;
}

export function RichActivityFields({ kind, value, onChange }: { kind: string; value: Obj; onChange: (patch: Obj) => void }) {
  const specs = ACTIVITY_FORMS[kind];
  if (!specs) return null;
  const problems = activityProblems(kind, value);
  return <div className="space-y-2" data-testid="rich-activity-fields"><DesignedFields specs={specs} value={value} onChange={onChange} />{problems.map((p) => <p key={p} className="text-xs text-destructive">{p}</p>)}</div>;
}

// --- Journey steps ---------------------------------------------------------
export function CurriculumEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const steps = Array.isArray(value) ? (value as { type: string; id: string; required: boolean }[]) : [];
  const { role } = useActingStaff();
  // §F3 Every live item — shipped or managed — is pickable.
  const candidates = staffContentInventory(role).filter((e) => ["library_lesson", "recovery_lesson", "recovery_module", "exercise"].includes(e.typeId) && (e.status === "published" || !!e.publishedBody) && e.revisions.at(-1)?.action !== "retired");
  return <div className="space-y-3" data-testid="curriculum-editor">{steps.map((step, i) => <div key={i} className="flex items-center gap-2"><span>{i + 1}.</span><Select value={`${step.type}:${step.id}`} onValueChange={(v) => { const split = v.indexOf(":"); onChange(steps.map((s, n) => (i === n ? { ...s, type: v.slice(0, split), id: v.slice(split + 1) } : s))); }}><SelectTrigger aria-label={`Step ${i + 1} content`}><SelectValue placeholder="Choose live content" /></SelectTrigger><SelectContent>{candidates.map((e) => <SelectItem key={`${e.typeId}:${e.id}`} value={`${e.typeId}:${e.id}`}>{contentType(e.typeId).label}: {contentType(e.typeId).titleOf(e.publishedBody ?? e.body)}</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-1 text-xs"><Checkbox aria-label={`Step ${i + 1} required`} checked={step.required} onCheckedChange={(v) => onChange(steps.map((s, n) => (i === n ? { ...s, required: v === true } : s)))} />Required</label><Button variant="ghost" size="icon" aria-label="Remove step" onClick={() => onChange(steps.filter((_, n) => i !== n))}><Trash2 className="size-4" /></Button></div>)}<Button variant="outline" onClick={() => onChange([...steps, { type: "library_lesson", id: "", required: true }])}><Plus className="mr-2 size-4" />Add step</Button></div>;
}
