// R53 part 1. Every clinical rule is Draft — pending clinical sign-off.
// Pure projection of existing scored history, patient tasks and booked visits.
import { SCREENER_CADENCE } from "./screeners";
import type { Patient, PatientTask } from "./ehr";

export const RESCREEN_PROMPT_RULES = {
  weeklyCapDays: 7, recentCompletionDays: 14, visitWindowDays: 7, visitLeadDays: 2,
  reminderDays: [3, 7], staffFollowupDays: 10,
  note: "Draft — pending clinical sign-off",
} as const;
export const RESCREEN_REMINDER_TEXT = "You have a short check-in waiting.";
export const RESCREEN_TASK_TEXT = "Screening follow-up needed";
const DAY = 86400000;
type Scored = { key: string; completedAt: string; score?: number; retiredForm?: boolean; completeness?: string; estimated?: boolean };
/** Draft — pending clinical sign-off: estimates count, incomplete never does. */
export function lastScoredAt(key: string, history: readonly Scored[]): number | undefined {
  const dates = history.filter(r => r.key === key && !r.retiredForm && r.completeness !== "incomplete" && typeof r.score === "number" && Number.isFinite(r.score))
    .map(r => Date.parse(r.completedAt)).filter(Number.isFinite);
  return dates.length ? Math.max(...dates) : undefined;
}
/** Draft — pending clinical sign-off: recorded release only; no fabricated needs-update signal. */
export function cadenceInterval(key: string, releaseDate: string | undefined, now: number): number | null {
  const rule = SCREENER_CADENCE[key as keyof typeof SCREENER_CADENCE];
  if (!rule) return null;
  if (key === "ahc-hrsn") {
    const hrsn = SCREENER_CADENCE["ahc-hrsn"];
    const released = releaseDate ? Date.parse(releaseDate) : NaN;
    if (Number.isFinite(released) && now >= released && now < released + hrsn.reentryWindowDays * DAY) return hrsn.reentryIntervalDays;
  }
  return rule.intervalDays;
}
/** Draft — pending clinical sign-off: shared clinical clock, independent of member prompt consent gates. */
export function cadenceDue(p: Pick<Patient, "screenerHistory" | "releaseDate" | "screeners">, now: number) {
  const history = [...(p.screenerHistory ?? []), ...Object.values(p.screeners).filter((r): r is NonNullable<typeof r> => !!r)];
  return Object.keys(SCREENER_CADENCE).flatMap(key => {
    const interval = cadenceInterval(key, p.releaseDate, now);
    const last = lastScoredAt(key, history);
    if (interval === null || last === undefined || now < last + interval * DAY) return [];
    return [{ key, lastDays: Math.floor((now - last) / DAY), nextDue: interval, dueAt: last + interval * DAY }];
  });
}
/** Draft — pending clinical sign-off: SUD auto-prompts require BOTH any-source flag and existing consent. */
export function autoInstrumentAllowed(key: string, hasSudFlag: boolean, sudConsent: boolean) {
  if (cadenceInterval(key, undefined, 0) === null) return false;
  return !["audit", "dast-10"].includes(key) || (hasSudFlag && sudConsent);
}
/** Draft — pending clinical sign-off: align to booked contact; never delay past contact. */
export function promptSurfaceAt(dueAt: number, visits: readonly { start: string; status: string }[]): number {
  const next = visits.filter(a => ["scheduled", "checked_in"].includes(a.status))
    .map(a => Date.parse(a.start)).filter(at => at >= dueAt && at <= dueAt + RESCREEN_PROMPT_RULES.visitWindowDays * DAY).sort((a,b) => a-b)[0];
  return next === undefined ? dueAt : Math.max(dueAt, next - RESCREEN_PROMPT_RULES.visitLeadDays * DAY);
}
/** Draft — pending clinical sign-off: one bundle, one new automatic prompt per seven days. */
export function automaticBundle(p: Patient, now: number, visits: readonly { start: string; status: string }[], hasSudFlag: boolean, sudConsent: boolean): string[] {
  if (!p.intakeCompletedAt) return [];
  const automatic = (p.tasks ?? []).filter(t => t.automaticRescreen);
  if (automatic.some(t => now - Date.parse(t.createdAt) < RESCREEN_PROMPT_RULES.weeklyCapDays * DAY)) return [];
  const history = [...(p.screenerHistory ?? []), ...Object.values(p.screeners).filter((r): r is NonNullable<typeof r> => !!r)];
  return cadenceDue(p, now).filter(d => autoInstrumentAllowed(d.key, hasSudFlag, sudConsent))
    .filter(d => { const last = lastScoredAt(d.key, history); return last === undefined || now - last >= RESCREEN_PROMPT_RULES.recentCompletionDays * DAY; })
    .filter(d => promptSurfaceAt(d.dueAt, visits) <= now)
    .filter(d => !(p.tasks ?? []).some(t => t.kind === "rescreen" && t.screenerKey === d.key && !t.completedAt)).map(d => d.key);
}
/** Draft — pending clinical sign-off: only still-uncompleted, eligible instruments drive reminders/outreach. */
export function outstandingPromptGroups(p: Patient, now: number, hasSudFlag: boolean, sudConsent: boolean) {
  const history = [...(p.screenerHistory ?? []), ...Object.values(p.screeners).filter((r): r is NonNullable<typeof r> => !!r)];
  const groups = new Map<string, PatientTask[]>();
  for (const task of p.tasks ?? []) {
    if (task.kind !== "rescreen" || task.completedAt || !task.screenerKey) continue;
    const key = task.screenerKey;
    if (cadenceInterval(key, p.releaseDate, now) === null || (["audit", "dast-10"].includes(key) && (!sudConsent || (task.automaticRescreen && !hasSudFlag)))) continue;
    const last = lastScoredAt(key, history);
    if (last !== undefined && last >= Date.parse(task.createdAt)) continue;
    const id = task.rescreenPromptId ?? task.id;
    groups.set(id, [...(groups.get(id) ?? []), task]);
  }
  return [...groups].map(([id, tasks]) => ({ id, tasks, createdAt: tasks[0].createdAt, ageDays: Math.floor((now - Date.parse(tasks[0].createdAt)) / DAY) }));
}