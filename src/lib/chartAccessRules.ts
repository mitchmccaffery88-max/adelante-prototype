// Mitch — 27 Oct access rules. Draft; pure inputs shared by app/SQL vectors.
export const CHART_ACCESS_DRAFT = "Draft — pending go-live permissions audit";
export const ACCESS_SETTINGS = { reasonDuration: "end_of_site_day", intakeDays: 60 } as const;
export const OPEN_REASONS = {
  covering_consult: "Covering or consult",
  scheduling_admin: "Scheduling or admin need",
  clinical_supervision: "Clinical supervision",
  crisis_safety: "Crisis or safety",
  other: "Other",
} as const;
export type OpenReason = keyof typeof OPEN_REASONS;
export const isOpenReason = (v: string): v is OpenReason => Object.hasOwn(OPEN_REASONS, v);
export function activeAt(start: string, end: string | undefined, at: Date): boolean {
  return Date.parse(start) <= +at && (!end || +at < Date.parse(end));
}
export function siteDay(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Next site midnight, including daylight-saving changes; never the device day. */
export function endOfSiteDay(at: Date, timezone: string): string {
  const day = siteDay(at, timezone);
  let low = +at, high = +at + 27 * 3_600_000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (siteDay(new Date(mid), timezone) === day) low = mid; else high = mid;
  }
  return new Date(high).toISOString();
}
export function intakeWindowActive(completedAt: string | undefined, at: Date, timezone: string): boolean {
  if (!completedAt || !Number.isFinite(Date.parse(completedAt)) || +at < Date.parse(completedAt)) return false;
  const days = (Date.parse(siteDay(at, timezone)) - Date.parse(siteDay(new Date(completedAt), timezone))) / 86_400_000;
  // Handoff date is day 1; day 60 is included and day 61 is not.
  return days >= 0 && days < ACCESS_SETTINGS.intakeDays;
}
export interface EntryFacts {
  eligible: boolean; exists: boolean; team: boolean; oversight: boolean;
  onCall: boolean; coverage: boolean; supervisor: boolean;
  restricted: boolean; restrictedOpen: boolean; reasonOpen: boolean;
}
export function evaluateChartEntry(f: EntryFacts) {
  if (!f.eligible) return { ok: false, entryEligible: false, reason: "role" as const };
  if (!f.exists) return { ok: false, entryEligible: false, reason: "missing" as const };
  const direct = f.team || f.oversight || f.onCall || f.coverage || f.supervisor;
  const restrictedGate = f.restricted && !f.team && !f.restrictedOpen;
  return { ok: !restrictedGate && (direct || f.reasonOpen), entryEligible: true,
    reason: restrictedGate ? "restricted" as const : direct || f.reasonOpen ? undefined : "reason" as const,
    direct, careTeam: f.team, restricted: f.restricted, outsideCaseload: !f.team,
    searchable: !f.restricted || f.team };
}