// §Phase 7c — the billing code table (unit rules) and the effective-dated,
// per-unit rate table. Replaces the display-only mock on /billing and the
// service-type price list that claims used to read.
//
// Rules, all enforced HERE rather than on a page:
//  - Only roles with `billing` write (Billing, Billing Coordinator) change
//    anything. A read-only role (Sys Admin) is refused and nothing changes.
//  - Rates are add + end-date only. No edit, no delete: a price change is
//    "end-date the old one, add a new one", so history is never overwritten.
//  - Two rates for the same code + program may never overlap in time.
//  - Every change is attributed to the acting staff member and audited.
//  - Unit length lives on the CODE, not the rate. Amount = rate × units.
//
// Everything seeded is a PLACEHOLDER / DRAFT pending billing review — the
// amounts were copied from the old per-service price list, not a fee schedule.

import { AdelanteEHR } from "@/lib/ehr";
import { canAccess, getActingRole, getActingStaff } from "@/lib/roles";

export const BILLING_WRITE_REFUSED = "Your role can view billing but can't change it.";

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export type PayerProgram =
  | "dmc_ods"
  | "smhs"
  | "medi_cal_managed"
  | "calaim_ecm"
  | "self_pay"
  | "sliding_fee"
  | "grant_isl"
  | "commercial";

/** §Phase 7d — how a general-population patient pays. Set by billing only. */
export type PaymentArrangement = "self_pay" | "sliding_fee" | "grant_isl";
export const PAYMENT_ARRANGEMENTS: { id: PaymentArrangement; label: string }[] = [
  { id: "self_pay", label: "Self-pay (standard fee)" },
  { id: "sliding_fee", label: "Sliding fee" },
  { id: "grant_isl", label: "Grant / ISL-funded (no patient charge)" },
];
/** Programs that are modelled but can't be chosen for a claim yet. */
export const INACTIVE_PROGRAMS: ReadonlySet<PayerProgram> = new Set<PayerProgram>(["commercial"]);
export const PROGRAM_INACTIVE = "Commercial insurance is inactive at launch and can't be used on a claim.";
/** Programs where the patient owes the whole charge. */
export const PATIENT_PAY_PROGRAMS: ReadonlySet<PayerProgram> = new Set<PayerProgram>(["self_pay", "sliding_fee"]);

export const PAYER_PROGRAMS: { id: PayerProgram; label: string; helper: string }[] = [
  { id: "dmc_ods", label: "DMC-ODS", helper: "SUD services for Medi-Cal members (county DMC-ODS)" },
  { id: "smhs", label: "Specialty MH (county MHP)", helper: "Specialty mental health through the county MHP" },
  { id: "medi_cal_managed", label: "Medi-Cal (FFS / managed care)", helper: "Non-specialty mental health" },
  { id: "calaim_ecm", label: "CalAIM ECM / Community Supports", helper: "CHW and peer-support codes" },
  { id: "self_pay", label: "Self-pay", helper: "Standard fee schedule — the patient pays" },
  { id: "sliding_fee", label: "Sliding fee", helper: "Discounted schedule — the patient pays (tiers in Phase 7e)" },
  { id: "grant_isl", label: "Grant / ISL", helper: "Grant or ISL-funded — no patient charge, reportable to the funder" },
  { id: "commercial", label: "Commercial (inactive at launch)", helper: "Modelled for expansion — not selectable for claims yet" },
];
export const PROGRAM_LABEL: Record<PayerProgram, string> = Object.fromEntries(
  PAYER_PROGRAMS.map((p) => [p.id, p.label]),
) as Record<PayerProgram, string>;
export const isPayerProgram = (v: string): v is PayerProgram =>
  PAYER_PROGRAMS.some((p) => p.id === v);

// ---------------------------------------------------------------------------
// Billing codes + unit rules
// ---------------------------------------------------------------------------

export type UnitType = "per_minutes" | "per_encounter" | "per_month";
/** `half_plus`: a unit counts once MORE than half is delivered (≥8 of 15). */
export type RoundingRule = "half_plus" | "whole_units";

export interface BillingCode {
  code: string;
  description: string;
  unitType: UnitType;
  /** Required for `per_minutes`. */
  unitMinutes?: number;
  roundingRule: RoundingRule;
  /** Seeded entries are drafts until billing reviews them. */
  draft: boolean;
  /** Set when the unit definition itself is uncertain. */
  needsReview?: string;
  updatedBy?: string;
  updatedByRole?: string;
  updatedAt?: string;
}

const SEED_BY = "seed";
const codes: BillingCode[] = [
  { code: "H0001", description: "SUD assessment", unitType: "per_encounter", roundingRule: "half_plus", draft: true },
  { code: "H0004", description: "SUD individual counseling", unitType: "per_minutes", unitMinutes: 15, roundingRule: "half_plus", draft: true },
  {
    code: "H0005",
    description: "SUD group counseling",
    unitType: "per_minutes",
    unitMinutes: 15,
    roundingRule: "half_plus",
    draft: true,
    needsReview: "DMC-ODS bills H0005 in 15-minute units per attendee under CalAIM payment reform — confirm against the county fee schedule.",
  },
  { code: "H0006", description: "SUD case management", unitType: "per_minutes", unitMinutes: 15, roundingRule: "half_plus", draft: true },
  { code: "H0031", description: "MH assessment", unitType: "per_encounter", roundingRule: "half_plus", draft: true },
  { code: "90834", description: "Psychotherapy, 45 min", unitType: "per_encounter", roundingRule: "half_plus", draft: true },
  { code: "90853", description: "Group psychotherapy", unitType: "per_encounter", roundingRule: "half_plus", draft: true },
  { code: "99213", description: "Office visit / med management", unitType: "per_encounter", roundingRule: "half_plus", draft: true },
  { code: "H0038", description: "Peer support, individual", unitType: "per_minutes", unitMinutes: 15, roundingRule: "half_plus", draft: true },
  {
    code: "H0025",
    description: "Peer support, group (behavioral health prevention education)",
    unitType: "per_encounter",
    roundingRule: "half_plus",
    draft: true,
    needsReview: "Unit basis for H0025 as a peer group code is not confirmed — billing to set.",
  },
  { code: "H2014", description: "Skills training, group", unitType: "per_minutes", unitMinutes: 15, roundingRule: "half_plus", draft: true },
  { code: "T1017", description: "Targeted case management / care coordination", unitType: "per_minutes", unitMinutes: 15, roundingRule: "half_plus", draft: true },
  {
    code: "G0019",
    description: "CHW services (initiating)",
    unitType: "per_minutes",
    unitMinutes: 30,
    roundingRule: "whole_units",
    draft: true,
    needsReview: "Medicare defines G0019 as 60 min per calendar month; the app's CHW hook uses 30-min units. Medi-Cal CHW services may use 98960–98962 instead. Billing to confirm.",
  },
  {
    code: "G0022",
    description: "CHW services (additional time)",
    unitType: "per_minutes",
    unitMinutes: 30,
    roundingRule: "whole_units",
    draft: true,
    needsReview: "Medicare defines G0022 as each additional 30 min. Confirm Medi-Cal applicability.",
  },
].map((c) => ({ ...c, updatedBy: SEED_BY })) as BillingCode[];

export function listBillingCodes(): BillingCode[] {
  return codes.map((c) => ({ ...c })).sort((a, b) => a.code.localeCompare(b.code));
}
export function getBillingCode(code: string): BillingCode | undefined {
  const c = codes.find((x) => x.code === code);
  return c ? { ...c } : undefined;
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export function unitsFor(code: BillingCode, minutes: number): number {
  if (code.unitType !== "per_minutes") return 1;
  const len = code.unitMinutes ?? 15;
  const m = Math.max(0, Math.floor(minutes));
  const whole = Math.floor(m / len);
  if (code.roundingRule === "whole_units") return whole;
  const rem = m - whole * len;
  return whole + (rem > len / 2 ? 1 : 0);
}

export function unitBasisLabel(code: BillingCode | undefined): string {
  if (!code) return "unknown code";
  if (code.unitType === "per_encounter") return "per encounter";
  if (code.unitType === "per_month") return "per month";
  return `${code.unitMinutes ?? 15} min`;
}

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

export interface Rate {
  id: string;
  code: string;
  program: PayerProgram;
  /** §Phase 7d — absent = program-wide; set = only this payer (commercial infra). */
  payerId?: string;
  /** Per unit, integer cents. */
  amountCents: number;
  /** YYYY-MM-DD, inclusive. */
  effectiveFrom: string;
  /** YYYY-MM-DD, inclusive. Absent = open-ended. */
  effectiveTo?: string;
  placeholder: boolean;
  placeholderNote?: string;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  endedBy?: string;
  endedByRole?: string;
  endedAt?: string;
  endReason?: string;
}

const rates: Rate[] = [];
let rateSeq = 0;
const rid = () => `rate_${++rateSeq}`;
const SEED_FROM = "2026-01-01";
const seedRate = (code: string, program: PayerProgram, amountCents: number, placeholderNote?: string) =>
  rates.push({
    id: rid(),
    code,
    program,
    amountCents,
    effectiveFrom: SEED_FROM,
    placeholder: true,
    ...(placeholderNote ? { placeholderNote } : {}),
    createdBy: SEED_BY,
    createdByRole: "system",
    createdAt: new Date().toISOString(),
  });
// Per-unit placeholders derived from the old per-visit price list.
seedRate("H0001", "dmc_ods", 22500);
seedRate("H0004", "dmc_ods", 4125); // 16500 / 4 units
seedRate("H0005", "dmc_ods", 2375); // 9500 / 4 units
seedRate("H0006", "dmc_ods", 2000); // 8000 / 4 units
seedRate("H0031", "smhs", 22500);
seedRate("H0031", "medi_cal_managed", 22500);
seedRate("90834", "smhs", 16500);
seedRate("90834", "medi_cal_managed", 16500);
seedRate("90853", "smhs", 9500);
seedRate("90853", "medi_cal_managed", 9500);
seedRate("99213", "smhs", 19500);
seedRate("99213", "medi_cal_managed", 19500);
seedRate("99213", "dmc_ods", 19500);
seedRate("T1017", "smhs", 2000);
seedRate("T1017", "medi_cal_managed", 2000);
seedRate("H2014", "dmc_ods", 2375);
seedRate("H0038", "calaim_ecm", 1625); // 6500 / 4 units
seedRate("G0019", "calaim_ecm", 2500);
seedRate("G0022", "calaim_ecm", 2500);
// §Phase 7d — general-population placeholders pending the clinic's fee policy.
// Self-pay = current per-unit amount; sliding fee = 50% (one row, tiers are
// 7e); grant/ISL = self-pay amount as the reportable value (patient owes $0).
export const FEE_POLICY_PLACEHOLDER = "Placeholder — pending clinic fee policy";
for (const [code, cents] of [
  ["H0001", 22500], ["H0004", 4125], ["H0005", 2375], ["H0006", 2000], ["H0031", 22500],
  ["90834", 16500], ["90853", 9500], ["99213", 19500], ["T1017", 2000], ["H2014", 2375],
] as [string, number][]) {
  seedRate(code, "self_pay", cents, FEE_POLICY_PLACEHOLDER);
  seedRate(code, "sliding_fee", Math.round(cents / 2), FEE_POLICY_PLACEHOLDER);
  seedRate(code, "grant_isl", cents, FEE_POLICY_PLACEHOLDER);
}

export function listRates(): Rate[] {
  return rates
    .map((r) => ({ ...r }))
    .sort((a, b) => a.code.localeCompare(b.code) || a.program.localeCompare(b.program) || a.effectiveFrom.localeCompare(b.effectiveFrom));
}

const inRange = (r: Rate, day: string) =>
  r.effectiveFrom <= day && (!r.effectiveTo || day <= r.effectiveTo);

export function rateFor(code: string, program: PayerProgram, serviceDate: string, payerId?: string): Rate | undefined {
  const day = serviceDate.slice(0, 10);
  const match = (x: Rate) => x.code === code && x.program === program && inRange(x, day);
  // Payer-specific first, then program-wide.
  const r =
    (payerId ? rates.find((x) => match(x) && x.payerId === payerId) : undefined) ??
    rates.find((x) => match(x) && !x.payerId);
  return r ? { ...r } : undefined;
}
export function getRate(id: string): Rate | undefined {
  const r = rates.find((x) => x.id === id);
  return r ? { ...r } : undefined;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (s: string) => DAY_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const overlaps = (aFrom: string, aTo: string | undefined, bFrom: string, bTo: string | undefined) =>
  aFrom <= (bTo ?? "9999-12-31") && bFrom <= (aTo ?? "9999-12-31");

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function writer(): { ok: true; id: string; name: string; role: string } | { ok: false; error: string } {
  const role = getActingRole();
  if (canAccess(role, "billing").level !== "write") return { ok: false, error: BILLING_WRITE_REFUSED };
  const s = getActingStaff();
  return { ok: true, id: s?.id ?? role, name: s?.name ?? role, role };
}

/** Listeners (ehr-ext re-prices waiting claims when a rate is added). */
const rateAddedListeners: ((r: Rate) => void)[] = [];
export function onRateAdded(fn: (r: Rate) => void) {
  rateAddedListeners.push(fn);
}

export function addRate(input: {
  code: string;
  program: PayerProgram;
  amountCents: number;
  effectiveFrom: string;
  effectiveTo?: string;
  payerId?: string;
}): Result<{ rate: Rate }> {
  const w = writer();
  if (!w.ok) return w;
  const code = input.code.trim().toUpperCase();
  if (!codes.some((c) => c.code === code))
    return { ok: false, error: `Unknown billing code ${code}. Add it to the code table first.` };
  if (!isPayerProgram(input.program)) return { ok: false, error: "Choose a payer program." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    return { ok: false, error: "Amount must be a positive whole number of cents." };
  if (!validDay(input.effectiveFrom)) return { ok: false, error: "Start date must be YYYY-MM-DD." };
  const to = input.effectiveTo?.trim() || undefined;
  if (to && !validDay(to)) return { ok: false, error: "End date must be YYYY-MM-DD." };
  if (to && to < input.effectiveFrom) return { ok: false, error: "End date can't be before the start date." };
  const payerId = input.payerId?.trim() || undefined;
  const clash = rates.find(
    (r) => r.code === code && r.program === input.program && (r.payerId ?? "") === (payerId ?? "") && overlaps(r.effectiveFrom, r.effectiveTo, input.effectiveFrom, to),
  );
  if (clash)
    return {
      ok: false,
      error: `Overlaps the existing ${code} / ${PROGRAM_LABEL[input.program]} rate from ${clash.effectiveFrom} to ${clash.effectiveTo ?? "open"}. End-date that rate first.`,
    };
  const rate: Rate = {
    id: rid(),
    code,
    program: input.program,
    ...(payerId ? { payerId } : {}),
    amountCents: input.amountCents,
    effectiveFrom: input.effectiveFrom,
    ...(to ? { effectiveTo: to } : {}),
    placeholder: false,
    createdBy: w.name,
    createdByRole: w.role,
    createdAt: new Date().toISOString(),
  };
  rates.push(rate);
  AdelanteEHR.recordBillingAudit({
    action: "rate_added",
    actorId: w.id,
    actorRole: w.role,
    detail: { rateId: rate.id, code, program: rate.program, payerId: payerId ?? null, amountCents: rate.amountCents, effectiveFrom: rate.effectiveFrom, effectiveTo: to ?? null, actorName: w.name },
  });
  for (const fn of rateAddedListeners) fn({ ...rate });
  return { ok: true, rate: { ...rate } };
}

/**
 * Close a rate. Only the end date (plus who/why) ever changes. Can't end
 * before the start, and can't cut off days a priced claim already relies on.
 */
export function endDateRate(
  id: string,
  effectiveTo: string,
  reason: string,
  latestPricedServiceDate?: (rateId: string) => string | undefined,
): Result<{ rate: Rate }> {
  const w = writer();
  if (!w.ok) return w;
  const r = rates.find((x) => x.id === id);
  if (!r) return { ok: false, error: "Rate not found." };
  if (!validDay(effectiveTo)) return { ok: false, error: "End date must be YYYY-MM-DD." };
  if (!reason.trim()) return { ok: false, error: "Give a reason for end-dating this rate." };
  if (effectiveTo < r.effectiveFrom) return { ok: false, error: "End date can't be before the start date." };
  if (r.effectiveTo && effectiveTo >= r.effectiveTo)
    return { ok: false, error: `This rate already ends ${r.effectiveTo}. An end date can only move earlier.` };
  const latest = latestPricedServiceDate?.(r.id);
  if (latest && effectiveTo < latest)
    return { ok: false, error: `A claim for ${latest} was priced from this rate. End date can't be before it.` };
  const from = r.effectiveTo ?? null;
  r.effectiveTo = effectiveTo;
  r.endedBy = w.name;
  r.endedByRole = w.role;
  r.endedAt = new Date().toISOString();
  r.endReason = reason.trim();
  AdelanteEHR.recordBillingAudit({
    action: "rate_end_dated",
    actorId: w.id,
    actorRole: w.role,
    detail: { rateId: r.id, code: r.code, program: r.program, amountCents: r.amountCents, effectiveFrom: r.effectiveFrom, previousEnd: from, effectiveTo, reason: r.endReason, actorName: w.name },
  });
  return { ok: true, rate: { ...r } };
}

/** Add a code, or change an existing code's description / unit rule. */
export function upsertBillingCode(input: {
  code: string;
  description: string;
  unitType: UnitType;
  unitMinutes?: number;
  roundingRule: RoundingRule;
}): Result<{ code: BillingCode }> {
  const w = writer();
  if (!w.ok) return w;
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,6}$/.test(code)) return { ok: false, error: "Code must be 4–6 letters or digits (e.g. H0004, 90834)." };
  if (!input.description.trim()) return { ok: false, error: "Give the code a description." };
  if (input.unitType === "per_minutes" && (!Number.isInteger(input.unitMinutes) || (input.unitMinutes ?? 0) <= 0))
    return { ok: false, error: "Minutes-based codes need a unit length in whole minutes." };
  const existing = codes.find((c) => c.code === code);
  const before = existing ? { ...existing } : null;
  const next: BillingCode = {
    code,
    description: input.description.trim(),
    unitType: input.unitType,
    ...(input.unitType === "per_minutes" ? { unitMinutes: input.unitMinutes } : {}),
    roundingRule: input.roundingRule,
    draft: false,
    updatedBy: w.name,
    updatedByRole: w.role,
    updatedAt: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, next, { needsReview: undefined });
  else codes.push(next);
  AdelanteEHR.recordBillingAudit({
    action: existing ? "billing_code_updated" : "billing_code_added",
    actorId: w.id,
    actorRole: w.role,
    detail: {
      code,
      before: before ? { description: before.description, unitType: before.unitType, unitMinutes: before.unitMinutes ?? null, roundingRule: before.roundingRule } : null,
      after: { description: next.description, unitType: next.unitType, unitMinutes: next.unitMinutes ?? null, roundingRule: next.roundingRule },
      actorName: w.name,
    },
  });
  return { ok: true, code: { ...next } };
}

// ---------------------------------------------------------------------------
// Default code per service type (billing can correct on the claim)
// ---------------------------------------------------------------------------

export type ServiceLine = "sud" | "mh";
export const DEFAULT_CODE_BY_SERVICE: Record<ServiceLine, Record<string, string>> = {
  sud: {
    intake: "H0001",
    therapy_individual: "H0004",
    therapy_group: "H0005",
    med_management: "99213",
    peer_support: "H0038",
    case_management: "H0006",
    care_coordination: "H0006",
  },
  mh: {
    intake: "H0031",
    therapy_individual: "90834",
    therapy_group: "90853",
    med_management: "99213",
    peer_support: "H0038",
    case_management: "T1017",
    care_coordination: "T1017",
  },
};
export function defaultCodeFor(serviceType: string | undefined, line: ServiceLine): string {
  return DEFAULT_CODE_BY_SERVICE[line][serviceType ?? "therapy_individual"] ?? DEFAULT_CODE_BY_SERVICE[line]["therapy_individual"]!;
}

export const COMMUNITY_CODES = new Set(["H0038", "H0025", "G0019", "G0022"]);

/**
 * Program selection (approved rule, in order):
 *  1. Peer / CHW code → calaim_ecm
 *  2. No Medi-Cal coverage on the service date → non_medi_cal
 *  3. SUD service line → dmc_ods
 *  4. Payer names the county MHP / mental health plan → smhs
 *  5. Any other Medi-Cal payer → medi_cal_managed
 */
export function selectProgram(input: {
  code: string;
  line: ServiceLine;
  hasMediCal: boolean;
  payer?: string;
}): PayerProgram {
  if (COMMUNITY_CODES.has(input.code)) return "calaim_ecm";
  if (!input.hasMediCal) return "non_medi_cal";
  if (input.line === "sud") return "dmc_ods";
  if (input.payer && /\bMHP\b|mental health/i.test(input.payer)) return "smhs";
  return "medi_cal_managed";
}
