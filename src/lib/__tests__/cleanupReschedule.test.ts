import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AdelanteEHR, type ServiceType } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { ADVOCATE_ACTOR_ROLE, PATIENT_ACTOR_ROLE, patientBookableClinicians, patientSelfBook, patientSlots } from "@/lib/patientBooking";
import { dmcOdsExportRows, exportDmcOdsCsv, ASAM_CLINICAL_COLUMNS, exportColumnsFor } from "@/lib/dmcOdsReadiness";

const SVC: ServiceType = "therapy_individual";
const actionEvents = () => AdelanteEHR.listAuditEvents({ category: "action" });

function bookFor(patientId: string) {
  const p = AdelanteEHR.getPatient(patientId)!;
  const opt = patientBookableClinicians(p, SVC, "in_person").find((o) => patientSlots(o.clinician.id, SVC, "in_person").length > 2)!;
  const slots = patientSlots(opt.clinician.id, SVC, "in_person");
  const loc = AdelanteEHR.locationsForService(SVC)[0]?.id;
  const appt = patientSelfBook({ patientId, clinicianId: opt.clinician.id, start: slots[0], serviceType: SVC, modality: "in_person", locationId: loc });
  return { appt, clinicianId: opt.clinician.id };
}

function advocateLink(type: "hipaa_authorization" | "conservatorship", n: number) {
  const patient = AdelanteEHR.createPatient({ firstName: "Ana", lastName: `Resched_${n}` });
  const invite = AdelanteEHR.createAdvocateInvitation({
    patientId: patient.id, advocateName: "Rosa Ibarra", relationship: "Sister",
    invitationSentTo: `rosa-rs-${n}@example.org`, invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({ code: invite.invitationCode, authorizationType: type, attestedName: "Rosa Ibarra" });
  if (type === "conservatorship") AdelanteEHR.recordAdvocateConservatorshipDocs(invite.id, { verifiedBy: "Val Ortiz", courtOrderRef: `TCSC-RS-${n}` });
  return { patient, linkId: invite.id };
}

describe("Cleanup 1 — reschedule on the booking engine", () => {
  it("patient reschedule runs through runAction and writes the standard audit event", () => {
    const { appt, clinicianId } = bookFor("p1");
    const next = patientSlots(clinicianId, SVC, "in_person", appt.id).find((s) => s !== appt.start)!;
    const before = actionEvents().length;
    const p = AdelanteEHR.getPatient("p1")!;
    const r = runAction("patient_reschedule", { role: PATIENT_ACTOR_ROLE, staffId: p.id, staffName: "Patient (self)" }, p, { args: [{ patientId: p.id, apptId: appt.id, start: next }] });
    expect(r.ok).toBe(true);
    expect(actionEvents().length).toBe(before + 1);
    expect(AdelanteEHR.listAppointments().find((a) => a.id === appt.id)!.start).toBe(next);
  });

  it("patient reschedule to a time outside real availability is refused", () => {
    const { appt } = bookFor("p1");
    const p = AdelanteEHR.getPatient("p1")!;
    const r = runAction("patient_reschedule", { role: PATIENT_ACTOR_ROLE, staffId: p.id, staffName: "x" }, p, { args: [{ patientId: p.id, apptId: appt.id, start: "2030-01-06T03:00:00.000Z" }] });
    expect(r.ok).toBe(false);
  });

  it("advocate tier is enforced: HIPAA-only refused, conservator allowed", () => {
    const hip = advocateLink("hipaa_authorization", 1);
    const con = advocateLink("conservatorship", 2);
    for (const l of [hip, con]) {
      const { appt, clinicianId } = bookFor(l.patient.id);
      const next = patientSlots(clinicianId, SVC, "in_person", appt.id).find((s) => s !== appt.start)!;
      const r = runAction("advocate_reschedule", { role: ADVOCATE_ACTOR_ROLE, staffId: l.linkId, staffName: "Advocate" }, l.patient, { args: [{ linkId: l.linkId, apptId: appt.id, start: next }] });
      expect(r.ok).toBe(l === con);
    }
  });

  it("no UI path calls the raw reschedule store functions", () => {
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const full = join(d, f);
        if (statSync(full).isDirectory()) { if (f !== "__tests__") walk(full); continue; }
        if (!/\.tsx?$/.test(f)) continue;
        const src = readFileSync(full, "utf8");
        if (/AdelanteEHR\.(rescheduleAppointment|advocateRescheduleAppointment)\(/.test(src)) offenders.push(full);
      }
    };
    walk("src/routes");
    walk("src/components");
    expect(offenders).toEqual([]);
  });
});

describe("Cleanup 2 — narrow reporting-only export", () => {
  it("billing coordinator export has no ASAM signature or medical-necessity columns", () => {
    const cols = exportColumnsFor("billing_coordinator");
    for (const c of ASAM_CLINICAL_COLUMNS) expect(cols).not.toContain(c);
    for (const r of dmcOdsExportRows("billing_coordinator") ?? []) for (const c of ASAM_CLINICAL_COLUMNS) expect(r).not.toHaveProperty(c);
    const out = exportDmcOdsCsv({ staffId: "s-bc1", role: "billing_coordinator" });
    expect(out!.csv.split("\n")[0]).not.toMatch(/ASAM version|signature|LPHA|Medical necessity/);
    expect(out!.file).toContain("Draft — Christi to confirm required fields");
  });
  it("roles passing roleSeesAsam keep the full export", () => {
    expect(exportColumnsFor("sud_counselor")).toContain("ASAM version");
  });
});
