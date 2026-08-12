// §Content Management admin tooling — THE PER-TYPE DESCRIPTORS.
//
// The lifecycle is shared (`src/lib/contentPublishing.ts`); the SHAPE is not.
// This module is where each managed content type declares its real schema:
// the fields an admin actually fills in, what a valid entry requires, and how
// a hardcoded baseline lesson is loaded into the editor so someone can start
// from the shipped text instead of a blank page.
//
// The field list is a declarative spec, not a free-text blob, precisely
// because these schemas are real: the Library's eight-part instructional
// sequence and the Recovery module's ten-step sequence with its typed tool
// flow are the reason a lesson cannot ship with a missing step. A JSON
// textarea would have thrown that away.
import {
  LIBRARY_CATEGORIES,
  LIBRARY_ITEMS,
  type LibraryActivity,
  type LibraryItem,
} from "@/lib/library";
import { RECOVERY_LESSONS, RECOVERY_MODULES, TOOL_FLOW_LIMITS, type RecoveryLesson } from "@/lib/recovery";
import type { ContentBody, ContentTypeId } from "@/lib/contentPublishing";

export type ContentFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "list"
  | "activity";

export interface ContentField {
  /** Dotted path into the body, e.g. `toolFlow.warningSigns`. */
  key: string;
  label: string;
  kind: ContentFieldKind;
  /** The numbered step this field belongs to, shown in the form. */
  step?: string;
  help?: string;
  required?: boolean;
  rows?: number;
  options?: { value: string; label: string }[];
  /** For `list` fields with a real selection limit (the tool flow has them). */
  max?: number;
}

export interface ContentTypeDescriptor {
  typeId: ContentTypeId;
  label: string;
  /** Plural, for headings. */
  labelPlural: string;
  /** One line explaining what publishing this actually changes for patients. */
  publishEffect: string;
  fields: ContentField[];
  /** Every id that exists as shipped, hardcoded baseline content. */
  baselineIds: () => string[];
  /** The shipped body for an id, so the editor can start from real text. */
  baselineBody: (id: string) => ContentBody | undefined;
  /** A blank body with the type's required structure already in place. */
  emptyBody: () => ContentBody;
  /** Human-readable title for a body, used in lists and the review queue. */
  titleOf: (body: ContentBody) => string;
  /** Real validation. Returns [] when the body may be submitted/published. */
  validate: (body: ContentBody) => string[];
}

// ---------------------------------------------------------------------------
// Dotted-path helpers
// ---------------------------------------------------------------------------

export function readField(body: ContentBody, key: string): unknown {
  return key.split(".").reduce<unknown>(
    (acc, part) => (acc && typeof acc === "object" ? (acc as ContentBody)[part] : undefined),
    body,
  );
}

export function writeField(body: ContentBody, key: string, value: unknown): ContentBody {
  const next = structuredClone(body);
  const parts = key.split(".");
  let cursor = next as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    if (typeof cursor[part] !== "object" || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
  return next;
}

function str(body: ContentBody, key: string): string {
  const v = readField(body, key);
  return typeof v === "string" ? v : "";
}

function list(body: ContentBody, key: string): string[] {
  const v = readField(body, key);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Shared: every required text field must actually carry text. */
function requireText(body: ContentBody, fields: ContentField[]): string[] {
  const errors: string[] = [];
  for (const f of fields) {
    if (!f.required) continue;
    if (f.kind === "number") {
      const v = readField(body, f.key);
      if (typeof v !== "number" || Number.isNaN(v) || v <= 0)
        errors.push(`${f.label} must be a number greater than zero.`);
      continue;
    }
    if (f.kind === "list") {
      if (list(body, f.key).length === 0) errors.push(`${f.label} needs at least one entry.`);
      continue;
    }
    if (f.kind === "activity") continue;
    if (!str(body, f.key).trim()) errors.push(`${f.label} is required.`);
  }
  return errors;
}

/** The activity is a discriminated union — validate the variant that is set. */
export const ACTIVITY_KINDS = [
  { value: "checklist", label: "Checklist" },
  { value: "reflection", label: "Tap-to-select reflection cards" },
  { value: "timeline", label: "Order-the-steps timeline" },
  { value: "sort", label: "Sort into buckets" },
  { value: "write", label: "Write" },
] as const;

export type EditableActivityKind = (typeof ACTIVITY_KINDS)[number]["value"];

export function isEditableActivity(a: unknown): a is LibraryActivity {
  return (
    !!a &&
    typeof a === "object" &&
    ACTIVITY_KINDS.some((k) => k.value === (a as { kind?: string }).kind)
  );
}

export function emptyActivity(kind: EditableActivityKind): LibraryActivity {
  switch (kind) {
    case "checklist":
      return { kind: "checklist", prompt: "", items: [] };
    case "reflection":
      return { kind: "reflection", title: "", prompt: "", cards: [] };
    case "timeline":
      return { kind: "timeline", title: "", prompt: "", steps: [] };
    case "sort":
      return { kind: "sort", prompt: "", buckets: ["", ""], cards: [] };
    case "write":
      return { kind: "write", prompt: "", lines: 4 };
  }
}

function validateActivity(body: ContentBody): string[] {
  const a = readField(body, "activity");
  if (!a || typeof a !== "object") return ["The interactive activity is required."];
  const act = a as Record<string, unknown>;
  const kind = act["kind"];
  if (typeof kind !== "string") return ["Pick an activity type."];
  // Kinds the form cannot edit (breathing, sliders, grounding, decision, rate)
  // are carried through untouched from the baseline rather than being
  // rewritten by a form that does not understand them.
  if (!ACTIVITY_KINDS.some((k) => k.value === kind)) return [];
  const prompt = typeof act["prompt"] === "string" ? act["prompt"].trim() : "";
  if (!prompt) return ["The activity needs a prompt."];
  const arrayKey =
    kind === "checklist" ? "items" : kind === "timeline" ? "steps" : kind === "write" ? null : "cards";
  if (arrayKey) {
    const arr = act[arrayKey];
    if (!Array.isArray(arr) || arr.filter((x) => typeof x === "string" && x.trim()).length < 2)
      return ["The activity needs at least two options."];
  }
  if (kind === "sort") {
    const buckets = act["buckets"];
    if (!Array.isArray(buckets) || buckets.filter((b) => typeof b === "string" && b.trim()).length < 2)
      return ["A sort activity needs at least two buckets."];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Library lesson — the eight-part instructional sequence
// ---------------------------------------------------------------------------

const LIBRARY_FIELDS: ContentField[] = [
  {
    key: "categoryId",
    label: "Category",
    kind: "select",
    required: true,
    options: LIBRARY_CATEGORIES.sort((a, b) => a.order - b.order).map((c) => ({
      value: c.id,
      label: c.name,
    })),
  },
  { key: "title", label: "Lesson title", kind: "text", required: true },
  { key: "minutes", label: "Minutes to read", kind: "number", required: true },
  { key: "order", label: "Order within the category", kind: "number", required: true },
  {
    key: "problem",
    label: "The problem",
    kind: "textarea",
    step: "1",
    required: true,
    rows: 2,
    help: "The lived problem, in the patient's own words.",
  },
  { key: "learnTitle", label: "Teaching headline", kind: "text", step: "3", required: true },
  { key: "learnBody", label: "Teaching block", kind: "textarea", step: "3", required: true, rows: 6 },
  { key: "activity", label: "Interactive activity", kind: "activity", step: "4", required: true },
  {
    key: "adelReflection",
    label: "Adel's reflection",
    kind: "textarea",
    step: "5",
    required: true,
    rows: 3,
  },
  { key: "adelQuestion", label: "Adel's question", kind: "text", step: "5", required: true },
  { key: "insight", label: "The one thing to remember", kind: "textarea", step: "6", required: true, rows: 2 },
  { key: "action", label: "The next action", kind: "text", step: "7", required: true },
  { key: "toolkitLabel", label: "Saves to the toolkit as", kind: "text", step: "8", required: true },
];

export const LIBRARY_LESSON_TYPE: ContentTypeDescriptor = {
  typeId: "library_lesson",
  label: "Library lesson",
  labelPlural: "Library lessons",
  publishEffect:
    "Publishing puts this lesson in the patient Library immediately, inside its category, subject to the same population gate every other lesson uses.",
  fields: LIBRARY_FIELDS,
  baselineIds: () => LIBRARY_ITEMS.map((i) => i.id),
  baselineBody: (id) => {
    const item = LIBRARY_ITEMS.find((i) => i.id === id);
    return item ? (structuredClone(item) as unknown as ContentBody) : undefined;
  },
  emptyBody: () => ({
    id: "",
    categoryId: LIBRARY_CATEGORIES[0]?.id ?? "",
    title: "",
    minutes: 5,
    order: 99,
    problem: "",
    learnTitle: "",
    learnBody: "",
    activity: emptyActivity("checklist"),
    adelReflection: "",
    adelQuestion: "",
    insight: "",
    action: "",
    toolkitLabel: "",
  }),
  titleOf: (b) => str(b, "title") || "(untitled lesson)",
  validate: (b) => {
    const errors = requireText(b, LIBRARY_FIELDS);
    if (!LIBRARY_CATEGORIES.some((c) => c.id === str(b, "categoryId")))
      errors.push("Pick a real library category.");
    return [...errors, ...validateActivity(b)];
  },
};

// ---------------------------------------------------------------------------
// Recovery lesson — the ten-step sequence, including the typed tool flow
// ---------------------------------------------------------------------------

const RECOVERY_FIELDS: ContentField[] = [
  {
    key: "moduleId",
    label: "Module",
    kind: "select",
    required: true,
    options: RECOVERY_MODULES.sort((a, b) => a.order - b.order).map((m) => ({
      value: m.id,
      label: `${m.order}. ${m.name}`,
    })),
  },
  { key: "title", label: "Lesson title", kind: "text", required: true },
  { key: "minutes", label: "Minutes to read", kind: "number", required: true },
  { key: "order", label: "Order within the module", kind: "number", required: true },
  { key: "problem", label: "The problem", kind: "textarea", step: "1", required: true, rows: 2 },
  { key: "checkIn", label: "Check-in question", kind: "textarea", step: "2", required: true, rows: 2 },
  { key: "learnTitle", label: "Teaching headline", kind: "text", step: "3", required: true },
  { key: "learnBody", label: "Teaching block", kind: "textarea", step: "3", required: true, rows: 6 },
  { key: "activity", label: "Interactive activity", kind: "activity", step: "4", required: true },
  { key: "adelReflection", label: "Adel's reflection", kind: "textarea", step: "5", required: true, rows: 3 },
  { key: "adelQuestion", label: "Adel's question", kind: "text", step: "5", required: true },
  { key: "insight", label: "The one thing to remember", kind: "textarea", step: "6", required: true, rows: 2 },
  {
    key: "toolFlow.warningSigns",
    label: "Warning signs to choose from",
    kind: "list",
    step: "7",
    required: true,
    help: `The patient picks up to ${TOOL_FLOW_LIMITS.warningSigns}.`,
  },
  {
    key: "toolFlow.supportPeople",
    label: "Support people to choose from",
    kind: "list",
    step: "8",
    required: true,
    help: `The patient picks up to ${TOOL_FLOW_LIMITS.supportPeople}.`,
  },
  {
    key: "toolFlow.todayActions",
    label: "Actions for today to choose from",
    kind: "list",
    step: "9",
    required: true,
    help: "The patient picks one.",
  },
  { key: "toolkitLabel", label: "Saves to the toolkit as", kind: "text", step: "10", required: true },
];

export const RECOVERY_LESSON_TYPE: ContentTypeDescriptor = {
  typeId: "recovery_lesson",
  label: "Recovery-module lesson",
  labelPlural: "Recovery-module lessons",
  publishEffect:
    "Publishing adds this lesson to its recovery module for patients, and counts toward that module's real progress fraction.",
  fields: RECOVERY_FIELDS,
  baselineIds: () => RECOVERY_LESSONS.map((l) => l.id),
  baselineBody: (id) => {
    const l = RECOVERY_LESSONS.find((x) => x.id === id);
    return l ? (structuredClone(l) as unknown as ContentBody) : undefined;
  },
  emptyBody: () => ({
    id: "",
    moduleId: RECOVERY_MODULES[0]?.id ?? "",
    title: "",
    minutes: 5,
    order: 99,
    problem: "",
    checkIn: "",
    learnTitle: "",
    learnBody: "",
    activity: emptyActivity("checklist"),
    adelReflection: "",
    adelQuestion: "",
    insight: "",
    toolFlow: { warningSigns: [], supportPeople: [], todayActions: [] },
    toolkitLabel: "",
  }),
  titleOf: (b) => str(b, "title") || "(untitled lesson)",
  validate: (b) => {
    const errors = requireText(b, RECOVERY_FIELDS);
    if (!RECOVERY_MODULES.some((m) => m.id === str(b, "moduleId")))
      errors.push("Pick a real recovery module.");
    // The tool flow's limits are real selection limits, so an option set
    // smaller than the limit would make the limit a lie.
    if (list(b, "toolFlow.warningSigns").length < TOOL_FLOW_LIMITS.warningSigns)
      errors.push(`Give at least ${TOOL_FLOW_LIMITS.warningSigns} warning signs to choose from.`);
    if (list(b, "toolFlow.supportPeople").length < TOOL_FLOW_LIMITS.supportPeople)
      errors.push(`Give at least ${TOOL_FLOW_LIMITS.supportPeople} support people to choose from.`);
    if (list(b, "toolFlow.todayActions").length < 2)
      errors.push("Give at least two actions for today to choose from.");
    return [...errors, ...validateActivity(b)];
  },
};

export const CONTENT_TYPES: ContentTypeDescriptor[] = [LIBRARY_LESSON_TYPE, RECOVERY_LESSON_TYPE];

export function contentType(typeId: ContentTypeId): ContentTypeDescriptor {
  const d = CONTENT_TYPES.find((t) => t.typeId === typeId);
  if (!d) throw new Error(`Unknown content type ${typeId}`);
  return d;
}

/** Typed casts used by the catalog once a body has passed `validate`. */
export function asLibraryItem(body: ContentBody, id: string): LibraryItem {
  return { ...(structuredClone(body) as unknown as LibraryItem), id };
}

export function asRecoveryLesson(body: ContentBody, id: string): RecoveryLesson {
  return { ...(structuredClone(body) as unknown as RecoveryLesson), id };
}
