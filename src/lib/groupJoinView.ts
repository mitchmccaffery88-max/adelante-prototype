// §Group join requests — role-aware view. Part 2 (SUD) group requests are
// masked for roles failing the screeners_sud check on that patient: they
// never see the row, only a generic hidden count.
import { AdelanteEHR, GROUP_ELIGIBILITY_ROLES, type GroupJoinRequest, type GroupJoinRequestStatus } from "./ehr";
import { canAccess, type StaffRole } from "./roles";

export function roleSeesGroupJoinRequest(role: StaffRole, r: Pick<GroupJoinRequest, "protected" | "patientId">): boolean {
  if (!r.protected) return true;
  const p = AdelanteEHR.getPatient(r.patientId);
  const g = canAccess(role, "screeners_sud", p);
  return g.level !== "none" && !g.locked;
}

export function isGroupJoinReviewer(role: StaffRole): boolean {
  return (GROUP_ELIGIBILITY_ROLES as readonly string[]).includes(role);
}

export function visibleGroupJoinRequests(
  role: StaffRole,
  status?: GroupJoinRequestStatus,
): { rows: GroupJoinRequest[]; hidden: number } {
  const all = AdelanteEHR.listGroupJoinRequests(status ? { status } : undefined);
  const rows = all.filter((r) => roleSeesGroupJoinRequest(role, r));
  return { rows, hidden: all.length - rows.length };
}

/** Patient-facing label: SUD groups get category-only wording. */
export function patientGroupLabel(g: { topic: string; category: string }): string {
  return g.category === "sud_clinical_preauth" ? "Substance use support group" : g.topic;
}
