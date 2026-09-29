// Chart Tracking — every screener and assessment, taken or missed, from ONE
// source: patient.screenerHistory (+ missedScreeners, + ASAM level). The care
// plan reads the latest result from the same screenerHistory.
//
// Part 2: AUDIT, DAST-10 and ASAM are SUD instruments. Roles failing the
// check get them removed entirely (not stubbed) — no name, no count.
import type { Patient } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import { canAccess } from "@/lib/roles";
import { screenerByKey, isPart2Screener, rescreenRule } from "@/lib/screeners";
import { CSSRS_KEY } from "@/lib/cssrs";
import { isHeldAfterMerge } from "@/lib/mergePart2";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { listScreenerRequests, screenerRequestStatus } from "@/lib/chartOrders";

export type TrackingStatus = "completed" | "missed" | "overdue";

export interface TrackingRow {
  key: string;
  label: string;
  date: string;
  status: TrackingStatus;
  score?: number;
  severity?: string;
  /** ASAM rows carry a level instead of a score. */
  level?: string;
  sud: boolean;
  trendable: boolean;
}

const LABELS: Record<string, string> = {
  "phq-9": "PHQ-9",
  "gad-7": "GAD-7",
  "phq-2": "PHQ-2",
  "gad-2": "GAD-2",
  [CSSRS_KEY]: "C-SSRS",
  audit: "AUDIT",
  "dast-10": "DAST-10",
  "pc-ptsd-5": "PC-PTSD-5",
  "pcl-5": "PCL-5",
  "pcl-5-20": "PCL-5",
  "ahc-hrsn": "AHC-HRSN",
  asam: "ASAM",
};

export function instrumentLabel(key: string): string {
  return LABELS[key] ?? screenerByKey(key)?.name ?? key.toUpperCase();
}

function isSudKey(key: string): boolean {
  return key === "asam" || isPart2Screener(key);
}

/** Can this role see SUD instruments on this patient? Same rule as the chart's ASAM gate. */
export function roleSeesSudInstruments(role: StaffRole, patient: Patient): boolean {
  const a = canAccess(role, "screeners_sud", patient);
  return a.level !== "none" && !a.locked && roleSeesAsamSection(role, patient);
}

export function buildTrackingRows(patient: Patient, role: StaffRole, now = new Date()): TrackingRow[] {
  const seesSud = roleSeesSudInstruments(role, patient);
  const rows: TrackingRow[] = [];
  for (const h of patient.screenerHistory ?? []) {
    if (h.retiredForm) continue;
    // Held after a merge: stays under the original record's consent until re-confirmed.
    if (isHeldAfterMerge(h)) continue;
    rows.push({
      key: h.key,
      label: instrumentLabel(h.key),
      date: h.completedAt,
      status: "completed",
      score: h.score,
      severity: h.severity,
      sud: isSudKey(h.key),
      trendable: h.key !== CSSRS_KEY && h.key !== "ahc-hrsn",
    });
  }
  for (const m of patient.missedScreeners ?? []) {
    rows.push({ key: m.key, label: instrumentLabel(m.key), date: m.dueAt, status: "missed", sud: isSudKey(m.key), trendable: false });
  }
  // Staff screener requests past due and not completed count as missed entries.
  for (const r of listScreenerRequests(patient.id)) {
    if (screenerRequestStatus(r, now) !== "overdue") continue;
    const key = r.key === "c-ssrs" ? CSSRS_KEY : r.key;
    rows.push({ key, label: instrumentLabel(key), date: r.dueAt, status: "missed", sud: isSudKey(key), trendable: false });
  }
  // Overdue: a scheduled instrument whose last result is older than its repeat interval.
  const lastByKey = new Map<string, number>();
  for (const r of rows) if (r.status === "completed") lastByKey.set(r.key, Math.max(lastByKey.get(r.key) ?? 0, +new Date(r.date)));
  for (const [key, last] of lastByKey) {
    const every = rescreenRule(key)?.repeatEveryDays;
    if (!every) continue;
    const due = last + every * 86400000;
    if (due < +now) rows.push({ key, label: instrumentLabel(key), date: new Date(due).toISOString(), status: "overdue", sud: isSudKey(key), trendable: false });
  }
  for (const a of patient.asamAssessments ?? []) {
    if (a.status !== "signed" && !a.signedAt) continue;
    rows.push({
      key: "asam",
      label: "ASAM",
      date: a.signedAt ?? a.authoredAt,
      status: "completed",
      level: a.actualLevel ?? a.recommendedLevel,
      sud: true,
      trendable: false,
    });
  }
  return rows
    .filter((r) => seesSud || !r.sud)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export interface TrackingFilter {
  instrument?: string; // label, e.g. "PHQ-9"; undefined = all
  from?: string; // yyyy-mm-dd
  to?: string;
  status?: "all" | "completed" | "missed";
}

export function filterTrackingRows(rows: TrackingRow[], f: TrackingFilter): TrackingRow[] {
  return rows.filter((r) => {
    if (f.instrument && r.label !== f.instrument) return false;
    const d = r.date.slice(0, 10);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (f.status === "completed" && r.status !== "completed") return false;
    if (f.status === "missed" && r.status === "completed") return false;
    return true;
  });
}

/** Latest completed result for an instrument — the value the care plan shows. */
export function latestFromHistory(patient: Patient, key: string) {
  return [...(patient.screenerHistory ?? [])]
    .filter((h) => h.key === key && !h.retiredForm && !isHeldAfterMerge(h))
    .sort((a, b) => +new Date(b.completedAt) - +new Date(a.completedAt))[0];
}
