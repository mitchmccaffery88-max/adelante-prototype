// R57 Draft — pending clinical sign-off. In-memory clinical store, persistence OFF.
import { AdelanteEHR, worklistStatusFor, type Patient, type CaseTask } from './ehr';
import { STAFF_ROSTER, getStaffMember, canAccess } from './roles';
import { chartEntryFor, onCareTeam } from './chartAccess';
import { validAccessActor, listAdditionalTeam } from './chartRelationships';
import { activeAt } from './chartAccessRules';
import { caseManagerIdFor, listContacts } from './caseloadReview';
import { screenerFollowupActor } from './screenerFollowup';
import { registerEngagementCloseGate, type EngagementActor } from './engagementRiskBoundary';
import { evaluateEngagement, engagementEvents, engagementOwner, eventHrsnAllowed, ENGAGEMENT_CLOSE_ROLES, ENGAGEMENT_TASK_TITLE, type EngagementFlag, type EngagementFacts } from './engagementRisk';
const states = new Map<string, { flag?: EngagementFlag; consumed: string[] }>();
export const isEngagementSystemActor = (a: EngagementActor) => a.role === screenerFollowupActor.role && a.staffId === screenerFollowupActor.staffId;
export const canUseEngagementClose = (a: EngagementActor, p?: Patient) => ENGAGEMENT_CLOSE_ROLES.includes(a.role) && (!p || (validAccessActor(a) && chartEntryFor(a.role, a.staffId, p.id).ok));
export function engagementTaskGate(a: EngagementActor, t: CaseTask) {
  if (!canUseEngagementClose(a, AdelanteEHR.getPatient(t.patientId)) || !validAccessActor(a) || canAccess(a.role, 'worklist').level !== 'write' || worklistStatusFor(t) === 'completed') return false;
  const s = getStaffMember(a.staffId);
  if (!s || t.allowedRoles?.length && !t.allowedRoles.includes(a.role)) return false;
  const identities = [s.id, s.name, s.clinicianId, s.caseManagerId, caseManagerIdFor(s.id)];
  if (t.claimedBy && !identities.includes(t.claimedBy)) return false;
  return t.claimedBy ? identities.includes(t.claimedBy) : !t.assignedTo || identities.includes(t.assignedTo);
}
registerEngagementCloseGate((a, id) => { const t = AdelanteEHR.listCaseTasks().find(t => t.id === id); return !!t && engagementTaskGate(a, t); });
/** Metadata only: destructuring never inspects a message body or a contact note. */
export function engagementFacts(p: Patient): EngagementFacts {
  return { patient: p, appointments: AdelanteEHR.listAppointments().filter(a => a.patientId === p.id), outreach: [
    ...listContacts(p.id).map(({ id, date, type }) => ({ id, at: date, kind: type === 'attempt' ? 'attempt' as const : 'contact' as const })),
    ...(p.careMessages ?? []).flatMap(({ id, createdAt, authorType }) => authorType === 'advocate' ? [] : [{ id, at: createdAt, kind: authorType === 'staff' ? 'staff_message' as const : 'member_reply' as const }]),
  ] };
}
export type EngagementOwnerRouting = { skippedTraineeId: string; branch: 'supervisor' | 'coordinator_queue' };
/** Chain: primary care manager -> ECM -> primary clinician. A trainee owner is skipped to a recorded
 *  close-allowed supervisor with chart entry, else the coordinator queue (Draft — pending clinical sign-off). */
export function engagementOwnerFor(p: Patient, now: Date): ReturnType<typeof engagementOwner> & { routing?: EngagementOwnerRouting } {
  const active = STAFF_ROSTER.filter(s => s.active !== false);
  const primary = active.find(s => !!p.caseManagerId && caseManagerIdFor(s.id) === p.caseManagerId);
  const ecm = active.find(s => s.role === 'ecm_provider' && (s.id === primary?.id || listAdditionalTeam().some(r => r.patientId === p.id && r.staffId === s.id && activeAt(r.start, r.end, now))));
  const clinician = active.find(s => (ENGAGEMENT_CLOSE_ROLES.includes(s.role) || s.role === 'clinical_trainee') && !!p.primaryClinicianId && [s.id, s.clinicianId].includes(p.primaryClinicianId));
  const chosen = primary ?? ecm ?? clinician;
  if (chosen?.role === 'clinical_trainee') {
    const sup = chosen.supervisedBy ? active.find(s => s.id === chosen.supervisedBy) : undefined;
    if (sup && ENGAGEMENT_CLOSE_ROLES.includes(sup.role) && chartEntryFor(sup.role, sup.id, p.id).ok)
      return { ...engagementOwner({ id: sup.id, role: sup.role }), routing: { skippedTraineeId: chosen.id, branch: 'supervisor' } };
    return { ...engagementOwner(), routing: { skippedTraineeId: chosen.id, branch: 'coordinator_queue' } };
  }
  return engagementOwner(chosen ? { id: chosen.id, role: chosen.role } : undefined);
}
const traineeIdentity = (id?: string) => !!id && STAFF_ROSTER.some(s => s.role === 'clinical_trainee' && [s.id, s.clinicianId].includes(id));
/** Staff-only projection; no individual export, member or advocate read. */
export function engagementFlagFor(a: EngagementActor, patientId: string): EngagementFlag | undefined {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p || !validAccessActor(a) || !ENGAGEMENT_CLOSE_ROLES.includes(a.role) || !chartEntryFor(a.role, a.staffId, patientId).ok || (!['ecm_provider', 'cf_care_manager', 'clinical_coordinator', 'community_health_worker', 'peer_specialist'].includes(a.role) && !onCareTeam(a.staffId, p))) return undefined;
  const f = states.get(patientId)?.flag;
  return f ? { ...f, signals: f.signals.map(s => ({ ...s })) } : undefined;
}
/** Only invoked as a registry store reference; state/audit operations are one transaction. */
export function runEngagementRiskStep(patientId: string, at: string, actor: EngagementActor) {
  if (!isEngagementSystemActor(actor)) throw new Error('System engagement automation actor only.');
  const p = AdelanteEHR.getPatient(patientId); const now = Date.parse(at);
  if (!p || !Number.isFinite(now)) throw new Error('Choose a member and valid evaluation date.');
  const facts = engagementFacts(p); const flag = evaluateEngagement(facts, now); const previous = states.get(patientId);
  const events = engagementEvents(facts, now); const pending = events.filter(e => !previous?.consumed.includes(e));
  const changed = JSON.stringify(previous?.flag) !== JSON.stringify(flag);
  let task: CaseTask | undefined; let routing: EngagementOwnerRouting | undefined; let reassigned = false;
  const openTask = AdelanteEHR.caseTasksForPatient(p.id).find(t => t.sourceAutomationId === 'engagement_risk_automation' && t.title === ENGAGEMENT_TASK_TITLE && t.status !== 'done' && !t.completedAt);
  if (openTask && (traineeIdentity(openTask.assignedTo) || traineeIdentity(openTask.claimedBy) || openTask.allowedRoles?.includes('clinical_trainee'))) {
    const o = engagementOwnerFor(p, new Date(at));
    routing = o.routing ?? { skippedTraineeId: openTask.assignedTo, branch: o.assignedTo ? 'supervisor' : 'coordinator_queue' };
    openTask.assignedTo = o.assignedTo; openTask.allowedRoles = o.allowedRoles; openTask.claimedBy = undefined; reassigned = true;
  }
  if (flag?.level === 'Elevated') task = openTask;
  if (flag?.level === 'Elevated' && !task) { const { routing: r, ...o } = engagementOwnerFor(p, new Date(at)); routing = r; task = AdelanteEHR.createCaseTask({ patientId, ...o, title: ENGAGEMENT_TASK_TITLE, detail: ENGAGEMENT_TASK_TITLE, dueDate: at, origin: 'screener_flag', source: 'engagement_risk_automation', sourceAutomationId: 'engagement_risk_automation', taskType: 'engagement_checkin', dedupeKey: `engagement:${p.id}` }); }
  let prompted = false;
  let consumed = previous?.consumed ?? [];
  const open = (p.tasks ?? []).some(t => t.kind === 'rescreen' && t.screenerKey === 'ahc-hrsn' && !t.completedAt);
  if (pending.length && open) consumed = [...new Set([...consumed, ...pending])];
  else if (pending.length && eventHrsnAllowed(p, now)) { AdelanteEHR.createEngagementHrsnPrompt(p.id, at, actor); prompted = true; consumed = [...new Set([...consumed, ...pending])]; }
  states.set(patientId, { flag, consumed });
  if (changed || prompted || reassigned) AdelanteEHR._emit();
  return { patientId, transition: changed ? flag ? previous?.flag ? 'changed' : 'flagged' : 'cleared' : 'unchanged', level: flag?.level ?? 'Clear', taskId: task?.id ?? (reassigned ? openTask?.id : undefined), prompted, ...(routing ? { ownerRouting: routing.branch, skippedTraineeId: routing.skippedTraineeId, reassigned } : {}) };
}
