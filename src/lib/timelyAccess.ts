// §Batch B1 — Timely access stamps (BHIN 26-023 / TADT).
//
// Three system-set stamps per person: service request, first appointment
// OFFERED, first appointment KEPT. They are read from store-set timestamps or
// the system clock at the moment the event is seen — never from a UI value.
// Earliest wins: once a stamp exists, a later event can't move it. Nothing
// exported here edits a stamp; a mistake gets a separate, audited correction
// note (reason required) and both are shown.
//
// Subjects: a referral that hasn't enrolled yet is its own subject
// (`r:<id>`); once enrolled, its stamps merge into the patient's (`p:<id>`),
// earliest per stamp.
import { AdelanteEHR } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import { cohortGuard, type CohortGuard } from "@/lib/cohortGuard";

export type StampKind = "request" | "offered" | "kept";
export interface TimelyStamp {
  at: string;
  source: string;
  /** Wall-clock moment the system wrote the stamp. */
  recordedAt: string;
}
export type OfferOutcome = "accepted" | "declined" | "no_answer";
export type OfferContext = "booking" | "request_response" | "referral_outreach";
export interface AppointmentOffer {
  id: string;
  patientId?: string;
  referralId?: string;
  slotStart: string;
  clinicianId?: string;
  outcome: OfferOutcome;
  context: OfferContext;
  at: string;
  byName: string;
  byRole: StaffRole;
}
export interface TimelyCorrection {
  id: string;
  patientId: string;
  kind: StampKind;
  correctedAt: string;
  reason: string;
  byName: string;
  byRole: StaffRole;
  at: string;
}

export const STAMP_LABEL: Record<StampKind, string> = { request: "Service request", offered: "First offered", kept: "First kept" };
/** Day-count targets are not set — Draft until care operations sign off. */
export const TIMELY_TARGETS_DRAFT = {
  offeredDays: undefined as number | undefined,
  keptDays: undefined as number | undefined,
  label: "Draft target — not set, pending clinical sign-off",
};

export const TIMELY_OFFER_ROLES: readonly StaffRole[] = [
  "therapist", "pmhnp", "physician", "sud_counselor", "medical_assistant",
  "ecm_provider", "cf_care_manager", "community_health_worker", "peer_specialist", "clinical_coordinator",
];
export const TIMELY_CORRECTION_ROLES: readonly StaffRole[] = ["clinical_coordinator", "sys_admin"];
/** Staff-only line; billing and admin never see it in the chart. */
export const TIMELY_VIEW_ROLES: readonly StaffRole[] = [...TIMELY_OFFER_ROLES, "sys_admin"];
export const canRecordOffer = (r: StaffRole) => TIMELY_OFFER_ROLES.includes(r);
export const canCorrectTimely = (r: StaffRole) => TIMELY_CORRECTION_ROLES.includes(r);
export const canSeeTimely = (r: StaffRole) => TIMELY_VIEW_ROLES.includes(r);

const stamps = new Map<string, Partial<Record<StampKind, TimelyStamp>>>();
const offers: AppointmentOffer[] = [];
const corrections: TimelyCorrection[] = [];
const seenAppts = new Set<string>();
let seq = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

/** Earliest wins. Returns true when the stamp was written. */
function setStamp(key: string, kind: StampKind, at: string, source: string): boolean {
  const row = stamps.get(key) ?? {};
  const cur = row[kind];
  if (cur && +new Date(cur.at) <= +new Date(at)) return false;
  // A stamp that already exists is never replaced by a LATER sweep — only a
  // strictly earlier system record can win (e.g. a referral found after an
  // appointment request for the same person).
  row[kind] = { at, source, recordedAt: new Date().toISOString() };
  stamps.set(key, row);
  return true;
}

let initialDone = false;
let sweeping = false;
export function sweepTimelyAccess(): void {
  if (sweeping) return;
  sweeping = true;
  try {
    const nowIso = new Date().toISOString();
    for (const r of AdelanteEHR.listReferrals()) setStamp(`r:${r.id}`, "request", r.createdAt, "referral");
    for (const p of AdelanteEHR.listPatients())
      for (const req of p.appointmentRequests ?? []) setStamp(`p:${p.id}`, "request", req.createdAt, "patient_request");
    for (const a of AdelanteEHR.listAppointments()) {
      const key = `p:${a.patientId}`;
      if (!seenAppts.has(a.id)) {
        seenAppts.add(a.id);
        // First time the system sees a booked slot = the moment it was offered.
        // Demo rows present at load are backfilled no later than the slot itself.
        const at = initialDone ? nowIso : new Date(Math.min(Date.now(), +new Date(a.start))).toISOString();
        setStamp(key, "offered", at, initialDone ? "booking" : "backfill");
      }
      if (a.status === "attended") {
        const at = a.attendedBy?.at ?? (initialDone ? nowIso : a.start);
        setStamp(key, "kept", at, a.attendedBy ? "attended" : "backfill");
      }
    }
    initialDone = true;
  } finally {
    sweeping = false;
  }
}

let subscribed = false;
export function startTimelyAccess(): void {
  if (subscribed) return;
  subscribed = true;
  sweepTimelyAccess();
  AdelanteEHR.subscribe(() => sweepTimelyAccess());
}

// ------------------------------------------------------------------ writes
type Actor = { name: string; role: StaffRole };

/** Record a proposed slot — kept even when the patient declines or doesn't answer. */
export function recordAppointmentOffer(
  actor: Actor,
  input: { patientId?: string; referralId?: string; slotStart: string; clinicianId?: string; outcome: OfferOutcome; context: OfferContext },
): AppointmentOffer {
  if (!canRecordOffer(actor.role)) throw new Error("Your role can't record appointment offers.");
  if (!input.patientId && !input.referralId) throw new Error("Pick a person.");
  if (!input.slotStart || Number.isNaN(+new Date(input.slotStart))) throw new Error("Pick the slot that was offered.");
  const at = new Date().toISOString();
  const o: AppointmentOffer = { id: nid("offer"), ...input, at, byName: actor.name, byRole: actor.role };
  offers.push(o);
  setStamp(input.patientId ? `p:${input.patientId}` : `r:${input.referralId}`, "offered", at, `offer_${input.context}`);
  AdelanteEHR._emit();
  return o;
}

/** First staff-recorded request when no referral or patient request exists. */
export function recordServiceRequest(actor: Actor, patientId: string): TimelyStamp {
  if (!canRecordOffer(actor.role)) throw new Error("Your role can't record a service request.");
  setStamp(`p:${patientId}`, "request", new Date().toISOString(), "staff_recorded");
  AdelanteEHR._emit();
  return timelyAccessFor(patientId).request!;
}

/** Correction note — never changes the original stamp. */
export function addTimelyCorrection(actor: Actor, input: { patientId: string; kind: StampKind; correctedAt: string; reason: string }): TimelyCorrection {
  if (!canCorrectTimely(actor.role)) throw new Error("Only a clinical coordinator or system admin can add a correction note.");
  if (!input.reason?.trim()) throw new Error("A reason is required.");
  if (!input.correctedAt || Number.isNaN(+new Date(input.correctedAt))) throw new Error("Enter the corrected date.");
  const c: TimelyCorrection = { id: nid("tcor"), ...input, reason: input.reason.trim(), byName: actor.name, byRole: actor.role, at: new Date().toISOString() };
  corrections.push(c);
  AdelanteEHR._emit();
  return c;
}

// ------------------------------------------------------------------ reads
function merged(keys: string[]): Partial<Record<StampKind, TimelyStamp>> {
  const out: Partial<Record<StampKind, TimelyStamp>> = {};
  for (const k of keys) {
    const row = stamps.get(k);
    if (!row) continue;
    for (const kind of ["request", "offered", "kept"] as StampKind[]) {
      const s = row[kind];
      if (s && (!out[kind] || +new Date(s.at) < +new Date(out[kind]!.at))) out[kind] = s;
    }
  }
  return out;
}
const days = (from?: string, to?: string) =>
  from && to ? Math.max(0, Math.floor((+new Date(to) - +new Date(from)) / 86400_000)) : undefined;

export interface TimelyView {
  request?: TimelyStamp;
  offered?: TimelyStamp;
  kept?: TimelyStamp;
  daysToOffered?: number;
  daysToKept?: number;
  corrections: TimelyCorrection[];
  offers: AppointmentOffer[];
}
export function timelyAccessFor(patientId: string): TimelyView {
  sweepTimelyAccess();
  const refKeys = AdelanteEHR.listReferrals().filter((r) => r.enrolledPatientId === patientId).map((r) => `r:${r.id}`);
  const s = merged([`p:${patientId}`, ...refKeys]);
  const refIds = new Set(refKeys.map((k) => k.slice(2)));
  return {
    ...s,
    daysToOffered: days(s.request?.at, s.offered?.at),
    daysToKept: days(s.request?.at, s.kept?.at),
    corrections: corrections.filter((c) => c.patientId === patientId),
    offers: offers.filter((o) => o.patientId === patientId || (o.referralId && refIds.has(o.referralId))),
  };
}
export function rawStamp(key: string, kind: StampKind): TimelyStamp | undefined {
  return stamps.get(key)?.[kind];
}
export function listOffers(): AppointmentOffer[] {
  return [...offers];
}

const md = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
/** "Requested 9/12 · First offered 9/15 (3d) · First kept 9/19 (7d)" */
export function timelyLine(v: TimelyView): string {
  const parts = [
    v.request ? `Requested ${md(v.request.at)}` : "No request recorded",
    v.offered ? `First offered ${md(v.offered.at)}${v.daysToOffered !== undefined ? ` (${v.daysToOffered}d)` : ""}` : "Not offered yet",
    v.kept ? `First kept ${md(v.kept.at)}${v.daysToKept !== undefined ? ` (${v.daysToKept}d)` : ""}` : "Not kept yet",
  ];
  return parts.join(" · ");
}

export interface TimelyReportRow { key: string; name: string; requestAt: string; daysToOffered?: number; daysToKept?: number }
function median(ns: number[]): number | undefined {
  if (!ns.length) return undefined;
  const s = [...ns].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function timelyAccessReport(opts: { sinceDays?: number; now?: Date } = {}): {
  rows: TimelyReportRow[];
  medianDaysToOffered?: number;
  medianDaysToKept?: number;
  guard: CohortGuard;
} {
  sweepTimelyAccess();
  const now = opts.now ?? new Date();
  const since = opts.sinceDays ? +now - opts.sinceDays * 86400_000 : -Infinity;
  const rows: TimelyReportRow[] = [];
  for (const p of AdelanteEHR.listPatients()) {
    const v = timelyAccessFor(p.id);
    if (!v.request || +new Date(v.request.at) < since) continue;
    rows.push({ key: p.id, name: `${p.firstName} ${p.lastName}`, requestAt: v.request.at, daysToOffered: v.daysToOffered, daysToKept: v.daysToKept });
  }
  for (const r of AdelanteEHR.listReferrals()) {
    if (r.enrolledPatientId) continue;
    const s = merged([`r:${r.id}`]);
    if (!s.request || +new Date(s.request.at) < since) continue;
    rows.push({ key: `r:${r.id}`, name: `${r.firstName} ${r.lastName} (referral)`, requestAt: s.request.at, daysToOffered: days(s.request.at, s.offered?.at) });
  }
  rows.sort((a, b) => b.requestAt.localeCompare(a.requestAt));
  const guard = cohortGuard(rows.length);
  // Hard suppression: medians are withheld below the cohort minimum.
  return {
    rows,
    guard,
    medianDaysToOffered: guard.belowMinimumCohort ? undefined : median(rows.flatMap((r) => (r.daysToOffered !== undefined ? [r.daysToOffered] : []))),
    medianDaysToKept: guard.belowMinimumCohort ? undefined : median(rows.flatMap((r) => (r.daysToKept !== undefined ? [r.daysToKept] : []))),
  };
}

export function _resetTimelyAccess(): void {
  stamps.clear();
  offers.length = 0;
  corrections.length = 0;
  seenAppts.clear();
  initialDone = false;
}
startTimelyAccess();
