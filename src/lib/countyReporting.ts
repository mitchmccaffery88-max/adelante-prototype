// §Batch D — County reporting hub for Premier (Tulare DMC-ODS).
//
// PROTOTYPE — NOT SUBMITTED ANYWHERE. Every county response is Simulated.
// Every field layout, band, due day and rule here is "Draft — pending clinical
// sign-off" (to be validated against the official DHCS specs).
//
// Part 2: client-level rows (files, worklists, TPS list) only for roles that
// hold "SUD reporting access" (sudReportingAccess.ts); everyone else gets aggregates. Every file that leaves
// goes through `disclose()` (one check per client in the file). Every
// displayed aggregate cell is suppressed below the cohort minimum (11).
import { AdelanteEHR, registerIslExportBuilder, type Patient } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import { hasSudReportingAccess } from "@/lib/sudReportingAccess";
import { MIN_COHORT_SIZE } from "@/lib/cohortGuard";
import { calomsCompletenessFor, calomsWorklist } from "@/lib/dmcOdsReadiness";
import { disclose, PART2_NOTICE_BLOCK, type Part2RecordClass } from "@/lib/part2Disclosure";
import { listPrograms, type Program } from "@/lib/providerReference";
import { CARE_CONTINUUM, FUNDING_LABEL, MEDI_CAL_LANES, listServiceClassifications, sweepServiceClassification, type CareContinuum, type ServiceClassification } from "@/lib/serviceClassification";
import { getAfbiContact, roleSeesAfbiDetail } from "@/lib/afbiOutreach";
import { listContacts } from "@/lib/caseloadReview";
import { fspPresumptiveEligibleIds, reportingAgeBand, AGE_BAND_LABEL, type ReportingAgeBand } from "@/lib/fspEligibility";
import { isSudServiceType } from "@/lib/bookingRights";
import { periodDays, type ReportingPeriodKey } from "@/lib/reportingPeriods";

export const COUNTY_PROTOTYPE_LABEL = "Prototype — not submitted anywhere";
export const COUNTY_DRAFT_LABEL = "Draft — pending clinical sign-off";
export const COUNTY_SIMULATED_LABEL = "Simulated — no county system is connected";
export const ISL_DEADLINE_NOTE = "Tulare target was October 2026 — confirm current deadline with county (Draft)";
export const BHOATR_DOLLARS_NOTE = "Dollar amounts added when billing is re-enabled";
export const ISL_PRIVATE_PAY_NOTE = "Private pay excluded (Draft — Christi to confirm)";

// ------------------------------------------------------------------ access
/** CalOMS/TPS client-level preparer (Batch G1 decision). Returned CalOMS errors route here too. */
export const COUNTY_PREPARER_ROLE: StaffRole = "billing_coordinator";
/** Hub roles. The SUD counselor keeps clinical access but no longer prepares county files. */
export const COUNTY_REPORTING_ROLES: readonly StaffRole[] = ["sys_admin", "billing", "billing_coordinator", "credentialing_coordinator", "clinical_coordinator"];
export const canViewCountyReporting = (role: StaffRole) => COUNTY_REPORTING_ROLES.includes(role);
/** Client-level rows (files, worklists) — holders of the "SUD reporting access" capability only. */
export const seesClientLevel = (role: StaffRole) => canViewCountyReporting(role) && hasSudReportingAccess(role);
/** Who gets the due-date reminders (Draft). */
export const REMINDER_OWNER_ROLE: StaffRole = "billing_coordinator";

export interface CountyActor {
  staffId?: string;
  name?: string;
  role: StaffRole;
}
function assertHub(actor: CountyActor) {
  if (!canViewCountyReporting(actor.role)) throw new Error("Your role can't use county reporting.");
}
function assertClientLevel(actor: CountyActor) {
  assertHub(actor);
  if (!hasSudReportingAccess(actor.role)) throw new Error("Client-level county files need SUD reporting access (substance-use reporting). You can see the counts.");
}

// ------------------------------------------------------------------ cohort guard
/** Suppress (return null) any displayed count from 1 to 10. Zero is shown. */
export function suppressCell(n: number): number | null {
  return n > 0 && n < MIN_COHORT_SIZE ? null : n;
}
export const cellText = (n: number) => {
  const v = suppressCell(n);
  return v === null ? `<${MIN_COHORT_SIZE}` : String(v);
};

// ------------------------------------------------------------------ periods
export interface DateRange {
  from: string; // ISO
  to: string; // ISO
}
export function rangeForPeriod(key: ReportingPeriodKey, now = new Date()): DateRange {
  return { from: new Date(now.getTime() - periodDays(key) * 86_400_000).toISOString(), to: now.toISOString() };
}
const inRange = (iso: string | undefined, r: DateRange) => !!iso && iso.slice(0, 10) >= r.from.slice(0, 10) && iso.slice(0, 10) <= r.to.slice(0, 10);

// ------------------------------------------------------------------ reports + due dates
export type CountyReportId = "caloms" | "datar" | "isl" | "bhoatr" | "tps";
export const REPORT_LABEL: Record<CountyReportId, string> = {
  caloms: "CalOMS monthly file",
  datar: "DATAR counts",
  isl: "ISL export",
  bhoatr: "BHOATR rollups",
  tps: "Treatment Perception Survey",
};
/** Draft due day for ISL (monthly). CalOMS / DATAR come from the provider & site reference. */
export const ISL_DUE_DAY_DRAFT = 20;

function dueDayFor(report: "CalOMS" | "DATAR"): number {
  for (const p of listPrograms()) {
    const c = p.reporting.find((r) => r.report === report);
    if (c) return c.dueDay;
  }
  return report === "CalOMS" ? 15 : 10;
}
function nextMonthlyDue(day: number, now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), day, 17, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d < today) d.setMonth(d.getMonth() + 1);
  return d;
}
export function nextDueDate(report: CountyReportId, now = new Date()): Date | null {
  if (report === "caloms") return nextMonthlyDue(dueDayFor("CalOMS"), now);
  if (report === "datar") return nextMonthlyDue(dueDayFor("DATAR"), now);
  if (report === "isl") return nextMonthlyDue(ISL_DUE_DAY_DRAFT, now);
  if (report === "tps") {
    const w = tpsWindow();
    return w ? new Date(`${w.end}T17:00:00`) : null;
  }
  return null; // BHOATR: on request
}
/** The monthly file covers the calendar month before the due date. */
export function reportingMonthFor(due: Date): { key: string; range: DateRange } {
  const start = new Date(due.getFullYear(), due.getMonth() - 1, 1);
  const end = new Date(due.getFullYear(), due.getMonth(), 0, 23, 59, 59);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return { key, range: { from: start.toISOString(), to: end.toISOString() } };
}
const daysUntil = (d: Date, now: Date) => {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
};

// ------------------------------------------------------------------ Part 2 file gate
function fileDisclose(actor: CountyActor, patientId: string, classes: Part2RecordClass[], purpose: string) {
  return disclose({
    patientId,
    actor: { name: actor.name ?? actor.staffId ?? actor.role, role: actor.role, staffId: actor.staffId },
    recipient: { name: "County behavioral health reporting (prototype)", organization: "Tulare County BH (prototype)", type: "county" },
    purpose,
    channel: "county_report",
    recordClasses: classes,
    simulated: true,
  });
}

// ------------------------------------------------------------------ D1 CalOMS
export const CALOMS_LAYOUT_DRAFT = ["Record type", "Client record ID", "Episode ID", "Event date", "Provider number (CalOMS)", "Primary substance", "Route", "Frequency (past 30 days)", "Age at first use", "Prior treatment episodes", "Discharge status", "Discharge reason"] as const;
export type CalomsRecordType = "admission" | "discharge" | "annual_update";
export interface CalomsRecord {
  type: CalomsRecordType;
  patientId: string;
  episodeId: string;
  date: string;
  missing: string[];
}
export function calomsRecordsFor(range: DateRange): CalomsRecord[] {
  const out: CalomsRecord[] = [];
  for (const p of AdelanteEHR.listPatients()) {
    const eps = (p.episodes ?? []).filter((e) => e.type === "sud_dmc_ods");
    if (!eps.length) continue;
    const comp = calomsCompletenessFor(p);
    const disc = p.calomsProfile?.discharges?.[0];
    for (const ep of eps) {
      if (inRange(ep.openedAt, range)) out.push({ type: "admission", patientId: p.id, episodeId: ep.id, date: ep.openedAt.slice(0, 10), missing: comp.admissionMissing });
      if (disc?.dischargedOn && inRange(disc.dischargedOn, range)) out.push({ type: "discharge", patientId: p.id, episodeId: ep.id, date: disc.dischargedOn, missing: comp.dischargeMissing ?? [] });
      if (!ep.closedAt) {
        const opened = new Date(ep.openedAt);
        for (let y = 1; y <= 5; y++) {
          const ann = new Date(opened);
          ann.setFullYear(opened.getFullYear() + y);
          if (inRange(ann.toISOString(), range)) out.push({ type: "annual_update", patientId: p.id, episodeId: ep.id, date: ann.toISOString().slice(0, 10), missing: comp.admissionMissing });
        }
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ D2 DATAR
/** Placeholder capacity per program (Simulated — not from DHCS). */
export const DATAR_CAPACITY_PLACEHOLDER: Record<string, number> = {
  "Outpatient SUD (DMC-ODS)": 60,
  "Field outreach (AFBI)": 0,
  "Outpatient mental health": 80,
};
export interface DatarRow {
  programId: string;
  program: string;
  capacity: number;
  waitlist: number | null;
  admissions: number | null;
}
function programKind(p: Program): "sud" | "afbi" | "mh" {
  if (/afbi|outreach/i.test(p.name)) return "afbi";
  if (/sud|dmc/i.test(p.name)) return "sud";
  return "mh";
}
export function datarCounts(range: DateRange): DatarRow[] {
  const patients = AdelanteEHR.listPatients();
  const appts = AdelanteEHR.listAppointments();
  return listPrograms().map((prog) => {
    const k = programKind(prog);
    let waitlist = 0;
    let admissions = 0;
    if (k === "sud") {
      for (const p of patients) {
        const ep = (p.episodes ?? []).find((e) => e.type === "sud_dmc_ods" && !e.closedAt);
        if (!ep) continue;
        if (inRange(ep.openedAt, range)) admissions++;
        if (!appts.some((a) => a.patientId === p.id && a.status === "scheduled")) waitlist++;
      }
    } else if (k === "afbi") {
      admissions = new Set(listServiceClassifications().filter((c) => c.ref.kind === "afbi_contact" && inRange(c.serviceDate, range)).map((c) => c.patientId ?? c.ref.id)).size;
    } else {
      admissions = new Set(appts.filter((a) => a.serviceType === "intake" && a.status === "attended" && inRange(a.start, range)).map((a) => a.patientId)).size;
      waitlist = AdelanteEHR.listOpenAppointmentRequests().length;
    }
    return { programId: prog.id, program: prog.name, capacity: DATAR_CAPACITY_PLACEHOLDER[prog.name] ?? 0, waitlist: suppressCell(waitlist), admissions: suppressCell(admissions) };
  });
}

// ------------------------------------------------------------------ services (shared by ISL + BHOATR)
export interface ServiceRow {
  cls: ServiceClassification;
  patientId?: string;
  date: string;
  minutes: number;
  completed: boolean;
  serviceLabel: string;
  program: string;
  /** Reveals SUD treatment (Part 2). */
  sud: boolean;
}
function programFor(c: ServiceClassification, sud: boolean): string {
  if (c.ref.kind === "afbi_contact") return "Field outreach (AFBI)";
  if (sud || c.fundingSource === "dmc_ods") return "Outpatient SUD (DMC-ODS)";
  return "Outpatient mental health";
}
export function serviceRows(range: DateRange): ServiceRow[] {
  sweepServiceClassification();
  const appts = new Map(AdelanteEHR.listAppointments().map((a) => [a.id, a]));
  const occ = new Map<string, { status: Map<string, string>; minutes: number }>();
  for (const g of AdelanteEHR.listGroupSessions())
    for (const o of AdelanteEHR.listGroupOccurrenceRecords(g.id))
      occ.set(o.id, { status: new Map((o.attendance ?? []).map((x) => [x.patientId, x.status])), minutes: (g as { durationMin?: number }).durationMin ?? 90 });
  const out: ServiceRow[] = [];
  for (const c of listServiceClassifications()) {
    if (!inRange(c.serviceDate, range)) continue;
    let minutes = 0;
    let completed = true;
    let label = "Service";
    let sud = c.careContinuum === "mat";
    if (c.ref.kind === "appointment") {
      const a = appts.get(c.ref.id);
      if (!a) continue;
      minutes = a.durationMin;
      completed = a.status === "attended";
      sud = sud || isSudServiceType(a.serviceType) || !!a.asamTaskId;
      label = sud ? "SUD treatment visit" : AdelanteEHR.getServiceType(a.serviceType)?.label ?? "Visit";
    } else if (c.ref.kind === "group_attendance") {
      const [oid, pid] = [c.ref.id.slice(0, c.ref.id.lastIndexOf(":")), c.ref.id.slice(c.ref.id.lastIndexOf(":") + 1)];
      const o = occ.get(oid);
      const st = o?.status.get(pid);
      completed = st === "present" || st === "late";
      minutes = o?.minutes ?? 90;
      label = "Group";
    } else if (c.ref.kind === "afbi_contact") {
      const a = getAfbiContact(c.ref.id);
      minutes = a?.minutes ?? 0;
      label = "Field outreach (AFBI)";
      sud = sud || !!a?.activities?.some((x) => /sud|substance|naloxone|mat/i.test(String(x)));
    } else if (c.ref.kind === "case_contact") {
      minutes = 15;
      label = "Case management contact";
      completed = !!c.patientId && listContacts(c.patientId).some((x) => x.id === c.ref.id);
    } else {
      const p = c.patientId ? AdelanteEHR.getPatient(c.patientId) : undefined;
      minutes = p?.peerNotes?.find((n) => n.id === c.ref.id)?.minutes ?? 15;
      label = "Peer contact";
    }
    out.push({ cls: c, patientId: c.patientId, date: c.serviceDate.slice(0, 10), minutes, completed, serviceLabel: label, program: programFor(c, sud), sud });
  }
  return out;
}

// ------------------------------------------------------------------ D3 ISL
export const ISL_LANES = ["isl_non_medi_cal", "bhsa"] as const;
export const ISL_COLUMNS_DRAFT = ["service_ref", "date", "client_record_id", "service", "program", "care_continuum", "funding_lane", "minutes"] as const;
export function islRows(range: DateRange): ServiceRow[] {
  return serviceRows(range)
    .filter((r) => (ISL_LANES as readonly string[]).includes(r.cls.fundingSource))
    .filter((r) => r.cls.fundingSource !== "private_pay")
    .filter((r) => r.completed)
    .sort((a, b) => a.date.localeCompare(b.date));
}
const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const continuumLabel = (c: CareContinuum) => CARE_CONTINUUM.find((x) => x.id === c)?.label ?? c;

export interface CountyFile {
  report: CountyReportId;
  rowCount: number;
  withheld: number;
  disclosureChecks: number;
  file: string;
}
/** Builds the ISL file: SUD rows only for SUD-authorised roles and only after disclose(). */
export function buildIslFile(actor: CountyActor, range: DateRange): CountyFile {
  const rows = islRows(range);
  const clientLevelSud = seesClientLevel(actor.role);
  const keep: ServiceRow[] = [];
  let withheld = 0;
  let checks = 0;
  const decided = new Map<string, boolean>();
  for (const r of rows) {
    const who = r.patientId ?? `afbi:${r.cls.ref.id}`;
    const classes: Part2RecordClass[] = r.sud ? ["SUD treatment notes"] : [];
    if (r.sud && !clientLevelSud) {
      withheld++;
      continue;
    }
    const k = `${who}|${r.sud}`;
    if (!decided.has(k)) {
      checks++;
      const res = r.patientId ? fileDisclose(actor, r.patientId, classes, "ISL reporting to county (prototype)") : { ok: true as const };
      decided.set(k, res.ok);
    }
    if (decided.get(k)) keep.push(r);
    else withheld++;
  }
  const header = [`# ${COUNTY_PROTOTYPE_LABEL}. Layout: ${COUNTY_DRAFT_LABEL}. ${ISL_PRIVATE_PAY_NOTE}.`];
  if (keep.some((r) => r.sud)) header.push(`# ${PART2_NOTICE_BLOCK.replace(/\n/g, " ")}`);
  if (withheld) header.push(`# ${withheld} row(s) withheld — restricted.`);
  const lines = [ISL_COLUMNS_DRAFT.join(","), ...keep.map((r) => [r.cls.ref.kind + ":" + r.cls.ref.id, r.date, r.patientId ?? "not-yet-enrolled", r.serviceLabel, r.program, continuumLabel(r.cls.careContinuum), FUNDING_LABEL[r.cls.fundingSource], r.minutes].map(csvCell).join(","))];
  return { report: "isl", rowCount: keep.length, withheld, disclosureChecks: checks, file: `${header.join("\n")}\n${lines.join("\n")}` };
}
registerIslExportBuilder((range, actor) => {
  const r: DateRange = { from: range?.from ?? "0000-01-01", to: range?.to ?? "9999-12-31" };
  return buildIslFile(actor ?? { role: "billing_coordinator", name: "Billing export" }, r).file;
});

// ------------------------------------------------------------------ D4 BHOATR
export const BHOATR_AGE_BANDS_DRAFT = [
  { id: "0_17", label: "0–17", max: 17 },
  { id: "18_25", label: "18–25", max: 25 },
  { id: "26_64", label: "26–64", max: 64 },
  { id: "65_up", label: "65+", max: 200 },
] as const;
function ageOn(dob: string, iso: string): number {
  const [y1, m1, d1] = dob.slice(0, 10).split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  let a = y2 - y1;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) a--;
  return a;
}
export interface BhoatrRollup {
  unduplicated: number | null;
  byAge: { band: string; count: number | null }[];
  mediCal: number | null;
  nonMediCal: number | null;
  services: { funding: string; program: string; continuum: string; units: number | null; minutes: number | null }[];
  fsp: { band: string; count: number | null }[];
  /** Raw (unsuppressed) for tests / exports only — never rendered. */
  raw: { unduplicated: number; mediCal: number; nonMediCal: number; fsp: Record<ReportingAgeBand, number> };
}
export function bhoatrRollup(range: DateRange): BhoatrRollup {
  const rows = serviceRows(range).filter((r) => r.completed);
  const clients = new Map<string, { patient?: Patient; mediCal: boolean }>();
  for (const r of rows) {
    const id = r.patientId ?? `afbi:${r.cls.ref.id}`;
    const cur = clients.get(id) ?? { patient: r.patientId ? AdelanteEHR.getPatient(r.patientId) : undefined, mediCal: false };
    if (MEDI_CAL_LANES.includes(r.cls.fundingSource)) cur.mediCal = true;
    clients.set(id, cur);
  }
  const ageCounts = new Map<string, number>();
  for (const c of clients.values()) {
    const band = c.patient?.dob ? BHOATR_AGE_BANDS_DRAFT.find((b) => ageOn(c.patient!.dob, range.to) <= b.max)?.label ?? "Unknown" : "Unknown";
    ageCounts.set(band, (ageCounts.get(band) ?? 0) + 1);
  }
  const svc = new Map<string, { funding: string; program: string; continuum: string; units: number; minutes: number }>();
  for (const r of rows) {
    const k = `${r.cls.fundingSource}|${r.program}|${r.cls.careContinuum}`;
    const cur = svc.get(k) ?? { funding: FUNDING_LABEL[r.cls.fundingSource], program: r.program, continuum: continuumLabel(r.cls.careContinuum), units: 0, minutes: 0 };
    cur.units++;
    cur.minutes += r.minutes;
    svc.set(k, cur);
  }
  const mediCal = [...clients.values()].filter((c) => c.mediCal).length;
  const fspRaw: Record<ReportingAgeBand, number> = { "25_and_under": 0, "26_and_older": 0 };
  for (const pid of fspPresumptiveEligibleIds(range.to.slice(0, 10))) {
    const p = AdelanteEHR.getPatient(pid);
    if (p?.dob) fspRaw[reportingAgeBand(p.dob, range.to)]++;
  }
  // Units/minutes: the cell is suppressed when the people behind it are under 11.
  const peoplePer = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = `${r.cls.fundingSource}|${r.program}|${r.cls.careContinuum}`;
    const s = peoplePer.get(k) ?? new Set<string>();
    s.add(r.patientId ?? `afbi:${r.cls.ref.id}`);
    peoplePer.set(k, s);
  }
  return {
    unduplicated: suppressCell(clients.size),
    byAge: [...BHOATR_AGE_BANDS_DRAFT.map((b) => b.label), "Unknown"].map((band) => ({ band, count: suppressCell(ageCounts.get(band) ?? 0) })),
    mediCal: suppressCell(mediCal),
    nonMediCal: suppressCell(clients.size - mediCal),
    services: [...svc.entries()].map(([k, v]) => {
      const safe = suppressCell(peoplePer.get(k)?.size ?? 0) !== null;
      return { ...v, units: safe ? v.units : null, minutes: safe ? v.minutes : null };
    }),
    fsp: (Object.keys(fspRaw) as ReportingAgeBand[]).map((b) => ({ band: AGE_BAND_LABEL[b], count: suppressCell(fspRaw[b]) })),
    raw: { unduplicated: clients.size, mediCal, nonMediCal: clients.size - mediCal, fsp: fspRaw },
  };
}

// ------------------------------------------------------------------ D5 TPS
export interface TpsWindow {
  start: string; // YYYY-MM-DD
  end: string;
}
export type TpsStatus = "not_offered" | "offered" | "completed" | "declined";
interface TpsRow {
  status: TpsStatus;
  by?: string;
  at?: string;
  linkSentAt?: string;
}
let _tpsWindow: TpsWindow | null = null;
const tps = new Map<string, TpsRow>();
export const TPS_ADMIN_ROLES: readonly StaffRole[] = ["sys_admin"];
export function tpsWindow(): TpsWindow | null {
  return _tpsWindow;
}
export function setTpsWindow(actor: CountyActor, w: TpsWindow): TpsWindow {
  if (!TPS_ADMIN_ROLES.includes(actor.role)) throw new Error("Only a system administrator sets the survey window.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.start) || !/^\d{4}-\d{2}-\d{2}$/.test(w.end) || w.end < w.start) throw new Error("Pick a start and an end date (end on or after start).");
  _tpsWindow = { ...w };
  AdelanteEHR._recordAudit({ category: "admin", action: "tps_window_set", actorId: actor.staffId ?? actor.name, actorRole: actor.role, detail: { ...w, draft: true } });
  return _tpsWindow;
}
export function tpsEligibleIds(w: TpsWindow | null = _tpsWindow): string[] {
  if (!w) return [];
  const r: DateRange = { from: `${w.start}T00:00:00.000Z`, to: `${w.end}T23:59:59.000Z` };
  const ids = new Set<string>();
  for (const p of AdelanteEHR.listPatients()) {
    const openEp = (p.episodes ?? []).some((e) => e.openedAt.slice(0, 10) <= w.end && (!e.closedAt || e.closedAt.slice(0, 10) >= w.start));
    if (openEp) ids.add(p.id);
  }
  for (const s of serviceRows(r)) if (s.patientId && s.completed) ids.add(s.patientId);
  return [...ids];
}
export function tpsStatusOf(patientId: string): TpsStatus {
  return tps.get(patientId)?.status ?? "not_offered";
}
/** Client-level list — SUD-authorised roles only. */
export function tpsList(role: StaffRole): { patientId: string; name: string; status: TpsStatus; linkSentAt?: string }[] | null {
  if (!seesClientLevel(role)) return null;
  return tpsEligibleIds().map((id) => {
    const p = AdelanteEHR.getPatient(id);
    const r = tps.get(id);
    return { patientId: id, name: p ? `${p.firstName} ${p.lastName}` : "Patient", status: r?.status ?? "not_offered", linkSentAt: r?.linkSentAt };
  });
}
export function tpsCounts(): { eligible: number | null; offered: number | null; completed: number | null; declined: number | null } {
  const ids = tpsEligibleIds();
  const c = (s: TpsStatus) => ids.filter((id) => tpsStatusOf(id) === s).length;
  return { eligible: suppressCell(ids.length), offered: suppressCell(c("offered")), completed: suppressCell(c("completed")), declined: suppressCell(c("declined")) };
}
export function markTps(actor: CountyActor, patientId: string, status: Exclude<TpsStatus, "not_offered">): void {
  assertClientLevel(actor);
  if (!tpsEligibleIds().includes(patientId)) throw new Error("This person isn't in treatment during the survey window.");
  const cur = tps.get(patientId) ?? { status: "not_offered" };
  tps.set(patientId, { ...cur, status, by: actor.name ?? actor.staffId, at: new Date().toISOString() });
  AdelanteEHR._recordAudit({ category: "clinical", action: "tps_status_marked", patientId, actorId: actor.staffId ?? actor.name, actorRole: actor.role, detail: { status, protected: true } });
}
export const TPS_LINK_COPY = {
  en: { subject: "A short survey about your care", body: "Please tell us how your care is going. (Simulated link — no survey is sent.)" },
  es: { subject: "Una encuesta breve sobre su atención", body: "Díganos cómo va su atención. (Enlace simulado — no se envía ninguna encuesta.) [Borrador — pendiente de revisión bilingüe]" },
};
export function sendTpsLink(actor: CountyActor, patientId: string): void {
  assertClientLevel(actor);
  if (!tpsEligibleIds().includes(patientId)) throw new Error("This person isn't in treatment during the survey window.");
  const p = AdelanteEHR.getPatient(patientId);
  const lang = p?.preferredLanguage === "es" ? "es" : "en";
  AdelanteEHR.notifyMember({ audience: "patient", recipientId: patientId, patientId, subject: TPS_LINK_COPY[lang].subject, body: TPS_LINK_COPY[lang].body, linkRoute: "/home", dedupeKey: `tps:${patientId}:${_tpsWindow?.start ?? ""}` });
  const cur = tps.get(patientId) ?? { status: "not_offered" as TpsStatus };
  tps.set(patientId, { ...cur, status: cur.status === "not_offered" ? "offered" : cur.status, linkSentAt: new Date().toISOString() });
  AdelanteEHR._recordAudit({ category: "clinical", action: "tps_link_sent", patientId, actorId: actor.staffId ?? actor.name, actorRole: actor.role, detail: { language: lang, simulated: true, protected: true } });
}

// ------------------------------------------------------------------ D6 submissions + errors
export type SubmissionStatus = "draft" | "ready" | "submitted";
export interface Submission {
  id: string;
  report: CountyReportId;
  periodKey: string;
  periodLabel: string;
  generatedBy: string;
  generatedRole: StaffRole;
  generatedAt: string;
  rowCount: number;
  withheld: number;
  blockers: number;
  disclosureChecks: number;
  status: SubmissionStatus;
  submittedAt?: string;
  simulated: true;
  resendOf?: string;
  file: string;
}
export interface CountyError {
  id: string;
  submissionId: string;
  report: CountyReportId;
  patientId?: string;
  recordRef: string;
  /** Full text — SUD-authorised roles only. */
  detail: string;
  ownerRole: StaffRole;
  status: "open" | "fixed" | "resent";
  simulated: true;
}
const submissions: Submission[] = [];
const errors: CountyError[] = [];
let seq = 0;
export const NEUTRAL_ERROR_TEXT = "Record needs a correction before it can be resent.";

function audit(actor: CountyActor, action: string, detail: Record<string, unknown>) {
  AdelanteEHR._recordAudit({ category: "admin", action, actorId: actor.staffId ?? actor.name, actorRole: actor.role, detail: { ...detail, simulated: true, prototype: true } });
}

/** Generate a report run (creates a submission record). Client-level files need SUD access. */
export function generateReport(actor: CountyActor, report: CountyReportId, periodKey: ReportingPeriodKey, now = new Date()): Submission {
  assertHub(actor);
  let rowCount = 0;
  let withheld = 0;
  let checks = 0;
  let blockers = 0;
  let file = "";
  let pKey: string = periodKey;
  let pLabel = `Last ${periodDays(periodKey)} days`;
  const due = nextDueDate(report, now);
  if (report === "caloms") {
    assertClientLevel(actor);
    const m = reportingMonthFor(due ?? now);
    pKey = m.key;
    pLabel = `Month ${m.key}`;
    const recs = calomsRecordsFor(m.range);
    blockers = recs.filter((r) => r.missing.length).length + (calomsWorklist(actor.role)?.length ?? 0);
    const ok = new Set<string>();
    for (const pid of new Set(recs.map((r) => r.patientId))) {
      checks++;
      if (fileDisclose(actor, pid, ["SUD episode / CalOMS data"], "CalOMS monthly reporting (prototype)").ok) ok.add(pid);
    }
    const site = (listPrograms()[0] && AdelanteEHR) ? (listPrograms()[0]?.siteId ?? "") : "";
    const kept = recs.filter((r) => ok.has(r.patientId));
    withheld = recs.length - kept.length;
    rowCount = kept.length;
    file = [`# ${COUNTY_PROTOTYPE_LABEL}. Layout: ${COUNTY_DRAFT_LABEL}.`, `# ${PART2_NOTICE_BLOCK.replace(/\n/g, " ")}`, CALOMS_LAYOUT_DRAFT.join(","), ...kept.map((r) => [r.type, r.patientId, r.episodeId, r.date, site, ...Array(7).fill(r.missing.length ? "MISSING" : "on file")].map(csvCell).join(","))].join("\n");
  } else if (report === "isl") {
    const m = reportingMonthFor(due ?? now);
    pKey = m.key;
    pLabel = `Month ${m.key}`;
    const f = buildIslFile(actor, m.range);
    rowCount = f.rowCount;
    withheld = f.withheld;
    checks = f.disclosureChecks;
    file = f.file;
  } else if (report === "datar") {
    const m = reportingMonthFor(due ?? now);
    pKey = m.key;
    pLabel = `Month ${m.key}`;
    const rows = datarCounts(m.range);
    rowCount = rows.length;
    file = [`# ${COUNTY_PROTOTYPE_LABEL}. Aggregate only. Layout: ${COUNTY_DRAFT_LABEL}.`, "program,capacity,waitlist,admissions", ...rows.map((r) => [r.program, r.capacity, r.waitlist ?? `<${MIN_COHORT_SIZE}`, r.admissions ?? `<${MIN_COHORT_SIZE}`].map(csvCell).join(","))].join("\n");
  } else if (report === "bhoatr") {
    const r = bhoatrRollup(rangeForPeriod(periodKey, now));
    rowCount = r.services.length;
    file = [`# ${COUNTY_PROTOTYPE_LABEL}. Aggregate only. ${BHOATR_DOLLARS_NOTE}.`, "funding,program,care_continuum,units,minutes", ...r.services.map((s) => [s.funding, s.program, s.continuum, s.units ?? `<${MIN_COHORT_SIZE}`, s.minutes ?? `<${MIN_COHORT_SIZE}`].map(csvCell).join(","))].join("\n");
  } else {
    const c = tpsCounts();
    rowCount = 4;
    file = [`# ${COUNTY_PROTOTYPE_LABEL}. Aggregate only.`, "eligible,offered,completed,declined", [c.eligible, c.offered, c.completed, c.declined].map((v) => v ?? `<${MIN_COHORT_SIZE}`).join(",")].join("\n");
  }
  const sub: Submission = {
    id: `csub-${++seq}`,
    report,
    periodKey: pKey,
    periodLabel: pLabel,
    generatedBy: actor.name ?? actor.staffId ?? actor.role,
    generatedRole: actor.role,
    generatedAt: now.toISOString(),
    rowCount,
    withheld,
    blockers,
    disclosureChecks: checks,
    status: blockers ? "draft" : "ready",
    simulated: true,
    file,
  };
  submissions.unshift(sub);
  audit(actor, "county_report_generated", { submissionId: sub.id, report, period: pKey, rowCount, withheld, disclosureChecks: checks });
  AdelanteEHR._emit?.();
  return sub;
}
export function submitReport(actor: CountyActor, submissionId: string, now = new Date()): Submission {
  assertHub(actor);
  const s = submissions.find((x) => x.id === submissionId);
  if (!s) throw new Error("That report run no longer exists.");
  if (s.status === "submitted") throw new Error("Already submitted (Simulated).");
  if (s.status !== "ready") throw new Error("Fix the blockers first — the file isn't ready.");
  if ((s.report === "caloms") && !seesClientLevel(actor.role)) throw new Error("Client-level county files need SUD reporting access (substance-use reporting).");
  s.status = "submitted";
  s.submittedAt = now.toISOString();
  audit(actor, "county_report_submitted", { submissionId: s.id, report: s.report, period: s.periodKey, rowCount: s.rowCount });
  AdelanteEHR._emit?.();
  return s;
}
/** Demo control: the county "returns" errors on up to two records (Simulated). */
export function simulateCountyResponse(actor: CountyActor, submissionId: string): CountyError[] {
  assertHub(actor);
  const s = submissions.find((x) => x.id === submissionId);
  if (!s || s.status !== "submitted") throw new Error("Submit the report (Simulated) first.");
  const made: CountyError[] = [];
  const refs = s.file.split("\n").filter((l) => !l.startsWith("#")).slice(1, 3);
  const list = refs.length ? refs : ["summary"];
  for (const line of list) {
    const cells = line.split(",");
    const pid = s.report === "caloms" ? cells[1] : s.report === "isl" ? cells[2] : undefined;
    const e: CountyError = {
      id: `cerr-${++seq}`,
      submissionId: s.id,
      report: s.report,
      patientId: pid && AdelanteEHR.getPatient(pid) ? pid : undefined,
      recordRef: s.report === "caloms" ? `${cells[0]} ${cells[2]}` : s.report === "isl" ? cells[0] ?? "row" : cells[0] ?? "summary",
      detail: s.report === "caloms" ? "Primary substance / route not accepted (Simulated county edit check)." : s.report === "isl" ? "Service date outside contract period (Simulated county edit check)." : "Count does not match prior month (Simulated county edit check).",
      ownerRole: s.report === "caloms" ? COUNTY_PREPARER_ROLE : REMINDER_OWNER_ROLE,
      status: "open",
      simulated: true,
    };
    errors.unshift(e);
    made.push(e);
  }
  audit(actor, "county_response_simulated", { submissionId: s.id, errors: made.length });
  AdelanteEHR._emit?.();
  return made;
}
export function fixCountyError(actor: CountyActor, errorId: string): CountyError {
  assertHub(actor);
  const e = errors.find((x) => x.id === errorId);
  if (!e) throw new Error("That error no longer exists.");
  if (e.patientId && e.report === "caloms" && !seesClientLevel(actor.role)) throw new Error("This correction needs SUD reporting access (substance-use reporting).");
  e.status = "fixed";
  audit(actor, "county_error_fixed", { errorId: e.id, submissionId: e.submissionId });
  AdelanteEHR._emit?.();
  return e;
}
/** Resend: new run for the same report; all fixed errors of the original become "resent". */
export function resendReport(actor: CountyActor, submissionId: string, now = new Date()): Submission {
  assertHub(actor);
  const s = submissions.find((x) => x.id === submissionId);
  if (!s) throw new Error("That report run no longer exists.");
  const open = errors.filter((e) => e.submissionId === s.id && e.status === "open");
  if (open.length) throw new Error(`Fix ${open.length} returned error${open.length === 1 ? "" : "s"} first.`);
  const next: Submission = { ...s, id: `csub-${++seq}`, generatedBy: actor.name ?? actor.staffId ?? actor.role, generatedRole: actor.role, generatedAt: now.toISOString(), status: "submitted", submittedAt: now.toISOString(), resendOf: s.id };
  submissions.unshift(next);
  for (const e of errors) if (e.submissionId === s.id && e.status === "fixed") e.status = "resent";
  audit(actor, "county_report_resent", { submissionId: next.id, resendOf: s.id, report: s.report });
  AdelanteEHR._emit?.();
  return next;
}
export function listSubmissions(report?: CountyReportId): Submission[] {
  return submissions.filter((s) => !report || s.report === report);
}
/** Error queue, Part 2-neutral text + no client link for non-SUD roles. */
export function listCountyErrors(role: StaffRole): (Omit<CountyError, "detail" | "patientId"> & { text: string; patientId?: string })[] {
  const full = seesClientLevel(role);
  return errors.map(({ detail, patientId, ...e }) => ({ ...e, text: full ? detail : NEUTRAL_ERROR_TEXT, ...(full && patientId ? { patientId } : {}), recordRef: full ? e.recordRef : `Row in ${REPORT_LABEL[e.report]}` }));
}

// ------------------------------------------------------------------ summary cards + reminders
export type CardStatus = "not_started" | "draft_ready" | "blockers" | "submitted" | "errors_returned";
export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  not_started: "Not started",
  draft_ready: "Draft ready",
  blockers: "Blockers",
  submitted: "Submitted (Simulated)",
  errors_returned: "Errors returned",
};
export interface ReportCard {
  report: CountyReportId;
  label: string;
  due: string | null;
  status: CardStatus;
  blockers: number;
  nextAction: string;
  latest?: Submission;
}
export function reportCards(role: StaffRole, now = new Date()): ReportCard[] {
  return (Object.keys(REPORT_LABEL) as CountyReportId[]).map((report) => {
    const due = nextDueDate(report, now);
    const latest = submissions.find((s) => s.report === report);
    const open = latest ? errors.filter((e) => e.report === report && e.status === "open").length : 0;
    let blockers = latest?.blockers ?? 0;
    if (report === "caloms" && !latest) blockers = seesClientLevel(role) ? (calomsWorklist(role)?.length ?? 0) : 0;
    const status: CardStatus = open ? "errors_returned" : latest?.status === "submitted" ? "submitted" : latest ? (latest.status === "draft" ? "blockers" : "draft_ready") : report === "caloms" && blockers ? "blockers" : "not_started";
    const clientOnly = report === "caloms";
    const nextAction =
      status === "errors_returned" ? "Fix returned errors, then resend"
        : status === "submitted" ? "Wait for county response (Simulated)"
          : status === "draft_ready" ? "Submit (Simulated)"
            : status === "blockers" ? (seesClientLevel(role) ? "Fix blocker records in the chart" : "Ask the billing coordinator (SUD reporting access) to fix blockers")
              : clientOnly && !seesClientLevel(role) ? "The billing coordinator (SUD reporting access) generates this file"
                : report === "tps" && !tpsWindow() ? "Set the survey window (admin)"
                  : "Generate the draft";
    return { report, label: REPORT_LABEL[report], due: due ? due.toISOString().slice(0, 10) : null, status, blockers, nextAction, latest };
  });
}
export interface CountyReminder {
  id: string;
  report: CountyReportId;
  due: string;
  daysLeft: number;
  kind: "5_day" | "1_day";
  label: string;
}
/** Needs my action: 5 days and 1 day before each due date, for the owning role (Draft: billing coordinator). */
export function countyReminders(role: StaffRole, now = new Date()): CountyReminder[] {
  if (role !== REMINDER_OWNER_ROLE) return [];
  const out: CountyReminder[] = [];
  for (const report of ["caloms", "datar", "isl", "tps"] as CountyReportId[]) {
    const due = nextDueDate(report, now);
    if (!due) continue;
    const d = daysUntil(due, now);
    if (d < 0 || d > 5) continue;
    const latest = submissions.find((s) => s.report === report);
    if (latest?.status === "submitted" && latest.generatedAt.slice(0, 7) === now.toISOString().slice(0, 7)) continue;
    const kind = d <= 1 ? "1_day" : "5_day";
    out.push({ id: `rem-${report}-${due.toISOString().slice(0, 10)}-${kind}`, report, due: due.toISOString().slice(0, 10), daysLeft: d, kind, label: `${REPORT_LABEL[report]} due ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}` });
  }
  return out;
}

/** Client-level CalOMS blocker worklist for the hub (SUD-authorised only). */
export function calomsBlockerRows(role: StaffRole) {
  if (!seesClientLevel(role)) return null;
  return calomsWorklist(role);
}

export function _resetCountyReporting(): void {
  submissions.length = 0;
  errors.length = 0;
  tps.clear();
  _tpsWindow = null;
}

// Draft default survey window: the third week of October this year.
(() => {
  const y = new Date().getFullYear();
  _tpsWindow = { start: `${y}-10-19`, end: `${y}-10-23` };
})();

export { roleSeesAfbiDetail };
