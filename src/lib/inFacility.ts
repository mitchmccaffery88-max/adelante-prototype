// Outpatient lens. Adelante is outpatient-only, so in-facility / inpatient
// surfaces (MAR / medication rounds, shift count, facility census, pre-release
// episodes, custody tasks, facility protocol rounds, NCCHC jail metrics) are
// hidden behind ONE segment flag, off by default. The code and tests stay.
// Connections to inpatient facilities (higher-level referrals, discharge and
// transfer records) are outpatient work and are NOT behind this flag.
let enabled = false;

export function inFacilityEnabled(): boolean {
  return enabled;
}
/** Test / future-segment hook. */
export function setInFacilityEnabled(on: boolean): void {
  enabled = on;
}

/** Staff nav entries that are in-facility only. */
export const IN_FACILITY_NAV_IDS: ReadonlySet<string> = new Set([
  "shift-count",
  "pre-release",
  "released-search",
  "facility-protocols",
  "admin-facilities",
  "refusal-queue",
]);

/** Dashboard KPI tiles that measure in-facility work. */
export function isInFacilityMetric(key: string): boolean {
  return (
    key === "mar_compliance_pct" ||
    key === "controlled_count_discrepancies" ||
    key === "open_kites_count" ||
    key.startsWith("ncchc_")
  );
}

/** Case tasks that belong to in-facility work (protocol rounds, custody). */
export function isInFacilityTask(t: {
  facilityContext?: boolean;
  protocolInstanceId?: string;
  taskType?: string;
}): boolean {
  if (t.facilityContext) return true;
  if (t.protocolInstanceId) return true;
  const tt = t.taskType ?? "";
  return /custody|pre_release|prerelease|mar_|shift_count|census/.test(tt);
}
