// R53 part 2 — clinician "Re-screens due" rows (Mitch, 31 Oct 16:36 CT).
// Draft — pending clinical sign-off. Presentation projection only: rows come
// from `screenerDueRows`, which already applies the viewer's existing
// `screeners_sud` gate per patient. Scores are read only for instruments that
// survived that gate, so a locked SUD instrument leaves no chip, score or stub.
// Every send runs the existing `rescreen_send` registry action.
import type { Patient, ScreenerResult } from "@/lib/ehr";
import { screenerDueRows, type ScreenerDueRow, type ScreenerViewer } from "@/lib/myWork";
import { answeredLabel, estimateLabel } from "@/lib/screenerCompleteness";
import { instrumentLabel } from "@/lib/trackingTimeline";

const DAY = 86400000;
export const RESCREEN_DASHBOARD_DRAFT = "Draft — pending clinical sign-off";
/** Draft — pending clinical sign-off: a sent request can be re-sent after 7 days. */
export const RESCREEN_RESEND_DAYS = 7;
export const RESCREEN_EMPTY_TEXT = "No re-screens due on your caseload.";

export type RescreenChipState = "due" | "overdue" | "requested";
export interface RescreenInstrumentView {
  key: string;
  label: string;
  chipState: RescreenChipState;
  chipText: string;
  /** "14 · Estimated (1 item missing)", or the newer incomplete text. */
  lastText?: string;
  trend?: "up" | "down" | "same";
  previousScore?: number;
  incomplete: boolean;
  cadenceNote: string;
  sendLabel: "Send" | "Send again" | "Sent";
  sendEnabled: boolean;
}
export interface RescreenPatientRow {
  patientId: string;
  patientName: string;
  instruments: RescreenInstrumentView[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function scoredResults(p: Pick<Patient, "screenerHistory" | "screeners">, key: string): ScreenerResult[] {
  const seen = new Set<string>();
  return [...(p.screenerHistory ?? []), ...Object.values(p.screeners ?? {})]
    .filter((r): r is ScreenerResult => !!r && r.key === key && typeof r.score === "number" && (r as { completeness?: string }).completeness !== "incomplete")
    .filter((r) => { const id = `${r.completedAt}|${r.score}`; if (seen.has(id)) return false; seen.add(id); return true; })
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

/** Pure: one instrument's chip, last score, trend and send state. */
export function rescreenInstrumentView(p: Pick<Patient, "screenerHistory" | "screeners" | "incompleteScreeners" | "tasks">, due: Pick<ScreenerDueRow, "screenerKey" | "daysSinceLast" | "cadenceStep">, now: number): RescreenInstrumentView {
  const key = due.screenerKey;
  const [last, previous] = scoredResults(p, key);
  const incomplete = [...(p.incompleteScreeners ?? [])].filter((r) => r.key === key).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  const newerIncomplete = !!incomplete && (!last || incomplete.completedAt > last.completedAt);
  const request = (p.tasks ?? []).filter((t) => t.kind === "rescreen" && !t.completedAt && t.screenerKey === key && !!t.createdAt).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  const requestedDays = request?.createdAt ? Math.max(0, Math.floor((now - Date.parse(request.createdAt)) / DAY)) : undefined;
  const overdueDays = Math.max(0, due.daysSinceLast - due.cadenceStep);
  const chipState: RescreenChipState = requestedDays !== undefined ? "requested" : overdueDays > 0 ? "overdue" : "due";
  const chipText = chipState === "requested" ? (requestedDays === 0 ? "Requested today" : `Requested ${plural(requestedDays!, "day")} ago`) : chipState === "overdue" ? `Overdue ${plural(overdueDays, "day")}` : "Due";
  const est = last ? estimateLabel(last) : "";
  const lastText = newerIncomplete ? `Incomplete · ${answeredLabel(incomplete!)}` : last ? `${last.score}${est ? ` · ${est}` : ""}` : undefined;
  const trend = !newerIncomplete && last && previous ? (last.score > previous.score ? "up" : last.score < previous.score ? "down" : "same") : undefined;
  const sendEnabled = requestedDays === undefined || requestedDays >= RESCREEN_RESEND_DAYS;
  return {
    key,
    label: instrumentLabel(key),
    chipState,
    chipText,
    lastText,
    trend,
    previousScore: trend ? previous!.score : undefined,
    incomplete: newerIncomplete,
    cadenceNote: `${due.cadenceStep}-day step`,
    sendLabel: requestedDays === undefined ? "Send" : sendEnabled ? "Send again" : "Sent",
    sendEnabled,
  };
}

/** Pure: groups due rows into one row per patient, most overdue first. */
export function groupRescreenRows(due: ScreenerDueRow[], patients: Patient[], now: number): RescreenPatientRow[] {
  const byId = new Map(patients.map((p) => [p.id, p]));
  const out = new Map<string, RescreenPatientRow>();
  for (const d of due) {
    const p = byId.get(d.patientId);
    if (!p) continue;
    const row = out.get(d.patientId) ?? { patientId: d.patientId, patientName: d.patientName, instruments: [] };
    if (!row.instruments.some((i) => i.key === d.screenerKey)) row.instruments.push(rescreenInstrumentView(p, d, now));
    out.set(d.patientId, row);
  }
  const worst = (r: RescreenPatientRow) => Math.max(...r.instruments.map((i) => (i.chipState === "overdue" ? Number(/\d+/.exec(i.chipText)?.[0] ?? 0) : 0)));
  return [...out.values()].sort((a, b) => worst(b) - worst(a) || a.patientName.localeCompare(b.patientName));
}

/** Caseload rows for the viewer; SUD instruments only where `screeners_sud` resolves. */
export function rescreenDashboardRows(caseload: Patient[], viewer: ScreenerViewer, now = Date.now()): RescreenPatientRow[] {
  return groupRescreenRows(screenerDueRows(caseload, viewer), caseload, now);
}

/** Instruments "Send all due" may send: visible rows whose send is enabled. */
export const sendableKeys = (row: RescreenPatientRow): string[] => row.instruments.filter((i) => i.sendEnabled).map((i) => i.key);

export type RescreenSendRunner = (actionId: "rescreen_send", via: "sendRescreenTask", patientId: string, key: string) => unknown;
/** One existing `rescreen_send` registry run per instrument; no batch action. */
export function sendRescreens(patientId: string, keys: string[], run: RescreenSendRunner): number {
  for (const key of keys) run("rescreen_send", "sendRescreenTask", patientId, key);
  return keys.length;
}
