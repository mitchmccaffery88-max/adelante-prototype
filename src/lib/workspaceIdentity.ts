// Clinician workspace identity. The workspace always shows the ACTING person
// from the top-bar switcher. Coordinators, system admins and supervisors may
// explicitly "View as" another clinician; actions are still recorded as the
// acting person, and every view is audited (AdelanteEHR.recordWorkspaceViewAs).
import { STAFF_ROSTER, getStaffMember, type StaffRole } from "@/lib/roles";

export interface WorkspaceActor {
  role: StaffRole;
  staffId: string;
  staffName: string;
  clinicianId?: string;
  caseManagerId?: string;
}

export const VIEW_AS_ROLES: readonly StaffRole[] = ["clinical_coordinator", "sys_admin"];

/** Staff this person supervises (the roster's supervisedBy link). */
export function superviseesOf(staffId: string) {
  return STAFF_ROSTER.filter((s) => s.supervisedBy === staffId);
}

/** Clinicians the acting person may "View as". Empty = no picker. */
export function viewAsOptions(acting: { role: StaffRole; staffId: string }) {
  const clinicians = STAFF_ROSTER.filter((s) => !!s.clinicianId && s.id !== acting.staffId);
  if (VIEW_AS_ROLES.includes(acting.role)) return clinicians;
  const sup = new Set(superviseesOf(acting.staffId).map((s) => s.id));
  return clinicians.filter((s) => sup.has(s.id));
}

export function canViewAs(acting: { role: StaffRole; staffId: string }, targetStaffId?: string): boolean {
  if (!targetStaffId) return false;
  return viewAsOptions(acting).some((s) => s.id === targetStaffId);
}

/** The ONE person every workspace widget reads. */
export function resolveWorkspaceActor(acting: WorkspaceActor, viewAsStaffId?: string): WorkspaceActor & { viewingAs: boolean } {
  if (viewAsStaffId && canViewAs(acting, viewAsStaffId)) {
    const m = getStaffMember(viewAsStaffId)!;
    return { role: m.role, staffId: m.id, staffName: m.name, clinicianId: m.clinicianId, caseManagerId: m.caseManagerId, viewingAs: true };
  }
  return { role: acting.role, staffId: acting.staffId, staffName: acting.staffName, clinicianId: acting.clinicianId, caseManagerId: acting.caseManagerId, viewingAs: false };
}

/** Today = local midnight to midnight. Needs closing = past, still open. */
export function bucketWorkspaceVisits<A extends { start: string; durationMin: number; status: string; id: string }>(
  appts: A[],
  hasNote: (a: A) => boolean,
  now = Date.now(),
) {
  const d = new Date(now);
  const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;
  const dow = d.getDay();
  const endOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - dow), 23, 59, 59, 999).getTime();
  const sorted = [...appts].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const t = (a: A) => +new Date(a.start);
  const ended = (a: A) => t(a) + a.durationMin * 60000 <= now;
  const needsClosing = sorted.filter(
    (a) =>
      ended(a) &&
      t(a) >= now - 30 * 86400000 &&
      (((a.status === "scheduled" || a.status === "checked_in")) || (a.status === "attended" && !hasNote(a))),
  );
  const closingIds = new Set(needsClosing.map((a) => a.id));
  return {
    today: sorted.filter((a) => t(a) >= startOfToday && t(a) <= endOfToday && !closingIds.has(a.id)),
    needsClosing,
    week: sorted.filter((a) => t(a) > endOfToday && t(a) <= endOfWeek),
    later: sorted.filter((a) => t(a) > endOfWeek),
  };
}
