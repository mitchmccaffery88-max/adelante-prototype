// §Clinical documentation Phase 3a — note template authoring.
//
// A real visual section/field builder (not a JSON textarea): sections are
// added/renamed/reordered, fields get type-appropriate editors, and option
// lists for select/radio/multiselect are edited row by row. Templates are
// deactivated with a reason, never deleted.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, useEhr, type NoteTemplate } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import {
  type FieldType,
  type ScoringRule,
  type TemplateField,
  type TemplateSchema,
  type TemplateSection,
} from "@/lib/templateSchema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { TemplateForm } from "@/components/clinical/TemplateForm";

export const Route = createFileRoute("/admin-note-templates")({
  head: () => ({
    meta: [
      { title: "Note templates — Adelante Admin" },
      {
        name: "description",
        content:
          "Author structured clinical note templates: sections, conditional fields, and scoring rules used by the progress-note editor.",
      },
      { property: "og:title", content: "Note templates — Adelante Admin" },
      {
        property: "og:description",
        content: "Admin authoring for structured clinical documentation templates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminNoteTemplatesPage,
});

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
  { value: "multiselect", label: "Multi-select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date + time" },
];

const HAS_OPTIONS: FieldType[] = ["select", "multiselect", "radio"];

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function AdminNoteTemplatesPage() {
  const { role, staffName } = useActingStaff();
  const access = canAccess(role, "note_templates");
  const canWrite = access.level === "write";
  const templates = useEhr(() => AdelanteEHR.listNoteTemplates(true));

  const [editing, setEditing] = useState<NoteTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<NoteTemplate | null>(null);
  const [reason, setReason] = useState("");

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={Lock}
          title="Not available for your role"
          description="Note template authoring is limited to clinical coordinators and system admins."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="h-3 w-3" /> Admin
          </Link>
          <h1 className="font-display text-2xl text-navy">Note templates</h1>
          <p className="text-sm text-muted-foreground">
            Structured documentation templates offered when a clinician starts a progress note.
          </p>
        </div>
        {canWrite && (
          <Button
            className="bg-navy text-navy-foreground hover:bg-navy/90"
            onClick={() => setCreating(true)}
          >
            <Plus className="mr-1 h-4 w-4" /> New template
          </Button>
        )}
      </header>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Clinicians will use the built-in SOAP structure until a template is published."
        />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-navy">{t.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {t.encounterType}
                  </Badge>
                  {!t.active && (
                    <Badge className="border-0 bg-muted text-[10px] text-muted-foreground">
                      Retired
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  key {t.key} · {t.schema.sections?.length ?? 0} sections ·{" "}
                  {(t.schema.sections ?? []).reduce((n, s) => n + (s.fields?.length ?? 0), 0)} fields
                  {t.schema.scoring?.length ? ` · ${t.schema.scoring.length} scoring rule(s)` : ""}
                </p>
                {!t.active && t.deactivationReason && (
                  <p className="text-[11px] text-muted-foreground">
                    Retired: {t.deactivationReason} — existing notes keep their content.
                  </p>
                )}
              </div>
              {canWrite && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                  {t.active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDeactivating(t);
                        setReason("");
                      }}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        AdelanteEHR.setNoteTemplateActive(t.id, true, staffName);
                        toast.success("Template reactivated");
                      }}
                    >
                      Reactivate
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <TemplateBuilderDialog
          template={editing}
          staffName={staffName}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <Dialog open={Boolean(deactivating)} onOpenChange={(o) => !o && setDeactivating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate template</DialogTitle>
            <DialogDescription>
              The template stops being offered for new notes. Notes already written against it keep
              their questions and answers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason (required)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                try {
                  AdelanteEHR.setNoteTemplateActive(deactivating!.id, false, staffName, reason);
                  toast.success("Template deactivated");
                  setDeactivating(null);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual builder
// ---------------------------------------------------------------------------

function TemplateBuilderDialog({
  template,
  staffName,
  onClose,
}: {
  template: NoteTemplate | null;
  staffName: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(template?.title ?? "");
  const [key, setKey] = useState(template?.key ?? "");
  const [encounterType, setEncounterType] = useState(template?.encounterType ?? "general");
  const [sections, setSections] = useState<TemplateSection[]>(
    template?.schema.sections?.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f })) })) ?? [],
  );
  const [scoring, setScoring] = useState<ScoringRule[]>(
    template?.schema.scoring?.map((r) => ({ ...r, sum_of: [...r.sum_of] })) ?? [],
  );
  const [preview, setPreview] = useState<Record<string, never> | Record<string, unknown>>({});

  const schema: TemplateSchema = { sections, scoring: scoring.length ? scoring : undefined };

  const updateSection = (i: number, patch: Partial<TemplateSection>) =>
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const updateField = (si: number, fi: number, patch: Partial<TemplateField>) =>
    setSections((prev) =>
      prev.map((s, idx) =>
        idx === si
          ? { ...s, fields: s.fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)) }
          : s,
      ),
    );

  const save = () => {
    try {
      if (template) {
        AdelanteEHR.updateNoteTemplate(template.id, { title, encounterType, schema }, staffName);
        toast.success("Template updated");
      } else {
        AdelanteEHR.createNoteTemplate(
          { key: key.trim() || slug(title), title, encounterType, schema },
          staffName,
        );
        toast.success("Template created");
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            Build sections and fields. `show_if` accepts simple expressions like{" "}
            <code>substance_use == "yes" && phq2_total &gt;= 3</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Key</Label>
            <Input
              value={key}
              disabled={Boolean(template)}
              placeholder={slug(title) || "bh_intake"}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Encounter type</Label>
            <Input
              value={encounterType}
              onChange={(e) => setEncounterType(e.target.value)}
              placeholder="intake, follow_up, group…"
            />
          </div>
        </div>

        <div className="space-y-3">
          {sections.map((section, si) => (
            <Card key={section.id} className="space-y-3 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <Label className="text-xs">Section title</Label>
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(si, { title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Show if (optional)</Label>
                  <Input
                    value={section.show_if ?? ""}
                    onChange={(e) => updateSection(si, { show_if: e.target.value || undefined })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove section"
                  className="self-end"
                  onClick={() => setSections((p) => p.filter((_, idx) => idx !== si))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {section.fields.map((field, fi) => (
                  <div key={fi} className="space-y-2 rounded-md border border-border p-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">Label</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => {
                            const label = e.target.value;
                            updateField(si, fi, {
                              label,
                              key: field.key || slug(label),
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">Key</Label>
                        <Input
                          value={field.key}
                          onChange={(e) => updateField(si, fi, { key: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(v) => updateField(si, fi, { type: v as FieldType })}
                        >
                          <SelectTrigger aria-label="Field type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove field"
                        className="self-end"
                        onClick={() =>
                          updateSection(si, {
                            fields: section.fields.filter((_, j) => j !== fi),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">Show if (optional)</Label>
                        <Input
                          value={field.show_if ?? ""}
                          onChange={(e) =>
                            updateField(si, fi, { show_if: e.target.value || undefined })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">Help text (optional)</Label>
                        <Input
                          value={field.help ?? ""}
                          onChange={(e) => updateField(si, fi, { help: e.target.value || undefined })}
                        />
                      </div>
                    </div>

                    {/* ADEL SEAM: authors may annotate a field's intent for the
                        future AI-drafting layer (see Agentic AI Adel Scaffolding
                        in ClickUp). This is authoring metadata only — no
                        consumer exists and no AI-fill UI is built against it. */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">AI hint (optional, unused today)</Label>
                      <Input
                        value={field.ai_hint ?? ""}
                        onChange={(e) =>
                          updateField(si, fi, { ai_hint: e.target.value || undefined })
                        }
                      />
                    </div>

                    {field.type === "number" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-[11px]">Min</Label>
                          <Input
                            type="number"
                            value={field.min ?? ""}
                            onChange={(e) =>
                              updateField(si, fi, {
                                min: e.target.value === "" ? undefined : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px]">Max</Label>
                          <Input
                            type="number"
                            value={field.max ?? ""}
                            onChange={(e) =>
                              updateField(si, fi, {
                                max: e.target.value === "" ? undefined : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {field.type === "textarea" && (
                      <div className="space-y-1.5 sm:w-40">
                        <Label className="text-[11px]">Rows</Label>
                        <Input
                          type="number"
                          value={field.rows ?? 3}
                          onChange={(e) => updateField(si, fi, { rows: Number(e.target.value) })}
                        />
                      </div>
                    )}

                    {HAS_OPTIONS.includes(field.type) && (
                      <OptionsEditor
                        field={field}
                        onChange={(options) => updateField(si, fi, { options })}
                      />
                    )}

                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Checkbox
                        checked={Boolean(field.required)}
                        aria-label={`${field.label || "Field"} required`}
                        onCheckedChange={(v) => updateField(si, fi, { required: Boolean(v) })}
                      />
                      <span>Required — blocks signing while unanswered</span>
                    </label>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateSection(si, {
                      fields: [
                        ...section.fields,
                        { key: `field_${section.fields.length + 1}`, type: "text", label: "" },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add field
                </Button>
              </div>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setSections((p) => [
                ...p,
                { id: `section_${p.length + 1}`, title: `Section ${p.length + 1}`, fields: [] },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add section
          </Button>
        </div>

        <ScoringEditor rules={scoring} onChange={setScoring} />

        <div className="space-y-2 rounded-md border border-border p-3">
          <h4 className="font-display text-sm text-navy">Live preview</h4>
          <TemplateForm
            schema={schema}
            answers={preview as Record<string, never>}
            onChange={(a) => setPreview(a)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-navy text-navy-foreground hover:bg-navy/90" onClick={save}>
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionsEditor({
  field,
  onChange,
}: {
  field: TemplateField;
  onChange: (options: TemplateField["options"]) => void;
}) {
  const options = field.options ?? [];
  return (
    <div className="space-y-2">
      <Label className="text-[11px]">Options</Label>
      {options.map((o, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
          <Input
            value={o.label}
            placeholder="Label"
            onChange={(e) =>
              onChange(
                options.map((x, j) =>
                  j === i ? { ...x, label: e.target.value, value: x.value || slug(e.target.value) } : x,
                ),
              )
            }
          />
          <Input
            value={o.value}
            placeholder="Value"
            onChange={(e) =>
              onChange(options.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
            }
          />
          <Input
            type="number"
            value={o.score ?? ""}
            placeholder="Score"
            onChange={(e) =>
              onChange(
                options.map((x, j) =>
                  j === i
                    ? { ...x, score: e.target.value === "" ? undefined : Number(e.target.value) }
                    : x,
                ),
              )
            }
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove option"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...options, { value: "", label: "" }])}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add option
      </Button>
    </div>
  );
}

function ScoringEditor({
  rules,
  onChange,
}: {
  rules: ScoringRule[];
  onChange: (rules: ScoringRule[]) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <h4 className="font-display text-sm text-navy">Scoring rules</h4>
      {rules.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input
            value={r.label}
            placeholder="Label"
            onChange={(e) =>
              onChange(
                rules.map((x, j) =>
                  j === i ? { ...x, label: e.target.value, id: x.id || slug(e.target.value) } : x,
                ),
              )
            }
          />
          <Input
            value={r.id}
            placeholder="Rule id"
            onChange={(e) => onChange(rules.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))}
          />
          <Input
            value={r.sum_of.join(", ")}
            placeholder="field keys, comma separated"
            onChange={(e) =>
              onChange(
                rules.map((x, j) =>
                  j === i
                    ? {
                        ...x,
                        sum_of: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }
                    : x,
                ),
              )
            }
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove scoring rule"
            onClick={() => onChange(rules.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...rules, { id: "", label: "", sum_of: [] }])}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add scoring rule
      </Button>
    </div>
  );
}