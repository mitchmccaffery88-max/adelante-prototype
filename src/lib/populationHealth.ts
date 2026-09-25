// §Phase 10d-2 — Population health reporting (staff, read-only).
//
// Everything is derived on demand from existing storage: `patient.screeners`
// / `screenerHistory`, signed ASAM assessments, pre-release episodes, the
// front-door population resolver, referrals and program episodes. No new
// write paths.
//
// RULES
// • AUDIT / DAST-10 are COUNTED, with "Item wording pending source
//   verification" wherever they feed a figure.
// • Retired forms (old PCL-5 short) are never counted.
// • C-SSRS results on placeholder text are excluded; the tile says how many.
// • Draft cutoffs are labelled on every positivity figure.
// • Each slice carries its own cohort guard (11, caveat mode — hard
//   suppression is required before real pilot data).
// • Association-only wording.
// • SUD tiles (AUDIT, DAST-10, level-of-care mix) follow the ASAM access rule:
//   Part 2-passing roles see them; the clinical coordinator sees totals only
//   (draft pending compliance review); every other role gets no SUD tile.
// • Justice self-report is a SLICE only. It never feeds any substance-use
//   figure — nothing here reads `calomsProfile.justice` at all.
import {
  AdelanteEHR,
  HRSN_SAFETY_DOMAIN_KEY,
  REFERRAL_SOURCE_LABELS,
  SCREENER_WORDING_PENDING_CAVEAT,
  type Patient,
  type ScreenerResult,
} from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import { resolvePopulation } from "@/lib/population";
import { screenerByKey } from "@/lib/screeners";
import { CSSRS_KEY, CSSRS_RISK_ORDER, type CssrsRisk } from "@/lib/cssrs";
import { cohortGuard, type CohortGuard } from "@/lib/cohortGuard";
import { dmcOdsLevelLabel, type AsamAssessment } from "@/lib/asam";
import { ACCESS_RULE_DRAFT_NOTE, aggregatePatients, asamAccessMode, type AsamAccessMode } from "@/lib/asamReporting";

export { ACCESS_RULE_DRAFT_NOTE };

export const POPULATION_HEALTH_ASSOCIATION_NOTE =
  "These figures describe what was recorded for the people in each group. They show association only — they do not show that a group, program or referral source caused a result.";
export const POPULATION_CUTOFF_DRAFT_NOTE = "Positive cutoffs are drafts — pending clinical sign-off.";

const NON_SUD_KEYS = ["phq-9", "gad-7", "pc-ptsd-5"] as const;
const SUD_KEYS = ["audit", "dast-10"] as const;

/** Roles that never see the population section (claim data only). */
const NO_POPULATION_ROLES: StaffRole[] = ["billing", "billing_coordinator"];

export type PopulationSliceTrack = "general" | "justice_self_report" | "pre_release_referred";
export const POPULATION_SLICE_TRACK_LABEL: Record<PopulationSliceTrack, string> = {
  general: "General population",
  justice_self_report: "Justice-involved (self-report)",
  pre_release_referred: "Pre-release referred",
};

const PROGRAM_LABEL: Record<string, string> = {
  mental_health: "Mental health",
  sud_dmc_ods: "DMC-ODS (substance use)",
  ecm: "Enhanced Care Management",
  ji_pre_release: "Justice-involved pre-release",
  bhsa: "BHSA",
  none: "No open program",
};

/** Track slice. Reads episodes + front-door answers only — never CalOMS justice. */
export function sliceTrack(p: Patient): PopulationSliceTrack {
  if (AdelanteEHR.listPreReleaseEpisodes(p.id).length > 0) return "pre_release_referred";
  const r = resolvePopulation(p.id);
  // A provisional "not sure" answer stays in general population until confirmed.
  if (r.track === "post_release_ji" && !r.provisional) return "justice_self_report";
  return "general";
}

export function sliceReferralSource(p: Patient): [string, string] {
  if (p.referralId) {
    const ref = AdelanteEHR.listReferrals().find((r) => r.id === p.referralId);
    if (ref?.referralSource) return [ref.referralSource, REFERRAL_SOURCE_LABELS[ref.referralSource] ?? ref.referralSource];
  }
  if (AdelanteEHR.listPreReleaseEpisodes(p.id).length > 0) return ["pre_release", "Pre-release coordination"];
  return ["self", "Self sign-up / front door"];
}

export function slicePrograms(p: Patient): [string, string][] {
  const open = (p.episodes ?? []).filter((e) => !e.closedAt).map((e) => e.type as string);
  const uniq = [...new Set(open)];
  if (!uniq.length) return [["none", PROGRAM_LABEL.none!]];
  return uniq.map((k) => [k, PROGRAM_LABEL[k] ?? k]);
}

const usable = (r: ScreenerResult | undefined): r is ScreenerResult => !!r && !r.retiredForm && !r.placeholderText;

export interface InstrumentTile {
  key: string;
  name: string;
  sud: boolean;
  administered: number;
  positive: number;
  positiveRate: number;
  cutoff?: number;
  cutoffDraft: boolean;
  /** People with an intake AND a later result. */
  withChange: number;
  improved: number;
  worsened: number;
  unchanged: number;
  meanChange: number | null;
  caveat?: string;
}

export interface CssrsTile {
  latestByRisk: { risk: CssrsRisk; count: number }[];
  counted: number;
  /** Placeholder-text results left out of every figure. */
  excludedPlaceholder: number;
  withChange: number;
  lower: number;
  higher: number;
  unchanged: number;
}

export interface DomainTile {
  key: string;
  label: string;
  positive: number;
  screened: number;
  staffOnly: boolean;
}

export interface LevelTile {
  level: string;
  count: number;
}

export interface SliceReport {
  guard: CohortGuard;
  instruments: InstrumentTile[];
  cssrs: CssrsTile;
  social: DomainTile[];
  /** null when the role gets no SUD tile. */
  levels: LevelTile[] | null;
}

function instrumentTile(key: string, cohort: Patient[]): InstrumentTile {
  const def = screenerByKey(key);
  const sud = (SUD_KEYS as readonly string[]).includes(key);
  const latest = cohort.map((p) => p.screeners?.[key]).filter(usable);
  const positive = latest.filter(
    (r) => r.positive ?? (def?.positiveCutoff !== undefined ? r.score >= def.positiveCutoff : false),
  ).length;
  let improved = 0,
    worsened = 0,
    unchanged = 0;
  const deltas: number[] = [];
  for (const p of cohort) {
    const hist = (p.screenerHistory ?? []).filter((h) => h.key === key && usable(h));
    if (hist.length < 2) continue;
    const first = hist.find((h) => h.timepoint === "intake") ?? hist[0]!;
    const last = hist[hist.length - 1]!;
    if (first === last) continue;
    const d = last.score - first.score; // higher = more symptoms on every instrument here
    deltas.push(d);
    if (d < 0) improved++;
    else if (d > 0) worsened++;
    else unchanged++;
  }
  const tile: InstrumentTile = {
    key,
    name: def?.name ?? key,
    sud,
    administered: latest.length,
    positive,
    positiveRate: latest.length ? positive / latest.length : 0,
    cutoffDraft: true,
    withChange: deltas.length,
    improved,
    worsened,
    unchanged,
    meanChange: deltas.length ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10 : null,
  };
  if (def?.positiveCutoff !== undefined) tile.cutoff = def.positiveCutoff;
  if (latest.some((r) => r.textVerified === false) || sud) tile.caveat = SCREENER_WORDING_PENDING_CAVEAT;
  return tile;
}

function cssrsTile(cohort: Patient[]): CssrsTile {
  const counts = new Map<CssrsRisk, number>();
  let excluded = 0,
    counted = 0,
    lower = 0,
    higher = 0,
    same = 0,
    withChange = 0;
  for (const p of cohort) {
    const hist = (p.screenerHistory ?? []).filter((h) => h.key === CSSRS_KEY);
    excluded += hist.filter((h) => h.placeholderText).length;
    const ok = hist.filter((h) => usable(h) && h.cssrsRisk);
    if (!ok.length) continue;
    const last = ok[ok.length - 1]!;
    counted++;
    counts.set(last.cssrsRisk!, (counts.get(last.cssrsRisk!) ?? 0) + 1);
    if (ok.length >= 2) {
      withChange++;
      const d = CSSRS_RISK_ORDER.indexOf(last.cssrsRisk!) - CSSRS_RISK_ORDER.indexOf(ok[0]!.cssrsRisk!);
      if (d < 0) lower++;
      else if (d > 0) higher++;
      else same++;
    }
  }
  return {
    latestByRisk: CSSRS_RISK_ORDER.map((risk) => ({ risk, count: counts.get(risk) ?? 0 })),
    counted,
    excludedPlaceholder: excluded,
    withChange,
    lower,
    higher,
    unchanged: same,
  };
}

function socialTiles(cohort: Patient[]): DomainTile[] {
  const tally = new Map<string, DomainTile>();
  for (const p of cohort) {
    const r = p.screeners?.["ahc-hrsn"];
    if (!usable(r) || !r.domains) continue;
    for (const d of r.domains) {
      const row = tally.get(d.key) ?? {
        key: d.key,
        label: d.label,
        positive: 0,
        screened: 0,
        staffOnly: d.key === HRSN_SAFETY_DOMAIN_KEY,
      };
      row.screened++;
      if (d.positive) row.positive++;
      tally.set(d.key, row);
    }
  }
  return [...tally.values()];
}

const finalAt = (a: AsamAssessment) => (a.status === "signed" ? a.cosignedAt ?? a.signedAt : undefined);

/** Latest signed version of each amended chain; one (most recent) per patient. */
export function currentSignedLevel(p: Patient): AsamAssessment | undefined {
  const signed = (p.asamAssessments ?? []).filter((a) => finalAt(a));
  const superseded = new Set(signed.map((a) => a.amendsId).filter(Boolean) as string[]);
  return signed
    .filter((a) => !superseded.has(a.id))
    .sort((a, b) => finalAt(b)!.localeCompare(finalAt(a)!))[0];
}

function levelTiles(cohort: Patient[]): LevelTile[] {
  const m = new Map<string, number>();
  for (const p of cohort) {
    const a = currentSignedLevel(p);
    if (!a?.actualLevel) continue;
    const label = dmcOdsLevelLabel(a.actualLevel);
    m.set(label, (m.get(label) ?? 0) + 1);
  }
  return [...m.entries()].map(([level, count]) => ({ level, count })).sort((a, b) => b.count - a.count);
}

function sliceReport(cohort: Patient[], sudCohort: Patient[] | null): SliceReport {
  const sudIds = sudCohort ? new Set(sudCohort.map((p) => p.id)) : null;
  const sudIn = sudIds ? cohort.filter((p) => sudIds.has(p.id)) : [];
  return {
    guard: cohortGuard(cohort.length),
    instruments: [
      ...NON_SUD_KEYS.map((k) => instrumentTile(k, cohort)),
      ...(sudIds ? SUD_KEYS.map((k) => instrumentTile(k, sudIn)) : []),
    ],
    cssrs: cssrsTile(cohort),
    social: socialTiles(cohort),
    levels: sudIds ? levelTiles(sudIn) : null,
  };
}

export interface SliceGroup {
  key: string;
  label: string;
  report: SliceReport;
}

export interface PopulationHealthReport {
  /** SUD tile access: "full", "totals" (coordinator) or null (no SUD tiles). */
  sudMode: AsamAccessMode | null;
  overall: SliceReport;
  slices: { kind: "track" | "referral_source" | "program"; title: string; note?: string; groups: SliceGroup[] }[];
}

function group(patients: Patient[], keyOf: (p: Patient) => [string, string][]): Map<string, { label: string; list: Patient[] }> {
  const m = new Map<string, { label: string; list: Patient[] }>();
  for (const p of patients)
    for (const [k, label] of keyOf(p)) {
      const g = m.get(k) ?? { label, list: [] };
      g.list.push(p);
      m.set(k, g);
    }
  return m;
}

/** The whole "Population health" section. `null` = hidden for this role. */
export function populationHealthReport(role: StaffRole): PopulationHealthReport | null {
  if (NO_POPULATION_ROLES.includes(role)) return null;
  const all = AdelanteEHR.listPatients();
  const sudMode = asamAccessMode(role);
  const sudCohort = sudMode ? aggregatePatients(role) : null;
  const toGroups = (m: Map<string, { label: string; list: Patient[] }>): SliceGroup[] =>
    [...m.entries()].map(([key, g]) => ({ key, label: g.label, report: sliceReport(g.list, sudCohort) }));
  const trackMap = group(all, (p) => {
    const t = sliceTrack(p);
    return [[t, POPULATION_SLICE_TRACK_LABEL[t]]];
  });
  // Keep all three tracks present, even when empty.
  for (const t of Object.keys(POPULATION_SLICE_TRACK_LABEL) as PopulationSliceTrack[])
    if (!trackMap.has(t)) trackMap.set(t, { label: POPULATION_SLICE_TRACK_LABEL[t], list: [] });
  return {
    sudMode,
    overall: sliceReport(all, sudCohort),
    slices: [
      {
        kind: "track",
        title: "By population track",
        note: "Justice self-report is a grouping only — it is never counted as a substance-use signal.",
        groups: toGroups(trackMap),
      },
      { kind: "referral_source", title: "By referral source", groups: toGroups(group(all, (p) => [sliceReferralSource(p)])) },
      {
        kind: "program",
        title: "By program",
        note: "A person in more than one open program is counted in each.",
        groups: toGroups(group(all, slicePrograms)),
      },
    ],
  };
}
