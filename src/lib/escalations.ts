// §U1 — Unified escalation queue: ONE view model over the existing pathways.
//
// Sources (stores and their rules are unchanged; this file only reads them):
//   crisis               → patient.crisisEscalations (clinical lane)   — crisisPolicy SLA
//   urgent_social_need   → patient.crisisEscalations (category "sdoh") — crisisPolicy SLA
//   score_change         → patient.severityFlags (open, non-historical)
//   crisis_note          → overdueCrisisNotes (noteClock 1-day clock)
//   missed_handoff       → missed pre-release coordination episodes
//   refusal              → repeated medication refusals (in-facility only)
//
// Shared actions (acknowledge / hand off / reassign) run through registry
// actions. Crisis rows delegate to the crisis store's own claim / handoff
// functions; other rows keep a small overlay here (ack + named owner), so
// the source store rules never change. Everything is audited without content.
import { AdelanteEHR, type Patient } from "./ehr";
import { crisisSlaState, crisisSlaTarget, overdueByLabel } from "./crisisPolicy";
import { overdueCrisisNotes } from "./noteClock";
import { inFacilityEnabled } from "./inFacility";
import { roleSeesAsamSection } from "./asamReporting";
import { isSudMedication } from "./sudMedClassifier";
import { part2SafeText } from "./actions/runAction";
import { STAFF_ROSTER, type StaffMember, type StaffRole } from "./roles";
import { severityAssignee, seesSeverity } from "./severityFlags";

export const ESCALATION_DRAFT_LABEL = "Draft — pending clinical sign-off";
const HOUR = 3_600_000;
/** Draft SLAs for pathways that have no clock of their own yet. */
export const ESCALATION_SLA_DRAFT = {
  score_change: { ms: 72 * HOUR, label: "72 hour (draft)" },
  missed_handoff: { ms: 24 * HOUR, label: "Day one (draft)" },
  refusal: { ms: 72 * HOUR, label: "72 hour (draft)" },
} as const;

export type EscalationType = "crisis" | "score_change" | "crisis_note" | "urgent_social_need" | "missed_handoff" | "refusal";
export type EscalationStatus = "new" | "acknowledged" | "handed_off" | "overdue" | "resolved";

export const ESCALATION_TYPE_LABEL: Record<EscalationType, string> = {
  crisis: "Crisis",
  score_change: "Score change",
  crisis_note: "Crisis note",
  urgent_social_need: "Urgent social need",
  missed_handoff: "Missed handoff",
  refusal: "Medication refusal",
};
/** Shown instead of the type for SUD-derived rows when the viewer lacks SUD access. */
export const NEUTRAL_TYPE_LABEL = "Follow-up needed";
export const POOL_LABEL = "Coordinator pool";

export interface EscalationRow {
  key: string;
  type: EscalationType;
  typeLabel: string;
  sourceId: string;
  patientId: string;
  patientName: string;
  ownerStaffId?: string;
  ownerName: string;
  pool: boolean;
  dueAt: string;
  overdue: boolean;
  countdown: string;
  status: EscalationStatus;
  /** Derived from SUD data (Part 2). */
  sud: boolean;
  /** True when this viewer sees the neutral label only. */
  masked: boolean;
  detail?: string;
  primaryAction: string;
}

export interface EscalationActor {
  staffId?: string;
  name: string;
  role: StaffRole;
}

// ---------------------------------------------------------------------------
// Overlay for non-crisis rows (crisis rows use the crisis store directly).
// ---------------------------------------------------------------------------
interface Overlay {
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  ownerStaffId?: string;
  ownerName?: string;
  handoffs: { at: string; toStaffId: string; byName: string; byRole: string; reason: string; kind: "handoff" | "reassign" }[];
}
const overlays = new Map<string, Overlay>();
const ov = (key: string): Overlay => {
  let o = overlays.get(key);
  if (!o) overlays.set(key, (o = { handoffs: [] }));
  return o;
};
/** Test helper. */
export function _resetEscalationOverlays(): void {
  overlays.clear();
}

export const isCoordinator = (role: StaffRole) => role === "clinical_coordinator" || role === "sys_admin";
/** Supervisors = anyone who supervises another staff member. */
export function isSupervisor(staffId?: string): boolean {
  return !!staffId && STAFF_ROSTER.some((m) => m.supervisedBy === staffId);
}
export function canSeeAllEscalations(actor: { role: StaffRole; staffId?: string }): boolean {
  return isCoordinator(actor.role) || isSupervisor(actor.staffId);
}
const NO_QUEUE: readonly StaffRole[] = ["billing", "billing_coordinator", "credentialing_coordinator"];
export function canUseEscalations(role: StaffRole): boolean {
  return !NO_QUEUE.includes(role);
}

function staffFor(idOrClinician?: string): StaffMember | undefined {
  if (!idOrClinician) return undefined;
  return STAFF_ROSTER.find((m) => m.id === idOrClinician) ?? STAFF_ROSTER.find((m) => m.clinicianId === idOrClinician);
}
const pname = (p: Patient) => `${p.firstName} ${p.lastName}`;

function countdownLabel(dueAt: string, now: number): { overdue: boolean; text: string } {
  const left = +new Date(dueAt) - now;
  if (left <= 0) return { overdue: true, text: overdueByLabel(-left) };
  const h = Math.floor(left / HOUR);
  const m = Math.round((left % HOUR) / 60000);
  return { overdue: false, text: h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h ${m}m left` };
}
const SUD_TEXT = (t?: string) => !!t && part2SafeText(t) !== t;
const SUD_SCREENERS = /^(audit|audit_c|auditc|dast|dast10|cows|ciwa)/i;

interface Raw extends Omit<EscalationRow, "typeLabel" | "masked" | "countdown" | "overdue" | "status" | "ownerName" | "pool" | "primaryAction"> {
  ownerName?: string;
  resolved?: boolean;
  acknowledged?: boolean;
  handedOff?: boolean;
  forceOverdue?: boolean;
}

function rawRows(now: number): { raw: Raw; patient: Patient }[] {
  const out: { raw: Raw; patient: Patient }[] = [];
  for (const p of AdelanteEHR.listPatients()) {
    // crisis + urgent social need — same store, existing SLA.
    for (const e of p.crisisEscalations ?? []) {
      const resolvedRecently = e.status === "resolved" && e.resolvedAt && now - +new Date(e.resolvedAt) < 24 * HOUR;
      if (e.status !== "open" && !resolvedRecently) continue;
      const since = e.lastTriggeredAt ?? e.triggeredAt;
      const named = e.ownerLane === "named" && !!e.ownerStaffId;
      out.push({
        patient: p,
        raw: {
          key: `crisis:${e.id}`,
          type: e.category === "sdoh" ? "urgent_social_need" : "crisis",
          sourceId: e.id,
          patientId: p.id,
          patientName: pname(p),
          ownerStaffId: named ? e.ownerStaffId : undefined,
          ownerName: named ? e.ownerName : undefined,
          dueAt: new Date(+new Date(since) + crisisSlaTarget(e).ms).toISOString(),
          sud: SUD_TEXT(e.triggerDetail),
          detail: e.triggerDetail,
          resolved: e.status === "resolved",
          acknowledged: !!e.claimedBy,
          handedOff: (e.handoffs?.length ?? 0) > 0,
          forceOverdue: crisisSlaState(e, now).overdue,
        },
      });
    }
    // score change — open severity flags; owner = primary clinician, else prescriber.
    for (const f of p.severityFlags ?? []) {
      if (f.kind !== "flag" || f.historical) continue;
      const reviewedRecently = f.reviewedAt && now - +new Date(f.reviewedAt) < 24 * HOUR;
      if (f.reviewedAt && !reviewedRecently) continue;
      const owner = staffFor(severityAssignee(p));
      out.push({
        patient: p,
        raw: {
          key: `severity:${f.id}`,
          type: "score_change",
          sourceId: f.id,
          patientId: p.id,
          patientName: pname(p),
          ownerStaffId: owner?.id,
          ownerName: owner?.name,
          dueAt: new Date(+new Date(f.createdAt) + ESCALATION_SLA_DRAFT.score_change.ms).toISOString(),
          sud: SUD_SCREENERS.test(f.key),
          detail: f.text,
          resolved: !!f.reviewedAt,
        },
      });
    }
    // missed handoff — day-one catch-up episodes still open.
    for (const ep of AdelanteEHR.listPreReleaseEpisodes(p.id)) {
      if (!ep.missedHandoff || ep.closedAt) continue;
      const owner = staffFor(ep.cfCareManagerStaffId);
      out.push({
        patient: p,
        raw: {
          key: `handoff:${ep.id}`,
          type: "missed_handoff",
          sourceId: ep.id,
          patientId: p.id,
          patientName: pname(p),
          ownerStaffId: owner?.id,
          ownerName: owner?.name ?? (ep.cfCareManagerName || undefined),
          dueAt: new Date(+new Date(ep.openedAt) + ESCALATION_SLA_DRAFT.missed_handoff.ms).toISOString(),
          sud: false,
          detail: "Pre-release coordination did not happen — day-one catch-up.",
        },
      });
    }
    // refusal escalations — in-facility only.
    if (inFacilityEnabled())
      for (const o of p.orders ?? []) {
        if (!AdelanteEHR.refusalEscalationDue(p.id, o.id, new Date(now))) continue;
        const last = AdelanteEHR.refusalsInWindow(p.id, o.id, undefined, new Date(now)).map((a) => a.chartedAt).sort().at(-1) ?? new Date(now).toISOString();
        out.push({
          patient: p,
          raw: {
            key: `refusal:${p.id}:${o.id}`,
            type: "refusal",
            sourceId: o.id,
            patientId: p.id,
            patientName: pname(p),
            dueAt: new Date(+new Date(last) + ESCALATION_SLA_DRAFT.refusal.ms).toISOString(),
            sud: isSudMedication(o),
            detail: `Repeated refusals — ${o.drugName}`,
          },
        });
      }
  }
  // crisis notes past the 1-day clock (noteClock); owner = note author.
  for (const { patient, note, clock } of overdueCrisisNotes(AdelanteEHR.listPatients(), new Date(now))) {
    const owner = staffFor(note.clinicianId);
    out.push({
      patient,
      raw: {
        key: `crisis_note:${note.id}`,
        type: "crisis_note",
        sourceId: note.id,
        patientId: patient.id,
        patientName: pname(patient),
        ownerStaffId: owner?.id,
        ownerName: owner?.name,
        dueAt: clock.dueAt,
        sud: note.category === "sud",
        detail: "Crisis note not signed within the 1-day clock.",
        forceOverdue: true,
      },
    });
  }
  return out;
}

const PRIMARY: Record<EscalationType, string> = {
  crisis: "Open crisis",
  urgent_social_need: "Open plan",
  score_change: "Review",
  crisis_note: "Open note",
  missed_handoff: "Open chart",
  refusal: "Open chart",
};

/** Every escalation, Part 2-masked for this viewer, overdue first then by due time. */
export function listEscalations(viewer: { role: StaffRole; staffId?: string }, now: number = Date.now()): EscalationRow[] {
  if (!canUseEscalations(viewer.role)) return [];
  const rows = rawRows(now).map(({ raw, patient }) => {
    const o = raw.type === "crisis" || raw.type === "urgent_social_need" ? undefined : overlays.get(raw.key);
    const ownerStaffId = o?.ownerStaffId ?? raw.ownerStaffId;
    const ownerName = o?.ownerName ?? raw.ownerName;
    const cd = countdownLabel(raw.dueAt, now);
    const overdue = !raw.resolved && (cd.overdue || !!raw.forceOverdue);
    const handedOff = raw.handedOff || (o?.handoffs.length ?? 0) > 0;
    const acknowledged = raw.acknowledged || !!o?.acknowledgedAt;
    const status: EscalationStatus = raw.resolved ? "resolved" : overdue ? "overdue" : handedOff ? "handed_off" : acknowledged ? "acknowledged" : "new";
    // MH score detail also needs the screener section; SUD rows need SUD access.
    const masked = (raw.sud && !roleSeesAsamSection(viewer.role, patient)) || (raw.type === "score_change" && !seesSeverity(viewer.role, patient));
    const sudMasked = raw.sud && !roleSeesAsamSection(viewer.role, patient);
    const row: EscalationRow = {
      key: raw.key,
      type: raw.type,
      typeLabel: sudMasked ? NEUTRAL_TYPE_LABEL : ESCALATION_TYPE_LABEL[raw.type],
      sourceId: raw.sourceId,
      patientId: raw.patientId,
      patientName: raw.patientName,
      ownerStaffId,
      ownerName: ownerName ?? POOL_LABEL,
      pool: !ownerStaffId,
      dueAt: raw.dueAt,
      overdue,
      countdown: raw.resolved ? "Resolved" : cd.overdue ? cd.text : overdue ? "Overdue" : cd.text,
      status,
      sud: raw.sud,
      masked,
      detail: masked ? undefined : raw.detail,
      primaryAction: status === "new" ? "Acknowledge" : sudMasked ? "Open chart" : PRIMARY[raw.type],
    };
    return row;
  });
  return sortEscalations(rows);
}

export function sortEscalations(rows: EscalationRow[]): EscalationRow[] {
  const rank = (r: EscalationRow) => (r.status === "resolved" ? 2 : r.overdue ? 0 : 1);
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.dueAt.localeCompare(b.dueAt));
}

export type EscalationView = "mine" | "all";
export interface EscalationFilter {
  view: EscalationView;
  type?: EscalationType;
  ownerStaffId?: string | "pool";
  overdueOnly?: boolean;
}

/** "Mine" = named owner is me (coordinators also get the pool). "All" needs coordinator / supervisor. */
export function filterEscalations(rows: EscalationRow[], viewer: { role: StaffRole; staffId?: string }, f: EscalationFilter): EscalationRow[] {
  const all = f.view === "all" && canSeeAllEscalations(viewer);
  return rows.filter((r) => {
    if (!all && !(r.ownerStaffId === viewer.staffId || (r.pool && isCoordinator(viewer.role)))) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.ownerStaffId === "pool" && !r.pool) return false;
    if (f.ownerStaffId && f.ownerStaffId !== "pool" && r.ownerStaffId !== f.ownerStaffId) return false;
    if (f.overdueOnly && !r.overdue) return false;
    return true;
  });
}

export function myOpenEscalations(viewer: { role: StaffRole; staffId?: string }, now: number = Date.now()): EscalationRow[] {
  return filterEscalations(listEscalations(viewer, now), viewer, { view: "mine" }).filter((r) => r.status !== "resolved");
}

export function getEscalation(key: string, viewer: { role: StaffRole; staffId?: string }): EscalationRow | undefined {
  return listEscalations(viewer).find((r) => r.key === key);
}

// ---------------------------------------------------------------------------
// Shared actions — store functions behind registry actions
// escalation_acknowledge / escalation_handoff / escalation_reassign.
// ---------------------------------------------------------------------------
function rowOrThrow(key: string, actor: EscalationActor): EscalationRow {
  const r = listEscalations({ role: actor.role, staffId: actor.staffId }).find((x) => x.key === key);
  if (!r) throw new Error("Escalation not found.");
  if (r.status === "resolved") throw new Error("This escalation is already resolved.");
  return r;
}
const mayWork = (r: EscalationRow, a: EscalationActor) => isCoordinator(a.role) || (!!a.staffId && r.ownerStaffId === a.staffId);
const audit = (action: string, r: EscalationRow, a: EscalationActor, extra: Record<string, unknown> = {}) =>
  AdelanteEHR._recordAudit({
    category: "clinical",
    action,
    patientId: r.patientId,
    actorId: a.name,
    actorRole: a.role,
    // Content-free: type + ids only, never the detail text.
    detail: { escalationKey: r.key, escalationType: r.sud ? "restricted" : r.type, ...extra },
  });

export function acknowledgeEscalation(key: string, actor: EscalationActor): EscalationRow {
  if (!canUseEscalations(actor.role)) throw new Error("Your role can't work escalations.");
  const r = rowOrThrow(key, actor);
  if (!mayWork(r, actor) && !(r.pool && isCoordinator(actor.role))) throw new Error("Only the owner or a clinical coordinator can acknowledge this.");
  if (r.type === "crisis" || r.type === "urgent_social_need") {
    AdelanteEHR.claimCrisisEscalation(r.patientId, r.sourceId, actor.name);
  } else {
    const o = ov(key);
    if (o.acknowledgedAt) throw new Error("Already acknowledged.");
    o.acknowledgedAt = new Date().toISOString();
    o.acknowledgedBy = actor.name;
  }
  audit("escalation_acknowledged", r, actor);
  AdelanteEHR._emit();
  return getEscalation(key, actor) ?? r;
}

function moveOwner(kind: "handoff" | "reassign", key: string, input: { toStaffId: string; reason: string }, actor: EscalationActor): EscalationRow {
  const reason = input.reason?.trim();
  if (!reason || reason.length < 3) throw new Error("Give a reason for the handoff.");
  const r = rowOrThrow(key, actor);
  const to = STAFF_ROSTER.find((m) => m.id === input.toStaffId && m.active !== false);
  if (!to) throw new Error("Choose an active staff member.");
  if (to.id === r.ownerStaffId) throw new Error("That person already owns this escalation.");
  if (r.type === "crisis" || r.type === "urgent_social_need") {
    AdelanteEHR.handOffCrisisEscalation(r.patientId, r.sourceId, { toStaffId: to.id, reason, byStaffId: actor.staffId ?? "", byName: actor.name, byRole: actor.role });
  } else {
    const o = ov(key);
    o.ownerStaffId = to.id;
    o.ownerName = to.name;
    o.handoffs.push({ at: new Date().toISOString(), toStaffId: to.id, byName: actor.name, byRole: actor.role, reason, kind });
    AdelanteEHR.notify({
      recipientStaffId: to.id,
      category: "task_assigned",
      subject: "Escalation handed to you",
      body: "An escalation needs your follow-up. Open Escalations to see the time left.",
      linkRoute: "/escalations",
      patientId: r.patientId,
      dedupeKey: `escalation-owner:${key}:${to.id}:${o.handoffs.length}`,
    });
  }
  audit(kind === "handoff" ? "escalation_handed_off" : "escalation_reassigned", r, actor, { fromStaffId: r.ownerStaffId ?? null, toStaffId: to.id, reason: part2SafeText(reason) });
  AdelanteEHR._emit();
  return getEscalation(key, actor) ?? r;
}

export function handOffEscalation(key: string, input: { toStaffId: string; reason: string }, actor: EscalationActor): EscalationRow {
  if (!canUseEscalations(actor.role)) throw new Error("Your role can't work escalations.");
  const r = rowOrThrow(key, actor);
  if (!mayWork(r, actor)) throw new Error("Only the owner or a clinical coordinator can hand this off.");
  return moveOwner("handoff", key, input, actor);
}

export function reassignEscalation(key: string, input: { toStaffId: string; reason: string }, actor: EscalationActor): EscalationRow {
  if (!isCoordinator(actor.role)) throw new Error("Only a clinical coordinator can reassign an escalation.");
  return moveOwner("reassign", key, input, actor);
}

/** Staff who can take an escalation (care team only). */
export function escalationHandoffCandidates(excludeStaffId?: string): StaffMember[] {
  return STAFF_ROSTER.filter((m) => m.active !== false && m.id !== excludeStaffId && !NO_QUEUE.includes(m.role) && m.role !== "sys_admin");
}
