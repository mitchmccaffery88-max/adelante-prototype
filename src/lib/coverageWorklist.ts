// §Phase 3c — program-level Medi-Cal verification worklist.
//
// Nothing here invents data. Every row is read back out of the two stores the
// earlier phases actually created:
//   * Phase 3a — `coverage.verifications[]` (who checked, when, through which
//     real human channel) and the follow-up `CaseTask` rows created by
//     `requestReactivation` / `addEnrollmentAssistTask`.
//   * Phase 3b — `coverage.plans[]`, the one consolidated coverage model.
//
// There is still NO automated eligibility transaction in this app (no 270/271,
// no clearinghouse — SculptSoft production scope). This worklist therefore
// orders HUMAN work: who nobody has checked on, and whose last human check is
// old enough to be untrustworthy.
import {
  AdelanteEHR,
  worklistStatusFor,
  type CaseTask,
  type CoverageVerificationRecord,
  type Patient,
} from "./ehr";

// ---------------------------------------------------------------------------
// Staleness policy — declared in ONE place, and declared as draft
// ---------------------------------------------------------------------------

/**
 * Why 30/60 and not the "e.g. 90 days" in the brief.
 *
 * Medi-Cal eligibility is a MONTHLY fact. Beneficiary eligibility is carried
 * in DHCS's monthly MEDS cycle, share-of-cost and aid codes are set per month
 * of service, and a beneficiary can lose or regain eligibility at a month
 * boundary without anything reaching the provider. The standard operational
 * expectation for a Medi-Cal provider is to verify eligibility for each month
 * in which services are rendered — which makes ~30 days, not 90, the interval
 * after which a recorded check stops describing the present.
 *
 * 90 days would be three whole eligibility months old: comfortable to report
 * against, wrong to bill against. So:
 *   * `dueDays: 30`  — a check older than one eligibility month needs redoing.
 *   * `overdueDays: 60` — two months past, escalate it above the routine pile.
 *
 * This has NOT been ratified by Adelante's revenue operations, so it is
 * surfaced as draft policy on screen, exactly the way `DISENGAGEMENT_DRAFT`
 * in `myWork.ts` surfaces its own unratified thresholds.
 */
export const COVERAGE_STALENESS_DRAFT = {
  dueDays: 30,
  overdueDays: 60,
  label: "Draft threshold — pending revenue-operations sign-off",
  note:
    "Draft: Medi-Cal eligibility is determined per month of service, so a check older than 30 days is treated as due and older than 60 days as overdue. No automated eligibility transaction exists in this app — every check on this list is a person picking up a phone or a portal.",
} as const;

export type CoverageCheckState = "never_checked" | "overdue" | "due" | "current";

export const COVERAGE_CHECK_STATE_LABEL: Record<CoverageCheckState, string> = {
  never_checked: "Never checked",
  overdue: "Overdue",
  due: "Due",
  current: "Current",
};

/** Sort weight — worst first. */
const STATE_RANK: Record<CoverageCheckState, number> = {
  never_checked: 0,
  overdue: 1,
  due: 2,
  current: 3,
};

/** Task types created by Phase 3a's Medi-Cal follow-up actions. */
export const COVERAGE_FOLLOW_UP_TASK_TYPES = [
  "medi_cal_reactivation",
  "benefitscal_enrollment",
  "ecm_consent_capture",
] as const;

export const COVERAGE_FOLLOW_UP_TASK_LABEL: Record<string, string> = {
  medi_cal_reactivation: "Reactivation follow-up",
  benefitscal_enrollment: "Enrollment assistance",
  ecm_consent_capture: "ECM consent capture",
};

export interface CoverageWorklistRow {
  patientId: string;
  name: string;
  programId: string;
  county?: string;
  coverageStatus: string;
  verified: string;
  cinOnFile: boolean;
  activePlanPayer?: string;
  lastCheck?: CoverageVerificationRecord;
  daysSinceCheck?: number;
  state: CoverageCheckState;
  /** Open (not completed/cancelled) Phase 3a follow-up tasks for this patient. */
  openFollowUps: CaseTask[];
}

function daysBetween(fromIso: string, now: number): number {
  return Math.floor((now - +new Date(fromIso)) / 86400000);
}

export function coverageCheckState(
  lastCheckedAt: string | undefined,
  now: number,
): { state: CoverageCheckState; days?: number } {
  if (!lastCheckedAt) return { state: "never_checked" };
  const days = daysBetween(lastCheckedAt, now);
  if (days >= COVERAGE_STALENESS_DRAFT.overdueDays) return { state: "overdue", days };
  if (days >= COVERAGE_STALENESS_DRAFT.dueDays) return { state: "due", days };
  return { state: "current", days };
}

function openFollowUpsFor(tasks: CaseTask[], patientId: string): CaseTask[] {
  return tasks
    .filter(
      (t) =>
        t.patientId === patientId &&
        t.taskType !== undefined &&
        (COVERAGE_FOLLOW_UP_TASK_TYPES as readonly string[]).includes(t.taskType) &&
        worklistStatusFor(t) !== "completed" &&
        worklistStatusFor(t) !== "cancelled",
    )
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

/**
 * Every patient, worst coverage-check state first. Patients with no coverage
 * record at all still appear — "nobody has ever looked" is the single most
 * actionable row on this page, and dropping them would hide it.
 */
export function coverageWorklistRows(
  patients: Patient[] = AdelanteEHR.listPatients(),
  tasks: CaseTask[] = AdelanteEHR.listCaseTasks(),
  now: number = Date.now(),
): CoverageWorklistRow[] {
  const rows = patients.map((p) => {
    const lastCheck = (p.coverage?.verifications ?? [])[0];
    const { state, days } = coverageCheckState(lastCheck?.checkedAt, now);
    const plan = (p.coverage?.plans ?? []).find(
      (c) => +new Date(c.from) <= now && (!c.to || +new Date(c.to) >= now),
    );
    return {
      patientId: p.id,
      name: p.name ?? "(no name on record)",
      programId: p.programId,
      county: p.coverage?.countyOfRelease,
      coverageStatus: p.coverage?.status ?? "unknown",
      verified: p.coverage?.verified ?? "not_found",
      cinOnFile: Boolean(p.cin),
      activePlanPayer: plan?.payer,
      lastCheck,
      daysSinceCheck: days,
      state,
      openFollowUps: openFollowUpsFor(tasks, p.id),
    } satisfies CoverageWorklistRow;
  });
  return rows.sort((a, b) => {
    const r = STATE_RANK[a.state] - STATE_RANK[b.state];
    if (r !== 0) return r;
    // Oldest check first within a state; never-checked fall back to name.
    const ad = a.daysSinceCheck ?? -1;
    const bd = b.daysSinceCheck ?? -1;
    if (ad !== bd) return bd - ad;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

export interface CoverageWorklistSummary {
  total: number;
  neverChecked: number;
  overdue: number;
  due: number;
  current: number;
  openFollowUps: number;
}

export function coverageWorklistSummary(rows: CoverageWorklistRow[]): CoverageWorklistSummary {
  return {
    total: rows.length,
    neverChecked: rows.filter((r) => r.state === "never_checked").length,
    overdue: rows.filter((r) => r.state === "overdue").length,
    due: rows.filter((r) => r.state === "due").length,
    current: rows.filter((r) => r.state === "current").length,
    openFollowUps: rows.reduce((n, r) => n + r.openFollowUps.length, 0),
  };
}

/** Distinct counties present in the rows, for the county filter. */
export function coverageWorklistCounties(rows: CoverageWorklistRow[]): string[] {
  return [...new Set(rows.map((r) => r.county).filter(Boolean) as string[])].sort();
}
