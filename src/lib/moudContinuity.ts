// §Phase 3 Part B — MOUD continuity across release.
//
// One record per patient PER RELEASE CYCLE (keyed by pre-release episode), so
// a later release never inherits an earlier plan or confirmation. A sibling
// store module of AdelanteEHR (same pattern as outpatientCare.ts): writes go
// through registered runAction actions and audit into the existing stream via
// AdelanteEHR._recordAudit, which also re-renders subscribers.
//
// Part 2: everything here is SUD-specific. Viewers without the existing
// part2_sud disclosure path see nothing (no record, no title). Audit text is
// neutral ("continuity_plan_recorded"), never a drug or program name.
//
// No reason is required for a plan or confirmation (Mitch, Oct 13): the step
// type and date are the record; the audit still records actor, time, before/after.
import { AdelanteEHR, type MedOrder, type PreReleaseEpisode } from "@/lib/ehr";
import { disclosureAccess } from "@/lib/ab133";
import { isMatOrder, refillRunway } from "@/lib/medAdherence";
import { getStaffMember, isPrescriberRole, type StaffRole } from "@/lib/roles";
import { chartEntryFor, roleHasChartEntry } from "@/lib/chartAccess";
import { isAssignedTo } from "@/lib/caseloadScope";
import { facilityDateKey } from "@/lib/facilityTime";
import type { StatusChipState } from "@/components/ui/status-chip";

export type MoudPlanType = "bridge_prescription" | "moud_appointment";
export type MoudConfirmType = "first_community_dose" | "moud_visit_kept";

export interface MoudContinuityRecord {
  patientId: string;
  /** Release-cycle linkage (pre-release episode id). */
  episodeId?: string;
  /** Confirmed release basis, when available. Never the anticipated date. */
  releaseDate?: string;
  planInPlace?: { type: MoudPlanType; at: string; byStaffId: string };
  confirmed?: { type: MoudConfirmType; at: string; byStaffId: string };
}

export const MOUD_PLAN_LABEL: Record<MoudPlanType, string> = {
  bridge_prescription: "Bridge prescription",
  moud_appointment: "Community MOUD appointment",
};
export const MOUD_CONFIRM_LABEL: Record<MoudConfirmType, string> = {
  first_community_dose: "First community dose",
  moud_visit_kept: "MOUD visit kept",
};
export const MOUD_CLINICAL_DEFAULT_NOTE = "Default per published guidance; pending clinical review (Dr. Bagga)";

const records = new Map<string, MoudContinuityRecord>();
const keyFor = (patientId: string, episodeId: string) => `${patientId}::${episodeId}`;

export interface ReleaseCycle {
  episodeId: string;
  /** Confirmed actual release date only. */
  releaseDate?: string;
  released: boolean;
}

/** The current release cycle: the open/released episode, else the most recent one. */
export function releaseCycleFor(patientId: string): ReleaseCycle | undefined {
  const eps = [...AdelanteEHR.listPreReleaseEpisodes(patientId)].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const ep: PreReleaseEpisode | undefined = eps.find((e) => e.status !== "closed") ?? eps[0];
  if (!ep) return undefined;
  return {
    episodeId: ep.id,
    ...(ep.actualReleaseDate ? { releaseDate: ep.actualReleaseDate } : {}),
    released: Boolean(ep.actualReleaseDate),
  };
}

/** Real active MOUD/MAT orders (existing isMatOrder). */
export function moudOrdersFor(patientId: string): MedOrder[] {
  return AdelanteEHR.listOrders(patientId).filter(
    (o) => isMatOrder(o) && o.status !== "draft" && o.status !== "discontinued",
  );
}

/** Existing gates only: Part 2 disclosure path, plus chart site/restricted entry for chart roles. */
export function canViewMoudContinuity(actor: { role: StaffRole; staffId?: string }, patientId: string): boolean {
  if (!disclosureAccess({ patientId, kind: "part2_sud", actorRole: actor.role }).allowed) return false;
  if (roleHasChartEntry(actor.role)) {
    const entry = chartEntryFor(actor.role, actor.staffId, patientId);
    if (!entry.ok) return false;
    if (entry.restricted && !entry.careTeam) return false;
  }
  return true;
}

export type WriterCheck = { ok: true } | { ok: false; reason: string };

/** Writers: assigned reentry guide, assigned care coordinator, or a prescriber role — after the view gates. */
export function moudWriterCheck(actor: { role: StaffRole; staffId?: string }, patientId: string): WriterCheck {
  if (!canViewMoudContinuity(actor, patientId))
    return { ok: false, reason: "Your role can't record continuity for this person." };
  const cycle = releaseCycleFor(patientId);
  if (!cycle) return { ok: false, reason: "No release episode on record." };
  if (isPrescriberRole(actor.role)) return { ok: true };
  const ep = AdelanteEHR.getPreReleaseEpisode(cycle.episodeId);
  if (actor.staffId && ep?.cfCareManagerStaffId === actor.staffId) return { ok: true };
  const member = getStaffMember(actor.staffId);
  const p = AdelanteEHR.getPatient(patientId);
  if (member?.caseManagerId && p && isAssignedTo(p, { caseManagerId: member.caseManagerId })) return { ok: true };
  return { ok: false, reason: "Only the assigned reentry guide, care coordinator or a prescriber can record this." };
}

/** Read for a viewer; undefined when the viewer may not see Part 2 content. */
export function getMoudContinuity(patientId: string, viewer?: { role: StaffRole; staffId?: string }): MoudContinuityRecord | undefined {
  if (viewer && !canViewMoudContinuity(viewer, patientId)) return undefined;
  const cycle = releaseCycleFor(patientId);
  if (!cycle) return undefined;
  const r = records.get(keyFor(patientId, cycle.episodeId));
  const base: MoudContinuityRecord = r ?? { patientId, episodeId: cycle.episodeId };
  return { ...base, ...(cycle.releaseDate ? { releaseDate: cycle.releaseDate } : {}) };
}

interface WriteActor { role: StaffRole; staffId: string }

function write(
  patientId: string,
  actor: WriteActor,
  action: string,
  mutate: (r: MoudContinuityRecord) => void,
): MoudContinuityRecord {
  const check = moudWriterCheck(actor, patientId);
  if (!check.ok) throw new Error(check.reason);
  const cycle = releaseCycleFor(patientId)!;
  const k = keyFor(patientId, cycle.episodeId);
  const before = records.get(k);
  const next: MoudContinuityRecord = {
    ...(before ?? { patientId, episodeId: cycle.episodeId }),
    ...(cycle.releaseDate ? { releaseDate: cycle.releaseDate } : {}),
  };
  mutate(next);
  records.set(k, next);
  AdelanteEHR._recordAudit({
    category: "clinical",
    action,
    patientId,
    actorId: actor.staffId,
    actorRole: actor.role,
    detail: {
      episodeId: cycle.episodeId,
      before: { planInPlace: before?.planInPlace ?? null, confirmed: before?.confirmed ?? null },
      after: { planInPlace: next.planInPlace ?? null, confirmed: next.confirmed ?? null },
    },
  });
  return { ...next };
}

const today = () => new Date().toISOString().slice(0, 10);

export function recordMoudPlan(input: { patientId: string; type: MoudPlanType; at?: string; actor: WriteActor }): MoudContinuityRecord {
  if (!MOUD_PLAN_LABEL[input.type]) throw new Error("Choose a plan type.");
  return write(input.patientId, input.actor, "continuity_plan_recorded", (r) => {
    r.planInPlace = { type: input.type, at: input.at || today(), byStaffId: input.actor.staffId };
  });
}

export function confirmMoudContinuity(input: { patientId: string; type: MoudConfirmType; at?: string; actor: WriteActor }): MoudContinuityRecord {
  if (!MOUD_CONFIRM_LABEL[input.type]) throw new Error("Choose what was confirmed.");
  const cycle = releaseCycleFor(input.patientId);
  if (cycle && !cycle.released) throw new Error("Confirm after the release is recorded.");
  return write(input.patientId, input.actor, "continuity_confirmed", (r) => {
    r.confirmed = { type: input.type, at: input.at || today(), byStaffId: input.actor.staffId };
  });
}

export function _resetMoudContinuityForTests(): void {
  records.clear();
}

// ---------------------------------------------------------------------------
// Display — staff screens only. Pure functions of real records and dates.
// ---------------------------------------------------------------------------

export interface ChipView { state: StatusChipState; label: string }

function daysBetween(fromKey: string, toKey: string): number {
  const [a, b] = [fromKey, toKey].map((k) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!);
  });
  return Math.round((b! - a!) / 86_400_000);
}

/** Continuity chip; undefined when there is no release cycle (nothing runnable to show). */
export function moudContinuityView(
  record: MoudContinuityRecord | undefined,
  cycle: ReleaseCycle | undefined,
  now: Date = new Date(),
  tz?: string,
): ChipView | undefined {
  if (!cycle) return undefined;
  // Default per published guidance; pending clinical review (Dr. Bagga)
  if (record?.confirmed) return { state: "done", label: "Confirmed" };
  if (cycle.released && cycle.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(cycle.releaseDate)) {
    const since = daysBetween(cycle.releaseDate, facilityDateKey(now, tz));
    // Default per published guidance; pending clinical review (Dr. Bagga)
    if (since >= 0 && since <= 14) return { state: "urgent", label: "Reach out today" };
    // Default per published guidance; pending clinical review (Dr. Bagga)
    if (since > 14) return { state: "yourturn", label: "Confirm MOUD continuity" };
  }
  if (cycle.released) return undefined; // released with no runnable date: no invented urgency
  // Default per published guidance; pending clinical review (Dr. Bagga)
  if (!record?.planInPlace) return { state: "yourturn", label: "Set MOUD plan" };
  // Default per published guidance; pending clinical review (Dr. Bagga)
  return { state: "upnext", label: "Plan in place" };
}

/** Out-of-supply chip from the existing refillRunway; undefined without a runnable start date and supply. */
export function supplyView(order: MedOrder, now: Date = new Date()): ChipView | undefined {
  const runway = refillRunway(order, now);
  if (!runway || runway.daysLeft > 0) return undefined;
  // Default per published guidance; pending clinical review (Dr. Bagga)
  if (isMatOrder(order)) return { state: "urgent", label: "Out of MAT — reach out" };
  // Default per published guidance; pending clinical review (Dr. Bagga)
  return { state: "yourturn", label: "Ask for a refill" };
}
