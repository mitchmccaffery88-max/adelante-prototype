// §7 — Scheduling constraint engine. Pure function; UI passes context in.
// Additive: does not replace existing findApptConflict, wraps richer reasons.
import { AdelanteEHR, type Appointment, type ServiceType } from "./ehr";
import { AdelanteEHRExt } from "./ehr-ext";

export type ConstraintReasonCode =
  | "clinician_inactive"
  | "license_expired"
  | "credential_missing"
  | "not_enrolled_with_payer"
  | "outside_availability_window"
  | "availability_exception_off"
  | "double_booked"
  | "service_not_offered"
  | "location_required"
  | "location_not_supported"
  | "modality_not_offered"
  | "past_time"
  | "late_cancel_window";

export interface ConstraintReason {
  code: ConstraintReasonCode;
  message: string;
  severity: "block" | "warn";
}

export interface EvaluateInput {
  clinicianId: string;
  patientId?: string;
  start: string; // ISO
  durationMin: number;
  serviceType: ServiceType;
  modality: "video" | "phone" | "in_person";
  locationId?: string;
  ignoreApptId?: string;
}

export interface EvaluateResult {
  ok: boolean;
  blocks: ConstraintReason[];
  warnings: ConstraintReason[];
}

function inWindow(start: Date, durationMin: number, weekdayStart: string, weekdayEnd: string) {
  const [sh, sm] = weekdayStart.split(":").map(Number);
  const [eh, em] = weekdayEnd.split(":").map(Number);
  const s = start.getHours() * 60 + start.getMinutes();
  const e = s + durationMin;
  const ws = sh * 60 + sm;
  const we = eh * 60 + em;
  return s >= ws && e <= we;
}

export const SchedulingConstraints = {
  evaluate(input: EvaluateInput): EvaluateResult {
    const blocks: ConstraintReason[] = [];
    const warnings: ConstraintReason[] = [];
    const clinician = AdelanteEHR.getClinician(input.clinicianId);
    const profile = AdelanteEHRExt.getClinicianProfile(input.clinicianId);
    const startAt = new Date(input.start);

    if (isNaN(+startAt)) blocks.push({ code: "past_time", message: "Pick a date and time.", severity: "block" });
    if (+startAt < Date.now()) blocks.push({ code: "past_time", message: "Start time is in the past.", severity: "block" });

    if (!clinician) blocks.push({ code: "clinician_inactive", message: "Clinician not found.", severity: "block" });
    if (profile && profile.active === false)
      blocks.push({ code: "clinician_inactive", message: `${clinician?.name ?? "Clinician"} is not accepting new bookings.`, severity: "block" });

    // License hard-stop
    if (clinician?.licenseExpiresOn && new Date(clinician.licenseExpiresOn) < startAt) {
      blocks.push({ code: "license_expired", message: `License expired ${clinician.licenseExpiresOn}.`, severity: "block" });
    }
    const creds = AdelanteEHRExt.credentialsForClinician(input.clinicianId);
    const licenseDoc = creds.find((c) => c.kind === "license");
    if (!licenseDoc || licenseDoc.status === "expired" || licenseDoc.status === "missing") {
      blocks.push({ code: "credential_missing", message: "License document missing or expired.", severity: "block" });
    }
    creds
      .filter((c) => c.status === "expiring")
      .forEach((c) =>
        warnings.push({ code: "credential_missing", message: `${c.kind.toUpperCase()} expires ${c.expiresAt ?? "soon"}.`, severity: "warn" }),
      );

    // Service offered
    if (clinician?.services && !clinician.services.includes(input.serviceType)) {
      blocks.push({ code: "service_not_offered", message: "Clinician doesn't offer this service.", severity: "block" });
    }

    // Modality/location
    if (input.modality === "in_person" && !input.locationId) {
      blocks.push({ code: "location_required", message: "Pick a location for in-person visits.", severity: "block" });
    }
    if (input.locationId && clinician?.locationIds && !clinician.locationIds.includes(input.locationId)) {
      blocks.push({ code: "location_not_supported", message: "Clinician isn't staffed at this location.", severity: "block" });
    }

    // Availability
    const blocksForDay = AdelanteEHRExt.availabilityBlocksForClinician(input.clinicianId).filter(
      (b) => b.weekday === startAt.getDay(),
    );
    if (blocksForDay.length && !blocksForDay.some((b) => inWindow(startAt, input.durationMin, b.start, b.end))) {
      warnings.push({ code: "outside_availability_window", message: "Outside clinician's standard hours.", severity: "warn" });
    }
    const dayKey = startAt.toISOString().slice(0, 10);
    const off = AdelanteEHRExt.availabilityExceptionsForClinician(input.clinicianId).find(
      (e) => e.date === dayKey && e.kind === "off",
    );
    if (off) blocks.push({ code: "availability_exception_off", message: off.note || "Clinician is off that day.", severity: "block" });

    // Payer enrollment (if patient known and has coverage)
    if (input.patientId) {
      const cov = AdelanteEHRExt.activeCoverageFor(input.patientId, startAt.toISOString());
      if (cov) {
        const enrolled = AdelanteEHRExt.enrollmentsForClinician(input.clinicianId).some(
          (e) => e.payer === cov.payer && e.status === "enrolled",
        );
        if (!enrolled)
          warnings.push({
            code: "not_enrolled_with_payer",
            message: `Not enrolled with ${cov.payer}. May bill ISL.`,
            severity: "warn",
          });
      }
    }

    // Double book
    const existing: Appointment | undefined = AdelanteEHR.findApptConflict(
      input.clinicianId,
      startAt.toISOString(),
      input.ignoreApptId,
    );
    if (existing) blocks.push({ code: "double_booked", message: "Overlaps another appointment.", severity: "block" });

    return { ok: blocks.length === 0, blocks, warnings };
  },
  isLateCancel(startISO: string, nowISO = new Date().toISOString()): boolean {
    const start = +new Date(startISO);
    const now = +new Date(nowISO);
    return start - now < 24 * 60 * 60 * 1000 && start - now > 0;
  },
};