// §Adelante Journey Phase 7 part 1 — SAFETY PLAN (Stanley-Brown structure).
//
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE CALL (deliberate, see the Phase 5 engagement note in
// src/lib/engagement.ts for the contrast):
//
// A Safety Plan is CLINICAL-ADJACENT, not engagement content. Library/Exercise
// progress was moved off the clinical record because nobody needs it during
// care and it must not inherit clinical RBAC/export/Part 2 assumptions. The
// opposite is true here: a crisis responder or on-call clinician may need to
// READ this during an active safety concern, it is referenced in crisis
// disposition, and hiding it behind engagement-tier plumbing would be unsafe.
//
// So it is gated by a real record class (`safety_plan` in src/lib/roles.ts),
// audited into the one clinical audit stream, and surfaced as a chart section.
// It is still NOT fields on `Patient`: it is PATIENT-AUTHORED clinical-support
// content — a genuine third bucket between the clinician-authored designated
// record and passive engagement data. Keeping it in its own store means
// clinician-authored documentation stays cleanly separable from what the
// patient wrote about themselves, while access remains clinical.
//
// ─────────────────────────────────────────────────────────────────────────────
// OPEN — CLINICAL REVIEW REQUIRED (Christi / Dr. Bagga):
// The Stanley-Brown SECTION STRUCTURE below is the real, published framework
// and is safe as built. The PROMPT / EXAMPLE text inside each section is a
// reasonable starting draft only — it is NOT reviewed clinical guidance. The
// flag `SAFETY_PLAN_REVIEW.pending` is read by the UI and by the admin
// content-review status panel; do not clear it in code without that sign-off.
// ─────────────────────────────────────────────────────────────────────────────

/** The one real crisis number used everywhere in this build (tel:988). */
export const CRISIS_LIFELINE_NUMBER = "988";
export const CRISIS_LIFELINE_NAME = "988 Suicide & Crisis Lifeline";

/** Real, visible review state — not a comment. Surfaced in patient, clinician
 *  and admin UI until Christi / Dr. Bagga sign off on the prompt text. */
export const SAFETY_PLAN_REVIEW = {
  pending: true,
  reviewers: "Christi / Dr. Bagga",
  scope:
    "Section prompts and example text only — the Stanley-Brown section structure itself is the published framework.",
  notice:
    "Draft prompt text — pending clinical review by Christi / Dr. Bagga. Not production-ready guidance.",
} as const;

export type SafetyPlanSectionId =
  | "warning_signs"
  | "internal_coping"
  | "distractions"
  | "support_people"
  | "professionals"
  | "environment_safety"
  | "reasons_for_living";

export interface SafetyPlanSectionDef {
  id: SafetyPlanSectionId;
  /** Step order in the published Stanley-Brown sequence (1-7). */
  step: number;
  title: string;
  /** DRAFT prompt — see SAFETY_PLAN_REVIEW. */
  prompt: string;
  /** True when the prompt text still needs clinical sign-off. */
  clinicalReviewPending: boolean;
  /** Section collects a contactable person/agency (name + phone). */
  contactSection: boolean;
}

export const SAFETY_PLAN_SECTIONS: SafetyPlanSectionDef[] = [
  {
    id: "warning_signs",
    step: 1,
    title: "Warning signs",
    prompt: "Thoughts, feelings, or situations that tell me a crisis may be building.",
    clinicalReviewPending: true,
    contactSection: false,
  },
  {
    id: "internal_coping",
    step: 2,
    title: "Internal coping strategies",
    prompt: "Things I can do on my own to take my mind off my problems.",
    clinicalReviewPending: true,
    contactSection: false,
  },
  {
    id: "distractions",
    step: 3,
    title: "People and social settings that provide distraction",
    prompt: "People or places that help me get out of my head — I don't have to explain myself.",
    clinicalReviewPending: true,
    contactSection: true,
  },
  {
    id: "support_people",
    step: 4,
    title: "People I can ask for help",
    prompt: "People I can tell that I'm struggling.",
    clinicalReviewPending: true,
    contactSection: true,
  },
  {
    id: "professionals",
    step: 5,
    title: "Professionals or agencies I can contact during a crisis",
    prompt: "Clinicians, crisis lines, or agencies to call when I need more than a friend.",
    clinicalReviewPending: true,
    contactSection: true,
  },
  {
    id: "environment_safety",
    step: 6,
    title: "Making the environment safer",
    prompt: "Steps to put time and distance between me and anything I could use to hurt myself.",
    clinicalReviewPending: true,
    contactSection: false,
  },
  {
    id: "reasons_for_living",
    step: 7,
    title: "Reasons for living",
    prompt: "What matters to me. Why getting through today is worth it.",
    clinicalReviewPending: true,
    contactSection: false,
  },
];

export function getSafetyPlanSection(id: SafetyPlanSectionId): SafetyPlanSectionDef | undefined {
  return SAFETY_PLAN_SECTIONS.find((s) => s.id === id);
}

export type SafetyPlanEntrySource = "patient" | "staff" | "prepopulated";

export interface SafetyPlanEntry {
  id: string;
  sectionId: SafetyPlanSectionId;
  /** Patient-authored (or staff-recorded) text. */
  text: string;
  /** Contact sections only. */
  phone?: string;
  source: SafetyPlanEntrySource;
  /** Pre-populated safety infrastructure (988) — cannot be deleted. */
  locked?: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SafetyPlan {
  patientId: string;
  entries: SafetyPlanEntry[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  lastReviewedAt?: string;
  lastReviewedBy?: string;
}

const plans = new Map<string, SafetyPlan>();

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export function subscribeSafetyPlan(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export type SafetyPlanAuditEvent = {
  patientId: string;
  action:
    | "safety_plan_created"
    | "safety_plan_entry_added"
    | "safety_plan_entry_updated"
    | "safety_plan_entry_removed"
    | "safety_plan_reviewed";
  actorRole: string;
  detail: Record<string, unknown>;
};
type AuditSink = (evt: SafetyPlanAuditEvent) => void;
let auditSink: AuditSink | undefined;

/** The EHR store installs the real audit writer; this module never imports it. */
export function setSafetyPlanAuditSink(sink: AuditSink | undefined): void {
  auditSink = sink;
}

let seq = 0;
const nextId = () => `sp_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** The 988 row every plan starts with — real number, never fabricated. */
function lifelineEntry(author: string): SafetyPlanEntry {
  return {
    id: nextId(),
    sectionId: "professionals",
    text: `${CRISIS_LIFELINE_NAME} — call or text, 24/7`,
    phone: CRISIS_LIFELINE_NUMBER,
    source: "prepopulated",
    locked: true,
    createdAt: new Date().toISOString(),
    createdBy: author,
  };
}

/** Create the plan on first touch. Idempotent. */
export function ensureSafetyPlan(patientId: string, author = "patient"): SafetyPlan {
  let plan = plans.get(patientId);
  if (plan) return plan;
  const now = new Date().toISOString();
  plan = {
    patientId,
    entries: [lifelineEntry(author)],
    createdAt: now,
    createdBy: author,
    updatedAt: now,
  };
  plans.set(patientId, plan);
  auditSink?.({
    patientId,
    action: "safety_plan_created",
    actorRole: author,
    detail: { prepopulated: CRISIS_LIFELINE_NAME, clinicalReviewPending: SAFETY_PLAN_REVIEW.pending },
  });
  notify();
  return plan;
}

export function getSafetyPlan(patientId: string): SafetyPlan | undefined {
  const p = plans.get(patientId);
  return p ? structuredClone(p) : undefined;
}

export function safetyPlanEntries(
  patientId: string,
  sectionId?: SafetyPlanSectionId,
): SafetyPlanEntry[] {
  const entries = plans.get(patientId)?.entries ?? [];
  return entries.filter((e) => !sectionId || e.sectionId === sectionId).map((e) => ({ ...e }));
}

/** Counts only — safe for queues/reporting; never returns patient text. */
export function safetyPlanSummary(patientId: string): {
  patientId: string;
  exists: boolean;
  entryCount: number;
  sectionsFilled: number;
  totalSections: number;
  updatedAt?: string;
  lastReviewedAt?: string;
  clinicalReviewPending: boolean;
} {
  const p = plans.get(patientId);
  const filled = new Set(
    (p?.entries ?? []).filter((e) => e.source !== "prepopulated").map((e) => e.sectionId),
  );
  return {
    patientId,
    exists: Boolean(p),
    entryCount: p?.entries.length ?? 0,
    sectionsFilled: filled.size,
    totalSections: SAFETY_PLAN_SECTIONS.length,
    ...(p?.updatedAt ? { updatedAt: p.updatedAt } : {}),
    ...(p?.lastReviewedAt ? { lastReviewedAt: p.lastReviewedAt } : {}),
    clinicalReviewPending: SAFETY_PLAN_REVIEW.pending,
  };
}

export function addSafetyPlanEntry(
  patientId: string,
  input: {
    sectionId: SafetyPlanSectionId;
    text: string;
    phone?: string;
    source?: SafetyPlanEntrySource;
    author?: string;
    actorRole?: string;
  },
): SafetyPlanEntry {
  const text = input.text.trim();
  if (!text) throw new Error("Entry text is required.");
  if (!getSafetyPlanSection(input.sectionId)) throw new Error("Unknown safety plan section.");
  const author = input.author ?? "patient";
  const plan = ensureSafetyPlan(patientId, author);
  const entry: SafetyPlanEntry = {
    id: nextId(),
    sectionId: input.sectionId,
    text,
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    source: input.source ?? "patient",
    createdAt: new Date().toISOString(),
    createdBy: author,
  };
  plan.entries.push(entry);
  plan.updatedAt = entry.createdAt;
  auditSink?.({
    patientId,
    action: "safety_plan_entry_added",
    actorRole: input.actorRole ?? entry.source,
    // Detail carries the SECTION, never the patient's words.
    detail: { sectionId: entry.sectionId, entryId: entry.id, source: entry.source },
  });
  notify();
  return { ...entry };
}

export function updateSafetyPlanEntry(
  patientId: string,
  entryId: string,
  patch: { text?: string; phone?: string; author?: string; actorRole?: string },
): SafetyPlanEntry | undefined {
  const plan = plans.get(patientId);
  const entry = plan?.entries.find((e) => e.id === entryId);
  if (!plan || !entry) return undefined;
  if (entry.locked) throw new Error(`${CRISIS_LIFELINE_NAME} entry cannot be edited.`);
  if (patch.text !== undefined) {
    const text = patch.text.trim();
    if (!text) throw new Error("Entry text is required.");
    entry.text = text;
  }
  if (patch.phone !== undefined) {
    const phone = patch.phone.trim();
    if (phone) entry.phone = phone;
    else delete entry.phone;
  }
  entry.updatedAt = new Date().toISOString();
  entry.updatedBy = patch.author ?? "patient";
  plan.updatedAt = entry.updatedAt;
  auditSink?.({
    patientId,
    action: "safety_plan_entry_updated",
    actorRole: patch.actorRole ?? entry.source,
    detail: { sectionId: entry.sectionId, entryId: entry.id },
  });
  notify();
  return { ...entry };
}

export function removeSafetyPlanEntry(
  patientId: string,
  entryId: string,
  opts: { actorRole?: string } = {},
): boolean {
  const plan = plans.get(patientId);
  const entry = plan?.entries.find((e) => e.id === entryId);
  if (!plan || !entry) return false;
  if (entry.locked) throw new Error(`${CRISIS_LIFELINE_NAME} entry cannot be removed.`);
  plan.entries = plan.entries.filter((e) => e.id !== entryId);
  plan.updatedAt = new Date().toISOString();
  auditSink?.({
    patientId,
    action: "safety_plan_entry_removed",
    actorRole: opts.actorRole ?? "patient",
    detail: { sectionId: entry.sectionId, entryId },
  });
  notify();
  return true;
}

/** A clinician reviewing the plan with the patient. Not a sign-off on content. */
export function markSafetyPlanReviewed(
  patientId: string,
  reviewedBy: string,
  actorRole = "clinician",
): SafetyPlan | undefined {
  const plan = plans.get(patientId);
  if (!plan) return undefined;
  plan.lastReviewedAt = new Date().toISOString();
  plan.lastReviewedBy = reviewedBy;
  auditSink?.({
    patientId,
    action: "safety_plan_reviewed",
    actorRole,
    detail: { reviewedBy, entryCount: plan.entries.length },
  });
  notify();
  return structuredClone(plan);
}

/** Population/reporting read: summaries only, optionally narrowed to a cohort. */
export function safetyPlanRecords(patientIds?: string[]): SafetyPlan[] {
  const all = [...plans.values()].map((p) => structuredClone(p));
  if (!patientIds) return all;
  const want = new Set(patientIds);
  return all.filter((p) => want.has(p.patientId));
}

/** Test/demo helper. */
export function __resetSafetyPlans(): void {
  plans.clear();
  notify();
}