// §Calendars L7 — "Calendar sync" vendor (Google / Microsoft 365). SIMULATED:
// no network call, nothing read or written. Staff and sites carry an
// externalCalendarId (workingCalendar.ts) so a real adapter can be wired
// later — see docs/sculptsoft-calendar-handoff.md.
export type CalendarProvider = "google" | "m365";
export interface CalendarSyncResult {
  simulated: true;
  provider: CalendarProvider;
  externalCalendarId: string;
  pulled: 0;
  pushed: 0;
  at: string;
}
export interface CalendarSyncAdapter {
  name: string;
  providers: CalendarProvider[];
  sync(input: { provider: CalendarProvider; externalCalendarId: string }): CalendarSyncResult;
}
export const SimulatedCalendarSyncAdapter: CalendarSyncAdapter = {
  name: "Calendar sync (Simulated)",
  providers: ["google", "m365"],
  sync({ provider, externalCalendarId }) {
    if (!externalCalendarId?.trim()) throw new Error("Add an external calendar id first.");
    return { simulated: true, provider, externalCalendarId: externalCalendarId.trim(), pulled: 0, pushed: 0, at: new Date().toISOString() };
  },
};
export const calendarSync = SimulatedCalendarSyncAdapter;
