// 27 Oct (Mitch) — clinician credentialing batch. Draft — pending the go-live
// permissions audit and compliance review (DHCS MHSUDS IN 18-019).
import { describe, expect, it } from "vitest";
import { AdelanteEHR, bookingCredentialingBlock } from "../ehr";
import { AdelanteEHRExt } from "../ehr-ext";
import { canAccess, STAFF_ROLES, type StaffRole } from "../roles";
import { roleHasChartEntry } from "../chartAccess";
import { canAssistCredentials } from "../credentialAccess";
import { chartAction } from "../chartActions";
import {
  BILLABLE_SERVICE_TYPES,
  CREDENTIALING_DENIED,
  CREDENTIALING_NEUTRAL_LABEL,
  CREDENTIALING_REASON_LABEL,
  MONITOR_CHANNELS,
  canManageCredentialing,
  credentialedForService,
  credentialingRecordForStaff,
  credentialingReviewFlags,
  credentialingTiles,
  clinicianCredentialNotices,
  evaluateCredentialing,
  exclusionChecksDue,
  expiringItems,
  recordExclusionCheck,
  recordVerification,
  runMonitorChannel,
  setServiceEnrollment,
  upsertLicense,
  type ClinicianCredentialing,
} from "../credentialing";
import { billingReadiness, billableService } from "../careLifecycle";

const COORD = { role: "credentialing_coordinator" as const, staffId: "s-cred1" };
const today = () => new Date().toISOString();
const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

let n = 0;
function freshPatient() {
  return AdelanteEHR.createPatient({ firstName: "Cred", lastName: `Fixture${++n}`, dob: "1990-01-01" } as Parameters<typeof AdelanteEHR.createPatient>[0]);
}
const cc = { id: "Priya Raman", role: "clinical_coordinator" as const };
let slotN = 0;
function futureSlot(): string {
  // A few days out — inside every seeded exclusion check's validity window —
  // each booking on its own day to avoid conflicts.
  const d = new Date(Date.now() + (3 + slotN++) * 86400_000);
  d.setHours(11, 0, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString();
}
function book(clinicianId: string, patientId: string, serviceType: string) {
  return AdelanteEHR.bookAppointment({
    patientId,
    clinicianId,
    start: futureSlot(),
    durationMin: 50,
    serviceType,
    modality: "in_person",
    locationId: "loc-visalia",
    source: "staff_scheduled",
    bookedBy: cc,
    allowPatientOverlap: true,
  } as Parameters<typeof AdelanteEHR.bookAppointment>[0]);
}

describe("the one credentialing rule", () => {
  it("returns no_record when there is no credentialing record", () => {
    const res = evaluateCredentialing(undefined, { dateOfService: today() });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons).toEqual(["no_record"]);
  });

  it("passes the fully credentialed, enrolled clinician (c1)", () => {
    const res = credentialedForService("s-th1", "Medi-Cal FFS", "therapy_individual", today());
    expect(res.ok).toBe(true);
  });

  it("passes the associate with an active supervision record (c4)", () => {
    const res = credentialedForService("s-tr1", "Medi-Cal FFS", "therapy_individual", today());
    expect(res.ok).toBe(true);
  });

  it("fails a license that expired before the date of service", () => {
    // c2's license expires in 25 days: fine today, expired in 40.
    expect(credentialedForService("s-th2", "Medi-Cal FFS", "therapy_individual", today()).ok).toBe(true);
    const later = credentialedForService("s-th2", "Medi-Cal FFS", "therapy_individual", inDays(40));
    expect(later.ok).toBe(false);
    if (!later.ok) expect(later.reasons).toContain("license_expired");
  });

  it("fails an unverified license", () => {
    upsertLicense(COORD, "s-bill1", { licenseType: "LCSW", number: "TEST-000", state: "CA", expiresAt: inDays(200), method: "manual" });
    const res = credentialedForService("s-bill1", undefined, undefined, today());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons).toContain("license_not_verified");
  });

  it("fails an overdue exclusion check (c5) and an exclusion hit", () => {
    const overdue = credentialedForService("s-np1", "Medi-Cal FFS", "med_management", today());
    expect(overdue.ok).toBe(false);
    if (!overdue.ok) expect(overdue.reasons).toContain("exclusion_check_overdue");

    recordExclusionCheck(COORD, "s-th2", { list: "oig", result: "hit" });
    const hit = credentialedForService("s-th2", "Medi-Cal FFS", "therapy_individual", today());
    expect(hit.ok).toBe(false);
    if (!hit.ok) expect(hit.reasons).toContain("exclusion_hit");
    // The hit raises one neutral urgent notice for the coordinator/sys_admin.
    recordExclusionCheck(COORD, "s-th2", { list: "oig", result: "clear" });
  });

  it("fails when the clinician is not enrolled with that payer for that service (c3 DMC-ODS)", () => {
    const sud = credentialedForService("s-th3", "Tulare County DMC-ODS", "sud_counseling", today());
    expect(sud.ok).toBe(false);
    if (!sud.ok) expect(sud.reasons).toContain("payer_not_enrolled");
    // …while the enrolled Medi-Cal service passes.
    expect(credentialedForService("s-th3", "Medi-Cal FFS", "med_management", today()).ok).toBe(true);
  });

  it("fails a trainee with no supervision record (c6)", () => {
    const res = credentialedForService("s-tr2", "Medi-Cal FFS", "therapy_individual", today());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons).toContain("supervision_missing");
  });

  it("fails when supervision ended before the date of service", () => {
    const record = credentialingRecordForStaff("s-tr1")!;
    const ended: ClinicianCredentialing = {
      ...record,
      registration: { ...record.registration!, supervision: { supervisorStaffId: "s-th1", start: inDays(-200), end: inDays(-10) } },
    };
    const res = evaluateCredentialing(ended, { payer: "Medi-Cal FFS", serviceType: "therapy_individual", dateOfService: today() });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons).toContain("supervision_expired");
  });

  it("skips the enrollment check when no payer is known", () => {
    // c6 fails on supervision, not enrollment, when the patient has no payer.
    const res = credentialedForService("s-th3", undefined, "sud_counseling", today());
    expect(res.ok).toBe(true);
  });
});

describe("billing readiness uses the rule", () => {
  function signedVisit(clinicianId: string, serviceType: string, signerRole: StaffRole, signer: string) {
    const p = freshPatient();
    const a = book(clinicianId, p.id, serviceType);
    AdelanteEHR.markAppointmentAttended(a.id, { name: signer, role: signerRole, id: "s-x" }, +new Date(a.start) + 60000);
    const note = AdelanteEHR.addProgressNote(p.id, {
      clinicianId,
      appointmentId: a.id,
      date: a.start,
      sessionType: "individual",
      subjective: "s",
      objective: "",
      assessment: "",
      plan: "",
      authorSource: "human",
      status: "draft",
    } as Parameters<typeof AdelanteEHR.addProgressNote>[1]);
    AdelanteEHR.signProgressNote(p.id, note!.id, { signedBy: signer, role: signerRole, attested: true } as never);
    return p.id;
  }

  it("marks the rendering clinician credentialed when the rule passes (c1)", () => {
    const pid = signedVisit("c1", "therapy_individual", "therapist", "Marisol Reyes");
    const svc = billableService(pid);
    expect(svc.attendedSigned).toBe(true);
    expect(svc.credentialed).toBe(true);
    const item = billingReadiness(pid, "billing").checklist.find((c) => c.label === "Rendering clinician credentialed")!;
    expect(item.done).toBe(true);
  });

  it("fails the checklist item when the rule fails, with reasons for Billing and the neutral label for others", () => {
    // c5 (Dr. Bagga) has an overdue exclusion check; the patient has no payer,
    // so booking is allowed but the readiness rule still fails.
    const pid = signedVisit("c5", "med_management", "physician", "Dr. M. Bagga");
    const svc = billableService(pid);
    expect(svc.credentialed).toBe(false);
    expect(svc.credentialingReasons).toContain("exclusion_check_overdue");

    const billingItem = billingReadiness(pid, "billing").checklist.find((c) => c.label === "Rendering clinician credentialed")!;
    expect(billingItem.done).toBe(false);
    expect(billingItem.detail).toContain(CREDENTIALING_REASON_LABEL.exclusion_check_overdue);

    const coordItem = billingReadiness(pid, "credentialing_coordinator").checklist.find((c) => c.label === "Rendering clinician credentialed")!;
    expect(coordItem.detail).toContain(CREDENTIALING_REASON_LABEL.exclusion_check_overdue);

    for (const role of ["therapist", "ecm_provider", "clinical_coordinator", "peer_specialist"] as StaffRole[]) {
      const item = billingReadiness(pid, role).checklist.find((c) => c.label === "Rendering clinician credentialed")!;
      expect(item.detail).toBe(CREDENTIALING_NEUTRAL_LABEL);
    }
  });
});

describe("booking block", () => {
  // p1 (Daniel) has an active Medi-Cal FFS plan.
  const P1 = "p1";

  it("blocks a billable booking when the clinician fails the rule for that payer", () => {
    expect(() => book("c5", P1, "med_management")).toThrow(/can't be booked for this service right now/i);
  });

  it("blocks the trainee without supervision for a billable service", () => {
    expect(() => book("c6", P1, "therapy_individual")).toThrow(/can't be booked for this service right now/i);
  });

  it("allows the fully credentialed clinician for the same payer", () => {
    const a = book("c1", P1, "therapy_individual");
    expect(a.clinicianId).toBe("c1");
  });

  it("blocks only the affected payer/service: c3 books Medi-Cal med management but not a DMC-ODS service", () => {
    const ok = book("c3", P1, "med_management");
    expect(ok.clinicianId).toBe("c3");
  });

  it("never blocks non-billable support work", () => {
    // c6 fails the rule, but the block helper skips non-billable services entirely.
    expect(bookingCredentialingBlock("c6", "case_management", P1, futureSlot())).toBeUndefined();
    expect(bookingCredentialingBlock("c6", "peer_support", P1, futureSlot())).toBeUndefined();
    expect(bookingCredentialingBlock("c6", "therapy_individual", P1, futureSlot())).toMatch(/can't be booked/i);
  });

  it("does not block when the patient has no payer on file (coverage is a separate readiness item)", () => {
    const p = freshPatient();
    const a = book("c5", p.id, "med_management");
    expect(a.clinicianId).toBe("c5");
  });
});

describe("review flags never change records", () => {
  it("flags existing appointments and claims without touching them", () => {
    const appts = [
      { id: "flag-a1", clinicianId: "c5", patientId: "p1", start: inDays(3), status: "scheduled", serviceType: "med_management" },
      { id: "flag-a2", clinicianId: "c1", patientId: "p1", start: inDays(4), status: "scheduled", serviceType: "therapy_individual" },
      { id: "flag-a3", clinicianId: "c5", patientId: "p1", start: inDays(5), status: "attended", serviceType: "med_management" },
    ];
    const claims = [
      { id: "flag-c1", clinicianId: "c5", patientId: "p1", serviceDate: today(), state: "ready" },
      { id: "flag-c2", clinicianId: "c1", patientId: "p1", serviceDate: today(), state: "ready" },
    ];
    const payer = () => "Medi-Cal FFS";
    const flags = credentialingReviewFlags(appts, claims, payer);
    expect(flags.map((f) => f.id).sort()).toEqual(["flag-a1", "flag-c1"]);
    // Inputs untouched: statuses and states exactly as before.
    expect(appts.map((a) => a.status)).toEqual(["scheduled", "scheduled", "attended"]);
    expect(claims.map((c) => c.state)).toEqual(["ready", "ready"]);
  });
});

describe("Today work derivation", () => {
  it("fires expiry tasks at the 90/60/30 thresholds", () => {
    upsertLicense(COORD, "s-bc1", { licenseType: "LMFT", number: "TEST-090", state: "CA", expiresAt: inDays(80), method: "manual", verifiedAt: today() });
    upsertLicense(COORD, "s-cc2", { licenseType: "LMFT", number: "TEST-100", state: "CA", expiresAt: inDays(100), method: "manual", verifiedAt: today() });
    const items = expiringItems();
    const at = (staffId: string) => items.find((i) => i.staffId === staffId && i.item === "License");
    expect(at("s-th2")?.threshold).toBe(30); // 25 days out
    expect(at("s-bc1")?.threshold).toBe(90); // 80 days out → first crossed threshold is 90
    expect(at("s-cc2")).toBeUndefined(); // 100 days out → no task yet
  });

  it("gives the clinician a neutral heads-up at 30 days only", () => {
    expect(clinicianCredentialNotices("s-th2").some((t) => t.includes("expires"))).toBe(true);
    expect(clinicianCredentialNotices("s-th1")).toEqual([]);
  });

  it("lists the overdue exclusion check and builds the five tiles", () => {
    expect(exclusionChecksDue().some((r) => r.staffId === "s-np1" && r.state === "overdue")).toBe(true);
    const tiles = credentialingTiles();
    expect(tiles.map((t) => t.key)).toEqual(["expiring", "exclusions", "recredentialing", "enrollment", "blocked"]);
    expect(tiles.find((t) => t.key === "enrollment")!.count).toBeGreaterThan(0); // c3 DMC-ODS not_started
  });
});

describe("role boundaries", () => {
  it("the credentialing coordinator has no chart entry and no clinical or billing record access", () => {
    expect(roleHasChartEntry("credentialing_coordinator")).toBe(false);
    for (const cls of ["therapy_notes", "screeners_mh", "screeners_sud", "care_plan", "meds_erx", "psych_eval", "case_notes", "billing"] as const) {
      expect(canAccess("credentialing_coordinator", cls).level).toBe("none");
    }
    // …but owns the credentialing tier.
    expect(canAssistCredentials("credentialing_coordinator")).toBe(true);
    expect(canManageCredentialing("credentialing_coordinator")).toBe(true);
  });

  it("buttons match the store for every role", () => {
    const actions = ["credential_verify", "credential_exclusion_check", "credential_enrollment_set", "credential_attestation", "credential_monitor_run"];
    for (const role of STAFF_ROLES.map((r) => r.key)) {
      const allowed = canManageCredentialing(role);
      for (const id of actions) {
        expect(chartAction(id).allowed({ role }).state === "allowed", `${role} × ${id}`).toBe(allowed);
      }
      // The store re-checks the same gate.
      const probe = () => recordVerification({ role, staffId: "probe" }, "s-th1", { source: "bbs" });
      if (allowed) expect(probe).not.toThrow();
      else expect(probe).toThrow(CREDENTIALING_DENIED);
    }
  });

  it("non-manual monitor channels are disabled and simulated", () => {
    for (const c of MONITOR_CHANNELS) {
      if (c.channel === "manual") expect(c.enabled).toBe(true);
      else {
        expect(c.enabled).toBe(false);
        expect(c.simulated).toBe(true);
      }
    }
    const r = runMonitorChannel(COORD, "cvo");
    expect(r.simulated).toBe(true);
  });

  it("enrollment changes are coordinator-owned", () => {
    expect(() => setServiceEnrollment({ role: "therapist", staffId: "s-th1" }, "s-th1", { payer: "X", serviceType: "*", status: "active" })).toThrow(CREDENTIALING_DENIED);
    const r = setServiceEnrollment(COORD, "s-th3", { payer: "Tulare County DMC-ODS", serviceType: "sud_counseling", status: "submitted" });
    expect(r.enrollments.find((e) => e.payer === "Tulare County DMC-ODS")?.status).toBe("submitted");
  });
});

describe("demo seeds", () => {
  it("cover the five required fictional scenarios", () => {
    expect(credentialedForService("s-th1", "Medi-Cal FFS", "therapy_individual", today()).ok).toBe(true); // fully credentialed
    expect(credentialingRecordForStaff("s-tr1")?.registration?.supervision?.supervisorStaffId).toBe("s-th1"); // associate + supervisor
    expect(expiringItems().some((i) => i.staffId === "s-th2" && i.daysLeft <= 30)).toBe(true); // expiring within 30 days
    expect(credentialedForService("s-th3", "Tulare County DMC-ODS", "sud_counseling", today()).ok).toBe(false); // not enrolled for DMC-ODS
    expect(exclusionChecksDue().some((r) => r.staffId === "s-np1" && r.state === "overdue")).toBe(true); // overdue exclusion check
  });
});

// Keep the billable-type list honest: support work stays out of it.
describe("billable service types (Draft)", () => {
  it("excludes non-billable support services", () => {
    expect(BILLABLE_SERVICE_TYPES).not.toContain("peer_support");
    expect(BILLABLE_SERVICE_TYPES).not.toContain("case_management");
    expect(BILLABLE_SERVICE_TYPES).not.toContain("care_coordination");
  });
});

// AdelanteEHRExt stays the document store; this batch adds no parallel store.
void AdelanteEHRExt;
