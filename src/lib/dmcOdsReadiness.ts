// §Phase 10d-3 — DMC-ODS operational readiness (PROTOTYPE).
//
// Three things, all reading existing store data:
//   1. Medical necessity gate (draft rule) on the existing claim path — a
//      DMC-ODS treatment claim can't move to Ready ("generated") without a
//      final (signed, and co-signed where required) ASAM in the window and a
//      linked SUD diagnosis. H0001 is exempt; non-DMC-ODS claims untouched.
//      Billing roles only ever see a generic message — never ASAM or SUD detail.
//   2. CalOMS completeness checks (draft required-field lists).
//   3. An export-ready per-episode view (CSV), never submitted anywhere.
//
// Part 2: every patient-level read goes through `roleSeesAsam` (the existing
// `canAccess(role, "screeners_sud", patient)` check). No role is widened.
import { disclose, PART2_NOTICE_BLOCK } from "./part2Disclosure";
import { AdelanteEHR, type Patient } from "./ehr";
import type { AsamAssessment } from "./asam";
import { dmcOdsLevelLabel } from "./asam";
import { roleSeesAsam } from "./asamReporting";
import { hasSudReportingAccess } from "./sudReportingAccess";
import type { StaffRole } from "./roles";
import {
  DISCHARGE_REASON_LABEL,
  DISCHARGE_STATUS_LABEL,
  FREQUENCY_LABEL,
  PRIOR_EPISODE_LABEL,
  ROUTE_LABEL,
  SUBSTANCE_LABEL,
} from "./caloms";

export const DMC_ODS_DRAFT_NOTE = "Draft — pending clinical sign-off";
export const DMC_ODS_PROTOTYPE_BANNER = "Prototype — not submitted anywhere.";

/** DRAFT gate settings — pending clinical sign-off. */
export const MEDICAL_NECESSITY_GATE_DRAFT = {
  /** Assessment codes exempt from the gate (the assessment itself). */
  exemptCodes: ["H0001"],
  /** A final ASAM counts if finalised up to this many days BEFORE the service… */
  windowDaysBefore: 365,
  /** …or up to this many days AFTER it (assessment may follow early visits). */
  windowDaysAfter: 30,
  /** SUD diagnosis: ICD-10 F10–F19, excluding F17 (nicotine). */
  sudDiagnosisRule: "ICD-10 F10–F19 except F17",
} as const;

export const GATE_GENERIC_MESSAGE = "Blocked: clinical documentation incomplete";

export type GateReason = "no_asam" | "cosign_pending" | "outside_window" | "no_sud_dx";
export const GATE_REASON_TEXT: Record<GateReason, string> = {
  no_asam: "No signed ASAM assessment on file for this episode.",
  cosign_pending: "ASAM is awaiting LPHA co-signature.",
  outside_window: "No signed ASAM within the draft window for this service date.",
  no_sud_dx: "The signed ASAM has no linked SUD diagnosis (F10–F19).",
};

export function isSudDiagnosis(code: string): boolean {
  return /^F1[0-9]/i.test(code) && !/^F17/i.test(code);
}

type GateClaim = {
  patientId: string;
  encounterId: string;
  program?: string;
  serviceCode?: string;
  serviceDate?: string;
};

export function gateApplies(c: GateClaim): boolean {
  return (
    c.program === "dmc_ods" &&
    !c.encounterId.startsWith("asam:") &&
    !(MEDICAL_NECESSITY_GATE_DRAFT.exemptCodes as readonly string[]).includes(c.serviceCode ?? "")
  );
}

const finalDate = (a: AsamAssessment) =>
  a.status === "signed" ? (a.cosignedAt ?? a.signedAt)?.slice(0, 10) : undefined;

const dayDiff = (a: string, b: string) => Math.round((+new Date(a) - +new Date(b)) / 86400000);

export type GateResult = { applies: false } | { applies: true; ok: true; asamId: string } | { applies: true; ok: false; reason: GateReason };

export function medicalNecessityGate(c: GateClaim): GateResult {
  if (!gateApplies(c)) return { applies: false };
  const p = AdelanteEHR.getPatient(c.patientId);
  const list = p?.asamAssessments ?? [];
  const svc = (c.serviceDate ?? new Date().toISOString()).slice(0, 10);
  const signed = list.filter((a) => finalDate(a));
  const inWindow = signed.filter((a) => {
    const d = dayDiff(finalDate(a)!, svc);
    return d <= MEDICAL_NECESSITY_GATE_DRAFT.windowDaysAfter && -d <= MEDICAL_NECESSITY_GATE_DRAFT.windowDaysBefore;
  });
  if (inWindow.length === 0) {
    if (list.some((a) => a.status === "cosign_pending")) return { applies: true, ok: false, reason: "cosign_pending" };
    return { applies: true, ok: false, reason: signed.length ? "outside_window" : "no_asam" };
  }
  const withDx = inWindow.find((a) => a.diagnosisCodes.some(isSudDiagnosis));
  if (!withDx) return { applies: true, ok: false, reason: "no_sud_dx" };
  return { applies: true, ok: true, asamId: withDx.id };
}

/**
 * What THIS role may be told about a blocked claim. Clinical roles passing the
 * Part 2 check get the specific reason; everyone else (billing, billing
 * coordinator…) gets the generic line only. `null` = not blocked.
 */
export function gateMessageFor(role: StaffRole, c: GateClaim): string | null {
  const g = medicalNecessityGate(c);
  if (!g.applies || g.ok) return null;
  const p = AdelanteEHR.getPatient(c.patientId);
  if (p && roleSeesAsam(role, p)) return `${GATE_REASON_TEXT[g.reason]} (Medical necessity rule: ${DMC_ODS_DRAFT_NOTE}.)`;
  return GATE_GENERIC_MESSAGE;
}

// ---------------------------------------------------------------------------
// CalOMS completeness (DRAFT required-field lists)
// ---------------------------------------------------------------------------

export const CALOMS_ADMISSION_REQUIRED_DRAFT = [
  "Primary substance",
  "Route",
  "Frequency (past 30 days)",
  "Age at first use",
  "Prior treatment episodes",
] as const;
export const CALOMS_DISCHARGE_REQUIRED_DRAFT = [
  "Discharge status",
  "Discharge reason",
  "Discharge date",
  "Other reason text (when reason is Other)",
] as const;

export interface CalomsCompleteness {
  inScope: boolean;
  admissionMissing: string[];
  /** null = no discharge recorded. */
  dischargeMissing: string[] | null;
}

function hasSudEpisode(p: Patient) {
  return (p.episodes ?? []).some((e) => e.type === "sud_dmc_ods");
}

export function calomsCompletenessFor(p: Patient): CalomsCompleteness {
  const prof = p.calomsProfile;
  const inScope = hasSudEpisode(p) || Boolean(prof?.substanceUse) || Boolean(prof?.discharges?.length);
  const primary = prof?.substanceUse?.entries.find((e) => e.rank === "primary");
  const admissionMissing: string[] = [];
  if (inScope) {
    if (!primary?.substance) admissionMissing.push("Primary substance");
    if (!primary?.route) admissionMissing.push("Route");
    if (!primary?.frequency) admissionMissing.push("Frequency (past 30 days)");
    if (primary?.ageAtFirstUse === undefined) admissionMissing.push("Age at first use");
    if (!prof?.priorTreatment?.priorEpisodes) admissionMissing.push("Prior treatment episodes");
  }
  const d = prof?.discharges?.[0];
  let dischargeMissing: string[] | null = null;
  if (d) {
    dischargeMissing = [];
    if (!d.status) dischargeMissing.push("Discharge status");
    if (!d.reason) dischargeMissing.push("Discharge reason");
    if (!d.dischargedOn) dischargeMissing.push("Discharge date");
    if (d.reason === "other" && !d.otherReason?.trim()) dischargeMissing.push("Other reason text");
  }
  return { inScope, admissionMissing, dischargeMissing };
}

export interface CalomsWorklistRow {
  patientId: string;
  patientName: string;
  admissionMissing: string[];
  dischargeMissing: string[];
}

/** Incomplete CalOMS records the role may see. `null` = hidden for this role. */
export function calomsWorklist(role: StaffRole): CalomsWorklistRow[] | null {
  if (!roleSeesAsam(role) && !hasSudReportingAccess(role)) return null;
  const rows: CalomsWorklistRow[] = [];
  for (const p of AdelanteEHR.listPatients()) {
    if (!roleSeesAsam(role, p) && !hasSudReportingAccess(role)) continue;
    const c = calomsCompletenessFor(p);
    if (!c.inScope) continue;
    const dm = c.dischargeMissing ?? [];
    if (c.admissionMissing.length === 0 && dm.length === 0) continue;
    rows.push({ patientId: p.id, patientName: `${p.firstName} ${p.lastName}`.trim(), admissionMissing: c.admissionMissing, dischargeMissing: dm });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Export-ready view (PROTOTYPE — never submitted)
// ---------------------------------------------------------------------------

export const EXPORT_COLUMNS = [
  "Episode ID",
  "Client record ID",
  "Episode opened",
  "Episode closed",
  "Level of care (clinician-selected)",
  "ASAM version",
  "ASAM final signature date",
  "LPHA co-signed",
  "SUD diagnosis codes",
  "Medical necessity (draft rule)",
  "Primary substance",
  "Route",
  "Frequency (past 30 days)",
  "Age at first use",
  "Prior treatment episodes",
  "Discharge date",
  "Discharge status",
  "Discharge reason",
  "CalOMS admission complete",
  "CalOMS discharge complete",
] as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];
export type ExportRow = Partial<Record<ExportColumn, string>> & { "Episode ID": string; "Client record ID": string };

/** ASAM clinical columns withheld from reporting-only holders (SUD reporting access without roleSeesAsam). */
export const ASAM_CLINICAL_COLUMNS: readonly ExportColumn[] = ["ASAM version", "ASAM final signature date", "LPHA co-signed", "Medical necessity (draft rule)"];
export const REPORTING_ONLY_LAYOUT_LABEL = "Draft — Christi to confirm required fields";

/** True when the role reaches the export only through SUD reporting access. */
export function isReportingOnly(role: StaffRole): boolean {
  return !roleSeesAsam(role) && hasSudReportingAccess(role);
}

/** Columns this role's export carries: the county-file subset for reporting-only holders. */
export function exportColumnsFor(role: StaffRole): readonly ExportColumn[] {
  return isReportingOnly(role) ? EXPORT_COLUMNS.filter((c) => !ASAM_CLINICAL_COLUMNS.includes(c)) : EXPORT_COLUMNS;
}

/** Per-episode rows. `null` = hidden for this role (no data at all). */
export function dmcOdsExportRows(role: StaffRole): ExportRow[] | null {
  if (!roleSeesAsam(role) && !hasSudReportingAccess(role)) return null;
  const rows: ExportRow[] = [];
  const narrow = isReportingOnly(role);
  for (const p of AdelanteEHR.listPatients()) {
    if (!roleSeesAsam(role, p) && !hasSudReportingAccess(role)) continue;
    const eps = (p.episodes ?? []).filter((e) => e.type === "sud_dmc_ods");
    if (!eps.length) continue;
    const signed = (p.asamAssessments ?? []).filter((a) => a.status === "signed").sort((a, b) => b.version - a.version);
    const latest = signed[0];
    const prof = p.calomsProfile;
    const primary = prof?.substanceUse?.entries.find((e) => e.rank === "primary");
    const d = prof?.discharges?.[0];
    const comp = calomsCompletenessFor(p);
    for (const ep of eps) {
      const level = (ep as { dmcOdsLevel?: string }).dmcOdsLevel ?? latest?.actualLevel;
      const row: ExportRow = {
        "Episode ID": ep.id,
        "Client record ID": p.id,
        "Episode opened": ep.openedAt.slice(0, 10),
        "Episode closed": ep.closedAt?.slice(0, 10) ?? "",
        "Level of care (clinician-selected)": level ? dmcOdsLevelLabel(level) : "",
        "ASAM version": latest ? String(latest.version) : "",
        "ASAM final signature date": latest ? (finalDate(latest) ?? "") : "",
        "LPHA co-signed": latest ? (latest.cosignedAt ? "Yes" : "Not required") : "",
        "SUD diagnosis codes": latest ? latest.diagnosisCodes.filter(isSudDiagnosis).join(" ") : "",
        "Medical necessity (draft rule)": latest && latest.diagnosisCodes.some(isSudDiagnosis) ? "Met" : "Not met",
        "Primary substance": primary ? SUBSTANCE_LABEL[primary.substance] : "",
        Route: primary?.route ? ROUTE_LABEL[primary.route] : "",
        "Frequency (past 30 days)": primary?.frequency ? FREQUENCY_LABEL[primary.frequency] : "",
        "Age at first use": primary?.ageAtFirstUse !== undefined ? String(primary.ageAtFirstUse) : "",
        "Prior treatment episodes": prof?.priorTreatment ? PRIOR_EPISODE_LABEL[prof.priorTreatment.priorEpisodes] : "",
        "Discharge date": d?.dischargedOn ?? "",
        "Discharge status": d?.status ? DISCHARGE_STATUS_LABEL[d.status] : "",
        "Discharge reason": d?.reason ? (d.reason === "other" ? d.otherReason || "Other (text missing)" : DISCHARGE_REASON_LABEL[d.reason]) : "",
        "CalOMS admission complete": comp.admissionMissing.length === 0 ? "Yes" : "No",
        "CalOMS discharge complete": comp.dischargeMissing === null ? "No discharge" : comp.dischargeMissing.length === 0 ? "Yes" : "No",
      };
      if (narrow) for (const c of ASAM_CLINICAL_COLUMNS) delete row[c];
      rows.push(row);
    }
  }
  return rows;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function exportRowsToCsv(rows: ExportRow[], columns: readonly ExportColumn[] = EXPORT_COLUMNS): string {
  const lines = [columns.join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c] ?? "")).join(","))];
  return lines.join("\n");
}

/**
 * Build the CSV AND audit the export (who, when, row count — never values).
 * Returns null for a role that fails the Part 2 check; nothing is audited
 * because nothing left.
 */
export function exportDmcOdsCsv(actor: { staffId: string; role: StaffRole; name?: string }): {
  csv: string;
  rowCount: number;
  /** Downloadable file: Part 2 notice header lines + the CSV. */
  file: string;
  notice: string;
  withheld: number;
} | null {
  const all = dmcOdsExportRows(actor.role);
  if (!all) return null;
  // §Batch C1 — every client in the file is a Part 2 disclosure to the county.
  const ok = new Set<string>();
  let withheld = 0;
  for (const pid of new Set(all.map((r) => r["Client record ID"]))) {
    const res = disclose({
      patientId: pid,
      actor: { name: actor.name ?? actor.staffId, role: actor.role, staffId: actor.staffId },
      recipient: { name: "County DMC-ODS / DHCS CalOMS reporting", organization: "Tulare County (prototype)", type: "county" },
      purpose: "DMC-ODS / CalOMS reporting (prototype)",
      channel: "dmc_ods_csv",
      recordClasses: ["SUD episode / CalOMS data", "SUD diagnoses"],
    });
    if (res.ok) ok.add(pid);
    else withheld += all.filter((r) => r["Client record ID"] === pid).length;
  }
  const rows = all.filter((r) => ok.has(r["Client record ID"]));
  AdelanteEHR.recordDmcOdsExport({ actorId: actor.staffId, actorRole: actor.role, rowCount: rows.length });
  const csv = exportRowsToCsv(rows, exportColumnsFor(actor.role));
  const header = [`# ${PART2_NOTICE_BLOCK.replace(/\n/g, " ")}`];
  if (isReportingOnly(actor.role)) header.push(`# Layout: ${REPORTING_ONLY_LAYOUT_LABEL}`);
  if (withheld) header.push(`# ${withheld} row(s) withheld — no Part 2 consent on file.`);
  return { csv, rowCount: rows.length, file: `${header.join("\n")}\n${csv}`, notice: PART2_NOTICE_BLOCK, withheld };
}
