// §Clinical documentation Phase 3a — note-template schema engine.
//
// Port of BaggaEMR's templateSchema.ts. Two properties matter here and are
// deliberately preserved:
//   1. `show_if` expressions are parsed by a hand-written tokenizer +
//      recursive-descent parser. This is NOT `eval()` / `new Function()` and
//      must never become one — template text is authored data that renders in
//      a clinical context, so it must not be able to execute arbitrary code.
//   2. A score whose inputs are incomplete is reported as incomplete, never as
//      a smaller-but-plausible total.

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "date"
  | "datetime";

export interface TemplateFieldOption {
  value: string;
  label: string;
  /**
   * Optional Spanish display label. `value` is the STORED answer and never
   * localizes — only the display text does — so adding this is structurally
   * safe for scoring, `show_if` and existing answers.
   */
  labelEs?: string;
  /** Optional numeric weight used by scoring rules. */
  score?: number;
}

export interface TemplateField {
  key: string;
  type: FieldType;
  label: string;
  /** Optional Spanish label. Falls back to `label` when absent — never blank. */
  labelEs?: string;
  required?: boolean;
  options?: TemplateFieldOption[];
  /** Conditional visibility expression, e.g. `risk == "yes" && phq9 >= 10`. */
  show_if?: string;
  help?: string;
  /** Optional Spanish help text. Falls back to `help` when absent. */
  helpEs?: string;
  min?: number;
  max?: number;
  rows?: number;
  /**
   * ADEL SEAM: this field is read by the future AI-drafting layer (see Agentic
   * AI Adel Scaffolding in ClickUp) to know what a field is asking for. No
   * consumer exists yet — do not build AI-fill UI against this field.
   */
  ai_hint?: string;
}

/**
 * §Clinical documentation Phase 3b — a template-authored medication quick pick.
 *
 * This converts into a DRAFT `MedOrder` using Adelante's real order model, not
 * a generic cart item. Everything here is a STARTING POINT: the resulting draft
 * still goes through `validateOrder` before it can be signed, exactly like an
 * order staged from the Orders tab.
 */
export interface QuickPickMed {
  id: string;
  /** Chip label. Defaults to `drugName` when blank. */
  label?: string;
  drugName: string;
  dose?: string;
  route?: string;
  /** Frequency catalog code, e.g. "BID". Same field the Orders tab writes. */
  frequencyCode?: string;
  isStat?: boolean;
  isKop?: boolean;
  isControlled?: boolean;
  deaSchedule?: "CII" | "CIII" | "CIV" | "CV";
  indicationText?: string;
}

/** Template-authored referral quick pick → draft `Referral`. */
export interface QuickPickReferral {
  id: string;
  label?: string;
  referringAgency: string;
  referrerName?: string;
  referrerEmail?: string;
  referrerPhone?: string;
  /** Matches `Referral.referralSource`; free string here to avoid a type cycle. */
  referralSource?: string;
  countyOfRelease?: string;
}

/**
 * Autofill sources Adelante can ACTUALLY resolve today.
 *
 * STANDING GAP — deliberately absent: `vitals_last`, `vitals_recent` and
 * `labs_recent`. Vitals and labs do not exist as entities in this EHR at all,
 * so there is no data source behind them. They are left out of the type rather
 * than added as no-ops, so no UI can ever be wired against a source that can
 * never return data.
 */
export type AutofillSource =
  | "medications_active"
  | "allergies"
  | "problems_active"
  | "mar_last_24h"
  | "last_note_summary";

export interface AutofillConfig {
  source: AutofillSource;
  /** Trailing window for `mar_last_24h`. Defaults to 24. */
  hours?: number;
  /** Max rows rendered. Unset = all. */
  limit?: number;
  /** `medications_active` only: include PRN orders. Defaults to true. */
  includePrn?: boolean;
}

export type SectionType = "fields" | "orders_section" | "autofill_section";

export interface TemplateSection {
  id: string;
  title: string;
  /** Optional Spanish section title. Falls back to `title` when absent. */
  titleEs?: string;
  show_if?: string;
  /** Defaults to "fields" when absent (every 3a template). */
  type?: SectionType;
  fields: TemplateField[];
  /**
   * orders_section only. Deliberately NOT labs/nursing — those are not
   * fulfillable entities in Adelante, so no allow flag exists for them.
   */
  allow?: { meds?: boolean; referrals?: boolean };
  /** orders_section only. */
  quick_picks?: { meds?: QuickPickMed[]; referrals?: QuickPickReferral[] };
  /** autofill_section only. */
  autofill?: AutofillConfig;
}

/** A section that carries answerable fields. Only these gate note-signing. */
export function isFieldsSection(section: TemplateSection): boolean {
  return (section.type ?? "fields") === "fields";
}

/** One rendered row of an autofill card. */
export interface AutofillLine {
  primary: string;
  secondary?: string;
}

/**
 * Resolved autofill content, SNAPSHOTTED into the note the same way template
 * answers are. A historical note shows what was true at signing time, never a
 * live re-computation.
 */
export interface AutofillSnapshot {
  sectionId: string;
  title: string;
  source: AutofillSource;
  /** ISO instant the content was resolved. */
  resolvedAt: string;
  lines: AutofillLine[];
  /** Consent/empty-state notice, e.g. the 42 CFR Part 2 mask. */
  notice?: string;
}

export interface ScoringBand {
  min: number;
  max: number;
  label: string;
}

export interface ScoringRule {
  id: string;
  label: string;
  /** Field keys whose numeric (or option-weighted) answers are summed. */
  sum_of: string[];
  bands?: ScoringBand[];
}

export interface TemplateSchema {
  sections: TemplateSection[];
  scoring?: ScoringRule[];
  /**
   * Spanish translations in this schema have passed clinical review.
   * Undefined / false = draft. This mirrors the Refusal form's risk-text
   * treatment: it is a VISIBILITY flag, not a hard gate — clinicians may still
   * use a draft translation, they just must not mistake it for approved
   * clinical language.
   */
  esReviewed?: boolean;
}

// ---------------------------------------------------------------------------
// Localization
//
// There is no global app-language toggle in this codebase. The single source
// of truth for a person's language is `Patient.preferredLanguage`, which is
// exactly what the Refusal risk text reads (see ehr.ts → riskTextFor). These
// helpers take that resolved language and apply English fallback, so a missing
// translation degrades to English and NEVER renders blank.
// ---------------------------------------------------------------------------

export type TemplateLanguage = "en" | "es";

/** English always wins over nothing. */
function pick(es: string | undefined, en: string, lang: TemplateLanguage): string {
  if (lang !== "es") return en;
  const t = (es ?? "").trim();
  return t || en;
}

export function fieldLabel(field: TemplateField, lang: TemplateLanguage): string {
  return pick(field.labelEs, field.label, lang);
}

export function fieldHelp(field: TemplateField, lang: TemplateLanguage): string | undefined {
  if (lang !== "es") return field.help;
  const t = (field.helpEs ?? "").trim();
  return t || field.help;
}

export function sectionTitle(section: TemplateSection, lang: TemplateLanguage): string {
  return pick(section.titleEs, section.title, lang);
}

export function optionLabel(option: TemplateFieldOption, lang: TemplateLanguage): string {
  return pick(option.labelEs, option.label, lang);
}

/** True when the schema carries ANY Spanish label/help/title text. */
export function schemaHasSpanish(schema: TemplateSchema | undefined): boolean {
  for (const s of schema?.sections ?? []) {
    if ((s.titleEs ?? "").trim()) return true;
    for (const f of s.fields ?? []) {
      if ((f.labelEs ?? "").trim()) return true;
      if ((f.helpEs ?? "").trim()) return true;
      for (const o of f.options ?? []) if ((o.labelEs ?? "").trim()) return true;
    }
  }
  return false;
}

/** Spanish content exists but has not been clinically reviewed. */
export function spanishReviewPending(schema: TemplateSchema | undefined): boolean {
  return schemaHasSpanish(schema) && !schema?.esReviewed;
}

/** Draft-translation notice, mirroring the Refusal form's wording. */
export const ES_DRAFT_NOTICE_ES = "Borrador — pendiente de revisión clínica";
export const ES_DRAFT_NOTICE_EN = "Spanish translation pending clinical review";

/**
 * Schema equality for VERSIONING purposes. `esReviewed` is a review-status
 * flag, not answer semantics, so flipping it must not publish a new version
 * (translated text changes still do).
 */
export function schemaContentEquals(a: TemplateSchema, b: TemplateSchema): boolean {
  const strip = ({ esReviewed: _ignored, ...rest }: TemplateSchema) => rest;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

export type AnswerValue = string | number | boolean | string[] | null | undefined;
export type TemplateAnswers = Record<string, AnswerValue>;

// ---------------------------------------------------------------------------
// Expression evaluator (no eval)
// ---------------------------------------------------------------------------

type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "lparen" }
  | { t: "rparen" };

const OPERATORS = ["==", "!=", ">=", "<=", "&&", "||", ">", "<"];

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ t: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ t: "rparen" });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== quote) {
        if (src[j] === "\\" && j + 1 < src.length) {
          s += src[j + 1];
          j += 2;
          continue;
        }
        s += src[j];
        j++;
      }
      if (j >= src.length) throw new Error("Unterminated string in expression.");
      out.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    const two = src.slice(i, i + 2);
    const op = OPERATORS.find((o) => (o.length === 2 ? o === two : o === c));
    if (op) {
      out.push({ t: "op", v: op });
      i += op.length;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++;
      out.push({ t: "num", v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j]!)) j++;
      const word = src.slice(i, j);
      if (word === "true" || word === "false") out.push({ t: "bool", v: word === "true" });
      else out.push({ t: "ident", v: word });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character "${c}" in expression.`);
  }
  return out;
}

function truthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return Boolean(v);
}

function compare(op: string, a: unknown, b: unknown): boolean {
  if (op === "==" || op === "!=") {
    let eq: boolean;
    if (Array.isArray(a)) eq = a.map(String).includes(String(b));
    else if (typeof a === "number" || typeof b === "number") eq = Number(a) === Number(b);
    else if (typeof a === "boolean" || typeof b === "boolean") eq = Boolean(a) === Boolean(b);
    else eq = String(a ?? "") === String(b ?? "");
    return op === "==" ? eq : !eq;
  }
  const x = Number(a);
  const y = Number(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return false;
  if (op === ">") return x > y;
  if (op === "<") return x < y;
  if (op === ">=") return x >= y;
  if (op === "<=") return x <= y;
  return false;
}

/**
 * Evaluate a `show_if` expression against the current answers.
 * Grammar (lowest → highest precedence): `||`, `&&`, comparison, primary.
 */
export function evalExpr(expr: string | undefined, answers: TemplateAnswers): boolean {
  if (!expr || !expr.trim()) return true;
  let tokens: Token[];
  try {
    tokens = tokenize(expr);
  } catch {
    // A malformed author expression must not hide a field silently.
    return true;
  }
  let pos = 0;
  const peek = () => tokens[pos];

  function parsePrimary(): unknown {
    const tk = peek();
    if (!tk) throw new Error("Unexpected end of expression.");
    if (tk.t === "lparen") {
      pos++;
      const v = parseOr();
      const close = peek();
      if (!close || close.t !== "rparen") throw new Error("Missing closing parenthesis.");
      pos++;
      return v;
    }
    if (tk.t === "op" && tk.v === "!") {
      pos++;
      return !truthy(parsePrimary());
    }
    pos++;
    if (tk.t === "num") return tk.v;
    if (tk.t === "str") return tk.v;
    if (tk.t === "bool") return tk.v;
    if (tk.t === "ident") return answers[tk.v];
    throw new Error("Unexpected token in expression.");
  }

  function parseComparison(): unknown {
    let left = parsePrimary();
    for (;;) {
      const tk = peek();
      if (tk && tk.t === "op" && ["==", "!=", ">", "<", ">=", "<="].includes(tk.v)) {
        pos++;
        const right = parsePrimary();
        left = compare(tk.v, left, right);
        continue;
      }
      return left;
    }
  }

  function parseAnd(): unknown {
    let left = parseComparison();
    for (;;) {
      const tk = peek();
      if (tk && tk.t === "op" && tk.v === "&&") {
        pos++;
        const right = parseComparison();
        left = truthy(left) && truthy(right);
        continue;
      }
      return left;
    }
  }

  function parseOr(): unknown {
    let left = parseAnd();
    for (;;) {
      const tk = peek();
      if (tk && tk.t === "op" && tk.v === "||") {
        pos++;
        const right = parseAnd();
        left = truthy(left) || truthy(right);
        continue;
      }
      return left;
    }
  }

  try {
    const result = parseOr();
    if (pos !== tokens.length) return true;
    return truthy(result);
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Visibility, required-field gating, scoring
// ---------------------------------------------------------------------------

export function isSectionVisible(section: TemplateSection, answers: TemplateAnswers): boolean {
  return evalExpr(section.show_if, answers);
}

export function isFieldVisible(field: TemplateField, answers: TemplateAnswers): boolean {
  return evalExpr(field.show_if, answers);
}

export function isAnswered(v: AnswerValue): boolean {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  return true; // booleans: an explicit false is an answer
}

export interface MissingField {
  sectionId: string;
  sectionTitle: string;
  key: string;
  label: string;
}

/**
 * Required fields that are visible under the current answers and unanswered.
 * Hidden (show_if false) fields are never required — that is the whole point
 * of conditional sections.
 */
export function findMissingRequired(
  schema: TemplateSchema | undefined,
  answers: TemplateAnswers,
): MissingField[] {
  if (!schema) return [];
  const out: MissingField[] = [];
  for (const section of schema.sections ?? []) {
    // Orders/autofill sections carry no answerable fields and are exempt from
    // the note's own required-field enforcement — order validation is its own
    // separate gate (validateOrder), and autofill is read-only.
    if (!isFieldsSection(section)) continue;
    if (!isSectionVisible(section, answers)) continue;
    for (const field of section.fields ?? []) {
      if (!field.required) continue;
      if (!isFieldVisible(field, answers)) continue;
      // A required checkbox means "must be ticked", not "must be touched".
      const v = answers[field.key];
      const ok = field.type === "checkbox" ? v === true : isAnswered(v);
      if (!ok) {
        out.push({
          sectionId: section.id,
          sectionTitle: section.title,
          key: field.key,
          label: field.label,
        });
      }
    }
  }
  return out;
}

export interface ScoreResult {
  id: string;
  label: string;
  total: number;
  /** True when one or more summed inputs are unanswered or non-numeric. */
  incomplete: boolean;
  missingKeys: string[];
  band?: string;
}

function numericValueFor(
  key: string,
  answers: TemplateAnswers,
  schema: TemplateSchema,
): number | null {
  const raw = answers[key];
  if (!isAnswered(raw)) return null;
  if (typeof raw === "number") return raw;
  if (typeof raw === "boolean") return raw ? 1 : 0;
  const field = schema.sections
    ?.flatMap((s) => s.fields ?? [])
    .find((f) => f.key === key);
  const values = Array.isArray(raw) ? raw : [String(raw)];
  let sum = 0;
  for (const v of values) {
    const opt = field?.options?.find((o) => o.value === v);
    if (opt && typeof opt.score === "number") {
      sum += opt.score;
      continue;
    }
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    sum += n;
  }
  return sum;
}

/**
 * Sum each scoring rule. Missing inputs do NOT silently lower the total — the
 * rule is flagged incomplete so the UI can tell the clinician not to rely on it.
 */
export function computeScore(
  schema: TemplateSchema | undefined,
  answers: TemplateAnswers,
): ScoreResult[] {
  if (!schema?.scoring?.length) return [];
  return schema.scoring.map((rule) => {
    let total = 0;
    const missingKeys: string[] = [];
    for (const key of rule.sum_of ?? []) {
      const n = numericValueFor(key, answers, schema);
      if (n === null) {
        missingKeys.push(key);
        continue;
      }
      total += n;
    }
    const incomplete = missingKeys.length > 0;
    const band = incomplete
      ? undefined
      : rule.bands?.find((b) => total >= b.min && total <= b.max)?.label;
    return { id: rule.id, label: rule.label, total, incomplete, missingKeys, band };
  });
}

export interface RequiredFieldSummary {
  /**
   * Required fields that are visible against an EMPTY answer set — exactly the
   * set `findMissingRequired(schema, {})` reports. This is the number a
   * clinician sees before answering anything.
   */
  baseline: number;
  /**
   * Required fields gated behind a `show_if` (on the field or its section).
   * These may or may not appear depending on answers, so the baseline count is
   * a floor, not a total. Surfaced separately rather than folded in.
   */
  conditional: number;
}

/**
 * Count required fields for a template picker. Keeps the same semantics as
 * `findMissingRequired` against `{}` so the displayed number can never disagree
 * with the gate that actually blocks signing.
 */
export function requiredFieldSummary(schema: TemplateSchema | undefined): RequiredFieldSummary {
  if (!schema) return { baseline: 0, conditional: 0 };
  const baseline = findMissingRequired(schema, {}).length;
  let conditional = 0;
  for (const section of schema.sections ?? []) {
    if (!isFieldsSection(section)) continue;
    for (const field of section.fields ?? []) {
      if (!field.required) continue;
      const gated = Boolean(section.show_if?.trim()) || Boolean(field.show_if?.trim());
      if (!gated) continue;
      conditional++;
    }
  }
  return { baseline, conditional };
}

/** The fixed SOAP structure used when no template is selected/exists. */
export const DEFAULT_SOAP_SCHEMA: TemplateSchema = {
  sections: [
    {
      id: "soap",
      title: "SOAP",
      fields: [
        { key: "subjective", type: "textarea", label: "Subjective", required: true, rows: 3 },
        { key: "objective", type: "textarea", label: "Objective", rows: 3 },
        { key: "assessment", type: "textarea", label: "Assessment", rows: 3 },
        { key: "plan", type: "textarea", label: "Plan", rows: 3 },
      ],
    },
  ],
};