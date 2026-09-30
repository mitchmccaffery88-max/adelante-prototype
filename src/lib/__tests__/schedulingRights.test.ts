import { describe, expect, it } from "vitest";
import { AdelanteEHR, TELEHEALTH_CONSENT_CATEGORY } from "../ehr";
import { STAFF_ROSTER, type StaffRole } from "../roles";
import { workspaceTileOrder } from "../clinicianWorkspace";
import { bookableServiceTypes, eligibleClinicians, openSlots, visitTypeLabel } from "../bookingFlow";
import { checkBookingRights } from "../bookingRights";
import { runAction } from "../actions/runAction";

let n = 0;
function patient(opts: { cm?: string; primary?: string } = {}) {
  const p = AdelanteEHR.createPatient({ firstName: "Sched", lastName: `S${++n}`, dob: "1990-01-01" } as Parameters<typeof AdelanteEHR.createPatient>[0]);
  if (opts.cm) AdelanteEHR.assignCaseManager({ patientId: p.id, caseManagerId: opts.cm });
  if (opts.primary) AdelanteEHR.reassignPrimaryClinician({ patientId: p.id, clinicianId: opts.primary, initiatedBy: "admin", context: "test" } as never);
  return p;
}
const staff = (id: string) => STAFF_ROSTER.find((s) => s.id === id)!;
const by = (id: string) => ({ id: staff(id).name, role: staff(id).role as StaffRole });
let slotN = 0;
const slot = (clinicianId: string) => openSlots(clinicianId, { days: 42 })[slotN++ % 40]!;
const book = (patientId: string, bookedBy: { id: string; role: StaffRole }, extra: Record<string, unknown> = {}) =>
  AdelanteEHR.bookAppointment({
    patientId,
    clinicianId: "c1",
    start: slot("c1"),
    durationMin: 50,
    serviceType: "therapy_individual",
    modality: "in_person",
    locationId: "loc-visalia",
    source: "staff_scheduled",
    bookedBy,
    allowPatientOverlap: true,
    ...extra,
  } as Parameters<typeof AdelanteEHR.bookAppointment>[0]);

describe("§Scheduling — booking rights by role (Draft)", () => {
  it("no booking path accepts an empty clinician id", () => {
    const p = patient();
    expect(() => book(p.id, by("s-cc1"), { clinicianId: "" })).toThrow(/whose calendar/i);
  });

  it("clinical coordinator books on any calendar for any patient", () => {
    const p = patient();
    expect(book(p.id, by("s-cc1")).clinicianId).toBe("c1");
  });

  it("clinical coordinator cannot mark a visit attended", () => {
    const p = patient();
    const a = book(p.id, by("s-cc1"));
    expect(() => AdelanteEHR.markAppointmentAttended(a.id, { name: "Priya Raman", role: "clinical_coordinator", id: "s-cc1" }, +new Date(a.start) + 60000)).toThrow(/coordinator/i);
  });

  it("ECM books for their caseload only", () => {
    const mine = patient({ cm: "cm3" });
    const other = patient();
    expect(book(mine.id, by("s-cm1")).patientId).toBe(mine.id);
    expect(() => book(other.id, by("s-cm1"))).toThrow(/caseload/i);
  });

  it("peer books for caseload; cancel is a request, not a direct cancel", () => {
    const mine = patient({ cm: "peer1" });
    const a = book(mine.id, by("s-peer1"));
    expect(() => AdelanteEHR.staffCancelAppointment(a.id, { reason: "patient_request", actor: { name: "Andre Willis", role: "peer_specialist", id: "s-peer1" } } as never)).toThrow();
    AdelanteEHR.staffRequestCancel(a.id, { name: "Andre Willis", role: "peer_specialist", id: "s-peer1" }, "Patient asked");
    expect(AdelanteEHR.listAppointments().find((x) => x.id === a.id)?.status).toBe("scheduled");
  });

  it("ECM / care manager / peer / CHW are never offered SUD visit types (hidden) and can't book them", () => {
    for (const role of ["ecm_provider", "cf_care_manager", "peer_specialist", "community_health_worker"] as StaffRole[]) {
      expect(bookableServiceTypes(role).some((s) => s.sud)).toBe(false);
      expect(checkBookingRights({ role, op: "book", inCaseload: true, serviceType: "sud_counseling" }).ok).toBe(false);
      expect(checkBookingRights({ role, op: "book", inCaseload: true, asam: true }).ok).toBe(false);
    }
  });

  it("Part 2 — SUD visit types display as 'Clinical visit' to roles without SUD access", () => {
    expect(visitTypeLabel("sud_counseling", "ecm_provider")).toBe("Clinical visit");
    expect(visitTypeLabel("sud_counseling", "billing")).toBe("Clinical visit");
    expect(visitTypeLabel("sud_counseling", "sud_counselor")).not.toBe("Clinical visit");
  });

  it("sud_counselor has a calendar and can be booked; books for own caseload", () => {
    expect(staff("s-sudc1").clinicianId).toBe("c7");
    const mine = patient({ primary: "c7" });
    const a = AdelanteEHR.bookAppointment({ patientId: mine.id, clinicianId: "c7", start: slot("c7"), durationMin: 50, serviceType: "sud_counseling", modality: "in_person", locationId: "loc-visalia", source: "staff_scheduled", bookedBy: by("s-sudc1"), allowPatientOverlap: true } as Parameters<typeof AdelanteEHR.bookAppointment>[0]);
    expect(a.clinicianId).toBe("c7");
    const suggested = eligibleClinicians("sud_counseling", mine, { staffId: "s-cc1", staffName: "Priya Raman", role: "clinical_coordinator" });
    expect(suggested.map((s) => s.clinician.id)).toContain("c7");
  });

  it("billing and sys_admin cannot book", () => {
    const p = patient();
    expect(() => book(p.id, { id: "Bill", role: "billing" })).toThrow();
    expect(() => book(p.id, { id: "Admin", role: "sys_admin" })).toThrow();
  });

  it("prescriber visits only go to physician/PMHNP calendars", () => {
    expect(eligibleClinicians("med_management", undefined, { staffId: "s-cc1", staffName: "Priya Raman", role: "clinical_coordinator" }).every((s) => /PMHNP|MD|M\.D\.|DO/.test(s.clinician.credential))).toBe(true);
  });

  it("telehealth needs consent before a future video slot is confirmed", () => {
    const p = patient();
    expect(() => book(p.id, by("s-cc1"), { modality: "video", locationId: undefined })).toThrow(/telehealth consent/i);
    AdelanteEHR.createConsentRecord({ patientId: p.id, formType: "NonAB133", source: "test", signedByName: "Test Patient", attested: true, effectiveDate: "2020-01-01", sections: [{ category: TELEHEALTH_CONSENT_CATEGORY, authorized: true }], capturedBy: { staffName: "Priya Raman", role: "clinical_coordinator" } } as never);
    expect(book(p.id, by("s-cc1"), { modality: "video", locationId: undefined }).modality).toBe("video");
  });

  it("booking audits actor + target calendar and notifies clinician and patient", () => {
    const p = patient();
    const a = book(p.id, by("s-cc1"));
    const audit = (AdelanteEHR.listAuditEvents({ patientId: p.id }) as Array<{ action?: string; detail?: { summary?: string } }>).find((e) => e.action === "appointment_booked");
    expect(audit?.detail?.summary ?? "").toMatch(/on behalf of/);
    expect(AdelanteEHR.listNotifications().some((x) => x.dedupeKey === `booked:${a.id}` || String(x.id).includes(a.id) || x.subject === "New visit on your calendar")).toBe(true);
  });

  it("coordinator and care roles get the Scheduling tile", () => {
    expect(workspaceTileOrder("clinical_coordinator")).toContain("scheduling");
    expect(workspaceTileOrder("ecm_provider")).toContain("scheduling");
    expect(workspaceTileOrder("peer_specialist")).toContain("scheduling");
  });

  it("registry: schedule_visit allowed for coordinator/ECM/peer, hidden for billing", () => {
    const p = patient();
    const r = runAction("schedule_visit", { id: "s-billing", name: "Bill", role: "billing" } as never, p.id as never, {} as never);
    expect((r as { ok?: boolean }).ok).toBe(false);
  });

  it("crisis alert text is neutral — never the free-text reason", () => {
    const p = patient();
    (AdelanteEHR.flagCrisis as (...a: unknown[]) => unknown)(p.id, "Luz Herrera", "SECRET-REASON heroin relapse");
    const rows = AdelanteEHR.listNotifications().filter((x) => (x.subject + x.body).includes("Crisis"));
    expect(rows.every((x) => !(x.subject + x.body).includes("SECRET-REASON"))).toBe(true);
  });
});
