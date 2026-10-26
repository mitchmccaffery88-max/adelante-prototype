// 26 Oct (Mitch) — coverage paths: configuration as DATA, not code.
// Every list here (paths, county programs, payers, fee schedules, sliding-scale
// tiers, re-verification cadence, adapter selection) is editable at runtime by
// the configuration setters below; nothing else branches on a hard-coded name.
// Draft — pending billing/clinical sign-off.
import { listManagedCarePlans } from "@/lib/managedCarePlans";

export const COVERAGE_CONFIG_DRAFT = "Draft — pending billing sign-off";

export type CoveragePath =
  | "medi_cal"
  | "medicare"
  | "county_program"
  | "private"
  | "self_pay"
  | "sliding_scale"
  | "uninsured_apply"
  | "unknown";

export type PathProcessing = "check" | "self_pay" | "sliding" | "application" | "determine";

export const COVERAGE_PATHS: { id: CoveragePath; label: string; short: string; processing: PathProcessing }[] = [
  { id: "medi_cal", label: "Medi-Cal (fee-for-service or managed care plan)", short: "Medi-Cal", processing: "check" },
  { id: "medicare", label: "Medicare (including Medi-Medi)", short: "Medicare", processing: "check" },
  { id: "county_program", label: "County or public program", short: "County program", processing: "check" },
  { id: "private", label: "Private / commercial insurance", short: "Private insurance", processing: "check" },
  { id: "self_pay", label: "Self-pay", short: "Self-pay", processing: "self_pay" },
  { id: "sliding_scale", label: "Sliding scale (income-based)", short: "Sliding scale", processing: "sliding" },
  { id: "uninsured_apply", label: "Uninsured — help applying for Medi-Cal", short: "Medi-Cal application", processing: "application" },
  { id: "unknown", label: "Unknown — Billing determines", short: "Coverage to be determined", processing: "determine" },
];
export const isCoveragePath = (v: unknown): v is CoveragePath => COVERAGE_PATHS.some((p) => p.id === v);
export const coveragePath = (id: CoveragePath) => COVERAGE_PATHS.find((p) => p.id === id)!;

// ---- County and public programs (configurable by program and county) ----
export interface CountyProgram { id: string; label: string; counties: string[]; recheckMonths: number; active: boolean }
let countyPrograms: CountyProgram[] = [
  { id: "dmc_ods_county", label: "DMC-ODS (county-funded)", counties: [], recheckMonths: 1, active: true },
  { id: "mhsa_bhsa", label: "MHSA / BHSA", counties: [], recheckMonths: 12, active: true },
  { id: "realignment_ab109", label: "Realignment / AB 109", counties: [], recheckMonths: 6, active: true },
  { id: "calaim_reentry", label: "CalAIM justice-involved pre-release services", counties: [], recheckMonths: 1, active: true },
];
export function listCountyPrograms(opts: { county?: string; includeRetired?: boolean } = {}) {
  return countyPrograms
    .filter((p) => opts.includeRetired || p.active)
    .filter((p) => !opts.county || p.counties.length === 0 || p.counties.includes(opts.county))
    .map((p) => ({ ...p, counties: [...p.counties] }));
}
export function setCountyPrograms(next: CountyProgram[]) {
  if (next.some((p) => !p.id.trim() || !p.label.trim() || !(p.recheckMonths > 0))) throw new Error("Each program needs an id, label and re-check interval.");
  countyPrograms = next.map((p) => ({ ...p, counties: [...p.counties] }));
}

// ---- Payer list (data). Medi-Cal plans come from the managed care plan list. ----
export interface Payer { id: string; name: string; kind: "medi_cal" | "medicare" | "commercial" | "county"; ediPayerId?: string; clearinghouseSupported: boolean; planYearStartMonth?: number; active: boolean }
let otherPayers: Payer[] = [
  { id: "medi-cal-ffs", name: "Medi-Cal fee-for-service (DHCS)", kind: "medi_cal", clearinghouseSupported: false, active: true },
  { id: "medicare-original", name: "Original Medicare", kind: "medicare", clearinghouseSupported: false, active: true },
  { id: "commercial-other", name: "Other commercial plan (name recorded by Billing)", kind: "commercial", clearinghouseSupported: false, planYearStartMonth: 1, active: true },
];
export function listPayers(kind?: Payer["kind"]): Payer[] {
  const mcp: Payer[] = listManagedCarePlans()
    .filter((p) => p.kind === "plan")
    .map((p) => ({ id: p.id, name: p.name, kind: "medi_cal" as const, clearinghouseSupported: false, active: true }));
  return [...mcp, ...otherPayers.filter((p) => p.active)].filter((p) => !kind || p.kind === kind).map((p) => ({ ...p }));
}
export function setPayers(next: Payer[]) {
  if (next.some((p) => !p.id.trim() || !p.name.trim())) throw new Error("Each payer needs an id and name.");
  otherPayers = next.map((p) => ({ ...p }));
}

// ---- Self-pay fee schedules ----
export interface FeeSchedule { id: string; label: string; active: boolean }
let feeSchedules: FeeSchedule[] = [{ id: "self_pay_standard", label: "Standard self-pay fee schedule", active: true }];
export const listFeeSchedules = () => feeSchedules.filter((f) => f.active).map((f) => ({ ...f }));
export function setFeeSchedules(next: FeeSchedule[]) { feeSchedules = next.map((f) => ({ ...f })); }

// ---- Sliding-scale tier table (Draft placeholder until finance signs off) ----
export interface SlidingTier { id: string; label: string; maxPercentOfPoverty: number | null }
export interface SlidingTable { povertyBaseCents: number; povertyPerPersonCents: number; tiers: SlidingTier[] }
let slidingTable: SlidingTable = {
  // Federal poverty guideline inputs are configuration; Billing updates them yearly.
  povertyBaseCents: 1_565_000,
  povertyPerPersonCents: 550_000,
  tiers: [
    { id: "tier_a", label: "Tier A", maxPercentOfPoverty: 100 },
    { id: "tier_b", label: "Tier B", maxPercentOfPoverty: 150 },
    { id: "tier_c", label: "Tier C", maxPercentOfPoverty: 200 },
    { id: "tier_d", label: "Tier D", maxPercentOfPoverty: 250 },
    { id: "full_fee", label: "Full fee", maxPercentOfPoverty: null },
  ],
};
export const getSlidingTable = (): SlidingTable => ({ ...slidingTable, tiers: slidingTable.tiers.map((t) => ({ ...t })) });
export function setSlidingTable(next: SlidingTable) {
  if (!next.tiers.length || next.tiers.at(-1)!.maxPercentOfPoverty !== null) throw new Error("The last tier must catch every income.");
  slidingTable = { ...next, tiers: next.tiers.map((t) => ({ ...t })) };
}
export function slidingTierFor(householdSize: number, annualIncomeCents: number): SlidingTier {
  if (!Number.isInteger(householdSize) || householdSize < 1 || !(annualIncomeCents >= 0)) throw new Error("Household size and income required.");
  const t = slidingTable;
  const poverty = t.povertyBaseCents + (householdSize - 1) * t.povertyPerPersonCents;
  const pct = (annualIncomeCents / poverty) * 100;
  return { ...t.tiers.find((x) => x.maxPercentOfPoverty === null || pct <= x.maxPercentOfPoverty)! };
}

// ---- Re-verification cadence ----
export type Recheck = { months: number } | { planYear: true } | { none: true };
let recheck: Record<Exclude<CoveragePath, "county_program">, Recheck> = {
  medi_cal: { months: 1 },
  medicare: { months: 12 },
  private: { planYear: true },
  self_pay: { none: true },
  sliding_scale: { months: 12 },
  uninsured_apply: { months: 1 },
  unknown: { none: true },
};
export function setRecheckCadence(path: Exclude<CoveragePath, "county_program">, value: Recheck) { recheck = { ...recheck, [path]: value }; }
const addMonths = (d: string, m: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };
export function nextCheckDate(path: CoveragePath, checkedOn: string, opts: { programId?: string; payerId?: string } = {}): string | undefined {
  if (path === "county_program") {
    const p = countyPrograms.find((x) => x.id === opts.programId);
    return p ? addMonths(checkedOn, p.recheckMonths) : addMonths(checkedOn, 1);
  }
  const r = recheck[path];
  if ("none" in r) return undefined;
  if ("months" in r) return addMonths(checkedOn, r.months);
  const start = (listPayers().find((p) => p.id === opts.payerId)?.planYearStartMonth ?? 1) - 1;
  const d = new Date(`${checkedOn}T00:00:00Z`);
  const candidate = new Date(Date.UTC(d.getUTCFullYear(), start, 1));
  if (candidate <= d) candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  return candidate.toISOString().slice(0, 10);
}

// ---- Adapter selection (configuration, never a code change) ----
export type CoverageChannel = "manual" | "simulated_vendor" | "clearinghouse" | "external_billing";
export interface AdapterConfig {
  selected: CoverageChannel;
  clearinghouse: { enabled: boolean; vendor: string; credentialsSecretName: string; baaOnFile: boolean; timeoutMs: number };
}
const DEFAULT_ADAPTER: AdapterConfig = {
  selected: "manual",
  clearinghouse: { enabled: false, vendor: "", credentialsSecretName: "CLEARINGHOUSE_API_KEY", baaOnFile: false, timeoutMs: 15000 },
};
let adapterConfig: AdapterConfig = structuredClone(DEFAULT_ADAPTER);
export const getAdapterConfig = (): AdapterConfig => structuredClone(adapterConfig);
export function configureEligibilityAdapter(next: Partial<Omit<AdapterConfig, "clearinghouse">> & { clearinghouse?: Partial<AdapterConfig["clearinghouse"]> }) {
  const merged: AdapterConfig = { ...adapterConfig, ...next, clearinghouse: { ...adapterConfig.clearinghouse, ...(next.clearinghouse ?? {}) } };
  if (merged.clearinghouse.enabled && (!merged.clearinghouse.baaOnFile || !merged.clearinghouse.vendor.trim() || !merged.clearinghouse.credentialsSecretName.trim()))
    throw new Error("A signed BAA, vendor and credentials setting are required before the clearinghouse can be switched on.");
  adapterConfig = merged;
}
export function resetEligibilityAdapterConfig() { adapterConfig = structuredClone(DEFAULT_ADAPTER); }
