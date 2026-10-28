// Only new relationship facts live here. Existing assignments, supervision,
// groups and on-call remain owned by their original stores.
import { AdelanteEHR } from "./ehr";
import { getStaffMember, hasRoleAssignment, type StaffRole } from "./roles";
import { activeAt } from "./chartAccessRules";

export type AccessActor = { role: StaffRole; staffId?: string };
export interface CoverageAssignment { id: string; coveringStaffId: string; coveredStaffId: string; start: string; end: string }
export interface AdditionalTeamAssignment { id: string; staffId: string; patientId: string; start: string; end?: string }
const coverage: CoverageAssignment[] = [];
const additionalTeam: AdditionalTeamAssignment[] = [];
let sequence = 0;
export function validAccessActor(actor: AccessActor): boolean {
  const s = getStaffMember(actor.staffId);
  return !!s && s.active !== false && hasRoleAssignment(s, actor.role);
}
export function canManageCoverage(actor: AccessActor): boolean {
  return validAccessActor(actor) && actor.role === "clinical_coordinator";
}
export function saveCoverageAssignment(actor: AccessActor, input: Omit<CoverageAssignment, "id">) {
  if (!canManageCoverage(actor)) throw new Error("Clinical coordinator assignment required.");
  for (const id of [input.coveringStaffId, input.coveredStaffId]) {
    const s = getStaffMember(id);
    if (!s || s.active === false || !["physician", "pmhnp", "therapist", "sud_counselor", "clinical_trainee"].some(r => hasRoleAssignment(s, r as StaffRole))) throw new Error("Choose active clinicians.");
  }
  if (input.coveringStaffId === input.coveredStaffId || !Number.isFinite(Date.parse(input.start)) || !Number.isFinite(Date.parse(input.end)) || Date.parse(input.end) <= Date.parse(input.start)) throw new Error("Choose different clinicians and valid coverage dates.");
  const row = { ...input, id: `coverage-${++sequence}` }; coverage.push(row); AdelanteEHR._emit(); return { ...row };
}
export function listCoverageAssignments() { return coverage.map(r => ({ ...r })); }
export function coveringStaffFor(staffId: string, at: Date) { return coverage.filter(r => r.coveringStaffId === staffId && activeAt(r.start, r.end, at)).map(r => r.coveredStaffId); }
export function additionalTeamFor(staffId: string, patientId: string, at: Date) { return additionalTeam.some(r => r.staffId === staffId && r.patientId === patientId && activeAt(r.start, r.end, at)); }
export function saveAdditionalTeamAssignment(actor: AccessActor, input: Omit<AdditionalTeamAssignment, "id">) {
  if (!canManageCoverage(actor) || !getStaffMember(input.staffId) || !AdelanteEHR.getPatient(input.patientId) || !Number.isFinite(Date.parse(input.start)) || (input.end && Date.parse(input.end) <= Date.parse(input.start))) throw new Error("Clinical coordinator and valid assignment required.");
  const row = { ...input, id: `team-${++sequence}` }; additionalTeam.push(row); AdelanteEHR._emit(); return { ...row };
}
export function _resetChartRelationships() { coverage.length = 0; additionalTeam.length = 0; }