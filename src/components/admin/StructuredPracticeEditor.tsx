import { useActingStaff } from "@/lib/roles";
import { contentVisibleToStaff } from "@/lib/contentStaff";
import { isContentLive } from "@/lib/contentPublishing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { listContent } from "@/lib/contentPublishing";
import { contentType } from "@/lib/contentTypes";
const schemas: Record<string, Record<string, "text" | "number" | "boolean" | "list">> = {
  fields: { label: "text", placeholder: "text", multiline: "boolean", options: "list" },
  columns: { label: "text", hint: "text", suggestions: "list" }, rows: { label: "text" }, incomeRows: { label: "text" },
  bands: { upTo: "number", label: "text", guidance: "text", moves: "list" },
  choices: { label: "text", feedback: "text", good: "boolean" },
  sliders: { label: "text", minLabel: "text", maxLabel: "text" }, senses: { label: "text", count: "number" },
};
export function StructuredFields({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return <div className="space-y-3">{Object.entries(value).filter(([key]) => !["id", "kind", "type"].includes(key)).map(([key, v]) => <div key={key} className="space-y-1"><Label>{key}</Label>
    {typeof v === "number" ? <Input type="number" aria-label={key} value={v} onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })} /> : typeof v === "boolean" ? <Checkbox aria-label={key} checked={v} onCheckedChange={(checked) => onChange({ ...value, [key]: checked === true })} /> : Array.isArray(v) ? <>
      {v.map((row, i) => <div key={i} className="flex gap-2 border-l border-border pl-3">{typeof row === "object" && row !== null ? <StructuredFields value={row} onChange={(next) => onChange({ ...value, [key]: v.map((x, n) => n === i ? next : x) })} /> : <Input aria-label={`${key} ${i + 1}`} value={String(row)} onChange={(e) => onChange({ ...value, [key]: v.map((x, n) => n === i ? e.target.value : x) })} />}<Button variant="ghost" size="icon" aria-label={`Remove ${key}`} onClick={() => onChange({ ...value, [key]: v.filter((_, n) => i !== n) })}><Trash2 className="size-4" /></Button></div>)}
      <Button variant="outline" size="sm" onClick={() => { const schema = schemas[key]; const row = schema ? { id: `${key}-${v.length + 1}`, ...Object.fromEntries(Object.entries(schema).map(([k, type]) => [k, type === "number" ? 0 : type === "boolean" ? false : type === "list" ? [] : ""])) } : ""; onChange({ ...value, [key]: [...v, row] }); }}><Plus className="mr-1 size-4" />Add {key}</Button>
    </> : <Input aria-label={key} value={String(v ?? "")} onChange={(e) => onChange({ ...value, [key]: e.target.value })} />}
  </div>)}</div>;
}
const defaults: Record<string, Record<string, unknown>> = {
  timer: { seconds: 60, prompts: [], closing: "" }, breathing: { inhaleSec: 4, holdSec: 4, exhaleSec: 4, holdAfterSec: 0, cycles: 3 },
  checklist: { intro: "", items: [], closing: "" }, worksheet: { intro: "", fields: [] }, mapper: { intro: "", columns: [] }, calculator: { intro: "", rows: [], incomeRows: [], totalLabel: "", againstLabel: "", closing: "" }, scale: { intro: "", min: 0, max: 10, minLabel: "", maxLabel: "", bands: [] },
};
export function ExerciseEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const c = value && typeof value === "object" ? value as Record<string, unknown> : { type: "breathing", ...defaults.breathing };
  return <div className="space-y-3"><Select value={String(c.type)} onValueChange={(type) => onChange({ type, ...structuredClone(defaults[type]) })}><SelectTrigger aria-label="Exercise kind"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(defaults).map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><StructuredFields value={c} onChange={onChange} /></div>;
}
export function CurriculumEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const steps = Array.isArray(value) ? value as { type: string; id: string; required: boolean }[] : [];
  const { role } = useActingStaff();
  const candidates = listContent().filter((e) => ["library_lesson", "recovery_lesson", "recovery_module", "exercise"].includes(e.typeId) && isContentLive(e) && contentVisibleToStaff(role, e.typeId, e.body));
  return <div className="space-y-3">{steps.map((step, i) => <div key={i} className="flex items-center gap-2"><span>{i + 1}.</span><Select value={`${step.type}:${step.id}`} onValueChange={(v) => { const split = v.indexOf(":"); onChange(steps.map((s, n) => i === n ? { ...s, type: v.slice(0, split), id: v.slice(split + 1) } : s)); }}><SelectTrigger aria-label={`Step ${i + 1} content`}><SelectValue placeholder="Choose published content" /></SelectTrigger><SelectContent>{candidates.map((e) => <SelectItem key={`${e.typeId}:${e.id}`} value={`${e.typeId}:${e.id}`}>{contentType(e.typeId).titleOf(e.publishedBody ?? e.body)}</SelectItem>)}</SelectContent></Select><Checkbox aria-label={`Step ${i + 1} required`} checked={step.required} onCheckedChange={(v) => onChange(steps.map((s, n) => i === n ? { ...s, required: v === true } : s))} /><Button variant="ghost" size="icon" aria-label="Remove step" onClick={() => onChange(steps.filter((_, n) => i !== n))}><Trash2 className="size-4" /></Button></div>)}<Button variant="outline" onClick={() => onChange([...steps, { type: "library_lesson", id: "", required: true }])}><Plus className="mr-2 size-4" />Add step</Button></div>;
}
