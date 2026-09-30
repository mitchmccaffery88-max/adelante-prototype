// §Batch B2 — referral chase tasks for missing non-critical fields.
// (notification category: "task_assigned")
//
// Draft field split — pending clinical sign-off:
//   CRITICAL (blocks submission): name; date of birth OR another identifier;
//     a way to reach the person OR the referrer.
//   NON-CRITICAL (accepted, then chased): listed in CHASE_FIELDS below.
//
// One chase task per referral lists every missing item. It is kept current by
// a sweep on every store change: created, updated, and closed automatically
// when all items are filled or the referral is enrolled / declined. Closing
// is audited. Nobody closes a task by hand.
//
// Part 2 / sensitivity: task, notification and audit text only names fields
// neutrally ("Missing: custody detail"). Values are never quoted.
import { AdelanteEHR, isReferralClosed, type Referral, type ReferralActor } from "@/lib/ehr";
import { getStaffMember, STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import { REFERRAL_AGING_DRAFT } from "@/lib/referralAging";

export const CHASE_DRAFT_LABEL = "Draft — pending clinical sign-off";

export type ChaseField = "cin" | "releaseDate" | "preferredLanguage" | "address" | "pendingCharges" | "priorRecords" | "emergencyContact";
/** Neutral names — safe for task, notification and audit text. */
export const CHASE_FIELD_LABEL: Record<ChaseField, string> = {
  cin: "Medi-Cal ID",
  releaseDate: "custody detail",
  preferredLanguage: "preferred language",
  address: "address",
  pendingCharges: "legal detail",
  priorRecords: "prior records",
  emergencyContact: "emergency contact",
};
export const CHASE_FIELDS: ChaseField[] = ["cin", "releaseDate", "preferredLanguage", "address", "pendingCharges", "priorRecords", "emergencyContact"];

export function missingChaseFields(r: Referral): ChaseField[] {
  return CHASE_FIELDS.filter((f) => {
    if ((f === "releaseDate" || f === "pendingCharges") && r.justiceInvolved !== "yes") return false;
    const v = (r as unknown as Record<string, unknown>)[f];
    return typeof v !== "string" || !v.trim();
  });
}
export const chaseText = (missing: ChaseField[]) => `Missing: ${missing.map((m) => CHASE_FIELD_LABEL[m]).join(", ")}`;

/** Critical-field check (Draft). Returns the first problem, or null. */
export function referralCriticalProblem(f: { firstName?: string; lastName?: string; dob?: string; cin?: string; phone?: string; email?: string; referrerPhone?: string; referrerEmail?: string }): string | null {
  if (!f.firstName?.trim() || !f.lastName?.trim()) return "Add the person's first and last name.";
  if (!f.dob?.trim() && !f.cin?.trim()) return "Add a date of birth or a Medi-Cal ID.";
  if (!f.phone?.trim() && !f.email?.trim() && !f.referrerPhone?.trim() && !f.referrerEmail?.trim())
    return "Add a way to reach the person or the referrer.";
  return null;
}

// ------------------------------------------------------------------ roles
/** Can own a chase task when assigned the referral. */
export const CHASE_OWNER_ROLES: readonly StaffRole[] = ["ecm_provider", "cf_care_manager"];
/** Shared pool. */
export const CHASE_POOL_ROLE: StaffRole = "clinical_coordinator";
/** Can open the referral and record a missing value / log outreach. Never owns. */
export const CHASE_FILL_ROLES: readonly StaffRole[] = ["peer_specialist", "community_health_worker", "ecm_provider", "cf_care_manager", "clinical_coordinator"];
export const canFillChase = (r: StaffRole) => CHASE_FILL_ROLES.includes(r);
export const canSeeChaseTasks = (r: StaffRole) => CHASE_OWNER_ROLES.includes(r) || r === CHASE_POOL_ROLE;
export const canClaimChase = (r: StaffRole) => r === CHASE_POOL_ROLE;
export const canAssignReferralOwner = (r: StaffRole) => r === CHASE_POOL_ROLE;
export const chaseOwnerCandidates = () => STAFF_ROSTER.filter((s) => CHASE_OWNER_ROLES.includes(s.role));

// ------------------------------------------------------------------ state
export interface ChaseTask {
  id: string;
  referralId: string;
  missing: ChaseField[];
  createdAt: string;
  dueAt: string;
  overdueAt: string;
  status: "open" | "closed";
  owner?: ReferralActor;
  /** Coordinator who claimed a pool task. */
  claimedBy?: ReferralActor;
  closedAt?: string;
  closedReason?: "all_filled" | "enrolled" | "declined";
}
const tasks = new Map<string, ChaseTask>();
let sweeping = false;

function ownerFor(r: Referral, t?: ChaseTask): ReferralActor | undefined {
  if (r.assignedOwner && CHASE_OWNER_ROLES.includes(r.assignedOwner.role as StaffRole)) return r.assignedOwner;
  return t?.claimedBy;
}
function audit(action: string, r: Referral, detail: Record<string, unknown>, actor?: ReferralActor) {
  AdelanteEHR._recordAudit({ category: "clinical", action, actorId: actor?.staffId ?? "system", actorRole: actor?.role, detail: { referralId: r.id, ...detail } });
}

export function sweepReferralChase(now: Date = new Date()): void {
  if (sweeping) return;
  sweeping = true;
  try {
    for (const r of AdelanteEHR.listReferrals()) {
      const t = tasks.get(r.id);
      const missing = missingChaseFields(r);
      const closeReason = r.status === "enrolled" ? "enrolled" : r.status === "declined" ? "declined" : missing.length === 0 ? "all_filled" : undefined;
      if (closeReason) {
        if (t && t.status === "open") {
          t.status = "closed";
          t.closedAt = now.toISOString();
          t.closedReason = closeReason;
          audit("referral_chase_closed", r, { reason: closeReason });
        }
        continue;
      }
      if (isReferralClosed(r.status)) continue;
      if (!t || t.status === "closed") {
        const created = t?.createdAt ?? r.createdAt;
        const nt: ChaseTask = {
          id: `chase-${r.id}`,
          referralId: r.id,
          missing,
          createdAt: created,
          dueAt: new Date(+new Date(created) + REFERRAL_AGING_DRAFT.dueDays * 86400_000).toISOString(),
          overdueAt: new Date(+new Date(created) + REFERRAL_AGING_DRAFT.overdueDays * 86400_000).toISOString(),
          status: "open",
        };
        nt.owner = ownerFor(r, nt);
        tasks.set(r.id, nt);
        audit("referral_chase_opened", r, { missing: missing.map((m) => CHASE_FIELD_LABEL[m]), routedTo: nt.owner ? "owner" : "coordinator_pool" });
        notifyOwner(r, nt);
        continue;
      }
      const prevOwner = t.owner?.staffId;
      if (t.missing.join() !== missing.join()) {
        t.missing = missing;
        audit("referral_chase_updated", r, { missing: missing.map((m) => CHASE_FIELD_LABEL[m]) });
      }
      t.owner = ownerFor(r, t);
      if (t.owner && t.owner.staffId !== prevOwner) notifyOwner(r, t);
    }
  } finally {
    sweeping = false;
  }
}

function notifyOwner(r: Referral, t: ChaseTask) {
  const common = {
    category: "task" as never,
    subject: "Referral details to follow up",
    body: chaseText(t.missing),
    linkRoute: "/referral-queue",
    dedupeKey: `chase:${r.id}:${t.owner?.staffId ?? "pool"}`,
  };
  if (t.owner) AdelanteEHR.notify({ recipientStaffId: t.owner.staffId, ...common });
  else AdelanteEHR.notify({ recipientRole: CHASE_POOL_ROLE, ...common });
}

let subscribed = false;
export function startReferralChase(): void {
  if (subscribed) return;
  subscribed = true;
  sweepReferralChase();
  AdelanteEHR.subscribe(() => sweepReferralChase());
}

// ------------------------------------------------------------------ reads
export function chaseTaskFor(referralId: string): ChaseTask | undefined {
  sweepReferralChase();
  return tasks.get(referralId);
}
export function listChaseTasks(): ChaseTask[] {
  sweepReferralChase();
  return [...tasks.values()];
}
export type ChaseAging = "fresh" | "due" | "overdue";
export function chaseAging(t: ChaseTask, now: Date = new Date()): ChaseAging {
  if (+now >= +new Date(t.overdueAt)) return "overdue";
  if (+now >= +new Date(t.dueAt)) return "due";
  return "fresh";
}
export interface ChaseRow {
  task: ChaseTask;
  referral: Referral;
  lane: "mine" | "pool";
  aging: ChaseAging;
  text: string;
}
/**
 * What an actor sees in Needs my action. Owners see their own; the clinical
 * coordinator sees unassigned tasks AND overdue owned tasks (to reassign).
 * Every other role sees nothing.
 */
export function chaseRowsFor(actor: { role: StaffRole; staffId?: string }, now: Date = new Date()): ChaseRow[] {
  if (!canSeeChaseTasks(actor.role)) return [];
  const out: ChaseRow[] = [];
  const refs = new Map(AdelanteEHR.listReferrals().map((r) => [r.id, r]));
  for (const t of listChaseTasks()) {
    if (t.status !== "open") continue;
    const referral = refs.get(t.referralId);
    if (!referral) continue;
    const aging = chaseAging(t, now);
    const base = { task: t, referral, aging, text: chaseText(t.missing) };
    if (t.owner && actor.staffId && t.owner.staffId === actor.staffId) out.push({ ...base, lane: "mine" });
    else if (actor.role === CHASE_POOL_ROLE && (!t.owner || aging === "overdue")) out.push({ ...base, lane: "pool" });
  }
  return out;
}

// ------------------------------------------------------------------ writes
type Actor = { role: StaffRole; staffId?: string; name: string };
const toRefActor = (a: Actor): ReferralActor => ({ staffId: a.staffId ?? a.name, name: a.name, role: a.role });

/** Record one or more missing values. Filling never assigns ownership. */
export function fillChaseField(actor: Actor, referralId: string, fields: Partial<Record<ChaseField, string>>): ChaseTask | undefined {
  if (!canFillChase(actor.role)) throw new Error("Your role can't update referral details.");
  const clean: Partial<Record<ChaseField, string>> = {};
  for (const k of CHASE_FIELDS) if (fields[k]?.trim()) clean[k] = fields[k]!.trim();
  if (!Object.keys(clean).length) throw new Error("Enter a value.");
  AdelanteEHR.updateReferralFields(referralId, clean as never);
  return chaseTaskFor(referralId);
}

/** Coordinator claims a pool task for themselves. */
export function claimChaseTask(actor: Actor, referralId: string): ChaseTask {
  if (!canClaimChase(actor.role)) throw new Error("Only a clinical coordinator can take a referral follow-up from the pool.");
  const t = chaseTaskFor(referralId);
  if (!t || t.status !== "open") throw new Error("That follow-up is already closed.");
  t.claimedBy = toRefActor(actor);
  // A named ECM / reentry owner takes precedence; claiming clears it only when the coordinator reassigns.
  const r = AdelanteEHR.listReferrals().find((x) => x.id === referralId)!;
  t.owner = ownerFor(r, t);
  AdelanteEHR._emit();
  return t;
}

/** Coordinator assigns the referral (and so its chase task) to an ECM provider / reentry care manager. */
export function assignReferralOwner(actor: Actor, referralId: string, staffId: string | undefined): Referral {
  if (!canAssignReferralOwner(actor.role)) throw new Error("Only a clinical coordinator can assign a referral.");
  if (!staffId) return AdelanteEHR.setReferralOwner(referralId, undefined);
  const s = getStaffMember(staffId);
  if (!s || !CHASE_OWNER_ROLES.includes(s.role)) throw new Error("Pick an ECM provider or reentry care manager.");
  const t = tasks.get(referralId);
  if (t) t.claimedBy = undefined;
  return AdelanteEHR.setReferralOwner(referralId, { staffId: s.id, name: s.name, role: s.role });
}

export function _resetReferralChase(): void {
  tasks.clear();
}
startReferralChase();
