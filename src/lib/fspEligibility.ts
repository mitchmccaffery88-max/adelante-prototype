// §Batch A2 — FSP presumptive eligibility (6+ months in custody). DRAFT rule.
//
// Justice-involved patients only (isJusticeInvolved). Staff-only; visibility
// follows the existing custody_tracking record class — no role is widened:
// write roles record, read roles see the badge, everyone else sees nothing.
// Never patient- or advocate-facing.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { canAccess, type StaffRole } from "@/lib/roles";
import { isJusticeInvolved } from "@/lib/justiceInvolvement";

export const FSP_RULE_LABEL = "Draft — pending clinical sign-off";
export const FSP_MIN_MONTHS = 6;

export type CustodyProvenance = "custody_record" | "court_record" | "self_report" | "outside_agency";
export const CUSTODY_PROVENANCE_LABEL: Record<CustodyProvenance, string> = {
  custody_record: "Custody / booking record",
  court_record: "Court record",
  self_report: "Patient self-report",
  outside_agency: "Outside agency (probation, parole)",
};

export interface CustodyDuration {
  custodyStart?: string;
  custodyEnd?: string;
  totalMonths?: number;
  provenance: CustodyProvenance;
}
export interface FspHistoryRow extends CustodyDuration {
  months: number;
  eligible: boolean;
  by: string;
  role: StaffRole;
  at: string;
}
export interface FspRecord extends CustodyDuration {
  patientId: string;
  months: number;
  fspPresumptiveEligible: boolean;
  history: FspHistoryRow[];
}

const records = new Map<string, FspRecord>();

/** Whole calendar months between two YYYY-MM-DD dates. */
export function monthsBetween(start: string, end: string): number {
  const [y1, m1, d1] = start.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = end.split("-").map(Number) as [number, number, number];
  let m = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) m -= 1;
  return Math.max(0, m);
}

export function custodyMonths(d: CustodyDuration, today = new Date().toISOString().slice(0, 10)): number {
  if (d.custodyStart) return monthsBetween(d.custodyStart, d.custodyEnd ?? today);
  return Math.max(0, Math.floor(d.totalMonths ?? 0));
}

const writes = (role: StaffRole, p?: Patient) => {
  const a = canAccess(role, "custody_tracking", p);
  return a.level === "write" && !a.locked;
};
const reads = (role: StaffRole, p?: Patient) => {
  const a = canAccess(role, "custody_tracking", p);
  return a.level !== "none" && !a.locked;
};
export const canRecordCustodyDuration = (role: StaffRole, p?: Patient) => writes(role, p) && isJusticeInvolved(p);

export function recordCustodyDuration(
  actor: { role: StaffRole; name: string },
  patientId: string,
  input: CustodyDuration,
): FspRecord {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) throw new Error("Patient not found.");
  if (!writes(actor.role, p)) throw new Error("Your role can't record custody information.");
  if (!isJusticeInvolved(p)) throw new Error("Custody duration applies only to justice-involved patients.");
  if (!CUSTODY_PROVENANCE_LABEL[input.provenance]) throw new Error("Say where this information came from.");
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (input.custodyStart && !date.test(input.custodyStart)) throw new Error("Enter a valid custody start date.");
  if (input.custodyEnd && !date.test(input.custodyEnd)) throw new Error("Enter a valid custody end date.");
  if (input.custodyStart && input.custodyEnd && input.custodyEnd < input.custodyStart) throw new Error("The end date is before the start date.");
  if (!input.custodyStart && (input.totalMonths === undefined || !(input.totalMonths >= 0))) throw new Error("Enter custody dates, or total months if the dates aren't known.");
  const months = custodyMonths(input);
  const eligible = months >= FSP_MIN_MONTHS;
  const at = new Date().toISOString();
  const clean: CustodyDuration = input.custodyStart
    ? { custodyStart: input.custodyStart, custodyEnd: input.custodyEnd, provenance: input.provenance }
    : { totalMonths: Math.floor(input.totalMonths!), provenance: input.provenance };
  const prev = records.get(patientId);
  const rec: FspRecord = {
    patientId,
    ...clean,
    months,
    fspPresumptiveEligible: eligible,
    history: [...(prev?.history ?? []), { ...clean, months, eligible, by: actor.name, role: actor.role, at }],
  };
  records.set(patientId, rec);
  return rec;
}

/** Staff view. Null when not justice-involved or the role can't read custody data. */
export function fspStatusFor(role: StaffRole, patientId: string): FspRecord | null {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p || !isJusticeInvolved(p) || !reads(role, p)) return null;
  const r = records.get(patientId);
  if (!r) return { patientId, months: 0, fspPresumptiveEligible: false, provenance: "self_report", history: [] };
  // Recalculate (an open-ended custody period keeps counting).
  const months = custodyMonths(r);
  return { ...r, months, fspPresumptiveEligible: months >= FSP_MIN_MONTHS, history: r.history.slice() };
}

export type ReportingAgeBand = "25_and_under" | "26_and_older";
export const AGE_BAND_LABEL: Record<ReportingAgeBand, string> = { "25_and_under": "25 and under", "26_and_older": "26 and older" };
/** Age band at the service date. */
export function reportingAgeBand(dob: string, serviceDate: string): ReportingAgeBand {
  const [y1, m1, d1] = dob.slice(0, 10).split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = serviceDate.slice(0, 10).split("-").map(Number) as [number, number, number];
  let age = y2 - y1;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) age -= 1;
  return age <= 25 ? "25_and_under" : "26_and_older";
}

/** §Batch D4 — aggregate-only: ids of justice-involved people currently FSP presumptive-eligible. */
export function fspPresumptiveEligibleIds(today?: string): string[] {
  const out: string[] = [];
  for (const [pid, r] of records) {
    const p = AdelanteEHR.getPatient(pid);
    if (p && isJusticeInvolved(p) && custodyMonths(r, today) >= FSP_MIN_MONTHS) out.push(pid);
  }
  return out;
}

export function _resetFsp(): void {
  records.clear();
}
