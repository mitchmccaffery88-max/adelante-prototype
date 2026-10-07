# SculptSoft handoff — location & staff calendars

Prototype state: calendars live in browser memory (`src/lib/workingCalendar.ts`, staff hours/time off extend `AvailabilityBlock` / `AvailabilityException` in `src/lib/ehr-ext.ts`). Every change runs through the action registry (`calendar_*` actions) and is audited with a reason; time-off type is never written to the audit. All rules are Draft — pending clinical sign-off; the holiday list is "Draft — Premier to confirm".

| # | Item | Acceptance criterion | Dependency |
|---|------|----------------------|------------|
| 1 | Server-side calendars | Site calendars, closed days, staff hours and time off stored server-side with row-level access (sys_admin edits sites; staff edit own time off; coordinator/sys_admin edit anyone). `addedAt`/`removedAt` kept so signed work reads the calendar "as of" its close time. | Persistent backend |
| 2 | Real Google / Microsoft 365 sync | Replace `src/lib/vendors/calendarSync.ts` (Simulated). Uses `externalCalendarId` on staff and site. Conflict rules: Adelante time off and site closures win for booking; external busy blocks only remove slots (never create bookings); external deletions never cancel Adelante visits — they raise "Reschedule needed". Sync is idempotent and audited without event content. | OAuth app per tenant, BAA review (event titles may hold PHI — push "Busy" only) |
| 3 | HR / PTO system feed | Approved PTO imports as time off with type kept private; edits in HR update Adelante; overlap with booked visits raises "Reschedule needed" for the coordinator. No auto-cancel, no patient notice. | HR vendor API, mapping of staff ids |
| 4 | Per-site time zones | Each site's `timezone` drives date keys for working days, booking slots and note deadlines. Test a site outside Pacific. | Item 1 |
| 5 | Holiday list confirmed by Premier | Premier signs off the org default list (federal + Cesar Chavez Day + day after Thanksgiving, Sat→Fri / Sun→Mon). Remove the Draft label after sign-off. | Premier operations |
| 6 | Second-county site setup | New site in provider reference → "Create from defaults" copies the org list → edits (county holidays). Clinicians can hold hours at both sites; telehealth hours tagged with the billing site. | Item 1, county contract |

Unchanged by design (decide later): referral chase (3/7 days) and county due dates use calendar days; county cards warn when a due date lands on a clinic closed day.
