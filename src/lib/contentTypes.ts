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
  type LibraryCategory,
} from "@/lib/library";
import {
  RECOVERY_LESSONS,
  RECOVERY_MODULES,
  TOOL_FLOW_LIMITS,
  type RecoveryLesson,
  type RecoveryModule,
} from "@/lib/recovery";
import { POPULATION_LABEL, type PopulationTrack } from "@/lib/population";
import {
  RESOURCE_CATEGORIES,
  SEED_RESOURCES,
  type CommunityResource,
} from "@/lib/communityResources";
import { NALOXONE_ACCESS_POINTS, type NaloxoneAccessPoint } from "@/lib/safetyContent";
import { publishedContentOfType, type ContentBody, type ContentTypeId } from "@/lib/contentPublishing";
// §Content-authoring pass Batch 1 — completeness is not the only bar. The
// originality gate runs inside the same `validate` every lifecycle mutation
// already calls, so it is enforced on the real submit/publish paths.
import { originalityErrors } from "@/lib/contentOriginality";

export type ContentFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "list"
  | "activity"
  // §Lesson-player Phase D — two new authoring inputs. `stages` is a
  // repeatable title+body list (the sub-paginated teaching block); `toggle` is
  // a real boolean (the rating scale's direction), not a string "true".
  | "stages"
  | "toggle";

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
  /**
   * Fields whose OPTIONS depend on live published content — the lesson forms'
   * category / module pickers, which must list categories an admin created
   * five seconds ago. Static `fields` stays the fallback so every existing
   * consumer keeps working.
   */
  fieldsFor?: () => ContentField[];
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

// ---------------------------------------------------------------------------
// §Adelante Journey sync Build 2 — LIVE CONTAINERS.
//
// Categories and modules are read here, not only in the catalog, because the
// lesson forms need them: a lesson written into a category that was created a
// minute ago must validate. `contentCatalog.ts` imports this module (not the
// other way round), so this is the lowest place the overlay can live without
// a cycle. The resolution rule is the catalog's, unchanged: a PUBLISHED
// override wins over the shipped baseline, a draft never displaces it.
// ---------------------------------------------------------------------------

function overlayById<T extends { id: string }>(baseline: readonly T[], overrides: T[]): T[] {
  const byId = new Map<string, T>(baseline.map((b) => [b.id, b]));
  for (const o of overrides) if (o.id) byId.set(o.id, o);
  return [...byId.values()];
}

export function liveLibraryCategoryList(): LibraryCategory[] {
  const overrides = publishedContentOfType("library_category")
    .map((b) => structuredClone(b) as unknown as LibraryCategory)
    .filter((c) => !!c.id);
  return overlayById(LIBRARY_CATEGORIES, overrides).sort((a, b) => a.order - b.order);
}

export function liveRecoveryModuleList(): RecoveryModule[] {
  const overrides = publishedContentOfType("recovery_module")
    .map((b) => structuredClone(b) as unknown as RecoveryModule)
    .filter((m) => !!m.id);
  return overlayById(RECOVERY_MODULES, overrides).sort((a, b) => a.order - b.order);
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

function libraryCategoryField(): ContentField {
  return {
    key: "categoryId",
    label: "Category",
    kind: "select",
    required: true,
    help: "Includes categories created in this workspace, once they are published.",
    options: liveLibraryCategoryList().map((c) => ({ value: c.id, label: c.name })),
  };
}

const LIBRARY_FIELDS: ContentField[] = [
  libraryCategoryField(),
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
  {
    key: "checkIn",
    label: "Check-in text (optional)",
    kind: "textarea",
    step: "2",
    rows: 2,
    help: "Leave blank and the lesson shows the shared check-in line instead.",
  },
  {
    key: "checkInOptions",
    label: "Check-in options (optional)",
    kind: "list",
    step: "2",
    help: 'Card-style "which of these sound like you" choices. Leave empty for a text-only check-in.',
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


// ---------------------------------------------------------------------------
// §Lesson-player Phase D — the OPTIONAL authoring surface, identical on both
// lesson types. Every field here ships empty on all 180 lessons: the renderer
// falls back to what it does today until someone authors into them.
// ---------------------------------------------------------------------------

const PHASE_D_FIELDS: ContentField[] = [
  {
    key: "learnStages",
    label: "Teaching block, split into parts (optional)",
    kind: "stages",
    step: "3",
    help: "Leave empty and the teaching block shows as one block, exactly as it does now. Add parts and the patient pages through them.",
  },
  {
    key: "enrichment.happening.headline",
    label: "Part 1 headline — what's happening (optional)",
    kind: "text",
    step: "3",
    help: "The four enrichment parts replace the split above when filled. Leave all of them blank to keep the lesson as it is.",
  },
  {
    key: "enrichment.happening.body",
    label: "Part 1 body — what's happening",
    kind: "textarea",
    step: "3",
    rows: 4,
  },
  { key: "enrichment.why.headline", label: "Part 2 headline — why it happens", kind: "text", step: "3" },
  { key: "enrichment.why.body", label: "Part 2 body — why it happens", kind: "textarea", step: "3", rows: 4 },
  {
    key: "enrichment.approach",
    label: "Clinical approach line (optional)",
    kind: "text",
    step: "3",
    help: 'Shown under part 2, e.g. "Trauma-informed care · Nervous system regulation".',
  },
  { key: "enrichment.canChange.headline", label: "Part 3 headline — what can change", kind: "text", step: "3" },
  { key: "enrichment.canChange.body", label: "Part 3 body — what can change", kind: "textarea", step: "3", rows: 4 },
  {
    key: "enrichment.takeaway",
    label: "Part 4 — the one line to take away",
    kind: "textarea",
    step: "3",
    rows: 2,
  },
  {
    key: "enrichment.reflection",
    label: "Part 4 — one reflection question",
    kind: "text",
    step: "3",
  },
  {
    key: "ratingPrimary.label",
    label: "Custom rating dimension (optional)",
    kind: "text",
    help: "Leave blank and the lesson uses the shared before/after scales derived from its check-in wording.",
  },
  { key: "ratingPrimary.lowLabel", label: "Rating — what 1 means", kind: "text" },
  { key: "ratingPrimary.highLabel", label: "Rating — what 5 means", kind: "text" },
  {
    key: "ratingPrimary.higherIsHarder",
    label: "A higher score means a HARDER day",
    kind: "toggle",
    help: "On for distress-style scales (craving, overwhelm) so improvement is read as the score going down.",
  },
  {
    key: "ifThenPractice.ifOptions",
    label: "If–then plan: IF options (optional)",
    kind: "list",
    help: "Both lists must have at least one entry for the if–then step to appear at all.",
  },
  { key: "ifThenPractice.thenOptions", label: "If–then plan: THEN options (optional)", kind: "list" },
];

/** Real, light validation: half-authored optional structures are refused. */
function phaseDErrors(body: ContentBody): string[] {
  const errors: string[] = [];
  const stages = readField(body, "learnStages");
  if (Array.isArray(stages)) {
    for (const [i, raw] of stages.entries()) {
      const st = (raw ?? {}) as Record<string, unknown>;
      const title = typeof st["title"] === "string" ? st["title"].trim() : "";
      const stBody = typeof st["body"] === "string" ? st["body"].trim() : "";
      if (title && !stBody) errors.push(`Teaching part ${i + 1} has a title but no text.`);
      if (!title && stBody) errors.push(`Teaching part ${i + 1} has text but no title.`);
    }
  }
  const ifs = list(body, "ifThenPractice.ifOptions").filter((x) => x.trim());
  const thens = list(body, "ifThenPractice.thenOptions").filter((x) => x.trim());
  if (ifs.length > 0 && thens.length === 0)
    errors.push("An if–then plan needs at least one THEN option.");
  if (thens.length > 0 && ifs.length === 0)
    errors.push("An if–then plan needs at least one IF option.");
  const ratingLabel = str(body, "ratingPrimary.label").trim();
  const anchors = str(body, "ratingPrimary.lowLabel") + str(body, "ratingPrimary.highLabel");
  if (!ratingLabel && anchors.trim())
    errors.push("Give the custom rating dimension a label, or clear its anchors.");
  return errors;
}

export const LIBRARY_LESSON_TYPE: ContentTypeDescriptor = {
  typeId: "library_lesson",
  label: "Library lesson",
  labelPlural: "Library lessons",
  publishEffect:
    "Publishing puts this lesson in the patient Library immediately, inside its category, subject to the same population gate every other lesson uses.",
  fields: [...LIBRARY_FIELDS, ...PHASE_D_FIELDS],
  fieldsFor: () => [libraryCategoryField(), ...LIBRARY_FIELDS.slice(1), ...PHASE_D_FIELDS],
  baselineIds: () => LIBRARY_ITEMS.map((i) => i.id),
  baselineBody: (id) => {
    const item = LIBRARY_ITEMS.find((i) => i.id === id);
    return item ? (structuredClone(item) as unknown as ContentBody) : undefined;
  },
  emptyBody: () => ({
    id: "",
    categoryId: liveLibraryCategoryList()[0]?.id ?? "",
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
    if (!liveLibraryCategoryList().some((c) => c.id === str(b, "categoryId")))
      errors.push("Pick a real library category.");
    return [
      ...errors,
      ...validateActivity(b),
      ...phaseDErrors(b),
      ...originalityErrors("library_lesson", b),
    ];
  },
};

// ---------------------------------------------------------------------------
// Recovery lesson — the ten-step sequence, including the typed tool flow
// ---------------------------------------------------------------------------

function recoveryModuleField(): ContentField {
  return {
    key: "moduleId",
    label: "Module",
    kind: "select",
    required: true,
    help: "Includes modules created in this workspace, once they are published.",
    options: liveRecoveryModuleList().map((m) => ({
      value: m.id,
      label: `${m.order}. ${m.name}`,
    })),
  };
}

const RECOVERY_FIELDS: ContentField[] = [
  recoveryModuleField(),
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
  fields: [...RECOVERY_FIELDS, ...PHASE_D_FIELDS],
  fieldsFor: () => [recoveryModuleField(), ...RECOVERY_FIELDS.slice(1), ...PHASE_D_FIELDS],
  baselineIds: () => RECOVERY_LESSONS.map((l) => l.id),
  baselineBody: (id) => {
    const l = RECOVERY_LESSONS.find((x) => x.id === id);
    return l ? (structuredClone(l) as unknown as ContentBody) : undefined;
  },
  emptyBody: () => ({
    id: "",
    moduleId: liveRecoveryModuleList()[0]?.id ?? "",
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
    if (!liveRecoveryModuleList().some((m) => m.id === str(b, "moduleId")))
      errors.push("Pick a real recovery module.");
    // The tool flow's limits are real selection limits, so an option set
    // smaller than the limit would make the limit a lie.
    if (list(b, "toolFlow.warningSigns").length < TOOL_FLOW_LIMITS.warningSigns)
      errors.push(`Give at least ${TOOL_FLOW_LIMITS.warningSigns} warning signs to choose from.`);
    if (list(b, "toolFlow.supportPeople").length < TOOL_FLOW_LIMITS.supportPeople)
      errors.push(`Give at least ${TOOL_FLOW_LIMITS.supportPeople} support people to choose from.`);
    if (list(b, "toolFlow.todayActions").length < 2)
      errors.push("Give at least two actions for today to choose from.");
    return [
      ...errors,
      ...validateActivity(b),
      ...phaseDErrors(b),
      ...originalityErrors("recovery_lesson", b),
    ];
  },
};

// ---------------------------------------------------------------------------
// Community resource — the directory record (address / phone / hours)
// ---------------------------------------------------------------------------

const RESOURCE_FIELDS: ContentField[] = [
  {
    key: "categoryId",
    label: "Category",
    kind: "select",
    required: true,
    options: [...RESOURCE_CATEGORIES]
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ value: c.id, label: c.name })),
  },
  { key: "name", label: "Organisation name", kind: "text", required: true },
  {
    key: "address",
    label: "Address",
    kind: "text",
    required: true,
    help: "Write what you confirmed. Never invent an address.",
  },
  { key: "phone", label: "Phone", kind: "text", required: true },
  { key: "hours", label: "Hours", kind: "text", required: true },
  {
    key: "website",
    label: "Website",
    kind: "text",
    help: "Full URL, e.g. https://cset.org. Leave blank if the organisation has none.",
  },
  {
    key: "description",
    label: "What they do",
    kind: "textarea",
    required: true,
    rows: 3,
    help: "Plain language a patient can act on.",
  },
];

export const COMMUNITY_RESOURCE_TYPE: ContentTypeDescriptor = {
  typeId: "community_resource",
  label: "Community resource",
  labelPlural: "Community resources",
  publishEffect:
    "Publishing puts this organisation in the patient Resource Center immediately, in its category, and makes it available for SDOH-need matching and referrals.",
  fields: RESOURCE_FIELDS,
  baselineIds: () => SEED_RESOURCES.map((r) => r.id),
  baselineBody: (id) => {
    const r = SEED_RESOURCES.find((x) => x.id === id);
    return r ? (structuredClone(r) as unknown as ContentBody) : undefined;
  },
  emptyBody: () => ({
    id: "",
    categoryId: RESOURCE_CATEGORIES[0]?.id ?? "",
    name: "",
    address: "",
    phone: "",
    hours: "",
    website: "",
    description: "",
    placeholder: false,
    verified: false,
    status: "unverified",
  }),
  titleOf: (b) => str(b, "name") || "(unnamed resource)",
  validate: (b) => {
    const errors = requireText(b, RESOURCE_FIELDS);
    if (!RESOURCE_CATEGORIES.some((c) => c.id === str(b, "categoryId")))
      errors.push("Pick a real resource category.");
    return errors;
  },
};

// ---------------------------------------------------------------------------
// Naloxone access point — where to get naloxone
// ---------------------------------------------------------------------------

const NALOXONE_FIELDS: ContentField[] = [
  { key: "name", label: "Where", kind: "text", required: true },
  {
    key: "what",
    label: "What to ask for",
    kind: "textarea",
    required: true,
    rows: 3,
    help: "Exactly what a patient should say or do to walk out with naloxone.",
  },
  { key: "city", label: "City", kind: "text" },
  { key: "phone", label: "Phone", kind: "text" },
  { key: "website", label: "Website", kind: "text" },
  { key: "source", label: "Source citation", kind: "text" },
];

export const NALOXONE_ACCESS_TYPE: ContentTypeDescriptor = {
  typeId: "naloxone_access_point",
  label: "Naloxone access point",
  labelPlural: "Naloxone access points",
  publishEffect:
    "Publishing adds this to the 'Where to get naloxone' list on the patient overdose-prevention page immediately. It does not touch the overdose-response steps, which stay under clinical review.",
  fields: NALOXONE_FIELDS,
  baselineIds: () => NALOXONE_ACCESS_POINTS.map((p) => p.id),
  baselineBody: (id) => {
    const p = NALOXONE_ACCESS_POINTS.find((x) => x.id === id);
    return p ? (structuredClone(p) as unknown as ContentBody) : undefined;
  },
  emptyBody: () => ({ id: "", name: "", what: "", verified: false }),
  titleOf: (b) => str(b, "name") || "(unnamed access point)",
  validate: (b) => {
    const errors = requireText(b, NALOXONE_FIELDS);
    if (!str(b, "phone").trim() && !str(b, "website").trim())
      errors.push("Give a phone number or a website — a patient needs a way to reach this.");
    return errors;
  },
};

// ---------------------------------------------------------------------------
// §Library category — the CONTAINER, now managed content
// ---------------------------------------------------------------------------

const CATEGORY_FIELDS: ContentField[] = [
  { key: "name", label: "Category name", kind: "text", required: true },
  {
    key: "desc",
    label: "Description",
    kind: "textarea",
    required: true,
    rows: 2,
    help: "Shown to patients under the category heading. Plain language.",
  },
  {
    key: "clinicalTarget",
    label: "Clinical target",
    kind: "text",
    required: true,
    help: "What this category is clinically aiming at. Shown to staff, never to patients.",
  },
  {
    key: "audience",
    label: "Audience",
    kind: "select",
    help: "Which library this category appears in. Advocate categories are written for the person supporting someone in care and never show in the patient Library.",
    options: [
      { value: "patient", label: "Patients" },
      { value: "advocate", label: "Advocates / family members" },
    ],
  },
  {

    key: "eyebrow",
    label: "Short eyebrow (patient-facing)",
    kind: "text",
    help: "The short phrase above the category name on the patient Library card, e.g. \"Grounding · Nervous system regulation\". Leave blank to derive one automatically from the clinical target — set it whenever that guess reads wrong.",
  },
  {
    key: "icon",
    label: "Icon name",
    kind: "text",
    required: true,
    help: "A lucide-react icon name in PascalCase, e.g. Sunrise. Stored as metadata; surfaces that do not resolve icons ignore it.",
  },
  {
    key: "order",
    label: "Order in the library",
    kind: "number",
    required: true,
    help: "Lower numbers come first. Reuse of a number is allowed; ties fall back to insertion order.",
  },
];

function validateIconName(body: ContentBody): string[] {
  const icon = str(body, "icon").trim();
  if (!icon) return [];
  return /^[A-Z][A-Za-z0-9]*$/.test(icon)
    ? []
    : ["Icon name must be a PascalCase lucide-react name, e.g. Sunrise."];
}

export const LIBRARY_CATEGORY_TYPE: ContentTypeDescriptor = {
  typeId: "library_category",
  label: "Library category",
  labelPlural: "Library categories",
  publishEffect:
    "Publishing adds this category to the patient Library immediately and makes it selectable when authoring a Library lesson. It starts empty until lessons are published into it.",
  fields: CATEGORY_FIELDS,
  baselineIds: () => LIBRARY_CATEGORIES.map((c) => c.id),
  baselineBody: (id) => {
    const c = LIBRARY_CATEGORIES.find((x) => x.id === id);
    return c ? (structuredClone(c) as unknown as ContentBody) : undefined;
  },
  emptyBody: () => ({
    id: "",
    name: "",
    desc: "",
    clinicalTarget: "",
    icon: "BookOpen",
    order: (liveLibraryCategoryList().at(-1)?.order ?? 0) + 1,
  }),
  titleOf: (b) => str(b, "name") || "(unnamed category)",
  validate: (b) => [...requireText(b, CATEGORY_FIELDS), ...validateIconName(b)],
};

// ---------------------------------------------------------------------------
// §Recovery module — the CONTAINER, with its real population gate
// ---------------------------------------------------------------------------

const POPULATION_GATE_VALUES: PopulationTrack[] = [
  "pre_release_ji",
  "post_release_ji",
  "general_population",
];

const MODULE_FIELDS: ContentField[] = [
  { key: "name", label: "Module name", kind: "text", required: true },
  {
    key: "mission",
    label: "Mission",
    kind: "text",
    required: true,
    help: "The module's mission statement, e.g. 'Build My Support System'.",
  },
  { key: "subtitle", label: "Subtitle", kind: "textarea", required: true, rows: 2 },
  {
    key: "icon",
    label: "Icon name",
    kind: "text",
    required: true,
    help: "A lucide-react icon name in PascalCase, e.g. Users.",
  },
  {
    key: "order",
    label: "Order in the journey",
    kind: "number",
    required: true,
    help: "Lower numbers come first. This number is also shown to patients as the module number.",
  },
  {
    key: "populations",
    label: "Population gate",
    kind: "list",
    help: `Leave empty to show this module to everyone. Otherwise list tracks: ${POPULATION_GATE_VALUES.join(", ")}.`,
  },
];

export const RECOVERY_MODULE_TYPE: ContentTypeDescriptor = {
  typeId: "recovery_module",
  label: "Recovery module",
  labelPlural: "Recovery modules",
  publishEffect:
    "Publishing adds this module to the patient Recovery Journey immediately, subject to its population gate, and makes it selectable when authoring a recovery lesson.",
  fields: MODULE_FIELDS,
  baselineIds: () => RECOVERY_MODULES.map((m) => m.id),
  baselineBody: (id) => {
    const m = RECOVERY_MODULES.find((x) => x.id === id);
    return m ? (structuredClone(m) as unknown as ContentBody) : undefined;
  },
  emptyBody: () => ({
    id: "",
    name: "",
    mission: "",
    subtitle: "",
    icon: "Compass",
    order: (liveRecoveryModuleList().at(-1)?.order ?? 0) + 1,
    populations: [],
  }),
  titleOf: (b) => str(b, "name") || "(unnamed module)",
  validate: (b) => {
    const errors = [...requireText(b, MODULE_FIELDS), ...validateIconName(b)];
    // A gate that names a track the population resolver cannot produce would
    // hide the module from everyone, silently. Refuse it.
    const bad = list(b, "populations").filter(
      (p) => !POPULATION_GATE_VALUES.includes(p as PopulationTrack),
    );
    if (bad.length > 0)
      errors.push(
        `Not a real population track: ${bad.join(", ")}. Use ${POPULATION_GATE_VALUES.map((p) => `${p} (${POPULATION_LABEL[p]})`).join(", ")}.`,
      );
    return errors;
  },
};

export const CONTENT_TYPES: ContentTypeDescriptor[] = [
  LIBRARY_LESSON_TYPE,
  RECOVERY_LESSON_TYPE,
  LIBRARY_CATEGORY_TYPE,
  RECOVERY_MODULE_TYPE,
  COMMUNITY_RESOURCE_TYPE,
  NALOXONE_ACCESS_TYPE,
];

export function contentType(typeId: ContentTypeId): ContentTypeDescriptor {
  const d = CONTENT_TYPES.find((t) => t.typeId === typeId);
  if (!d) throw new Error(`Unknown content type ${typeId}`);
  return d;
}

/** The real field list for a descriptor, live options included. */
export function descriptorFields(d: ContentTypeDescriptor): ContentField[] {
  return d.fieldsFor ? d.fieldsFor() : d.fields;
}

/** Typed casts used by the catalog once a body has passed `validate`. */
export function asLibraryItem(body: ContentBody, id: string): LibraryItem {
  return { ...(structuredClone(body) as unknown as LibraryItem), id };
}

export function asRecoveryLesson(body: ContentBody, id: string): RecoveryLesson {
  return { ...(structuredClone(body) as unknown as RecoveryLesson), id };
}

export function asCommunityResource(body: ContentBody, id: string): CommunityResource {
  return { ...(structuredClone(body) as unknown as CommunityResource), id };
}

export function asNaloxoneAccessPoint(body: ContentBody, id: string): NaloxoneAccessPoint {
  return { ...(structuredClone(body) as unknown as NaloxoneAccessPoint), id };
}
