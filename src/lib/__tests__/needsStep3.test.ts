import { describe, it, expect } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, DEMO_PRE_RELEASE_PERSONA } from "@/lib/ehr";
import { patientApptStates, requestToBooked } from "@/lib/apptRequestStatus";
import { roleSeesApptRequest } from "@/components/scheduling/AppointmentRequestsCard";

const PAT = (id: string) => ({ id, role: "patient" });
function slot(daysAhead: number, hour: number) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
const therapist = () =>
  AdelanteEHR.listClinicians().find(
    (c) => (!c.services || c.services.includes("therapy_individual")) && AdelanteEHR.canBook(c.id).ok,
  )!;

describe("needs step 3 — appointment requests", () => {
  it("mental health + medication creates two requests, de-duplicated on repeat", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Req", lastName: "Two" });
    const out = AdelanteEHR.createAppointmentRequests(p.id, { mentalHealth: true, medication: true }, PAT(p.id));
    expect(out.map((o) => o.outcome)).toEqual(["requested", "requested"]);
    const again = AdelanteEHR.createAppointmentRequests(p.id, { mentalHealth: true, medication: true }, PAT(p.id));
    expect(again.every((o) => o.outcome === "already_requested")).toBe(true);
    expect(AdelanteEHR.listAppointmentRequests(p.id)).toHaveLength(2);
  });

  it("an existing scheduled appointment of that type creates nothing", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Req", lastName: "Dup" });
    AdelanteEHR.bookAppointment({ patientId: p.id, clinicianId: therapist().id, start: slot(20, 10), durationMin: 50, serviceType: "therapy_individual", source: "pre_release" });
    const out = AdelanteEHR.createAppointmentRequests(p.id, { mentalHealth: true }, PAT(p.id));
    expect(out[0]!.outcome).toBe("already_scheduled");
    expect(AdelanteEHR.listAppointmentRequests(p.id)).toHaveLength(0);
  });

  it("staff booking from the request closes it and its task", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Req", lastName: "Book" });
    const [o] = AdelanteEHR.createAppointmentRequests(p.id, { mentalHealth: true }, PAT(p.id));
    const req = o!.request!;
    AdelanteEHR.bookAppointment({ patientId: p.id, clinicianId: therapist().id, start: slot(22, 13), durationMin: 50, serviceType: "therapy_individual", requestId: req.id, bookedBy: { id: "Dr. Reyes", role: "therapist" } });
    const after = AdelanteEHR.listAppointmentRequests(p.id)[0]!;
    expect(after.status).toBe("booked");
    expect(after.closedByRole).toBe("therapist");
    expect(AdelanteEHR.listCaseTasks().find((t) => t.id === req.taskId)?.status).toBe("done");
    expect(patientApptStates(AdelanteEHR.getPatient(p.id), AdelanteEHR.appointmentsForPatient(p.id))[0]?.state).toBe("scheduled");
  });

  it("contacted-not-booked requires a reason", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Req", lastName: "NoBook" });
    const [o] = AdelanteEHR.createAppointmentRequests(p.id, { medication: true }, PAT(p.id));
    const by = { id: "s", name: "Staff", role: "therapist" as const };
    expect(() => AdelanteEHR.markAppointmentRequestNotBooked(p.id, o!.request!.id, " ", by)).toThrow();
    AdelanteEHR.markAppointmentRequestNotBooked(p.id, o!.request!.id, "No answer x3", by);
    expect(AdelanteEHR.listAppointmentRequests(p.id)[0]!.status).toBe("contacted_not_booked");
  });

  it("not sure → one help-me-choose request", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Req", lastName: "Unsure" });
    const out = AdelanteEHR.createAppointmentRequests(p.id, { notSure: true, mentalHealth: true }, PAT(p.id));
    expect(out.map((o) => o.kind)).toEqual(["help_choose"]);
  });

  it("SUD request links to the ASAM task, creates no parallel task, and is hidden from case manager", () => {
    const luisId = demoScenarioPatientId("sud_consented")!;
    const req = AdelanteEHR.listAppointmentRequests(luisId).find((r) => r.kind === "sud_assessment")!;
    expect(req).toBeTruthy();
    expect(req.taskId).toBeUndefined();
    expect(req.linkedAsamTaskId).toBeTruthy();
    const luis = AdelanteEHR.getPatient(luisId)!;
    expect(roleSeesApptRequest("therapist", luis, req)).toBe(true);
    expect(roleSeesApptRequest("ecm_provider", luis, req)).toBe(false);
    expect(roleSeesApptRequest("cf_care_manager", luis, req)).toBe(false);
  });

  it("SUD request leaves the linked ASAM task text untouched (no leak to roles that see the task)", () => {
    const luisId = demoScenarioPatientId("sud_consented")!;
    const req = AdelanteEHR.listAppointmentRequests(luisId).find((r) => r.kind === "sud_assessment")!;
    const task = AdelanteEHR.listCaseTasks().find((t) => t.id === req.linkedAsamTaskId);
    expect(task).toBeTruthy();
    expect(`${task!.title} ${task!.detail ?? ""}`.toLowerCase()).not.toContain("appointment");
  });

  it("seeded demo: Elena pending therapy; Carmen already scheduled; Tomás has an arranged visit", () => {
    const elena = AdelanteEHR.getPatient(demoScenarioPatientId("mh_only")!)!;
    expect(patientApptStates(elena, AdelanteEHR.appointmentsForPatient(elena.id))[0]?.state).toBe("requested");
    const carmen = AdelanteEHR.getPatient(demoScenarioPatientId("public_referral")!)!;
    expect(AdelanteEHR.createAppointmentRequests(carmen.id, { mentalHealth: true }, PAT(carmen.id))[0]!.outcome).toBe("already_scheduled");
    expect(AdelanteEHR.listAppointmentRequests(carmen.id)).toHaveLength(0);
    const withSeeking = { ...carmen, seeking: { mentalHealth: true, medication: false, answeredAt: "" } };
    expect(patientApptStates(withSeeking, AdelanteEHR.appointmentsForPatient(carmen.id))[0]?.state).toBe("already_scheduled");
    const tomas = AdelanteEHR.listPatients().find((p) => p.firstName === DEMO_PRE_RELEASE_PERSONA.firstName)!;
    expect(AdelanteEHR.createAppointmentRequests(tomas.id, { mentalHealth: true }, PAT(tomas.id))[0]!.outcome).toBe("already_scheduled");
  });

  it("request → booked reporting excludes SUD and is cohort-guarded", () => {
    const r = requestToBooked(AdelanteEHR.listPatients());
    expect(r.requested).toBeGreaterThan(0);
    expect(r.belowMinimumCohort).toBe(r.requested < 11);
  });
});
