// §EHR audit Phase 2b — note-template scope model (Global / Department / Personal).
//
// Before this module every template was one flat shared tier: no owner, no
// department, no personal copies. This adds the three real tiers WITHOUT
// touching the versioning guarantee in `ehr.ts` (schema edits supersede, notes
// keep a frozen snapshot) — scope is orthogonal to version history.
//
// "Department" interpretation (reported, not silently assumed):
// Adelante has NO department field on staff or anywhere else, and building an
// org directory (assignment UI, leads, transfers) is a much larger piece of
// work than this phase. So a department here is a CLINICAL DISCIPLINE derived
// from the staff member's existing role. Derived, not stored, so it cannot
// drift out of sync with a second source of truth.

import type { StaffRole } from "@/lib/roles";
import type { TemplateField, TemplateSchema, TemplateSection } from "@/lib/templateSchema";

export type TemplateScope = "global" | "department" | "personal";

export const TEMPLATE_SCOPE_LABEL: Record<TemplateScope, string> = {
  global: "System",
  department: "Discipline",
  personal: "Mine",
};

export const DEPARTMENT_DERIVATION_NOTE =
  "Discipline is derived from each person's role — Adelante has no department directory yet.";

export interface TemplateDepartment {
  id: string;
  label: string;
  /** Roles that belong to this discipline and may USE its templates. */
  roles: StaffRole[];
  /** Roles that may EDIT this discipline's templates. */
  leadRoles: StaffRole[];
}

/**
 * The real disciplines, mapped from the real role list. Every role appears in
 * exactly one discipline; roles with no documentation surface (billing,
 * credentialing, medical assistant) sit in `operations`, which owns no
 * clinical templates but still resolves to a real, honest value.
 */
export const TEMPLATE_DEPARTMENTS: TemplateDepartment[] = [
  {
    id: "behavioral_health",
    label: "Behavioral health therapy",
    roles: ["therapist", "clinical_trainee"],
    leadRoles: ["therapist"],
  },
  {
    id: "psychiatry",
    label: "Psychiatry",
    roles: ["pmhnp"],
    leadRoles: ["pmhnp"],
  },
  {
    id: "sud_services",
    label: "SUD services",
    roles: ["sud_counselor"],
    leadRoles: ["sud_counselor"],
  },
  {
    id: "care_management",
    label: "Care management",
    roles: ["ecm_provider", "cf_care_manager", "community_health_worker"],
    leadRoles: ["ecm_provider"],
  },
  {
    id: "peer_support",
    label: "Peer support",
    roles: ["peer_specialist"],
    leadRoles: ["peer_specialist"],
  },
  {
    id: "clinical_admin",
    label: "Clinical administration",
    roles: ["clinical_coordinator", "sys_admin"],
    leadRoles: ["clinical_coordinator", "sys_admin"],
  },
  {
    id: "operations",
    label: "Operations",
    roles: ["billing", "billing_coordinator", "credentialing_coordinator", "medical_assistant"],
    leadRoles: [],
  },
];

export function departmentById(id: string | undefined): TemplateDepartment | undefined {
  return TEMPLATE_DEPARTMENTS.find((d) => d.id === id);
}

export function departmentLabel(id: string | undefined): string {
  return departmentById(id)?.label ?? "Unassigned discipline";
}

/** The discipline a role belongs to. Never undefined for a real role. */
export function disciplineForRole(role: StaffRole): TemplateDepartment | undefined {
  return TEMPLATE_DEPARTMENTS.find((d) => d.roles.includes(role));
}

/** Minimal shape this module needs — avoids importing the full NoteTemplate. */
export interface ScopedTemplate {
  id: string;
  scope?: TemplateScope;
  departmentId?: string;
  ownerStaffId?: string;
}

export interface ScopeActor {
  role: StaffRole;
  staffId: string;
}

/**
 * Existing rows carry no scope. They were authored by admins and are visible
 * to everyone today, so `global` is their honest current meaning — not a
 * guess, a description of the behaviour already shipped.
 */
export function scopeOf(t: ScopedTemplate): TemplateScope {
  return t.scope ?? "global";
}

/**
 * USE visibility. Deliberately broader than edit rights: picking a template is
 * documentation, authoring one is configuration.
 *  - global: everyone
 *  - department: anyone whose role sits in that discipline
 *  - personal: the owner only
 */
export function canUseTemplate(actor: ScopeActor, t: ScopedTemplate): boolean {
  const scope = scopeOf(t);
  if (scope === "global") return true;
  if (scope === "personal") return t.ownerStaffId === actor.staffId;
  const dept = departmentById(t.departmentId);
  if (!dept) return false;
  return dept.roles.includes(actor.role);
}

export function templatesVisibleTo<T extends ScopedTemplate>(templates: T[], actor: ScopeActor): T[] {
  return templates.filter((t) => canUseTemplate(actor, t));
}

/**
 * EDIT rights.
 *  - global: the roles that create templates today (sys_admin, clinical_coordinator)
 *  - department: that discipline's lead roles, plus clinical admin
 *  - personal: the owner only
 */
export function canEditTemplate(actor: ScopeActor, t: ScopedTemplate): boolean {
  const scope = scopeOf(t);
  if (scope === "personal") return t.ownerStaffId === actor.staffId;
  if (scope === "global") return actor.role === "sys_admin" || actor.role === "clinical_coordinator";
  if (actor.role === "sys_admin" || actor.role === "clinical_coordinator") return true;
  const dept = departmentById(t.departmentId);
  return !!dept && dept.leadRoles.includes(actor.role);
}

/** Anyone who can see a template may take a personal copy of it. */
export function canCloneTemplate(actor: ScopeActor, t: ScopedTemplate): boolean {
  return canUseTemplate(actor, t) && scopeOf(t) !== "personal";
}

// ----- Locked fields -------------------------------------------------------
//
// A global/department author can mark a field `locked`. A personal clone
// inherits those fields and may not delete them or drop their `required` flag.
// Locked-ness itself is not editable below the tier that set it.

export function lockedFieldKeys(schema: TemplateSchema | undefined): string[] {
  const keys: string[] = [];
  for (const section of schema?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.locked) keys.push(field.key);
    }
  }
  return keys;
}

export interface LockedFieldViolation {
  key: string;
  reason: "removed" | "unrequired" | "unlocked";
  message: string;
}

/**
 * Compare a proposed schema against the locked fields it inherited. Returns
 * every violation, in a stable order, so the UI can show one consolidated list
 * rather than one error at a time.
 */
export function lockedFieldViolations(
  inheritedLockedKeys: string[],
  inherited: TemplateSchema | undefined,
  proposed: TemplateSchema | undefined,
): LockedFieldViolation[] {
  const out: LockedFieldViolation[] = [];
  const proposedFields = new Map<string, TemplateField>();
  for (const section of proposed?.sections ?? []) {
    for (const field of section.fields ?? []) proposedFields.set(field.key, field);
  }
  const inheritedFields = new Map<string, TemplateField>();
  for (const section of inherited?.sections ?? []) {
    for (const field of section.fields ?? []) inheritedFields.set(field.key, field);
  }
  for (const key of inheritedLockedKeys) {
    const field = proposedFields.get(key);
    const label = inheritedFields.get(key)?.label ?? key;
    if (!field) {
      out.push({
        key,
        reason: "removed",
        message: `"${label}" is a locked field and can't be removed from a personal copy.`,
      });
      continue;
    }
    if (inheritedFields.get(key)?.required && !field.required) {
      out.push({
        key,
        reason: "unrequired",
        message: `"${label}" is a locked required field and must stay required.`,
      });
    }
    if (!field.locked) {
      out.push({
        key,
        reason: "unlocked",
        message: `"${label}" is locked by the source template and can't be unlocked here.`,
      });
    }
  }
  return out;
}

// ----- Cloning -------------------------------------------------------------

export interface CloneResult {
  key: string;
  title: string;
  schema: TemplateSchema;
}

function cloneSection(section: TemplateSection): TemplateSection {
  return JSON.parse(JSON.stringify(section)) as TemplateSection;
}

/**
 * Build the payload for a personal copy. The clone is a NEW template key at
 * version 1 with its own independent history — it never appends to, or
 * supersedes, the source's version chain. Locked fields are carried through
 * exactly as authored.
 */
export function buildPersonalClone(
  source: { key: string; title: string; schema: TemplateSchema },
  actor: ScopeActor,
  existingKeys: string[] = [],
): CloneResult {
  const base = `${source.key}-my-${actor.staffId}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  let key = base;
  let n = 2;
  const taken = new Set(existingKeys.map((k) => k.toLowerCase()));
  while (taken.has(key)) {
    key = `${base}-${n}`;
    n += 1;
  }
  return {
    key,
    title: `${source.title} (my copy)`,
    schema: {
      ...source.schema,
      sections: (source.schema?.sections ?? []).map(cloneSection),
    },
  };
}
