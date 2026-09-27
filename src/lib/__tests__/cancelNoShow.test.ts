import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import "@/lib/demoInboxSeed";
import { appointmentOutcomes } from "@/lib/apptRequestStatus";
import { isLateCancelWindow } from "@/lib/lateCancel";
import { SchedulingConstraints } from "@/lib/scheduling";

const reyes = { name: "Dr. Marisol Reyes", role: "therapist" as const, id: "s-th1" };
const clin = () => AdelanteEHR.listClinicians().find((c) => AdelanteEHR.canBook(c.id).ok)!;
const book = (pid: string, hoursFromNow: number, extra: Record<string, unknown> = {}) => {
  const d = new Date(Date.now() + hoursFromNow * 3600000);
  d.setMinutes(Math.floor(Math.random() * 59), 0, 0);
  return AdelanteEHR.bookAppointment({ patientId: pid, clinicianId: clin().id, start: d.toISOString(), durationMin: 30, serviceType: "therapy_individual", modality: "video", allowPatientOverlap: true, ...extra });
};

describe("cancel & no-show", () => {
  it("patient request → pending → staff confirm cancels, attributed and audited", () => {
    const a = book("p1", 24 * 5);
    AdelanteEHR.patientRequestCancel("p1", a.id, "work");
    expect(a.cancelRequest?.status).toBe("pending");
    expect(a.status).toBe("scheduled");
    AdelanteEHR.resolveCancelRequest(a.id, "confirm", reyes);
    expect(a.status).toBe("cancelled");
    expect(a.cancellation).toMatchObject({ reason: "patient_request", byName: reyes.name, fromRequest: true, lateCancel: false });
    expect(AdelanteEHR.listAuditEvents().some((e: { action: string; detail?: unknown }) => e.action === "appointment_cancelled" && (e.detail as { apptId?: string })?.apptId === a.id)).toBe(true);
  });
  it("staff cancel requires a reason; other requires a note; late cancel uses the 24h check", () => {
    const a = book("p1", 5);
    expect(() => AdelanteEHR.staffCancelAppointment(a.id, { reason: "" as never, actor: reyes })).toThrow();
    expect(() => AdelanteEHR.staffCancelAppointment(a.id, { reason: "other", actor: reyes })).toThrow();
    AdelanteEHR.staffCancelAppointment(a.id, { reason: "clinician_unavailable", actor: reyes });
    expect(a.cancellation?.lateCancel).toBe(true);
    expect(SchedulingConstraints.isLateCancel(a.start, a.cancellation!.at)).toBe(isLateCancelWindow(a.start, a.cancellation!.at));
  });
  it("no-show only on past scheduled visits; never creates a claim", () => {
    const fut = book("p1", 48);
    expect(() => AdelanteEHR.markAppointmentNoShow(fut.id, reyes)).toThrow();
    const past = book("p1", -30);
    AdelanteEHR.markAppointmentNoShow(past.id, reyes);
    expect(past.status).toBe("no_show");
    expect(() => AdelanteEHRExt.upsertClaimFromEncounter(past.id)).toThrow();
  });
  it("a visit with a claim cannot be flipped to cancelled", () => {
    const past = book("p1", -50);
    AdelanteEHR.updateAppointmentStatus(past.id, "attended");
    expect(() => AdelanteEHR.updateAppointmentStatus(past.id, "cancelled")).toThrow(/claim/);
  });
  it("seeded: Luis's ASAM-linked no-show returns the task to not scheduled with the missed date", () => {
    const luis = AdelanteEHR.listPatients().find((p) => p.firstName === "Luis")!;
    const t = AdelanteEHR.openAsamWorkTask(luis.id)!;
    const v = AdelanteEHR.asamVisitState(t.id);
    expect(v.state).toBe("not_scheduled");
    expect((v as { missedOn?: string }).missedOn).toBeTruthy();
  });
  it("cancel-request notifications never name the visit type", () => {
    const rows = AdelanteEHR.listNotifications().filter((n) => n.category === "appointment_cancel_request");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((n) => !/asam|assessment|substance|intake/i.test(n.subject + n.body))).toBe(true);
  });
  it("reporting counts no-shows, cancels and late cancels", () => {
    const r = appointmentOutcomes(AdelanteEHR.listAppointments(), 30);
    expect(r.noShows).toBeGreaterThan(0);
    expect(r.lateCancels).toBeGreaterThan(0);
    expect(r.pendingCancelRequests).toBeGreaterThan(0);
  });
  it("advocate thread seeded only through upload + staff verification", async () => {
    const { ensureAdvocateMessagingDemo } = await import("@/lib/demoInboxSeed");
    const inv = AdelanteEHR.createAdvocateInvitation({ patientId: "p1", advocateName: "Test Adv", relationship: "Family", invitationSentTo: "a@example.com", invitationChannel: "email", designatedBy: { actor: "patient", name: "t" } });
    const link = AdelanteEHR.claimAdvocateInvitation({ code: inv.invitationCode, authorizationType: "family_participation", attestedName: "Test Adv" });
    ensureAdvocateMessagingDemo(link.id);
    const row = AdelanteEHR.listAdvocateLinks().find((l) => l.id === link.id)!.documentRequirements!.find((r) => r.key === "hipaa_roi_communication")!;
    expect(row.status).toBe("verified");
    expect(row.verifiedBy).toBe("Luz Herrera");
    expect(AdelanteEHR.listAuditEvents().some((e: { action: string; detail?: unknown }) => e.action === "document_verified")).toBe(true);
  });
});
