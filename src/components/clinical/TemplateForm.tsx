// §Clinical documentation Phase 3a — template renderer.
//
// Port of BaggaEMR's TemplateForm.tsx: renders all 8 field types, groups by
// section, gates visibility with `show_if`, and shows scoring with an explicit
// "incomplete score" warning.
//
// ADEL SEAM: TemplateField.ai_hint is intentionally NOT rendered anywhere in
// this file. The field is read by the future AI-drafting layer (see Agentic AI
// Adel Scaffolding in ClickUp) to know what a field is asking for. No consumer
// exists yet — do not build AI-fill UI here.
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import {
  computeScore,
  ES_DRAFT_NOTICE_EN,
  ES_DRAFT_NOTICE_ES,
  fieldHelp,
  fieldLabel,
  isFieldVisible,
  isSectionVisible,
  optionLabel,
  sectionTitle,
  spanishReviewPending,
  type AnswerValue,
  type TemplateAnswers,
  type TemplateField,
  type TemplateLanguage,
  type TemplateSchema,
} from "@/lib/templateSchema";

interface Props {
  schema: TemplateSchema;
  answers: TemplateAnswers;
  onChange: (answers: TemplateAnswers) => void;
  readOnly?: boolean;
  /** Field keys to highlight as missing (from findMissingRequired). */
  missingKeys?: string[];
  /**
   * Display language. Resolved by the caller from `Patient.preferredLanguage`
   * — the same source of truth the Refusal risk text uses. Defaults to English,
   * so existing English-only rendering is unchanged.
   */
  language?: TemplateLanguage;
}

export function TemplateForm({
  schema,
  answers,
  onChange,
  readOnly,
  missingKeys = [],
  language = "en",
}: Props) {
  const set = (key: string, value: AnswerValue) => onChange({ ...answers, [key]: value });
  const scores = computeScore(schema, answers);
  // Draft-translation visibility flag, mirroring the Refusal risk text. Not a
  // gate — the form stays fully usable.
  const esDraft = language === "es" && spanishReviewPending(schema);

  return (
    <div className="space-y-5">
      {esDraft && (
        <p
          data-testid="template-es-draft-banner"
          className="flex items-start gap-1.5 rounded-md border border-gold/50 bg-gold/15 p-2 text-[11px] text-navy"
        >
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {ES_DRAFT_NOTICE_ES} · {ES_DRAFT_NOTICE_EN}
          </span>
        </p>
      )}
      {(schema.sections ?? [])
        .filter((s) => isSectionVisible(s, answers))
        .map((section) => (
          <section key={section.id} className="space-y-3">
            <h5 className="font-display text-sm text-navy">{sectionTitle(section, language)}</h5>
            {(section.fields ?? [])
              .filter((f) => isFieldVisible(f, answers))
              .map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={answers[field.key]}
                  onChange={(v) => set(field.key, v)}
                  readOnly={readOnly}
                  missing={missingKeys.includes(field.key)}
                  language={language}
                />
              ))}
          </section>
        ))}

      {scores.length > 0 && (
        <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
          {scores.map((s) => (
            <div key={s.id} data-testid={`score-${s.id}`} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-navy">{s.label}</span>
                <span className="text-navy">
                  {s.total}
                  {s.band ? ` · ${s.band}` : ""}
                </span>
              </div>
              {s.incomplete && (
                <p className="mt-1 flex items-start gap-1.5 text-[11px] text-destructive">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    Incomplete score — do not rely on this total. Missing:{" "}
                    {s.missingKeys.join(", ")}.
                  </span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  readOnly,
  missing,
  language,
}: {
  field: TemplateField;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  readOnly?: boolean;
  missing?: boolean;
  language: TemplateLanguage;
}) {
  const id = `tf-${field.key}`;
  const labelText = fieldLabel(field, language);
  const helpText = fieldHelp(field, language);
  const label = (
    <Label htmlFor={id} className="text-xs">
      {labelText}
      {field.required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
  );

  const selected = Array.isArray(value) ? value : [];

  return (
    <div className={`space-y-1.5 ${missing ? "rounded-md border border-destructive/40 p-2" : ""}`}>
      {label}
      {field.type === "text" && (
        <Input
          id={id}
          disabled={readOnly}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "textarea" && (
        <Textarea
          id={id}
          disabled={readOnly}
          rows={field.rows ?? 3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "number" && (
        <Input
          id={id}
          type="number"
          disabled={readOnly}
          min={field.min}
          max={field.max}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      )}
      {(field.type === "date" || field.type === "datetime") && (
        <Input
          id={id}
          type={field.type === "date" ? "date" : "datetime-local"}
          disabled={readOnly}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "checkbox" && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            id={id}
            disabled={readOnly}
            checked={value === true}
            onCheckedChange={(v) => onChange(Boolean(v))}
            aria-label={labelText}
          />
          <span>{helpText ?? (language === "es" ? "Sí" : "Yes")}</span>
        </label>
      )}
      {field.type === "select" && (
        <Select
          disabled={readOnly}
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={id} aria-label={labelText}>
            <SelectValue placeholder={language === "es" ? "Elegir…" : "Choose…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {optionLabel(o, language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field.type === "radio" && (
        <RadioGroup
          disabled={readOnly}
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
          className="space-y-1"
        >
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-xs">
              <RadioGroupItem value={o.value} id={`${id}-${o.value}`} />
              <span>{optionLabel(o, language)}</span>
            </label>
          ))}
        </RadioGroup>
      )}
      {field.type === "multiselect" && (
        <div className="space-y-1">
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-xs">
              <Checkbox
                disabled={readOnly}
                checked={selected.includes(o.value)}
                aria-label={`${labelText}: ${optionLabel(o, language)}`}
                onCheckedChange={(v) =>
                  onChange(
                    v ? [...selected, o.value] : selected.filter((s) => s !== o.value),
                  )
                }
              />
              <span>{optionLabel(o, language)}</span>
            </label>
          ))}
        </div>
      )}
      {helpText && field.type !== "checkbox" && (
        <p className="text-[10px] text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}