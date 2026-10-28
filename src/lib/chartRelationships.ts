// Only new relationship facts live here. Existing assignments, supervision,
// groups and on-call remain owned by their original stores.
import { AdelanteEHR } from "./ehr";
import { getStaffMember, hasRoleAssignment, type StaffRole } from "./roles";
import { activeAt } from "./chartAccessRules";

export type AccessActor = { role: StaffRole; staffId?: string };
export interface CoverageAssignment { id: string; coveringStaffId: string; coveredStaffId: string; start: string; end: string }
export interface AdditionalTeamAssignment { id: string; staffId: string; patientId: string; start: string; end?: string; kind?: "care_manager"; /** Why the row is held: "coordinator" and/or "moud:<episodeId>". */ sources?: string[] }
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
  const row = { ...input, id: `team-${++sequence}`, sources: ["coordinator"] }; additionalTeam.push(row); AdelanteEHR._emit(); return { ...row };
}
// 28 Oct (Mitch, Draft): MOUD episode care manager → care_manager team row in the same write.
// The registry entry (moud_care_manager_assign / _end) writes the single audit row; this store does not audit.
const MOUD_ASSIGNER_ROLES: StaffRole[] = ["clinical_coordinator", "cf_care_manager", "ecm_provider"];
const MOUD_CM_ROLES: StaffRole[] = ["cf_care_manager", "ecm_provider"];
export function canAssignMoudCareManager(actor: AccessActor): boolean {
  return validAccessActor(actor) && MOUD_ASSIGNER_ROLES.includes(actor.role);
}
export function assignMoudCareManager(actor: AccessActor, input: { episodeId: string; staffId: string; at?: string }) {
  if (!canAssignMoudCareManager(actor)) throw new Error("Care manager or clinical coordinator assignment required.");
  const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
  if (!ep || ep.status === "closed") throw new Error("Choose an open episode.");
  if (actor.role !== "clinical_coordinator" && (input.staffId !== actor.staffId || (ep.cfCareManagerStaffId && ep.cfCareManagerStaffId !== actor.staffId))) throw new Error("Only the clinical coordinator may assign or replace another care manager.");
  const s = getStaffMember(input.staffId);
  if (!s || s.active === false || !MOUD_CM_ROLES.some(r => hasRoleAssignment(s, r))) throw new Error("Choose an active care manager.");
  const at = input.at ?? new Date().toISOString();
  ep.cfCareManagerStaffId = s.id; ep.cfCareManagerName = s.name;
  const source = `moud:${ep.id}`;
  for (const r of additionalTeam) if (r.staffId !== s.id && r.patientId === ep.patientId && r.sources?.includes(source)) {
    r.sources = r.sources.filter(x => x !== source); if (!r.sources.length && !r.end) r.end = at;
  }
  let row = additionalTeam.find(r => r.staffId === s.id && r.patientId === ep.patientId && activeAt(r.start, r.end, new Date(at)));
  const kept = !!row;
  if (row) { row.kind = row.kind ?? "care_manager"; row.sources = [...new Set([...(row.sources ?? ["coordinator"]), source])]; }
  else { row = { id: `team-${++sequence}`, staffId: s.id, patientId: ep.patientId, start: at, kind: "care_manager", sources: [source] }; additionalTeam.push(row); }
  AdelanteEHR._emit();
  return { id: row.id, episodeId: ep.id, staffId: s.id, kept };
}
export function endMoudCareManager(actor: AccessActor, input: { episodeId: string; at?: string }) {
  if (!canAssignMoudCareManager(actor)) throw new Error("Care manager or clinical coordinator assignment required.");
  const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);
  if (!ep) throw new Error("Choose an episode.");
  const at = input.at ?? new Date().toISOString();
  const source = `moud:${ep.id}`;
  let ended = 0;
  for (const r of additionalTeam) {
    if (r.patientId !== ep.patientId || !r.sources?.includes(source)) continue;
    r.sources = r.sources.filter(x => x !== source);
    if (!r.sources.length && !r.end) { r.end = at; ended++; }
  }
  AdelanteEHR._emit();
  return { id: ep.id, episodeId: ep.id, ended };
}
export function listAdditionalTeam() { return additionalTeam.map(r => ({ ...r, sources: [...(r.sources ?? [])] })); }
export function _resetChartRelationships() { coverage.length = 0; additionalTeam.length = 0; }