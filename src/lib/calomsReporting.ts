// §Reporting Tier 2 — caseload aggregations over the structured CalOMS fields.
//
// The whole point of typing these fields is that questions like "how many
// admissions had methamphetamine as the primary substance?" are now a real
// query instead of a note-by-note read. Every helper below is a plain
// selector over `Patient.calomsProfile`, so `useEhr(...)` re-runs it on any
// write — exactly like the other reporting helpers.
//
// Nothing here is a submission feed. Counts are point-in-time.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import {
  DISCHARGE_STATUS_LABEL,
  JUSTICE_REFERRAL_LABEL,
  PRIOR_EPISODE_LABEL,
  SUBSTANCE_LABEL,
  type DischargeStatus,
  type JusticeReferralSource,
  type PriorEpisodeBucket,
  type CalomsSubstance,
} from "@/lib/caloms";

export interface Breakdown<K extends string> {
  key: K;
  label: string;
  count: number;
}

function sortDesc<K extends string>(rows: Breakdown<K>[]): Breakdown<K>[] {
  return rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function caseload(patients?: Patient[]): Patient[] {
  return patients ?? AdelanteEHR.listPatients();
}

/** How much of the structured set is actually captured across the caseload. */
export function calomsCompleteness(patients?: Patient[]) {
  const rows = caseload(patients);
  const total = rows.length;
  const substanceUse = rows.filter((p) => (p.calomsProfile?.substanceUse?.entries.length ?? 0) > 0).length;
  const priorTreatment = rows.filter((p) => !!p.calomsProfile?.priorTreatment).length;
  const discharge = rows.filter((p) => (p.calomsProfile?.discharges?.length ?? 0) > 0).length;
  const justice = rows.filter((p) => !!p.calomsProfile?.justice).length;
  const pct = (n: number) => (total === 0 ? null : Math.round((n / total) * 1000) / 10);
  return {
    total,
    substanceUse,
    priorTreatment,
    discharge,
    justice,
    substanceUsePct: pct(substanceUse),
    priorTreatmentPct: pct(priorTreatment),
    dischargePct: pct(discharge),
    justicePct: pct(justice),
  };
}

/** Primary-substance distribution — the query that was impossible before. */
export function substanceUseBreakdown(patients?: Patient[]): Breakdown<CalomsSubstance>[] {
  const tally = new Map<CalomsSubstance, number>();
  for (const p of caseload(patients)) {
    const primary = p.calomsProfile?.substanceUse?.entries.find((e) => e.rank === "primary");
    if (!primary) continue;
    tally.set(primary.substance, (tally.get(primary.substance) ?? 0) + 1);
  }
  return sortDesc(
    [...tally.entries()].map(([key, count]) => ({ key, label: SUBSTANCE_LABEL[key], count })),
  );
}

export function priorTreatmentBreakdown(patients?: Patient[]): Breakdown<PriorEpisodeBucket>[] {
  const tally = new Map<PriorEpisodeBucket, number>();
  for (const p of caseload(patients)) {
    const h = p.calomsProfile?.priorTreatment;
    if (!h) continue;
    tally.set(h.priorEpisodes, (tally.get(h.priorEpisodes) ?? 0) + 1);
  }
  return sortDesc(
    [...tally.entries()].map(([key, count]) => ({ key, label: PRIOR_EPISODE_LABEL[key], count })),
  );
}

export function dischargeStatusBreakdown(patients?: Patient[]): Breakdown<DischargeStatus>[] {
  const tally = new Map<DischargeStatus, number>();
  for (const p of caseload(patients)) {
    const latest = p.calomsProfile?.discharges?.[0];
    if (!latest) continue;
    tally.set(latest.status, (tally.get(latest.status) ?? 0) + 1);
  }
  return sortDesc(
    [...tally.entries()].map(([key, count]) => ({
      key,
      label: DISCHARGE_STATUS_LABEL[key],
      count,
    })),
  );
}

/**
 * Justice-involvement estimates. EVERY consumer must render these under the
 * self-reported label — the returned object carries `allSelfReported` so no
 * surface can accidentally present them as verified facility data.
 */
export function justiceSelfReportCoverage(patients?: Patient[]) {
  const rows = caseload(patients).filter((p) => !!p.calomsProfile?.justice);
  const reports = rows.map((p) => p.calomsProfile!.justice!);
  const withCustody = reports.filter((r) => typeof r.timeInCustodyMonths === "number");
  const medianCustodyMonths = (() => {
    if (withCustody.length === 0) return null;
    const vals = withCustody.map((r) => r.timeInCustodyMonths!).sort((a, b) => a - b);
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : Math.round(((vals[mid - 1] + vals[mid]) / 2) * 10) / 10;
  })();
  const tally = new Map<JusticeReferralSource, number>();
  for (const r of reports) {
    if (!r.justiceReferralSource) continue;
    tally.set(r.justiceReferralSource, (tally.get(r.justiceReferralSource) ?? 0) + 1);
  }
  return {
    reported: reports.length,
    anyArrestPast12Months: reports.filter((r) => (r.arrestsPast12Months ?? 0) > 0).length,
    medianCustodyMonths,
    referralSources: sortDesc(
      [...tally.entries()].map(([key, count]) => ({
        key,
        label: JUSTICE_REFERRAL_LABEL[key],
        count,
      })),
    ),
    /** Always true: there is no verified facility source in the MVP. */
    allSelfReported: reports.every((r) => r.source !== "internal"),
  };
}
