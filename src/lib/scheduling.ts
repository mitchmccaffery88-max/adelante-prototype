// §7 — Scheduling constraint engine. Pure function; UI passes context in.
// Additive: does not replace existing findApptConflict, wraps richer reasons.
import { AdelanteEHR, type Appointment, type ServiceType } from "./ehr";
import { AdelanteEHRExt } from "./ehr-ext";
import { isLateCancelWindow } from "./lateCancel";
import { facilityDateKey } from "./facilityTime";
import { siteClosedDay, siteForLocation, primarySiteFor, siteTimezone, staffTimeOffOn, fitsStaffHours } from "./workingCalendar";

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

    // Availability — site wall clock + the clinician's hours at that site (§P1).
    if (!isNaN(+startAt)) {
      const site = siteForLocation(input.locationId) ?? primarySiteFor(input.clinicianId);
      const h = fitsStaffHours(startAt, input.durationMin, { ownerId: input.clinicianId, siteId: site });
      if (h.hasHours && !h.fits)
        warnings.push({ code: "outside_availability_window", message: "Outside clinician's standard hours.", severity: "warn" });
    }
    // §Calendars L5 — site closed day and time off through the one working-day service.
    const siteId = siteForLocation(input.locationId) ?? primarySiteFor(input.clinicianId);
    const dayKey = isNaN(+startAt) ? "" : facilityDateKey(startAt, siteTimezone(siteId));
    const closed = dayKey ? siteClosedDay(siteId, dayKey) : undefined;
    if (closed) blocks.push({ code: "availability_exception_off", message: `Clinic closed — ${closed.name}.`, severity: "block" });
    // Never the time-off type here (other staff see only "Out").
    if (dayKey && staffTimeOffOn(input.clinicianId, dayKey)) blocks.push({ code: "availability_exception_off", message: "Clinician is out that day.", severity: "block" });

    // Payer enrollment — reads the one coverage model (§Phase 3b).
    if (input.patientId) {
      const cov = AdelanteEHR.activeCoveragePlan(input.patientId, startAt.toISOString());

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
    return isLateCancelWindow(startISO, nowISO);
  },
};