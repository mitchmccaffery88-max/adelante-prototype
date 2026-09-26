// §Needs step 3 — patient-facing per-service appointment state.
// Scheduled (from a request) · Requested — waiting for confirmation ·
// Already scheduled (an appointment set up another way, e.g. pre-release,
// a referral or staff booking). Substance-use rows follow the existing
// patient-facing rule: shown only when `recoveryJourneyVisible` (i.e. Part 2
// consent exists), in plain words with no clinical terms or levels.
import {
  APPT_REQUEST_SERVICE_TYPES,
  type Appointment,
  type AppointmentRequestKind,
  type Patient,
} from "@/lib/ehr";
import { recoveryJourneyVisible } from "@/lib/seeking";

export const PATIENT_REQUEST_LABEL: Record<AppointmentRequestKind, { en: string; es: string }> = {
  therapy: { en: "Counseling (first visit)", es: "Consejería (primera visita)" },
  medication: { en: "Medication visit", es: "Visita de medicamentos" },
  sud_assessment: { en: "Substance use support — first visit", es: "Apoyo para el uso de sustancias — primera visita" },
  help_choose: { en: "Help choosing the right care", es: "Ayuda para elegir la atención adecuada" },
};

export type PatientApptState =
  | { kind: AppointmentRequestKind; state: "scheduled"; start: string }
  | { kind: AppointmentRequestKind; state: "requested" }
  | { kind: AppointmentRequestKind; state: "already_scheduled"; start: string }
  | { kind: AppointmentRequestKind; state: "contacted" };

export function patientApptStates(
  patient: Patient | undefined,
  appts: Appointment[],
  now = Date.now(),
): PatientApptState[] {
  if (!patient) return [];
  const s = patient.seeking;
  const reqs = patient.appointmentRequests ?? [];
  const kinds = new Set<AppointmentRequestKind>(reqs.map((r) => r.kind));
  if (s?.notSure) kinds.add("help_choose");
  if (s?.mentalHealth) kinds.add("therapy");
  if (s?.medication) kinds.add("medication");
  if (s?.substanceUse) kinds.add("sud_assessment");
  const sudOk = recoveryJourneyVisible(patient);
  const out: PatientApptState[] = [];
  for (const kind of ["therapy", "medication", "sud_assessment", "help_choose"] as const) {
    if (!kinds.has(kind)) continue;
    if (kind === "sud_assessment" && !sudOk) continue;
    const latest = [...reqs].filter((r) => r.kind === kind).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    if (latest?.status === "requested") { out.push({ kind, state: "requested" }); continue; }
    if (latest?.status === "booked") {
      const a = appts.find((x) => x.id === latest.bookedApptId);
      if (a && a.status === "scheduled" && +new Date(a.start) > now) { out.push({ kind, state: "scheduled", start: a.start }); continue; }
    }
    const other = appts
      .filter((a) => a.status === "scheduled" && +new Date(a.start) > now && a.serviceType && APPT_REQUEST_SERVICE_TYPES[kind].includes(a.serviceType))
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
    if (other) { out.push({ kind, state: "already_scheduled", start: other.start }); continue; }
    if (latest?.status === "contacted_not_booked") out.push({ kind, state: "contacted" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// §Needs step 3 — reporting: request → booked (count + median days).
// Substance-use assessment requests are excluded here (Part 2); they are
// tracked through the ASAM section. Cohort-guarded; association only.
// ---------------------------------------------------------------------------
import { cohortGuard, type CohortGuard } from "@/lib/cohortGuard";

export interface RequestToBooked extends CohortGuard {
  requested: number;
  booked: number;
  contactedNotBooked: number;
  medianDaysToBooked: number | null;
}

export function requestToBooked(patients: Patient[], sinceDays?: number, now = Date.now()): RequestToBooked {
  const since = sinceDays ? now - sinceDays * 86400000 : -Infinity;
  const reqs = patients.flatMap((p) => p.appointmentRequests ?? [])
    .filter((r) => r.kind !== "sud_assessment" && +new Date(r.createdAt) >= since);
  const booked = reqs.filter((r) => r.status === "booked" && r.closedAt);
  const days = booked.map((r) => (+new Date(r.closedAt!) - +new Date(r.createdAt)) / 86400000).sort((a, b) => a - b);
  const median = days.length
    ? Math.round((days.length % 2 ? days[(days.length - 1) / 2]! : (days[days.length / 2 - 1]! + days[days.length / 2]!) / 2) * 10) / 10
    : null;
  return {
    requested: reqs.length,
    booked: booked.length,
    contactedNotBooked: reqs.filter((r) => r.status === "contacted_not_booked").length,
    medianDaysToBooked: median,
    ...cohortGuard(reqs.length),
  };
}
