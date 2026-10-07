// §B2 — Medi-Cal pre-release / reactivation tracker. Draft rules, one config.
// The eligibility check stays Simulated; statuses carry a source and a date.
import { AdelanteEHR, type Patient, type PreReleaseEpisode } from "./ehr";
import { STAFF_ROSTER, type StaffRole } from "./roles";
import { cohortGuard } from "./cohortGuard";
import { sameBusinessDayDue } from "./medContinuity";

export const COVERAGE_RELEASE_DRAFT = {
  /** Days before release with nothing submitted → task to CF care manager / ECM. */
  preReleaseTaskDays: 30,
  /** Days after release still not Active → escalation to the coordinator. */
  escalateAfterDays: 3,
  /** Days after release still not Active → also flagged on the coordinator's view. */
  flagAfterDays: 10,
  label: "Draft — pending Premier sign-off",
} as const;

export type ReleaseCoverageStatus = "active" | "suspended" | "reactivation_submitted" | "pending" | "not_enrolled" | "unknown";
export const RELEASE_COVERAGE_LABEL: Record<ReleaseCoverageStatus, string> = {
  active: "Active",
  suspended: "Suspended (in custody)",
  reactivation_submitted: "Reactivation submitted",
  pending: "Pending",
  not_enrolled: "Not enrolled",
  unknown: "Unknown",
};
export const SUBMITTED: readonly ReleaseCoverageStatus[] = ["reactivation_submitted", "pending", "active"];
export const COVERAGE_RELEASE_EDIT_ROLES: readonly StaffRole[] = ["clinical_coordinator", "sys_admin", "cf_care_manager", "ecm_provider"];
export const canSetReleaseCoverage = (r: StaffRole) => COVERAGE_RELEASE_EDIT_ROLES.includes(r);

interface StatusRecord { status: ReleaseCoverageStatus; source: string; at: string; by: string; simulated?: boolean }
const records = new Map<string, StatusRecord[]>();
let version = 0;
export const coverageReleaseVersion = () => version;
export function _resetCoverageRelease(): void { records.clear(); version++; }

function derived(p: Patient, ep: PreReleaseEpisode): StatusRecord {
  const c = p.coverage;
  if (c?.status === "active" && ep.actualReleaseDate) return { status: "active", source: "Coverage record", at: ep.actualReleaseDate, by: "system" };
  if (c?.status === "suspended") return { status: "suspended", source: "Coverage record", at: ep.openedAt.slice(0, 10), by: "system" };
  if (!ep.actualReleaseDate) return { status: "suspended", source: "Assumed while in custody", at: ep.openedAt.slice(0, 10), by: "system" };
  return { status: "unknown", source: "No coverage record", at: ep.openedAt.slice(0, 10), by: "system" };
}
export function currentStatus(p: Patient, ep: PreReleaseEpisode): StatusRecord {
  return records.get(ep.id)?.at(-1) ?? derived(p, ep);
}

/** Store function behind registry action `coverage_release_status_set`. Audited, reason-free (no SUD). */
export function setReleaseCoverageStatus(
  input: { episodeId: string; status: ReleaseCoverageStatus; source: string; simulated?: boolean },
  actor: { name: string; role: StaffRole; staffId?: string },
): StatusRecord {
  if (!canSetReleaseCoverage(actor.role)) throw new Error("Your role can't update coverage at release.");
  const ep = AdelanteEHR.listPreReleaseEpisodes().find((e) => e.id === input.episodeId);
  if (!ep) throw new Error("Release episode not found.");
  if (!input.source.trim()) throw new Error("A source is required.");
  const rec: StatusRecord = { status: input.status, source: input.source.trim(), at: new Date().toISOString(), by: actor.name, simulated: input.simulated };
  records.set(ep.id, [...(records.get(ep.id) ?? []), rec]);
  AdelanteEHR.recordActionEvent({ action: "coverage_release_status_set", actorRole: actor.role, actorId: actor.staffId, patientId: ep.patientId, detail: { episodeId: ep.id, status: input.status, simulated: !!input.simulated } });
  version++;
  return rec;
}
/** Simulated eligibility check — no 270/271 call; returns the current status stamped Simulated. */
export function simulateEligibilityCheck(episodeId: string, actor: { name: string; role: StaffRole; staffId?: string }): StatusRecord {
  const ep = AdelanteEHR.listPreReleaseEpisodes().find((e) => e.id === episodeId);
  const p = ep && AdelanteEHR.getPatient(ep.patientId);
  if (!ep || !p) throw new Error("Release episode not found.");
  return setReleaseCoverageStatus({ episodeId, status: currentStatus(p, ep).status, source: "Eligibility check (Simulated)", simulated: true }, actor);
}

export type ReleaseNextAction = "submit_application" | "follow_up_reactivation" | "confirm_active" | "none";
export const NEXT_ACTION_LABEL: Record<ReleaseNextAction, string> = {
  submit_application: "Submit application / reactivation",
  follow_up_reactivation: "Follow up — not Active after release",
  confirm_active: "Confirm coverage",
  none: "—",
};
export interface ReleaseCoverageRow {
  episodeId: string;
  patientId: string;
  patientName: string;
  releaseDate: string;
  released: boolean;
  /** Negative = days to release; positive = days after release. */
  dayOffset: number;
  status: ReleaseCoverageStatus;
  statusLabel: string;
  source: string;
  statusAt: string;
  nextAction: ReleaseNextAction;
  ownerStaffId?: string;
  ownerName: string;
  /** Task to the CF care manager / ECM (30 days out, nothing submitted). */
  task: boolean;
  /** Escalation to the coordinator (release + 3, not Active). */
  escalation: boolean;
  /** Release + 10, still not Active. */
  flagged: boolean;
}

const DAY = 86_400_000;
const dayStart = (k: string) => +new Date(`${k}T00:00:00`);
function staffName(id?: string) {
  const m = id ? STAFF_ROSTER.find((s) => s.id === id && s.active !== false) : undefined;
  return m;
}

/** "Coverage at release" — everyone with a release date. */
export function releaseCoverageRows(now: Date = new Date()): ReleaseCoverageRow[] {
  const today = dayStart(now.toISOString().slice(0, 10));
  const out: ReleaseCoverageRow[] = [];
  for (const ep of AdelanteEHR.listPreReleaseEpisodes()) {
    if ((ep as { status?: string }).status === "cancelled") continue;
    const p = AdelanteEHR.getPatient(ep.patientId);
    if (!p) continue;
    const releaseDate = ep.actualReleaseDate ?? ep.anticipatedReleaseDate;
    const released = !!ep.actualReleaseDate;
    const dayOffset = Math.round((today - dayStart(releaseDate)) / DAY);
    const s = currentStatus(p, ep);
    const submitted = SUBMITTED.includes(s.status);
    const task = !released && dayOffset >= -COVERAGE_RELEASE_DRAFT.preReleaseTaskDays && !submitted;
    const escalation = released && dayOffset >= COVERAGE_RELEASE_DRAFT.escalateAfterDays && s.status !== "active";
    const flagged = released && dayOffset >= COVERAGE_RELEASE_DRAFT.flagAfterDays && s.status !== "active";
    const owner = escalation ? undefined : staffName(ep.cfCareManagerStaffId) ?? staffName(ep.receivingEcmStaffId);
    const nextAction: ReleaseNextAction = !submitted ? (released ? "follow_up_reactivation" : "submit_application") : s.status === "active" ? "none" : released ? "follow_up_reactivation" : "confirm_active";
    out.push({
      episodeId: ep.id, patientId: p.id, patientName: `${p.firstName} ${p.lastName}`, releaseDate, released, dayOffset,
      status: s.status, statusLabel: RELEASE_COVERAGE_LABEL[s.status], source: s.source, statusAt: s.at.slice(0, 10),
      nextAction, ownerStaffId: owner?.id, ownerName: owner?.name ?? "Coordinator pool", task, escalation, flagged,
    });
  }
  return out.sort((a, b) => Number(b.escalation) - Number(a.escalation) || b.dayOffset - a.dayOffset);
}
export const releaseCoverageDueAt = (r: ReleaseCoverageRow, now = new Date()) => sameBusinessDayDue(r.ownerStaffId, now);
export const dayOffsetLabel = (n: number) => (n < 0 ? `${-n} days to release` : n === 0 ? "Release day" : `${n} days after release`);

/** Aggregate for the admin dashboard — cohort-guarded (11). */
export function releaseCoverageAggregate(now: Date = new Date()) {
  const rows = releaseCoverageRows(now);
  const released = rows.filter((r) => r.released);
  const notActive = released.filter((r) => r.status !== "active").length;
  return { released: released.length, notActive, ...cohortGuard(released.length) };
}

// Seeds — store functions only.
let seeded = false;
export function seedCoverageReleaseDemo(now: Date = new Date()): void {
  if (seeded) return;
  seeded = true;
  const find = (f: string, l: string) => AdelanteEHR.listPatients().find((p) => p.firstName === f && p.lastName === l);
  const cf = STAFF_ROSTER.find((m) => m.id === "s-cf2") ?? STAFF_ROSTER.find((m) => (m.role as string).includes("cf"));
  const key = (d: number) => new Date(+now + d * DAY).toISOString().slice(0, 10);
  const elena = find("Elena", "Vargas");
  if (elena && !AdelanteEHR.listPreReleaseEpisodes(elena.id).length && cf) {
    const ep = AdelanteEHR.openPreReleaseEpisode({ patientId: elena.id, anticipatedReleaseDate: key(-4), cfCareManagerStaffId: cf.id, cfCareManagerName: cf.name, openedBy: "seed", actorRole: "sys_admin" });
    AdelanteEHR.markPreReleaseEpisodeReleased({ episodeId: ep.id, confirmedBy: "seed", actorRole: "sys_admin", releasedOn: key(-4) });
    setReleaseCoverageStatus({ episodeId: ep.id, status: "pending", source: "County reactivation queue (Simulated)", simulated: true }, { name: "seed", role: "sys_admin" });
  }
  const jordan = find("Jordan", "Vega");
  if (jordan && !AdelanteEHR.listPreReleaseEpisodes(jordan.id).length && cf)
    AdelanteEHR.openPreReleaseEpisode({ patientId: jordan.id, anticipatedReleaseDate: key(25), cfCareManagerStaffId: cf.id, cfCareManagerName: cf.name, openedBy: "seed", actorRole: "sys_admin" });
}
seedCoverageReleaseDemo();
