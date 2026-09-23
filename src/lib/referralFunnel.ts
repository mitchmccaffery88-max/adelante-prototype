// §Referrals Rework Phase 4g — the referral-to-active-patient FUNNEL.
//
// A real projection over the real referral records, the Phase 4e outreach
// attempts and the Phase 4f post-enrollment journey. Nothing is invented and
// nothing is stamped: every stage below is a read of a timestamp that already
// exists on the record.
//
// ⚠️ THE ENDPOINT IS ATTENDANCE, NOT A BOOKING. A scheduled appointment is an
// intention; `firstAttendedAppointment` (4f) is the only thing that counts,
// and it can never be satisfied by a cancelled or no-showed visit.
//
// ⚠️ "CONTACTED" MEANS REACHED. An outreach attempt with no answer, a left
// message, a wrong number or a disconnected line is effort, not contact.
// Counting those as contact would overstate conversion at exactly the step
// where the funnel is weakest, so they are reported separately as
// "outreach attempted, not yet reached".
//
// ⚠️ 42 CFR PART 2 IN AGGREGATE. A source row labelled "Drug court" with a
// count of 2 discloses two people's substance-use involvement to anyone who
// knows the caseload. So drug court is NEVER its own row here: the four
// justice-system sources fold into one bucket. The fold happens in this
// module, so no reporting surface can opt out of it.
//
// ⚠️ ASSOCIATION, NOT CAUSATION. Nothing here supports a causal claim about
// referral source and engagement or retention.
import {
  AdelanteEHR,
  REFERRAL_SOURCE_LABELS,
  type Referral,
  type ReferralSource,
} from "@/lib/ehr";
import { cohortGuard, type CohortGuard } from "@/lib/cohortGuard";
import { referralDeclineReasonLabel } from "@/lib/referralActions";
import { referralAging } from "@/lib/referralAging";
import { firstAttendedAppointment, nextScheduledAppointment } from "@/lib/postEnrollment";
import { resolveCohorts } from "@/lib/cohorts";
import { POPULATION_LABEL, type PopulationTrack } from "@/lib/population";

export const REFERRAL_FUNNEL_ASSOCIATION_NOTE =
  "These counts describe an association only. Nothing here shows that a referral source caused a person to engage, or that a slower contact caused a drop-off.";

export const REFERRAL_SOURCE_FOLD_NOTE =
  "Probation, parole, drug court and correctional health are reported together as one justice-system bucket. A small drug-court count would identify who is in substance-use care, so these sources are deliberately not listed separately.";

/** The four sources folded together for confidentiality. */
export const JUSTICE_SOURCE_KEYS: ReferralSource[] = [
  "probation",
  "parole",
  "drug_court",
  "correctional",
];
export const JUSTICE_SOURCE_BUCKET_KEY = "justice_system";
export const JUSTICE_SOURCE_BUCKET_LABEL = "Justice system (supervision, court or correctional)";

export interface FunnelRow {
  key: string;
  label: string;
  count: number;
}

export interface GuardedReferralBreakdown extends CohortGuard {
  rows: FunnelRow[];
}

export interface ReferralFunnel extends CohortGuard {
  /** Referrals submitted inside the window — the denominator. */
  submitted: number;
  /** Actually reached: `contactedAt` set, or an outreach attempt of "reached". */
  contacted: number;
  enrolled: number;
  /** Enrolled and a first appointment exists (scheduled or already attended). */
  firstApptScheduled: number;
  /** Enrolled and a first appointment was genuinely ATTENDED. */
  firstApptAttended: number;
  medianDaysToContact: number | null;
  medianDaysToEnroll: number | null;
  medianDaysToFirstAttended: number | null;
}

export interface ReferralDropOff extends CohortGuard {
  /** At least one outreach attempt logged, none of them reached the person. */
  outreachAttemptedNotReached: number;
  /** Past the Phase 4c overdue threshold with no contact yet — as of now. */
  overdueBeforeFirstContact: number;
  /** Enrolled, no attended session, but something is on the books. */
  enrolledAwaitingFirstSession: number;
  /** Enrolled, no attended session, and nothing booked at all. */
  enrolledNoAppointment: number;
  declined: number;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : (((s[mid - 1] as number) + (s[mid] as number)) / 2);
}

function days(from: string | undefined, to: string | undefined): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Referrals submitted inside the window. `sinceDays` omitted = everything. */
export function referralsInWindow(sinceDays?: number, now: Date = new Date()): Referral[] {
  const all = AdelanteEHR.listReferrals();
  if (!sinceDays) return all;
  const cutoff = +now - sinceDays * 86_400_000;
  return all.filter((r) => {
    const t = Date.parse(r.createdAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}

/** An outreach attempt that genuinely reached the person. */
export function reachedAttemptAt(r: Referral): string | undefined {
  return r.outreach?.attempts?.filter((a) => a.outcome === "reached").sort((a, b) => +new Date(a.at) - +new Date(b.at))[0]?.at;
}

/**
 * When this referral was really CONTACTED. A no-answer, left-message, wrong
 * number or disconnected attempt is deliberately not contact.
 */
export function contactedAtOf(r: Referral): string | undefined {
  const reached = reachedAttemptAt(r);
  if (r.contactedAt && reached) {
    return Date.parse(r.contactedAt) <= Date.parse(reached) ? r.contactedAt : reached;
  }
  return r.contactedAt ?? reached;
}

export function wasContacted(r: Referral): boolean {
  return !!contactedAtOf(r);
}

/** Effort without contact: attempts exist, none of them reached anyone. */
export function attemptedNotReached(r: Referral): boolean {
  const attempts = r.outreach?.attempts ?? [];
  return attempts.length > 0 && !wasContacted(r);
}

function enrolledPatientId(r: Referral): string | undefined {
  return r.status === "enrolled" ? r.enrolledPatientId : undefined;
}

// ---------------------------------------------------------------------------
// The funnel
// ---------------------------------------------------------------------------

export function referralFunnel(
  opts: { sinceDays?: number; now?: Date } = {},
): ReferralFunnel {
  const rs = referralsInWindow(opts.sinceDays, opts.now);

  const contacted = rs.filter(wasContacted);
  const enrolled = rs.filter((r) => !!enrolledPatientId(r) && !!r.enrolledAt);

  let scheduled = 0;
  let attended = 0;
  const toAttended: number[] = [];
  for (const r of enrolled) {
    const pid = enrolledPatientId(r)!;
    const first = firstAttendedAppointment(pid);
    const upcoming = nextScheduledAppointment(pid);
    if (first || upcoming) scheduled += 1;
    if (first) {
      attended += 1;
      const d = days(r.createdAt, first.start);
      if (d !== null) toAttended.push(d);
    }
  }

  return {
    submitted: rs.length,
    contacted: contacted.length,
    enrolled: enrolled.length,
    firstApptScheduled: scheduled,
    firstApptAttended: attended,
    medianDaysToContact: median(
      contacted.map((r) => days(r.createdAt, contactedAtOf(r))).filter((d): d is number => d !== null),
    ),
    medianDaysToEnroll: median(
      enrolled
        .map((r) => days(contactedAtOf(r) ?? r.createdAt, r.enrolledAt))
        .filter((d): d is number => d !== null),
    ),
    medianDaysToFirstAttended: median(toAttended),
    ...cohortGuard(rs.length),
  };
}

// ---------------------------------------------------------------------------
// Slices
// ---------------------------------------------------------------------------

function tally(rows: { key: string; label: string }[], cohortSize: number): GuardedReferralBreakdown {
  const counts = new Map<string, { label: string; count: number }>();
  for (const r of rows) {
    const cur = counts.get(r.key);
    if (cur) cur.count += 1;
    else counts.set(r.key, { label: r.label, count: 1 });
  }
  return {
    rows: [...counts.entries()]
      .map(([key, v]) => ({ key, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    ...cohortGuard(cohortSize),
  };
}

/** The reportable source — justice sources fold into one bucket. */
export function reportableSource(r: Referral): { key: string; label: string } {
  if (JUSTICE_SOURCE_KEYS.includes(r.referralSource))
    return { key: JUSTICE_SOURCE_BUCKET_KEY, label: JUSTICE_SOURCE_BUCKET_LABEL };
  return { key: r.referralSource, label: REFERRAL_SOURCE_LABELS[r.referralSource] };
}

export function referralsBySource(opts: { sinceDays?: number; now?: Date } = {}) {
  const rs = referralsInWindow(opts.sinceDays, opts.now);
  return tally(rs.map(reportableSource), rs.length);
}

export const JUSTICE_ANSWER_LABEL: Record<string, string> = {
  yes: "Justice-involved — yes",
  no: "Justice-involved — no",
  unsure: "Justice-involved — referrer unsure",
  not_asked: "Not asked (pre-Phase 4c referral)",
};

export function referralsByJusticeAnswer(opts: { sinceDays?: number; now?: Date } = {}) {
  const rs = referralsInWindow(opts.sinceDays, opts.now);
  return tally(
    rs.map((r) => {
      const key = r.justiceInvolved ?? "not_asked";
      return { key, label: JUSTICE_ANSWER_LABEL[key] ?? key };
    }),
    rs.length,
  );
}

/**
 * Population track, enrolled referrals only: an unenrolled referral has no
 * patient record, so it has no track to resolve. Stated on screen.
 */
export function referralsByTrack(opts: { sinceDays?: number; now?: Date } = {}) {
  const rs = referralsInWindow(opts.sinceDays, opts.now).filter((r) => !!enrolledPatientId(r));
  const ids = rs.map((r) => enrolledPatientId(r)!);
  const cohorts = resolveCohorts(ids);
  return tally(
    ids.map((id) => {
      const track = (cohorts.byPatient[id]?.track ?? "general_population") as PopulationTrack;
      return { key: track, label: POPULATION_LABEL[track] };
    }),
    ids.length,
  );
}

/** Declined referrals by AGGREGATED reason key — never the free-text note. */
export function declinedByReason(opts: { sinceDays?: number; now?: Date } = {}) {
  const rs = referralsInWindow(opts.sinceDays, opts.now).filter((r) => r.status === "declined");
  return tally(
    rs.map((r) => {
      const key = r.declineReason ?? "unrecorded";
      return {
        key,
        label: r.declineReason ? referralDeclineReasonLabel(r.declineReason) : "No reason recorded",
      };
    }),
    rs.length,
  );
}

// ---------------------------------------------------------------------------
// Drop-off
// ---------------------------------------------------------------------------

export function referralDropOff(opts: { sinceDays?: number; now?: Date } = {}): ReferralDropOff {
  const now = opts.now ?? new Date();
  const rs = referralsInWindow(opts.sinceDays, now);

  let awaiting = 0;
  let noAppt = 0;
  for (const r of rs) {
    const pid = enrolledPatientId(r);
    if (!pid) continue;
    if (firstAttendedAppointment(pid)) continue;
    if (nextScheduledAppointment(pid)) awaiting += 1;
    else noAppt += 1;
  }

  return {
    outreachAttemptedNotReached: rs.filter(attemptedNotReached).length,
    overdueBeforeFirstContact: rs.filter(
      (r) => !wasContacted(r) && referralAging(r, now).state === "overdue",
    ).length,
    enrolledAwaitingFirstSession: awaiting,
    enrolledNoAppointment: noAppt,
    declined: rs.filter((r) => r.status === "declined").length,
    ...cohortGuard(rs.length),
  };
}
