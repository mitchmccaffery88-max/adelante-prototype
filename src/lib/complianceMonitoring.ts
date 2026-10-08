// §Access batch A1 — compliance monitoring, built only from the access log
// (accessLog.ts). Draft — pending exec RBAC review. Counts per person; the
// drill-down lists access-log rows (time, section) — never chart content.
import { accessEventsFor, type AccessRow } from "./accessLog";
import { AdelanteEHR } from "./ehr";
import { onCareTeam, UNUSUAL_VOLUME_DRAFT, COMPLIANCE_ROLES } from "./chartAccess";
import type { StaffRole } from "./roles";

export const canViewCompliance = (role: StaffRole) => COMPLIANCE_ROLES.includes(role);

export interface OutsideRow { actorId: string; actorName: string; role?: string; charts: number; opens: number; rows: (AccessRow & { patientId: string })[] }

const DAY = 86_400_000;
/** Monday 00:00 (local) of the week containing `d`. */
export function weekStartOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7;
  return new Date(+x - wd * DAY);
}

function chartOpens(from: number, to: number) {
  return accessEventsFor()
    .filter((r): r is AccessRow & { patientId: string } => r.action === "record.viewed" && r.kind === "open" && !!r.patientId && !!r.actorId)
    .filter((r) => { const t = +new Date(r.at); return t >= from && t < to; });
}

/** Weekly "Charts opened outside caseload": per staff member, charts not on their care team. */
export function outsideCaseloadReport(weekOf: Date = new Date()): OutsideRow[] {
  const from = +weekStartOf(weekOf);
  const by = new Map<string, OutsideRow>();
  for (const r of chartOpens(from, from + 7 * DAY)) {
    const p = AdelanteEHR.getPatient(r.patientId);
    if (!p || !r.actorId || onCareTeam(r.actorId, p)) continue;
    const row = by.get(r.actorId) ?? { actorId: r.actorId, actorName: r.actorName, role: r.role, charts: 0, opens: 0, rows: [] };
    row.opens++;
    if (!row.rows.some((x) => x.patientId === r.patientId)) row.charts++;
    row.rows.push(r);
    by.set(r.actorId, row);
  }
  return [...by.values()].sort((a, b) => b.charts - a.charts);
}

export interface VolumeFlag { actorId: string; actorName: string; day: string; charts: number }
/** "Unusual volume": more than the Draft threshold of distinct charts opened by one person in a day. */
export function unusualVolumeFlags(day: Date = new Date(), threshold = UNUSUAL_VOLUME_DRAFT): VolumeFlag[] {
  const from = +new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const per = new Map<string, { name: string; ids: Set<string> }>();
  for (const r of chartOpens(from, from + DAY)) {
    if (!r.actorId) continue;
    const v = per.get(r.actorId) ?? { name: r.actorName, ids: new Set<string>() };
    v.ids.add(r.patientId);
    per.set(r.actorId, v);
  }
  const key = new Date(from).toISOString().slice(0, 10);
  return [...per.entries()].filter(([, v]) => v.ids.size > threshold).map(([actorId, v]) => ({ actorId, actorName: v.name, day: key, charts: v.ids.size }));
}
