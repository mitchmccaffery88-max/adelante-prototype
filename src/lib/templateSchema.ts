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
  | "last_note_summary"
  // §Discharge summary — additive Phase 3b sources. Same contract as the five
  // above: computed at render time, snapshotted at signing, SUD-masked.
  | "booking_release_info"
  | "referrals_open";

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
  /**
   * §Crisis escalation — landing in this band forces a required crisis
   * decision at signing. The signer must escalate or log a reason; the note
   * cannot reach a signed status silently.
   */
  triggersCrisis?: boolean;
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
   * §Clinical documentation Phase 3c — post-sign automations. Absent on every
   * 3a/3b template. See the Automation block below for the scope boundary.
   */
  automations?: Automation[];
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
// §Clinical documentation Phase 3c — post-sign automations
//
// SCOPE BOUNDARY, deliberate: the reference EMR also supports "orders" and
// "order_set" automation actions. Those are NOT ported. Auto-placing a
// medication order with no human confirming that specific order at that
// specific moment is a higher bar than this pass crosses: an automation would
// either have to bypass the dose/justification/off-catalog gate that every
// quick pick still goes through (unsafe), or satisfy it programmatically
// (worse — a machine-authored clinical justification).
//
// Both supported actions create WORK FOR A HUMAN TO REVIEW. Neither one
// modifies the medical record on its own: `schedule_task` puts a task on a
// queue, `start_template` creates an unsigned DRAFT note that a human must
// still author and sign.
// ---------------------------------------------------------------------------

/** Gate on the patient's ACTIVE problem list. Resolved problems never match. */
export interface AutomationProblemGate {
  /** Matches `Problem.category` exactly, e.g. "sud". */
  category?: string;
  /** Any ICD-10 code on an active problem starting with one of these. */
  icd10Prefixes?: string[];
}

export interface AutomationWhen {
  /** `show_if`-style expression over the note's OWN answers. */
  condition?: string;
  requiresActiveProblem?: AutomationProblemGate;
}

export type AutomationPriority = "routine" | "urgent" | "stat";

export type AutomationAction =
  | {
      kind: "schedule_task";
      taskType: string;
      dueInDays: number;
      priority?: AutomationPriority;
    }
  | { kind: "start_template"; templateKey: string; dueInDays?: number };

export interface Automation {
  id: string;
  label: string;
  enabled: boolean;
  when?: AutomationWhen;
  action: AutomationAction;
}

/**
 * The subset of a `Problem` an automation gate reads. Declared structurally so
 * this module stays free of any EHR import — the same reason the expression
 * evaluator takes plain answers rather than a note.
 */
export interface AutomationProblemRef {
  category?: string;
  icd10Code?: string;
}

/** True when at least one ACTIVE problem satisfies the gate. */
export function problemGateMet(
  gate: AutomationProblemGate | undefined,
  activeProblems: AutomationProblemRef[],
): boolean {
  if (!gate) return true;
  const prefixes = (gate.icd10Prefixes ?? []).map((p) => p.trim().toUpperCase()).filter(Boolean);
  const category = gate.category?.trim();
  // An empty gate object constrains nothing.
  if (!category && prefixes.length === 0) return true;
  return activeProblems.some((p) => {
    if (category && p.category !== category) return false;
    if (prefixes.length === 0) return true;
    const code = (p.icd10Code ?? "").trim().toUpperCase();
    if (!code) return false;
    return prefixes.some((prefix) => code.startsWith(prefix));
  });
}

/** Every gate on an automation, evaluated together. */
export function automationApplies(
  automation: Automation,
  answers: TemplateAnswers,
  activeProblems: AutomationProblemRef[],
): boolean {
  if (!automation.enabled) return false;
  if (!evalExpr(automation.when?.condition, answers)) return false;
  return problemGateMet(automation.when?.requiresActiveProblem, activeProblems);
}

/**
 * Enabled automations whose gates are met, in author order. This is the single
 * source of truth behind BOTH the pre-sign "this will also…" summary and the
 * post-sign execution, so the clinician can never be shown one thing and have
 * another happen.
 */
export function plannedAutomations(
  schema: TemplateSchema | undefined,
  answers: TemplateAnswers,
  activeProblems: AutomationProblemRef[] = [],
): Automation[] {
  return (schema?.automations ?? []).filter((a) => automationApplies(a, answers, activeProblems));
}

function dayPhrase(days: number): string {
  if (days === 0) return "due today";
  if (days === 1) return "due in 1 day";
  return `due in ${days} days`;
}

/**
 * Plain-English description of what an automation does, so a template author
 * can sanity-check the configuration without reading the raw expression, and
 * so the clinician's pre-sign summary reads as a sentence.
 */
export function summarizeAutomation(automation: Automation): string {
  const a = automation.action;
  let what: string;
  if (a.kind === "schedule_task") {
    const priority = a.priority && a.priority !== "routine" ? ` (${a.priority})` : "";
    what = `Schedule a "${a.taskType}" task${priority}, ${dayPhrase(a.dueInDays)}`;
  } else {
    const due = a.dueInDays === undefined ? "" : `, ${dayPhrase(a.dueInDays)}`;
    what = `Start a draft "${a.templateKey || "same template"}" note for a clinician to complete${due}`;
  }
  const conditions: string[] = [];
  const cond = automation.when?.condition?.trim();
  if (cond) conditions.push(`when ${cond}`);
  const gate = automation.when?.requiresActiveProblem;
  const prefixes = (gate?.icd10Prefixes ?? []).filter((p) => p.trim());
  if (gate?.category?.trim() || prefixes.length) {
    const parts: string[] = [];
    if (gate?.category?.trim()) parts.push(`category "${gate.category.trim()}"`);
    if (prefixes.length) parts.push(`ICD-10 starting ${prefixes.join(" / ")}`);
    conditions.push(`only if an active problem matches ${parts.join(" and ")}`);
  }
  return conditions.length ? `${what} — ${conditions.join(", ")}.` : `${what}.`;
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
  /**
   * `missing` — required and unanswered (the original behaviour).
   * `invalid` — answered, but the stored value violates a constraint the
   * field itself declares (min/max, option list). Both block signing.
   */
  problem?: "missing" | "invalid";
  /** Human-readable reason, only set for `invalid`. */
  reason?: string;
}

/**
 * Per-type value validation for a field that HAS a value. Returns a reason
 * string when the stored value violates a constraint declared on the field,
 * otherwise null.
 *
 * Deliberately conservative: a field that declares no `min`/`max` and no
 * `options` can never fail here, so nothing becomes stricter unless the
 * template opts in. Values can be written programmatically (autofill, future
 * integrations), so this cannot assume the UI produced them.
 */
function invalidReasonFor(field: TemplateField, v: AnswerValue): string | null {
  switch (field.type) {
    case "number": {
      const n = typeof v === "number" ? v : Number(String(v).trim());
      if (Number.isNaN(n)) return "Must be a number";
      if (typeof field.min === "number" && n < field.min) return `Must be at least ${field.min}`;
      if (typeof field.max === "number" && n > field.max) return `Must be at most ${field.max}`;
      return null;
    }
    case "date":
    case "datetime": {
      const ms = +new Date(String(v));
      if (Number.isNaN(ms)) return "Not a valid date";
      const lo = dateBound(field.min);
      const hi = dateBound(field.max);
      if (lo !== null && ms < lo) return `Must be on or after ${boundLabel(field.min)}`;
      if (hi !== null && ms > hi) return `Must be on or before ${boundLabel(field.max)}`;
      return null;
    }
    case "select":
    case "radio": {
      if (!field.options?.length) return null;
      return field.options.some((o) => o.value === String(v))
        ? null
        : `"${String(v)}" is not one of the allowed choices`;
    }
    case "multiselect": {
      if (!field.options?.length || !Array.isArray(v)) return null;
      const bad = v.map(String).filter((x) => !field.options!.some((o) => o.value === x));
      return bad.length ? `Not allowed choices: ${bad.join(", ")}` : null;
    }
    default:
      return null;
  }
}

/**
 * Date bounds reuse the EXISTING `min`/`max` schema properties rather than
 * inventing new ones. A number is read as a calendar year (e.g. `max: 2026`);
 * an ISO date string is read as that exact instant. No bounds → no date-range
 * check at all.
 */
function dateBound(b: number | string | undefined): number | null {
  if (b === undefined || b === null) return null;
  if (typeof b === "number") {
    // Year bound: min → Jan 1, max → Dec 31 23:59:59.999 handled by caller
    // semantics via the same instant math below.
    return +new Date(Date.UTC(b, 0, 1));
  }
  const ms = +new Date(b);
  return Number.isNaN(ms) ? null : ms;
}

function boundLabel(b: number | string | undefined): string {
  return typeof b === "number" ? String(b) : String(b ?? "");
}

/**
 * Required fields that are visible under the current answers and unanswered.
 * Hidden (show_if false) fields are never required — that is the whole point
 * of conditional sections.
 *
 * ALSO reports fields whose stored value violates the field's own declared
 * constraints. This lives in the same function (not a companion validator) so
 * the signing gate, the missing-field highlight in `TemplateForm`, and the
 * required-count baseline can never disagree with each other.
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
      if (!isFieldVisible(field, answers)) continue;
      // A required checkbox means "must be ticked", not "must be touched".
      const v = answers[field.key];
      const answered = field.type === "checkbox" ? v === true : isAnswered(v);
      if (field.required && !answered) {
        out.push({
          sectionId: section.id,
          sectionTitle: section.title,
          key: field.key,
          label: field.label,
          problem: "missing",
        });
        continue;
      }
      // Value checks apply to any answered field, required or not: an invalid
      // stored value is a defect regardless of who wrote it.
      if (!answered) continue;
      const reason = invalidReasonFor(field, v as AnswerValue);
      if (reason) {
        out.push({
          sectionId: section.id,
          sectionTitle: section.title,
          key: field.key,
          label: field.label,
          problem: "invalid",
          reason,
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
  /** True when the resolved band carries `triggersCrisis`. */
  triggersCrisis?: boolean;
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
    const hit = incomplete ? undefined : rule.bands?.find((b) => total >= b.min && total <= b.max);
    return {
      id: rule.id,
      label: rule.label,
      total,
      incomplete,
      missingKeys,
      band: hit?.label,
      triggersCrisis: hit?.triggersCrisis ? true : undefined,
    };
  });
}

/**
 * Scores whose resolved band demands a crisis decision at signing. An
 * incomplete score never triggers — a partial total is not a clinical finding.
 */
export function crisisTriggeringScores(
  schema: TemplateSchema | undefined,
  answers: TemplateAnswers,
): ScoreResult[] {
  return computeScore(schema, answers).filter((s) => s.triggersCrisis);
}

/** Human-readable trigger detail, e.g. `PHQ-9 total 22 (Severe band)`. */
export function describeCrisisScore(s: ScoreResult): string {
  return `${s.label} total ${s.total}${s.band ? ` (${s.band} band)` : ""}`;
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