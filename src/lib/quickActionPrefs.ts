// Presentation-only device preferences. No clinical writes or audit sink.
import { CHART_ACTIONS, type ChartAction, type ChartActor } from "@/lib/chartActions";
import { hasRoleAssignment, roleAssignmentsOf, type StaffMember, type StaffRole } from "@/lib/roles";
import { CONTENT_NEW_ACTION_IDS, PENDING_SIGNOFF_IDS } from "@/lib/quickActions";
import type { Patient } from "@/lib/ehr";

export const MAX_QUICK_ACTIONS = 8;
export const preferenceKey = (staffId: string) => `adelante.quickActions.${staffId}`;
export const PREFS_CHANGED = "adelante:quick-actions-changed";
export interface PersonalAction { action: ChartAction; roles: StaffRole[] }

export function personalActionOptions(member: StaffMember | undefined, patient?: Patient): PersonalAction[] {
  if (!member || member.active === false) return [];
  return CHART_ACTIONS.filter((a) => !a.pending && !PENDING_SIGNOFF_IDS.includes(a.id) && (a.menu !== false || a.opsMenu || CONTENT_NEW_ACTION_IDS.some((id) => id === a.id)))
    .map((action) => ({ action, roles: roleAssignmentsOf(member).filter(({ role }) => action.allowed({ role, staffId: member.id, clinicianId: member.clinicianId }, patient).state !== "hidden").map(({ role }) => role) }))
    .filter((x) => x.roles.length > 0);
}

export function sanitizePersonalActions(ids: unknown, member: StaffMember | undefined, patient?: Patient): string[] {
  if (!Array.isArray(ids)) return [];
  const allowed = new Set(personalActionOptions(member, patient).map((x) => x.action.id));
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && allowed.has(id)))].slice(0, MAX_QUICK_ACTIONS);
}

export function addPersonalAction(ids: string[], id: string, member: StaffMember | undefined): string[] {
  const clean = sanitizePersonalActions(ids, member);
  if (!personalActionOptions(member).some((x) => x.action.id === id)) throw new Error("This action is not available for your roles.");
  if (clean.includes(id)) return clean;
  if (clean.length >= MAX_QUICK_ACTIONS) throw new Error("Choose up to 8 quick actions. Remove one before adding another.");
  return [...clean, id];
}

export function personalMenuActions(ids: string[], member: StaffMember | undefined, actor: ChartActor, available: string[], patient?: Patient) {
  if (!member || member.id !== actor.staffId || !hasRoleAssignment(member, actor.role)) return [];
  const options = personalActionOptions(member, patient);
  return sanitizePersonalActions(ids, member, patient).flatMap((id) => {
    const option = options.find((x) => x.action.id === id);
    if (!option) return [];
    const current = option.roles.includes(actor.role);
    // Current-role actions still require this launcher's existing handler.
    if (current && !available.includes(id)) return [];
    return [{ action: option.action, answer: option.action.allowed(actor, patient), switchRole: current ? undefined : option.roles[0] }];
  });
}

// Called only by effects or user events, never from render/module evaluation.
export function readPersonalActions(staffId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(preferenceKey(staffId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : null;
  } catch { return null; }
}

export function writePersonalActions(staffId: string, ids: string[] | null): void {
  if (typeof window === "undefined") return;
  if (ids === null) window.localStorage.removeItem(preferenceKey(staffId));
  else window.localStorage.setItem(preferenceKey(staffId), JSON.stringify(ids));
  window.dispatchEvent(new Event(PREFS_CHANGED));
}