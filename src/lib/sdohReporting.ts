// §SDOH Referral Thread Phase 5d-4 — the need-to-resolution FUNNEL.
//
// A real projection over the real records: `Patient.sdohPlan.items` joined to
// `Patient.resourceReferrals` through the 5d-2 `sdohItemId` link, and to the
// 5d-3 activity log for barrier frequency. Nothing is invented — a stage with
// no underlying record reports 0 against a stated denominator, and every
// breakdown carries the SHARED small-cohort guard (`cohortGuard.ts`, 11).
//
// ⚠️ 42 CFR PART 2 IN AGGREGATE. A breakdown row labelled "Recovery meetings"
// with a count of 2 is, at caseload scale, a list of two people's SUD
// involvement. So the two Part 2 sensitive categories are NEVER a category
// value of their own here: they fold into one deliberately unspecific
// "Other / confidential services" bucket, together with the genuinely
// uncategorised. The fold happens in this module, so no reporting surface can
// opt out of it.
//
// ⚠️ ASSOCIATION, NOT CAUSATION. Nothing here supports a causal claim about
// needs and engagement or dropout; the labels say so.
import {
  AdelanteEHR,
  isPart2SensitiveCategory,
  RESOURCE_REFERRAL_CLOSED_OUTCOMES,
  SDOH_BARRIER_LABEL,
  SDOH_SOURCE_LABEL,
  type Patient,
  type ResourceReferral,
  type SdohItemSource,
  type SdohPlanItem,
} from "@/lib/ehr";
import { cohortGuard, type CohortGuard } from "@/lib/cohortGuard";
import { resolveCohorts } from "@/lib/cohorts";
import { POPULATION_LABEL, type PopulationTrack } from "@/lib/population";

/** The bucket every Part 2 sensitive (and unmatched) category folds into. */
export const CONFIDENTIAL_CATEGORY_KEY = "other_confidential";
export const CONFIDENTIAL_CATEGORY_LABEL = "Other / confidential services";

export const SDOH_FUNNEL_ASSOCIATION_NOTE =
  "These counts describe an association only. Nothing here shows that a social need caused a change in engagement, or that a referral caused an outcome.";

export interface FunnelRow {
  key: string;
  label: string;
  count: number;
}

export interface GuardedFunnelBreakdown extends CohortGuard {
  rows: FunnelRow[];
}

export interface SdohFunnel extends CohortGuard {
  /** Every need on the cohort's records. */
  identified: number;
  /** Needs with at least one referral. */
  referred: number;
  /** Needs with at least one referral whose outcome is `connected`. */
  connected: number;
  /** Needs whose own status reached `completed`. */
  resolved: number;
  /** Median days identified → first referral. null when nothing qualifies. */
  medianDaysToReferral: number | null;
  /** Median days first referral → first connected outcome. */
  medianDaysToConnected: number | null;
  /** Median days identified → resolved. */
  medianDaysToResolved: number | null;
  /** Patients considered — the guard's denominator. */
  patients: number;
}

interface NeedRecord {
  patientId: string;
  item: SdohPlanItem;
  referrals: ResourceReferral[];
}

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

function earliest(values: (string | undefined)[]): string | undefined {
  const real = values.filter((v): v is string => !!v && Number.isFinite(Date.parse(v)));
  if (!real.length) return undefined;
  return real.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
}

function patientsFor(patientIds?: string[]): Patient[] {
  const want = patientIds ? new Set(patientIds) : undefined;
  return AdelanteEHR.listPatients().filter((p) => !want || want.has(p.id));
}

/** Every need on the cohort, with its referrals attached. */
export function needRecords(patientIds?: string[]): NeedRecord[] {
  const out: NeedRecord[] = [];
  for (const p of patientsFor(patientIds)) {
    for (const item of p.sdohPlan?.items ?? []) {
      out.push({
        patientId: p.id,
        item,
        referrals: (p.resourceReferrals ?? []).filter((r) => r.sdohItemId === item.id),
      });
    }
  }
  return out;
}

function connectedAt(r: ResourceReferral): string | undefined {
  // The record keeps one `updatedAt`; an outcome of `connected` means that
  // stamp IS the connection moment. Anything else would be a guess.
  return r.status === "connected" ? (r.updatedAt ?? r.createdAt) : undefined;
}

function isResolved(i: SdohPlanItem): boolean {
  return i.status === "completed";
}

/** The funnel over a cohort. */
export function sdohFunnel(opts: { patientIds?: string[] } = {}): SdohFunnel {
  const people = patientsFor(opts.patientIds);
  const records = needRecords(opts.patientIds);

  const referredRecords = records.filter((r) => r.referrals.length > 0);
  const connectedRecords = referredRecords.filter((r) =>
    r.referrals.some((x) => x.status === "connected"),
  );
  const resolvedRecords = records.filter((r) => isResolved(r.item));

  const toReferral = referredRecords
    .map((r) => days(r.item.createdAt, earliest(r.referrals.map((x) => x.createdAt))))
    .filter((d): d is number => d !== null);
  const toConnected = connectedRecords
    .map((r) =>
      days(
        earliest(r.referrals.map((x) => x.createdAt)),
        earliest(r.referrals.map(connectedAt)),
      ),
    )
    .filter((d): d is number => d !== null);
  const toResolved = resolvedRecords
    .map((r) => days(r.item.createdAt, r.item.updatedAt))
    .filter((d): d is number => d !== null);

  return {
    identified: records.length,
    referred: referredRecords.length,
    connected: connectedRecords.length,
    resolved: resolvedRecords.length,
    medianDaysToReferral: median(toReferral),
    medianDaysToConnected: median(toConnected),
    medianDaysToResolved: median(toResolved),
    patients: people.length,
    ...cohortGuard(people.length),
  };
}

// ---------------------------------------------------------------------------
// Slices. Each one is a GuardedBreakdown over the SAME need records.
// ---------------------------------------------------------------------------

function tally(rows: { key: string; label: string }[], patients: number): GuardedFunnelBreakdown {
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
    ...cohortGuard(patients),
  };
}

/**
 * The reportable category of a need, taken from its referrals' real
 * categories. Part 2 sensitive categories fold into the confidential bucket —
 * see the module header.
 */
export function reportableCategory(rec: NeedRecord): { key: string; label: string } {
  const first = rec.referrals[0];
  // A need with no referral has no category at all — saying so is honest, and
  // keeps the confidential bucket meaning what it says.
  if (!first) return { key: "not_yet_referred", label: "Not yet referred" };
  if (isPart2SensitiveCategory(first.category))
    return { key: CONFIDENTIAL_CATEGORY_KEY, label: CONFIDENTIAL_CATEGORY_LABEL };
  return {
    key: first.category,
    label: first.category.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
  };
}

export function needsByCategory(patientIds?: string[]): GuardedFunnelBreakdown {
  const recs = needRecords(patientIds);
  return tally(recs.map(reportableCategory), patientsFor(patientIds).length);
}

export function needsByProvenance(patientIds?: string[]): GuardedFunnelBreakdown {
  const recs = needRecords(patientIds);
  return tally(
    recs.map((r) => ({
      key: r.item.source as SdohItemSource,
      label: SDOH_SOURCE_LABEL[r.item.source],
    })),
    patientsFor(patientIds).length,
  );
}

export function needsByTrack(patientIds?: string[]): GuardedFunnelBreakdown {
  const cohorts = resolveCohorts(patientIds);
  const recs = needRecords(patientIds);
  return tally(
    recs.map((r) => {
      const track = (cohorts.byPatient[r.patientId]?.track ??
        "general_population") as PopulationTrack;
      return { key: track, label: POPULATION_LABEL[track] };
    }),
    cohorts.total,
  );
}

/**
 * Barrier frequency over the 5d-3 activity logs (needs AND referrals). The
 * barrier list itself is a DRAFT pending clinical review; the caller renders
 * `SDOH_BARRIERS_DRAFT_NOTE` beside this.
 */
export function barrierFrequency(patientIds?: string[]): GuardedFunnelBreakdown {
  const people = patientsFor(patientIds);
  const rows: { key: string; label: string }[] = [];
  for (const p of people) {
    const logs = [
      ...(p.sdohPlan?.items ?? []).flatMap((i) => i.log ?? []),
      ...(p.resourceReferrals ?? []).flatMap((r) => r.log ?? []),
    ];
    for (const entry of logs)
      for (const b of entry.barriers ?? [])
        rows.push({ key: b, label: SDOH_BARRIER_LABEL[b] ?? b });
  }
  return tally(rows, people.length);
}

/** True when a referral outcome ended its active work. Re-exported for tests. */
export function referralClosed(r: ResourceReferral): boolean {
  return RESOURCE_REFERRAL_CLOSED_OUTCOMES.includes(r.status);
}
