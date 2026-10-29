// 29 Oct (Mitch) — payment and coverage rules for every appointment.
// Draft — pending billing/compliance review with Christi.
//
// ONE pure resolver answers "who pays for THIS appointment": bookings,
// billing readiness, claims and groups all call `resolveFundingSource`.
// No rates, tiers or billing codes live here. Payer keys for county systems
// are Draft (Tulare first; Kings pending confirmation).
//
// Boundaries:
//  • Pure core (`resolveFundingSourceFrom`) takes every fact as a parameter.
//  • The store wrapper reads facts through self-registered readers (ehr.ts
//    registers coverage/catalog/episodes; structuredCarePlan.ts registers the
//    clinician's SMHS determination) so this module imports no store.
//  • The SMHS determination is a dated clinician field — never inferred.

export const FUNDING_DRAFT_LABEL = "Draft — pending billing/compliance review";

export type FundingSource =
  | "medi_cal_mcp"
  | "county_mhp"
  | "county_dmc_ods"
  | "medi_cal_ffs"
  | "commercial"
  | "medicare"
  | "private_pay"
  | "grant_or_county_funded"
  | "non_billable";

export const FUNDING_SOURCES: readonly FundingSource[] = [
  "medi_cal_mcp", "county_mhp", "county_dmc_ods", "medi_cal_ffs", "commercial", "medicare", "private_pay", "grant_or_county_funded", "non_billable",
];

export const FUNDING_SOURCE_LABEL: Record<FundingSource, string> = {
  medi_cal_mcp: "Medi-Cal managed care plan",
  county_mhp: "County mental health plan",
  county_dmc_ods: "County DMC-ODS",
  medi_cal_ffs: "Medi-Cal fee-for-service",
  commercial: "Commercial insurance",
  medicare: "Medicare",
  private_pay: "Private pay",
  grant_or_county_funded: "Grant or county-funded program",
  non_billable: "Not billed",
};

/** Draft delivery-system tag on each service-type catalog entry. */
export type DeliverySystemTag =
  /** Therapy/psychiatry: county_mhp when the clinician's SMHS determination says so, otherwise plan/FFS. */
  | "smhs_or_nsmhs"
  /** Non-specialty mental health (mild-to-moderate, med management): plan or FFS. */
  | "nsmhs"
  /** SUD treatment, incl. the Controlled medication / MOUD visit. */
  | "county_dmc_ods"
  /** ECM and community supports. */
  | "ecm_mcp"
  /** Peer support: county MHP or DMC-ODS — county opt-in to confirm. */
  | "county_peer"
  | "non_billable";

export interface DeliverySystemDraft {
  tag: DeliverySystemTag;
  /** Shown in the report for Mitch and Christi to confirm. */
  confirm?: string;
}

export type FundingFlag =
  | "cob_review"
  | "out_of_network_review"
  | "medicare_review"
  | "delivery_system_review"
  | "coverage_review";

/** Neutral labels — safe for every role that sees billing status. */
export const FUNDING_FLAG_LABEL: Record<FundingFlag, string> = {
  cob_review: "Coordination of benefits — review",
  out_of_network_review: "Out-of-network — needs review",
  medicare_review: "Medicare — needs review (Draft)",
  delivery_system_review: "Delivery system — needs review (Draft)",
  coverage_review: "Coverage — needs review",
};
export const COVERAGE_NEEDS_REVIEW = FUNDING_FLAG_LABEL.coverage_review;

/** Private pay never shows amounts while tiers are pending (Mitch). */
export const SLIDING_SCALE_FEE_LABEL = "Fee: per sliding scale (Draft — tiers pending)";

/** Draft settings. */
export const FUNDING_DRAFT = {
  label: FUNDING_DRAFT_LABEL,
  /** Peer support stays non-billable until county opt-in is confirmed. */
  countyPeerOptInConfirmed: false,
  /** Draft county payer keys used for enrollment rows (Kings pending). */
  countyMhpPayer: "Tulare County MHP",
  countyDmcOdsPayer: "Tulare County DMC-ODS",
  mediCalFfsPayer: "Medi-Cal FFS",
} as const;

export type CoveragePlanType = "medi_cal_mcp" | "medi_cal_ffs" | "commercial" | "medicare";
export type CoverageOrder = "primary" | "secondary";

/** The subset of a CoveragePlanSpan the resolver reads. */
export interface FundingCoverageSpan {
  id: string;
  payer: string;
  from: string;
  to?: string;
  order?: CoverageOrder;
  planType?: CoveragePlanType;
}

export interface SmhsDetermination {
  meets: boolean;
  /** YYYY-MM-DD or ISO — applies to services on/after this date. */
  determinedAt: string;
  determinedBy: string;
}

export interface FundingInput {
  serviceType?: string;
  dateOfService: string;
  coverage: FundingCoverageSpan[];
  paymentArrangement?: "self_pay" | "sliding_fee" | "grant_isl";
  tag?: DeliverySystemTag;
  smhs?: SmhsDetermination;
  /** Active ECM program enrollment (an episode record, never clinical inference). */
  ecmEnrolled?: boolean;
  countyPeerOptIn?: boolean;
}

export interface FundingResolution {
  /** Undefined only when it can't decide (see `reason`). */
  source?: FundingSource;
  coverageId?: string;
  /** Payer key used for the enrollment check. */
  payerKey?: string;
  flags: FundingFlag[];
  reason?: typeof COVERAGE_NEEDS_REVIEW;
}

const day = (iso: string) => iso.slice(0, 10);

/** Conservative Draft plan-type reading when a span predates the field. Unknown stays unknown. */
export function planTypeOf(span: FundingCoverageSpan): CoveragePlanType | undefined {
  if (span.planType) return span.planType;
  const p = span.payer.toLowerCase();
  if (p.includes("medicare")) return "medicare";
  if (p === "medi-cal ffs" || p.includes("fee-for-service")) return "medi_cal_ffs";
  if (p.includes("medi-cal")) return "medi_cal_mcp";
  return undefined;
}

const needsReview = (flags: FundingFlag[] = []): FundingResolution => ({ flags: [...flags, "coverage_review"], reason: COVERAGE_NEEDS_REVIEW });

/** THE resolver (pure). */
export function resolveFundingSourceFrom(input: FundingInput): FundingResolution {
  const tag = input.tag;
  if (!input.serviceType || !tag) return needsReview();
  if (tag === "non_billable") return { source: "non_billable", flags: [] };
  if (tag === "county_peer" && !input.countyPeerOptIn) return { source: "non_billable", flags: [] };

  const d = day(input.dateOfService);
  const active = input.coverage.filter((c) => day(c.from) <= d && (!c.to || day(c.to) >= d));
  const mediCal = active.filter((c) => { const t = planTypeOf(c); return t === "medi_cal_mcp" || t === "medi_cal_ffs"; });
  const other = active.filter((c) => { const t = planTypeOf(c); return t === "commercial" || t === "medicare"; });
  const unknown = active.filter((c) => !planTypeOf(c));

  if (input.paymentArrangement === "grant_isl" && !active.length) return { source: "grant_or_county_funded", flags: [] };
  if (!active.length) {
    if (input.paymentArrangement === "self_pay" || input.paymentArrangement === "sliding_fee") return { source: "private_pay", flags: [] };
    return needsReview();
  }

  // Medi-Cal is the payer of last resort: other coverage is primary.
  if (other.length) {
    const primary = other.find((c) => c.order === "primary") ?? other[0];
    const t = planTypeOf(primary)!;
    const flags: FundingFlag[] = mediCal.length || other.length > 1 ? ["cob_review"] : [];
    if (t === "medicare") flags.push("medicare_review");
    return { source: t, coverageId: primary.id, payerKey: primary.payer, flags };
  }
  if (!mediCal.length) return needsReview(unknown.length ? [] : []);

  const span = mediCal.find((c) => c.order === "primary") ?? mediCal[0];
  const inPlan = planTypeOf(span) === "medi_cal_mcp";
  const planOrFfs = (): FundingResolution =>
    inPlan
      ? { source: "medi_cal_mcp", coverageId: span.id, payerKey: span.payer, flags: [] }
      : { source: "medi_cal_ffs", coverageId: span.id, payerKey: FUNDING_DRAFT.mediCalFfsPayer, flags: [] };
  const meetsSmhs = !!input.smhs && input.smhs.meets && day(input.smhs.determinedAt) <= d;

  switch (tag) {
    case "county_dmc_ods":
      return {
        source: "county_dmc_ods", coverageId: span.id, payerKey: FUNDING_DRAFT.countyDmcOdsPayer,
        // MOUD may also bill through the plan or FFS — Draft "needs review".
        flags: input.serviceType === "controlled_med_moud" ? ["delivery_system_review"] : [],
      };
    case "smhs_or_nsmhs":
      return meetsSmhs ? { source: "county_mhp", coverageId: span.id, payerKey: FUNDING_DRAFT.countyMhpPayer, flags: [] } : planOrFfs();
    case "nsmhs":
      return planOrFfs();
    case "ecm_mcp":
      return input.ecmEnrolled && inPlan ? { source: "medi_cal_mcp", coverageId: span.id, payerKey: span.payer, flags: [] } : { source: "non_billable", flags: [] };
    case "county_peer":
      return meetsSmhs ? { source: "county_mhp", coverageId: span.id, payerKey: FUNDING_DRAFT.countyMhpPayer, flags: [] } : needsReview();
  }
  return needsReview();
}

// ---------------------------------------------------------------- store wrapper

export interface FundingFactReader {
  coverage(patientId: string): FundingCoverageSpan[];
  paymentArrangement(patientId: string): FundingInput["paymentArrangement"];
  tag(serviceType?: string): DeliverySystemTag | undefined;
  ecmEnrolled(patientId: string, at: string): boolean;
}
let facts: FundingFactReader | undefined;
let smhsReader: ((patientId: string) => SmhsDetermination | undefined) | undefined;
/** Financial details never cross this boundary; the existing request store owns order. */
export interface DeterminedFundingFacts {
  coverage: FundingCoverageSpan[];
  paymentArrangement?: FundingInput["paymentArrangement"];
}
let determinationReader: ((patientId: string, dateOfService: string) => DeterminedFundingFacts | undefined) | undefined;
export function registerCoverageDeterminationSource(read: (patientId: string, dateOfService: string) => DeterminedFundingFacts | undefined) { determinationReader = read; }
export function registerFundingFacts(reader: FundingFactReader) { facts = reader; }
export function registerSmhsDeterminationSource(read: (patientId: string) => SmhsDetermination | undefined) { smhsReader = read; }

export function resolveFundingSource(patientId: string, serviceType: string | undefined, dateOfService: string): FundingResolution {
  if (!facts) return needsReview();
  const determined = determinationReader?.(patientId, dateOfService);
  return resolveFundingSourceFrom({
    serviceType,
    dateOfService,
    coverage: determined?.coverage ?? facts.coverage(patientId),
    paymentArrangement: determined?.paymentArrangement ?? facts.paymentArrangement(patientId),
    tag: facts.tag(serviceType),
    smhs: smhsReader?.(patientId),
    ecmEnrolled: facts.ecmEnrolled(patientId, dateOfService),
    countyPeerOptIn: FUNDING_DRAFT.countyPeerOptInConfirmed,
  });
}

// ---------------------------------------------------------------- override

export const FUNDING_OVERRIDE_ROLES = ["billing", "billing_coordinator", "intake_coordinator"] as const;
export const canOverrideFundingSource = (role: string) => (FUNDING_OVERRIDE_ROLES as readonly string[]).includes(role);
export const FUNDING_OVERRIDE_REASONS = ["coverage_updated", "coordination_of_benefits", "program_enrollment", "payer_confirmed", "other"] as const;
export type FundingOverrideReason = (typeof FUNDING_OVERRIDE_REASONS)[number];
export const FUNDING_OVERRIDE_REASON_LABEL: Record<FundingOverrideReason, string> = {
  coverage_updated: "Coverage updated",
  coordination_of_benefits: "Coordination of benefits",
  program_enrollment: "Program enrollment",
  payer_confirmed: "Payer confirmed",
  other: "Other",
};

/** What an appointment stores. Ids and codes only. */
export interface AppointmentFundingRecord {
  source?: FundingSource;
  coverageId?: string;
  payerKey?: string;
  flags: FundingFlag[];
  set: "resolved" | "override";
  reasonCode?: FundingOverrideReason;
}

export function fundingRecordFrom(r: FundingResolution): AppointmentFundingRecord {
  return { ...(r.source ? { source: r.source } : {}), ...(r.coverageId ? { coverageId: r.coverageId } : {}), ...(r.payerKey ? { payerKey: r.payerKey } : {}), flags: [...r.flags], set: "resolved" };
}

/** Does this source require payer enrollment for the service? */
export function fundingRequiresEnrollment(source: FundingSource): "required" | "in_network_flag" | "review_flag" | "none" {
  switch (source) {
    case "medi_cal_mcp": case "county_mhp": case "county_dmc_ods": case "medi_cal_ffs": return "required";
    case "commercial": return "in_network_flag";
    case "medicare": return "review_flag";
    default: return "none";
  }
}
/** Exclusion screening for these sources is Adelante policy rather than payer law. */
export const isAdelantePolicySource = (source?: FundingSource) => source === "private_pay" || source === "grant_or_county_funded";
export const ADELANTE_POLICY_LABEL = "Adelante policy (Draft)";

// ---------------------------------------------------------------- recurring series (staff only)

export const SERIES_DRAFT = {
  label: "Draft",
  /** Maximum visits per series — about six months weekly. */
  maxVisitsPerSeries: 26,
} as const;
export type SeriesCadence = "weekly" | "biweekly";

/** Occurrence start times for a series (pure). End by date OR count; capped by the Draft max. */
export function seriesOccurrences(input: { firstStart: string; cadence: SeriesCadence; endDate?: string; count?: number }): string[] {
  const step = (input.cadence === "weekly" ? 7 : 14) * 86400_000;
  const first = +new Date(input.firstStart);
  if (!Number.isFinite(first)) throw new Error("Pick a first visit time.");
  if (!input.endDate && !input.count) throw new Error("Choose an end date or a number of visits.");
  const cap = SERIES_DRAFT.maxVisitsPerSeries;
  const wanted = input.count ? Math.min(Math.max(1, Math.floor(input.count)), cap) : cap;
  const end = input.endDate ? +new Date(`${day(input.endDate)}T23:59:59.999Z`) : Infinity;
  const out: string[] = [];
  for (let i = 0; out.length < wanted; i++) {
    const t = first + i * step;
    if (t > end) break;
    out.push(new Date(t).toISOString());
  }
  return out;
}
