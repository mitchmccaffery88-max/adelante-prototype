// §Content Management admin tooling — THE STRUCTURED CRUD FORM.
//
// Driven entirely by the type descriptor's field spec, so the form matches
// each content type's ACTUAL schema (eight-part Library sequence, ten-step
// Recovery sequence with its typed tool flow) instead of being a free-text
// blob. Adding a field to a descriptor adds it here; there is no second place
// to keep in sync.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  ACTIVITY_KINDS,
  emptyActivity,
  readField,
  writeField,
  type ContentField,
  type ContentTypeDescriptor,
  type EditableActivityKind,
  descriptorFields,
} from "@/lib/contentTypes";
import type { ContentBody } from "@/lib/contentPublishing";

function StringListEditor({
  value,
  onChange,
  addLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      {value.map((v, i) => (
        <div key={i} className="flex gap-1.5">
          <Input
            data-testid="list-option"
            value={v}
            onChange={(e) => onChange(value.map((x, n) => (n === i ? e.target.value : x)))}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove option"
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}

/**
 * §Lesson-player Phase D — the repeatable teaching-part editor. Each part is
 * a title + body; an empty list means the lesson keeps its single teaching
 * block, which is what every lesson ships with.
 */
function StagesEditor({
  value,
  onChange,
}: {
  value: { title: string; body: string }[];
  onChange: (next: { title: string; body: string }[]) => void;
}) {
  const set = (i: number, patch: Partial<{ title: string; body: string }>) =>
    onChange(value.map((v, n) => (n === i ? { ...v, ...patch } : v)));
  return (
    <div className="space-y-2" data-testid="stages-editor">
      {value.map((stage, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-border p-3">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              Part {i + 1}
            </Badge>
            <Input
              data-testid="stage-title"
              placeholder="Part title"
              value={stage.title}
              onChange={(e) => set(i, { title: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove part"
              onClick={() => onChange(value.filter((_, n) => n !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            data-testid="stage-body"
            rows={3}
            placeholder="What this part teaches"
            value={stage.body}
            onChange={(e) => set(i, { body: e.target.value })}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { title: "", body: "" }])}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add teaching part
      </Button>
    </div>
  );
}

function ActivityEditor({
  activity,
  onChange,
}: {
  activity: unknown;
  onChange: (next: unknown) => void;
}) {
  const a = (activity && typeof activity === "object" ? activity : {}) as Record<string, unknown>;
  const kind = typeof a["kind"] === "string" ? (a["kind"] as string) : "";
  const editable = ACTIVITY_KINDS.some((k) => k.value === kind);
  const set = (patch: Record<string, unknown>) => onChange({ ...a, ...patch });

  if (kind && !editable) {
    // A baseline lesson may use a richer activity (breathing, sliders,
    // grounding, decision, rate). The form does not understand those, so it
    // carries them through unchanged rather than flattening them.
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-2 text-[10px]">
          {kind}
        </Badge>
        This activity type is not editable in this form and is carried through unchanged. Everything
        else on the lesson can still be edited and published.
      </div>
    );
  }

  const listKey =
    kind === "checklist" ? "items" : kind === "timeline" ? "steps" : kind === "write" ? null : "cards";
  const listValue = listKey && Array.isArray(a[listKey]) ? (a[listKey] as string[]) : [];

  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-testid="activity-editor">
      <div className="space-y-1">
        <Label className="text-xs">Activity type</Label>
        <Select
          value={kind || "checklist"}
          onValueChange={(v) => onChange(emptyActivity(v as EditableActivityKind))}
        >
          <SelectTrigger data-testid="activity-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {kind !== "checklist" && kind !== "sort" && (
        <div className="space-y-1">
          <Label className="text-xs">Activity title</Label>
          <Input
            value={typeof a["title"] === "string" ? (a["title"] as string) : ""}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Prompt</Label>
        <Textarea
          rows={2}
          data-testid="activity-prompt"
          value={typeof a["prompt"] === "string" ? (a["prompt"] as string) : ""}
          onChange={(e) => set({ prompt: e.target.value })}
        />
      </div>
      {kind === "sort" && (
        <div className="space-y-1">
          <Label className="text-xs">Buckets</Label>
          <StringListEditor
            value={Array.isArray(a["buckets"]) ? (a["buckets"] as string[]) : []}
            onChange={(buckets) => set({ buckets })}
            addLabel="Add bucket"
          />
        </div>
      )}
      {kind === "write" && (
        <div className="space-y-1">
          <Label className="text-xs">Lines of space</Label>
          <Input
            type="number"
            value={typeof a["lines"] === "number" ? (a["lines"] as number) : 4}
            onChange={(e) => set({ lines: Number(e.target.value) })}
          />
        </div>
      )}
      {listKey && (
        <div className="space-y-1">
          <Label className="text-xs">Options</Label>
          <StringListEditor
            value={listValue}
            onChange={(next) => set({ [listKey]: next })}
            addLabel="Add option"
          />
        </div>
      )}
    </div>
  );
}

function FieldEditor({
  field,
  body,
  onChange,
}: {
  field: ContentField;
  body: ContentBody;
  onChange: (next: ContentBody) => void;
}) {
  const value = readField(body, field.key);
  const set = (v: unknown) => onChange(writeField(body, field.key, v));
  // Associate the label with its control, so clicking the label focuses the
  // field and a screen reader announces the two together.
  const fieldId = `field-${field.key}`;
  const helpId = field.help ? `${fieldId}-help` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="flex flex-wrap items-center gap-2 text-xs">
        {field.step && (
          <Badge variant="outline" className="text-[10px]">
            Step {field.step}
          </Badge>
        )}
        <span className="font-medium text-navy">{field.label}</span>
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      {field.help && (
        <p id={helpId} className="text-[11px] text-muted-foreground">
          {field.help}
        </p>
      )}
      {field.kind === "text" && (
        <Input
          id={fieldId}
          aria-describedby={helpId}
          data-testid={`field-${field.key}`}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value)}
        />
      )}
      {field.kind === "textarea" && (
        <Textarea
          id={fieldId}
          aria-describedby={helpId}
          data-testid={`field-${field.key}`}
          rows={field.rows ?? 3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value)}
        />
      )}
      {field.kind === "number" && (
        <Input
          id={fieldId}
          aria-describedby={helpId}
          data-testid={`field-${field.key}`}
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => set(Number(e.target.value))}
        />
      )}
      {field.kind === "select" && (
        <Select value={typeof value === "string" ? value : ""} onValueChange={(v) => set(v)}>
          <SelectTrigger id={fieldId} aria-describedby={helpId} data-testid={`field-${field.key}`}>
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field.kind === "list" && (
        <StringListEditor
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(next) => set(next)}
          addLabel="Add option"
        />
      )}
      {field.kind === "stages" && (
        <StagesEditor
          value={
            Array.isArray(value)
              ? (value as { title?: string; body?: string }[]).map((v) => ({
                  title: typeof v?.title === "string" ? v.title : "",
                  body: typeof v?.body === "string" ? v.body : "",
                }))
              : []
          }
          onChange={(next) => set(next)}
        />
      )}
      {field.kind === "toggle" && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={fieldId}
            aria-describedby={helpId}
            data-testid={`field-${field.key}`}
            checked={value === true}
            onCheckedChange={(v) => set(v === true)}
          />
          <label htmlFor={fieldId} className="text-xs text-muted-foreground">
            {field.label}
          </label>
        </div>
      )}
      {field.kind === "activity" && (
        <ActivityEditor activity={value} onChange={(next) => set(next)} />
      )}
    </div>
  );
}

export function ContentForm({
  descriptor,
  body,
  onChange,
}: {
  descriptor: ContentTypeDescriptor;
  body: ContentBody;
  onChange: (next: ContentBody) => void;
}) {
  return (
    <div className="space-y-4" data-testid="content-form">
      {descriptorFields(descriptor).map((f) => (
        <FieldEditor key={f.key} field={f} body={body} onChange={onChange} />
      ))}
    </div>
  );
}