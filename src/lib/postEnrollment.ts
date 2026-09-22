// §Referrals Rework Phase 4f — post-enrollment handoff.
//
// Enrollment creates a patient record and nothing else. These helpers read the
// real record to answer two questions no surface could answer before:
//   1. Which of the four setup steps are still missing?
//   2. How long have they been missing?
//
// Nothing is stamped or stored: every value below is computed from fields that
// already exist on the Patient and Appointment rows.
import { AdelanteEHR, type Appointment, type Patient } from "./ehr";

export type PostEnrollmentStep = "case_manager" | "clinician" | "intake" | "first_session";

export const POST_ENROLLMENT_STEP_LABEL: Record<PostEnrollmentStep, string> = {
  case_manager: "Case manager assigned",
  clinician: "Clinician assigned",
  intake: "Intake completed",
  first_session: "First session attended",
};

/**
 * THRESHOLD REASONING (draft — deliberately labelled as such on screen).
 *
 * Each step has its own clock because each depends on a different thing:
 *  - case manager: naming an owner is a same-week desk decision. Without one,
 *    a returned call reaches nobody.
 *  - clinician: matching depends on licence, language and caseload, so it is
 *    slower than naming a coordinator but still inside two weeks.
 *  - intake: requires an actual scheduled contact with the person, so it
 *    trails assignment by roughly a week.
 *  - first session: depends on the person showing up; a month with no attended
 *    visit means the enrollment is effectively inactive.
 *
 * NOT ratified by Adelante care operations.
 */
export const POST_ENROLLMENT_STALENESS_DRAFT: Record<
  PostEnrollmentStep,
  { dueDays: number; overdueDays: number }
> = {
  case_manager: { dueDays: 3, overdueDays: 7 },
  clinician: { dueDays: 5, overdueDays: 10 },
  intake: { dueDays: 7, overdueDays: 14 },
  first_session: { dueDays: 14, overdueDays: 30 },
};

export const POST_ENROLLMENT_STALENESS_LABEL =
  "Draft threshold — pending care-operations sign-off";

export const POST_ENROLLMENT_STALENESS_NOTE =
  "Draft: days since enrollment, measured per step — case manager 3/7, clinician 5/10, intake 7/14, first attended session 14/30. Each step has its own clock because each depends on a different thing. Not yet ratified by care operations.";

/** The step order the Client Journey shows them in. */
export const POST_ENROLLMENT_STEPS: PostEnrollmentStep[] = [
  "case_manager",
  "clinician",
  "intake",
  "first_session",
];

/**
 * The earliest appointment the person actually ATTENDED. A scheduled, cancelled
 * or no-showed appointment is not a first session — attendance is a real staff
 * owned field on the appointment and is the only thing read here.
 */
export function firstAttendedAppointment(patientId: string): Appointment | undefined {
  return AdelanteEHR.appointmentsForPatient(patientId)
    .filter((a) => a.status === "attended")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
}

/** The next appointment still on the books — shown as "in progress", never as reached. */
export function nextScheduledAppointment(patientId: string): Appointment | undefined {
  return AdelanteEHR.appointmentsForPatient(patientId)
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
}

/** Which of the four setup steps are still missing for this patient. */
export function postEnrollmentGaps(p: Patient): PostEnrollmentStep[] {
  const gaps: PostEnrollmentStep[] = [];
  if (!p.caseManagerId) gaps.push("case_manager");
  if (!p.primaryClinicianId) gaps.push("clinician");
  if (!p.intakeCompletedAt) gaps.push("intake");
  if (!firstAttendedAppointment(p.id)) gaps.push("first_session");
  return gaps;
}

export function needsSetup(p: Patient): boolean {
  return postEnrollmentGaps(p).length > 0;
}

/** When the post-enrollment clock starts for this person. */
export function enrollmentClockStart(p: Patient): string | undefined {
  return p.enrolledAt;
}

export type PostEnrollmentStalenessState = "fresh" | "due" | "overdue";

export interface PostEnrollmentStaleness {
  /** The earliest unmet step — the one driving the badge. */
  step: PostEnrollmentStep;
  state: PostEnrollmentStalenessState;
  days: number;
}

/**
 * Staleness for the earliest unmet step, measured in days since enrollment.
 * Returns undefined when nothing is missing or there is no enrollment date.
 */
export function postEnrollmentStaleness(
  p: Patient,
  now: Date = new Date(),
): PostEnrollmentStaleness | undefined {
  const gaps = postEnrollmentGaps(p);
  if (!gaps.length) return undefined;
  const start = enrollmentClockStart(p);
  if (!start) return undefined;
  const step = POST_ENROLLMENT_STEPS.find((s) => gaps.includes(s))!;
  const days = Math.floor((+now - +new Date(start)) / 86400_000);
  const t = POST_ENROLLMENT_STALENESS_DRAFT[step];
  const state: PostEnrollmentStalenessState =
    days >= t.overdueDays ? "overdue" : days >= t.dueDays ? "due" : "fresh";
  return { step, state, days };
}

export function postEnrollmentStalenessLabel(s: PostEnrollmentStaleness): string {
  const what = POST_ENROLLMENT_STEP_LABEL[s.step].toLowerCase();
  if (s.days <= 0) return `Enrolled today · ${what} still open`;
  if (s.days === 1) return `1 day since enrollment · ${what} still open`;
  return `${s.days} days since enrollment · ${what} still open`;
}

/** Every enrolled patient still missing at least one setup step. */
export function patientsNeedingSetup(patients: Patient[]): Patient[] {
  return patients.filter((p) => needsSetup(p));
}
