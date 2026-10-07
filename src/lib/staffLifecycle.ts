// §B6 — same-day staff add / change / deactivate. sys_admin only, reason
// required, audited via AdelanteEHR.recordActionEvent (no free text beyond
// the reason). Deactivated people vanish from the persona switcher, booking,
// assignment pickers and team-thread pickers via `activeStaff`/`isActiveStaff`
// — the roster already carries `StaffMember.active`; this module is the one
// audited write path plus the one read helper every picker should share.
import { AdelanteEHR, worklistStatusFor } from "./ehr";
import { addStaffMember, STAFF_ROSTER, type StaffMember, type StaffRole } from "./roles";
import { listUnsignedWork } from "./unsignedWork";
import { listEscalations } from "./escalations";

export const PROTOTYPE_IDENTITY_LABEL = "Prototype — real sign-in needs the identity backend (SculptSoft)";

export interface LifecycleActor {
  role: StaffRole;
  staffId?: string;
}

function assertSysAdmin(actor: LifecycleActor) {
  if (actor.role !== "sys_admin") throw new Error("Only a system administrator can manage staff.");
}
function assertReason(reason: string | undefined): string {
  const r = reason?.trim();
  if (!r || r.length < 3) throw new Error("Give a reason.");
  return r;
}

/** Staff whose identity is currently active (not deactivated). */
export function activeStaff(): StaffMember[] {
  return STAFF_ROSTER.filter((s) => s.active !== false);
}

/** True when the id (staff id OR linked clinicianId) belongs to an active person. Unknown ids default to active (seed data not yet modeled as staff). */
export function isActiveStaff(idOrClinicianId: string | undefined): boolean {
  if (!idOrClinicianId) return true;
  const m = STAFF_ROSTER.find((s) => s.id === idOrClinicianId || s.clinicianId === idOrClinicianId);
  return !m || m.active !== false;
}

/** Refuses to let a deactivated person become the owner of a new item. Call this at every owner-assignment write. */
export function assertAssignableStaff(staffId: string | undefined): void {
  if (!isActiveStaff(staffId)) throw new Error("That person is deactivated and can't be assigned new work.");
}

/** Adds a staff member through the existing audited path, with a required reason on top (sys_admin UI). */
export function addStaffMemberWithReason(actor: LifecycleActor, member: StaffMember, reason: string): StaffMember {
  assertSysAdmin(actor);
  const cleanReason = assertReason(reason);
  const created = addStaffMember(actor, { ...member, active: member.active ?? true });
  AdelanteEHR.recordActionEvent({
    action: "staff.add_reason",
    actorRole: actor.role,
    actorId: actor.staffId,
    detail: { staffId: created.id, reason: cleanReason },
  });
  return created;
}

export interface UpdateStaffInput {
  staffId: string;
  role?: StaffRole;
  siteIds?: string[];
  reason: string;
}

/** Changes role and/or site assignment for an existing staff member. sys_admin only, reason required. */
export function updateStaffMember(actor: LifecycleActor, input: UpdateStaffInput): StaffMember {
  assertSysAdmin(actor);
  const reason = assertReason(input.reason);
  const m = STAFF_ROSTER.find((s) => s.id === input.staffId);
  if (!m) throw new Error("Staff member not found.");
  if (input.role) m.role = input.role;
  if (input.siteIds) m.siteIds = input.siteIds;
  AdelanteEHR.recordActionEvent({
    action: "staff.updated",
    actorRole: actor.role,
    actorId: actor.staffId,
    detail: { staffId: m.id, reason },
  });
  AdelanteEHR._emit();
  return m;
}

export interface DeactivateStaffInput {
  staffId: string;
  reason: string;
}

/** Deactivates a staff member: disappears from switcher/booking/assignment/thread pickers and can't own new items. */
export function deactivateStaffMember(actor: LifecycleActor, input: DeactivateStaffInput): StaffMember {
  assertSysAdmin(actor);
  const reason = assertReason(input.reason);
  const m = STAFF_ROSTER.find((s) => s.id === input.staffId);
  if (!m) throw new Error("Staff member not found.");
  if (m.active === false) return m;
  m.active = false;
  m.deactivatedAt = new Date().toISOString();
  AdelanteEHR.recordActionEvent({
    action: "staff.deactivated",
    actorRole: actor.role,
    actorId: actor.staffId,
    detail: { staffId: m.id, reason },
  });
  AdelanteEHR._emit();
  return m;
}

/** Reactivates a previously deactivated staff member. sys_admin only, reason required. */
export function reactivateStaffMember(actor: LifecycleActor, input: DeactivateStaffInput): StaffMember {
  assertSysAdmin(actor);
  const reason = assertReason(input.reason);
  const m = STAFF_ROSTER.find((s) => s.id === input.staffId);
  if (!m) throw new Error("Staff member not found.");
  if (m.active !== false) return m;
  m.active = true;
  m.deactivatedAt = undefined;
  AdelanteEHR.recordActionEvent({
    action: "staff.reactivated",
    actorRole: actor.role,
    actorId: actor.staffId,
    detail: { staffId: m.id, reason },
  });
  AdelanteEHR._emit();
  return m;
}

export interface ReassignNeededRow {
  staffId: string;
  name: string;
  counts: { notesToSign: number; tasks: number; escalations: number; caseload: number };
}

/** Deactivated people who still own open items — nothing is reassigned automatically. Signed notes keep their author regardless. */
export function reassignNeededItems(): ReassignNeededRow[] {
  const out: ReassignNeededRow[] = [];
  for (const m of STAFF_ROSTER) {
    if (m.active !== false) continue;
    const notesToSign = listUnsignedWork({ authorId: m.clinicianId ?? m.id }).length;
    const openTasks = AdelanteEHR.listCaseTasks().filter((t) => {
      const st = worklistStatusFor(t);
      return t.assignedTo === m.id && st !== "completed" && st !== "cancelled";
    }).length;
    const escalations = listEscalations({ role: "sys_admin" }).filter((r) => r.ownerStaffId === m.id).length;
    const caseload = m.caseManagerId
      ? AdelanteEHR.listPatients().filter((p) => p.caseManagerId === m.caseManagerId).length
      : m.clinicianId
        ? AdelanteEHR.listPatients().filter((p) => p.primaryClinicianId === m.clinicianId).length
        : 0;
    if (notesToSign || openTasks || escalations || caseload) {
      out.push({ staffId: m.id, name: m.name, counts: { notesToSign, tasks: openTasks, escalations, caseload } });
    }
  }
  return out;
}
