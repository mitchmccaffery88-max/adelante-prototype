// §Reminders — pre-contact reminders for EVERY scheduled contact type.
//
// This deliberately builds NO parallel SMS plumbing. It reuses the existing
// notification path (`AdelanteEHR.notifyAppointmentChange`), which already:
//   • fans out to profile / sms / email,
//   • consults `AdelanteEHR.isSmsOn()` so a patient with SMS off never gets a
//     text (revocable consent first, legacy `smsFallback` second),
//   • simulates delivery, records failures, and feeds
//     `recentFailedNotifications` / `resendNotification`.
//
// The only thing added here is VISIBILITY: group occurrences were invisible to
// the reminder path because they are not Appointments. Both sources are folded
// into one list of upcoming contacts.
import { AdelanteEHR, type ServiceType } from "./ehr";

export type ContactSource = "appointment" | "group";

export interface UpcomingContact {
  patientId: string;
  source: ContactSource;
  /** Appointment id, or the `group:<sessionId>:<startISO>:<patientId>` ref. */
  refId: string;
  start: string;
  serviceType: ServiceType;
  label: string;
}

export const REMINDER_LEAD_HOURS = 48;

/** Every scheduled contact for every patient inside the lead window. */
export function upcomingContacts(
  now = new Date(),
  hoursAhead = REMINDER_LEAD_HOURS,
): UpcomingContact[] {
  const from = now.getTime();
  const to = from + hoursAhead * 3_600_000;
  const out: UpcomingContact[] = [];

  for (const a of AdelanteEHR.listAppointments()) {
    if (a.status !== "scheduled") continue;
    const t = Date.parse(a.start);
    if (!Number.isFinite(t) || t < from || t > to) continue;
    out.push({
      patientId: a.patientId,
      source: "appointment",
      refId: a.id,
      start: a.start,
      serviceType: a.serviceType ?? "therapy_individual",
      label: AdelanteEHR.getClinician(a.clinicianId)?.name ?? "Your care team",
    });
  }

  for (const g of AdelanteEHR.listGroupSessions()) {
    if (g.status === "cancelled") continue;
    const roster = AdelanteEHR.listGroupEnrollments(g.id);
    if (roster.length === 0) continue;
    for (const start of AdelanteEHR.groupOccurrenceStarts(g.id, 14)) {
      const t = Date.parse(start);
      if (!Number.isFinite(t) || t < from || t > to) continue;
      const occ = AdelanteEHR.getGroupOccurrence(g.id, start);
      if (occ?.status === "cancelled") continue;
      for (const e of roster) {
        out.push({
          patientId: e.patientId,
          source: "group",
          refId: `group:${g.id}:${start}:${e.patientId}`,
          start,
          serviceType: g.serviceType,
          label: g.topic,
        });
      }
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start));
}

function alreadyReminded(patientId: string, refId: string): boolean {
  const p = AdelanteEHR.getPatient(patientId);
  return (p?.notifications ?? []).some((n) => n.apptId === refId && n.kind === "reminder");
}

export interface ReminderRun {
  sent: UpcomingContact[];
  /** Contacts already reminded — never re-sent. */
  skippedDuplicate: UpcomingContact[];
  /** Reminded in-app/email, but no text: this patient has SMS off. */
  smsSuppressed: UpcomingContact[];
}

/**
 * Fire reminders for everything due. Manually triggered (there is no scheduler
 * in this build), idempotent per contact.
 */
export function sendDueReminders(
  now = new Date(),
  hoursAhead = REMINDER_LEAD_HOURS,
): ReminderRun {
  const run: ReminderRun = { sent: [], skippedDuplicate: [], smsSuppressed: [] };
  for (const c of upcomingContacts(now, hoursAhead)) {
    if (alreadyReminded(c.patientId, c.refId)) {
      run.skippedDuplicate.push(c);
      continue;
    }
    // The SMS decision lives in one place only — `isSmsOn` inside
    // notifyAppointmentChange. This is reporting, not a second gate.
    if (!AdelanteEHR.isSmsOn(c.patientId)) run.smsSuppressed.push(c);
    AdelanteEHR.notifyAppointmentChange({
      patientId: c.patientId,
      apptId: c.refId,
      kind: "reminder",
    });
    run.sent.push(c);
  }
  return run;
}
