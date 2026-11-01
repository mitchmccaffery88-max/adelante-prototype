// R57: explainable, non-punitive rules. Draft — pending clinical sign-off.
import type { Patient, Appointment, SdohPlanItem } from './ehr';
import type { StaffRole } from './roles';
import { lastScoredAt, RESCREEN_PROMPT_RULES } from './rescreenCadence';
export const ENGAGEMENT_DRAFT = 'Draft — pending clinical sign-off';
export const ENGAGEMENT_TASK_TITLE = 'Engagement check-in needed';
export const ENGAGEMENT_OUTCOMES = ['Reached, re-engaged', 'Reached, needs help', 'Unable to reach', 'Member declined'] as const;
export type EngagementOutcome = typeof ENGAGEMENT_OUTCOMES[number];
export const ENGAGEMENT_CLOSE_ROLES: readonly StaffRole[] = ['ecm_provider', 'cf_care_manager', 'community_health_worker', 'peer_specialist', 'clinical_coordinator', 'therapist', 'sud_counselor', 'clinical_trainee', 'pmhnp', 'physician', 'nurse_rn', 'lvn'];
export const ENGAGEMENT_SETTINGS = {
  missed: { days: 30, minimum: 2, weight: 'High', label: ENGAGEMENT_DRAFT },
  outreach: { days: 7, minimum: 3, weight: 'High', label: ENGAGEMENT_DRAFT },
  contact: { days: 14, weight: 'High', label: ENGAGEMENT_DRAFT },
  housing: { weight: 'Medium', label: ENGAGEMENT_DRAFT },
  phoneData: { weight: 'High', label: ENGAGEMENT_DRAFT },
  transportation: { weight: 'Medium', label: ENGAGEMENT_DRAFT },
  food: { weight: 'Low', label: ENGAGEMENT_DRAFT },
  rescreen: { days: RESCREEN_PROMPT_RULES.staffFollowupDays, weight: 'Low', label: ENGAGEMENT_DRAFT },
  early: { days: 14, label: ENGAGEMENT_DRAFT },
  coverage: { weight: 'Medium', label: ENGAGEMENT_DRAFT },
} as const;
const DAY = 86400000;
export interface OutreachMetadata { id: string; at: string; kind: 'attempt' | 'contact' | 'staff_message' | 'member_reply' }
export interface EngagementFacts { patient: Patient; appointments: readonly Pick<Appointment, 'id' | 'start' | 'status' | 'cancellation' | 'noShow'>[]; outreach: readonly OutreachMetadata[] }
export type EngagementSignalKey = Exclude<keyof typeof ENGAGEMENT_SETTINGS, 'early'>;
export interface EngagementFlag { level: 'Watch' | 'Elevated'; signals: { key: EngagementSignalKey; weight: 'High' | 'Medium' | 'Low'; reason: string }[]; earlyReentry: boolean; label: string }
const inWindow = (at: string, now: number, days: number) => Number.isFinite(Date.parse(at)) && Date.parse(at) <= now && now - Date.parse(at) < days * DAY;
const unresolved = (item: SdohPlanItem) => item.status !== 'completed';
export function missedVisits(facts: EngagementFacts, now: number) {
  return facts.appointments.filter(a => ['no_show', 'late_cancel'].includes(a.status) && inWindow(a.status === 'late_cancel' ? a.cancellation?.at ?? a.start : a.noShow?.at ?? a.start, now, ENGAGEMENT_SETTINGS.missed.days));
}
/** Metadata only; contact/reply clears prior attempts, not later attempts. */
export function unansweredOutreach(rows: readonly OutreachMetadata[], now: number) {
  const recent = rows.filter(r => inWindow(r.at, now, ENGAGEMENT_SETTINGS.outreach.days));
  const replied = Math.max(-Infinity, ...recent.filter(r => r.kind === 'contact' || r.kind === 'member_reply').map(r => Date.parse(r.at)));
  return recent.filter(r => (r.kind === 'attempt' || r.kind === 'staff_message') && Date.parse(r.at) > replied).length;
}
export function engagementNeedsData(p: Patient) {
  return ['Phone disconnected', 'SMS undeliverable', 'Packet confirmations as needs-change events', ...(!p.sdohPlan?.items.some(i => i.need === 'Phone or internet' && i.source === 'intake_self_report' && !i.safetySensitive) ? ['No phone or data'] : []), ...(!p.coverage?.status ? ['Coverage gap'] : []), ...(!p.releaseDate ? ['Early reentry window'] : [])].map(signal => ({ signal, status: 'needs data' as const, label: ENGAGEMENT_DRAFT }));
}
/** Only allowlisted reasons are returned; no safety/Part 2 payload is retained. */
export function evaluateEngagement(facts: EngagementFacts, now: number): EngagementFlag | undefined {
  const p = facts.patient;
  const signals: EngagementFlag['signals'] = [];
  const add = (key: EngagementSignalKey, reason: string) => signals.push({ key, weight: ENGAGEMENT_SETTINGS[key].weight, reason });
  const missed = missedVisits(facts, now).length;
  if (missed >= ENGAGEMENT_SETTINGS.missed.minimum) add('missed', `${missed} missed visits`);
  if (unansweredOutreach(facts.outreach, now) >= ENGAGEMENT_SETTINGS.outreach.minimum) add('outreach', 'outreach not answered');
  if (p.demographicsHistory?.some(h => inWindow(h.at, now, ENGAGEMENT_SETTINGS.contact.days) && h.changes.some(c => c.field === 'phone' && c.before !== c.after))) add('contact', 'phone changed');
  const hrsn = [...(p.screenerHistory ?? []), ...Object.values(p.screeners).filter((r): r is NonNullable<typeof r> => !!r)].filter(r => r.key === 'ahc-hrsn' && !r.retiredForm && !r.provenance && Date.parse(r.completedAt) <= now).sort((a,b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
  const items = (p.sdohPlan?.items ?? []).filter(i => !i.safetySensitive);
  const domainOpen = (key: string, label: string) => {
    const matching = items.filter(i => i.source === 'pre_release_hrsn' && i.need === label && (!hrsn || Date.parse(i.updatedAt) >= Date.parse(hrsn.completedAt)));
    return matching.length === 0 || matching.some(unresolved);
  };
  // Housing-quality alone is NOT instability; require the living-situation answer.
  if (hrsn?.responses?.[0] === 1 && domainOpen('housing', 'Housing instability & quality')) add('housing', 'housing unstable');
  if (hrsn?.domains?.some(d => d.key === 'transportation' && d.positive) && domainOpen('transportation', 'Transportation')) add('transportation', 'transportation need');
  if (hrsn?.domains?.some(d => d.key === 'food' && d.positive) && domainOpen('food', 'Food insecurity')) add('food', 'food need');
  if (items.some(i => i.need === 'Phone or internet' && i.source === 'intake_self_report' && unresolved(i))) add('phoneData', 'phone or data need');
  const history = [...(p.screenerHistory ?? []), ...Object.values(p.screeners).filter((r): r is NonNullable<typeof r> => !!r)];
  if ((p.tasks ?? []).some(t => t.kind === 'rescreen' && !t.completedAt && t.screenerKey && !['cssrs', 'c-ssrs-screener'].includes(t.screenerKey) && inWindow(t.createdAt, now, Infinity) && now - Date.parse(t.createdAt) >= ENGAGEMENT_SETTINGS.rescreen.days * DAY && (lastScoredAt(t.screenerKey, history) ?? -Infinity) < Date.parse(t.createdAt))) add('rescreen', 'screening follow-up waiting');
  const c = p.coverage;
  if (c?.status && (['uninsured'].includes(c.status) || ((!c.coverageType || ['medi_cal', 'dual'].includes(c.coverageType)) && (c.status === 'suspended' || (c.verified === 'pending' && c.status !== 'not_applicable'))))) add('coverage', 'coverage gap');
  if (!signals.length) return undefined;
  const earlyReentry = !!p.releaseDate && inWindow(p.releaseDate, now, ENGAGEMENT_SETTINGS.early.days);
  return { level: signals.some(s => s.weight === 'High') || signals.length >= 2 || earlyReentry ? 'Elevated' : 'Watch', signals, earlyReentry, label: ENGAGEMENT_DRAFT };
}
export interface EngagementOwner { id: string; role: StaffRole }
export function engagementOwner(primaryCareManager?: EngagementOwner, ecm?: EngagementOwner, primaryClinician?: EngagementOwner) {
  const owner = primaryCareManager ?? ecm ?? primaryClinician;
  return owner ? { assignedTo: owner.id, allowedRoles: [owner.role] } : { assignedTo: '', allowedRoles: ['clinical_coordinator' as StaffRole] };
}
/** Real member-sourced writes only; packet confirmations and safety rows omitted. */
export function engagementEvents(facts: EngagementFacts, now: number): string[] {
  const p = facts.patient;
  const history = (p.demographicsHistory ?? []).filter(h => Date.parse(h.at) <= now);
  const events = history.flatMap(h => h.changes.filter(c => ['phone', 'address'].includes(c.field) && c.before !== c.after).map(c => `${c.field}:${h.id}:${h.at}`));
  const missed = missedVisits(facts, now);
  if (missed.length >= 2) events.push(`missed:${missed.map(a => a.id).sort().join(',')}`);
  for (const i of p.sdohPlan?.items ?? []) if (!i.safetySensitive && i.source === 'intake_self_report' && Date.parse(i.createdAt) <= now) events.push(`needs:${i.id}:${i.createdAt}`);
  return events.sort();
}
/** R53 shared cap/skip; event prompts join an existing open HRSN bundle, never duplicate. */
export function eventHrsnAllowed(p: Patient, now: number) {
  if (!p.intakeCompletedAt || (p.tasks ?? []).some(t => t.automaticRescreen && inWindow(t.createdAt, now, RESCREEN_PROMPT_RULES.weeklyCapDays))) return false;
  const last = lastScoredAt('ahc-hrsn', [...(p.screenerHistory ?? []), ...Object.values(p.screeners).filter((r): r is NonNullable<typeof r> => !!r)]);
  return last === undefined || now - last >= RESCREEN_PROMPT_RULES.recentCompletionDays * DAY;
}
