// §Phase 8a — coverage status honesty.
//
// Two rules live here:
//  1. `coverage.status` is a MEDI-CAL status. It only means something when the
//     coverage type is Medi-Cal or dual. Intake asks it only then.
//  2. `coverage.verified === "verified"` means a person actually checked
//     (a CoverageVerificationRecord exists). Anything the patient tells us is
//     "self_reported".
import type { CoverageStatus, Patient } from "@/lib/ehr";
import { COVERAGE_TYPES, type CoverageType } from "@/lib/frontDoor";

type Coverage = NonNullable<Patient["coverage"]>;

export function mediCalStatusApplies(t?: CoverageType): boolean {
  return t === "medi_cal" || t === "dual";
}

/** Statuses that describe a Medi-Cal record (as opposed to "no Medi-Cal"). */
const MEDI_CAL_STYLE: ReadonlySet<CoverageStatus> = new Set<CoverageStatus>([
  "active",
  "suspended",
  "none_unsure",
]);

const NON_MEDI_CAL_TYPES: ReadonlySet<CoverageType> = new Set<CoverageType>([
  "medicare",
  "private",
  "self_pay",
]);

const STATUS_LABEL: Record<CoverageStatus, string> = {
  active: "Medi-Cal active",
  suspended: "Medi-Cal suspended",
  none_unsure: "No Medi-Cal / unsure",
  other: "Other coverage",
  private_pay: "Private pay",
  uninsured: "Uninsured",
  not_applicable: "No Medi-Cal status (not Medi-Cal)",
};

/**
 * A record whose coverage type is not Medi-Cal but which carries a
 * Medi-Cal-style status (written by the pre-8a intake). Never rewritten —
 * labelled so nobody reads it as Medi-Cal.
 */
export function hasStatusTypeMismatch(c?: Coverage): boolean {
  if (!c?.coverageType) return false;
  return NON_MEDI_CAL_TYPES.has(c.coverageType) && MEDI_CAL_STYLE.has(c.status);
}

export function coverageTypeLabel(t?: CoverageType): string {
  return COVERAGE_TYPES.find((x) => x.key === t)?.label ?? "Coverage type unknown";
}

/** Honest one-line label for the coverage status. */
export function coverageStatusLabel(c?: Coverage): string {
  if (!c) return "No coverage on file";
  if (hasStatusTypeMismatch(c)) {
    return `${coverageTypeLabel(c.coverageType)} · Medi-Cal status "${c.status}" from an older intake — confirm`;
  }
  return STATUS_LABEL[c.status] ?? c.status;
}

export function verifiedLabel(v?: Coverage["verified"]): string {
  switch (v) {
    case "verified":
      return "verified by staff check";
    case "self_reported":
      return "self-reported, not verified";
    case "pending":
      return "check pending";
    default:
      return "not verified";
  }
}

/** Fields a caller of setCoverage may write. Plans and check history are not among them. */
export type CoveragePatch = Partial<Omit<Coverage, "plans" | "verifications">>;

/**
 * Merge a patch into existing coverage. Never drops plans, verification
 * history, community-supports or other flags the patch doesn't mention, and
 * never lets "verified" stand without a recorded check.
 */
export function mergeCoverage(
  existing: Coverage | undefined,
  patch: CoveragePatch,
): { next: Coverage; changed: string[] } {
  const base: Coverage = existing ?? { status: "none_unsure", verified: "not_found" };
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => v !== undefined && k !== "plans" && k !== "verifications"),
  ) as CoveragePatch;
  const next: Coverage = {
    ...base,
    ...clean,
    communitySupports: clean.communitySupports
      ? { ...base.communitySupports, ...clean.communitySupports }
      : base.communitySupports,
    plans: base.plans,
    verifications: base.verifications,
  };
  if (!next.communitySupports) delete next.communitySupports;
  if (!next.plans) delete next.plans;
  if (!next.verifications) delete next.verifications;
  const hasCheck = (base.verifications ?? []).length > 0;
  if (next.verified === "verified" && !hasCheck) next.verified = "self_reported";
  const changed = Object.keys(next).filter(
    (k) =>
      JSON.stringify((base as Record<string, unknown>)[k]) !==
      JSON.stringify((next as Record<string, unknown>)[k]),
  );
  return { next, changed };
}

/** Intake's answers → a coverage patch. Self-report only; never "verified". */
export function intakeCoveragePatch(
  existing: Coverage | undefined,
  a: {
    coverageType: CoverageType;
    mediCalStatus: CoverageStatus;
    countyOfRelease: string;
    jiReentryFlag: boolean;
    justiceInvolvement: Coverage["justiceInvolvement"];
    ecmEligible: boolean;
    otherPlanName?: string;
  },
): CoveragePatch {
  const applies = mediCalStatusApplies(a.coverageType);
  const hasCheck = (existing?.verifications ?? []).length > 0;
  return {
    coverageType: a.coverageType,
    // Non-Medi-Cal types: don't set a Medi-Cal status. Keep what's on file;
    // a brand-new record gets an explicit "not applicable".
    status: applies
      ? a.mediCalStatus
      : existing
        ? undefined
        : a.coverageType === "unknown"
          ? "none_unsure"
          : "not_applicable",
    // A staff check on file outranks the patient's answer; otherwise self-report.
    verified: hasCheck ? undefined : "self_reported",
    countyOfRelease: a.countyOfRelease || undefined,
    jiReentryFlag: a.jiReentryFlag,
    justiceInvolvement: a.justiceInvolvement,
    // Intake can say "yes, I have ECM" but never clears a flag staff set.
    ecmEligible: applies && a.ecmEligible ? true : undefined,
    otherPlanName:
      (a.coverageType === "private" || a.coverageType === "medicare") && a.otherPlanName
        ? a.otherPlanName
        : undefined,
  };
}
