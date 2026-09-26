import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import "@/lib/ehr-ext";
import { ASAM_DIMENSIONS, type AsamAssessment } from "@/lib/asam";
import { attestationStatement, buildAttestationRecord } from "@/lib/attestation";
import { asamClinicalReport } from "@/lib/asamReporting";
import { patientFirstVisit } from "@/lib/apptRequestStatus";
import { roleWorksAsamTask, LEGAL_REASON_NOTICE } from "@/components/clinical/AsamTaskWorkItem";

const REYES = { staffId: "s-th1", name: "Dr. Marisol Reyes", role: "therapist" as const, clinicianId: "c1" };
const BY = { id: "Dr. Marisol Reyes", role: "therapist" };
const ATT = { attested: true, signatureDataUrl: "data:image/png;base64,dGVzdA==" };

let n = 0;
function fresh(part2 = true) {
  const p = AdelanteEHR.createPatient({ firstName: "Visit", lastName: `V${++n}`, dob: "1990-01-01" } as Parameters<
    typeof AdelanteEHR.createPatient
  >[0]);
  AdelanteEHR.completeIntake(p.id, {
    needs: { housing: false, food: false, employment: false, transport: false },
    hipaa: true,
    part2Sud: part2,
  });
  AdelanteEHR.requestAsamAssessment(p.id, "Selected substance use treatment at intake", { asamReason: "self_family" });
  return { p, task: AdelanteEHR.openAsamTask(p.id)! };
}
const clinician = () => AdelanteEHR.listClinicians().find((c) => AdelanteEHR.canBook(c.id).ok)!;
let h = 8;
function slot(daysAhead: number) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(8 + (h++ % 9), 0, 0, 0);
  return d.toISOString();
}
const book = (patientId: string, taskId: string, days = 30 + n) =>
  AdelanteEHR.bookAppointment({
    patientId,
    clinicianId: clinician().id,
    start: slot(days),
    durationMin: 60,
    serviceType: "intake",
    modality: "video",
    asamTaskId: taskId,
    bookedBy: BY,
    allowPatientOverlap: true,
  });

describe("ASAM task — the single work item for the substance-use path", () => {
  it("booking from the task links the visit but never closes the task", () => {
    const { p, task } = fresh();
    expect(AdelanteEHR.asamVisitState(task.id).state).toBe("not_scheduled");
    const a = book(p.id, task.id);
    expect(a.asamTaskId).toBe(task.id);
    expect(AdelanteEHR.openAsamTask(p.id)?.id).toBe(task.id);
    expect(AdelanteEHR.asamVisitState(task.id)).toMatchObject({ state: "scheduled", apptId: a.id });
    expect(AdelanteEHR.listAppointmentRequests(p.id)).toHaveLength(0);
  });

  it("a role failing the Part 2 check cannot book against the task", () => {
    const { p, task } = fresh();
    expect(() =>
      AdelanteEHR.bookAppointment({
        patientId: p.id, clinicianId: clinician().id, start: slot(40), durationMin: 60, serviceType: "intake",
        modality: "video", asamTaskId: task.id, bookedBy: { id: "Luz", role: "ecm_provider" },
      }),
    ).toThrow(/Part 2/);
  });

  it("signing the ASAM closes the task", () => {
    const { p, task } = fresh();
    book(p.id, task.id);
    const d = AdelanteEHR.saveAsamDraft(
      p.id,
      {
        dimensions: ASAM_DIMENSIONS.map((x) => ({ key: x.key, documentation: "Documented.", rating: 1 as const })),
        recommendedLevel: "outpatient",
        actualLevel: "outpatient",
        diagnosisCodes: ["F10.20"],
      } as Partial<AsamAssessment>,
      REYES,
    );
    AdelanteEHR.signAsam(p.id, d.id, REYES, buildAttestationRecord({ statement: attestationStatement("asam_sign"), draft: ATT, signedBy: REYES.name }));
    expect(AdelanteEHR.openAsamTask(p.id)).toBeUndefined();
    expect(AdelanteEHR.listCaseTasks().find((t) => t.id === task.id)?.status).toBe("done");
  });

  it("a no-show or cancellation puts the task back to 'not yet scheduled' (missed date shown)", () => {
    const { p, task } = fresh();
    const a = book(p.id, task.id);
    AdelanteEHR.updateAppointmentStatus(a.id, "no_show");
    const s = AdelanteEHR.asamVisitState(task.id);
    expect(s.state).toBe("not_scheduled");
    expect(s.state === "not_scheduled" && s.missedOn).toBe(a.start);
    expect(AdelanteEHR.openAsamTask(p.id)?.id).toBe(task.id);
    const b = book(p.id, task.id, 60);
    AdelanteEHR.updateAppointmentStatus(b.id, "cancelled");
    expect(AdelanteEHR.asamVisitState(task.id).state).toBe("not_scheduled");
  });

  it("task title/detail never contain appointment or reason details", () => {
    const { p, task } = fresh();
    book(p.id, task.id);
    AdelanteEHR.setAsamReason(task.id, "legal", { name: REYES.name, role: "therapist" });
    const t = AdelanteEHR.listCaseTasks().find((x) => x.id === task.id)!;
    const text = `${t.title} ${t.detail ?? ""}`.toLowerCase();
    for (const w of ["appointment", "visit", "legal", "court", "attorney", "dmv", "insurance", "self or family"]) {
      expect(text).not.toContain(w);
    }
    expect(t.asamReason).toBe("legal");
  });

  it("reason is set only by ASAM-authorized roles; justice involvement never sets legal", () => {
    const { p, task } = fresh();
    expect(() => AdelanteEHR.setAsamReason(task.id, "legal", { name: "Luz", role: "ecm_provider" })).toThrow(/Part 2/);
    AdelanteEHR.setJusticeSelfReport(p.id, { arrestsPast12Months: 2, timeInCustodyMonths: 3, recordedBy: p.id });
    expect(AdelanteEHR.openAsamTask(p.id)?.asamReason).toBe("self_family");
  });

  it("legal reason: consent notice and on-file check (Marcus seeded: consent needed)", () => {
    expect(LEGAL_REASON_NOTICE).toMatch(/42 CFR Part 2 consent/);
    const marcus = AdelanteEHR.openAsamTask("p3")!;
    expect(marcus.asamReason).toBe("legal");
    expect(AdelanteEHR.hasLegalDisclosureConsent("p3")).toBe(false);
  });

  it("seeded demo: Luis visit scheduled + linked; Jordan not yet scheduled; roles", () => {
    const luisId = demoScenarioPatientId("sud_consented")!;
    const lt = AdelanteEHR.openAsamWorkTask(luisId)!;
    expect(AdelanteEHR.asamVisitState(lt.id).state).toBe("scheduled");
    expect(patientFirstVisit(lt, AdelanteEHR.asamVisitState(lt.id))?.state).toBe("scheduled");
    const jordanId = demoScenarioPatientId("sud_no_consent");
    if (jordanId) {
      const jt = AdelanteEHR.openAsamTask(jordanId)!;
      expect(AdelanteEHR.asamVisitState(jt.id).state).toBe("not_scheduled");
    }
    const luis = AdelanteEHR.getPatient(luisId)!;
    expect(roleWorksAsamTask("therapist", luis)).toBe(true);
    expect(roleWorksAsamTask("ecm_provider", luis)).toBe(false);
    expect(roleWorksAsamTask("cf_care_manager", luis)).toBe(false);
  });

  it("reporting: counts by reason and visit scheduled vs not", () => {
    const r = asamClinicalReport("therapist")!;
    expect(r.byReason.find((x) => x.key === "legal")!.count).toBeGreaterThanOrEqual(1);
    expect(r.visitScheduled).toBeGreaterThanOrEqual(1);
    expect(r.visitNotScheduled).toBeGreaterThanOrEqual(1);
    expect(asamClinicalReport("ecm_provider")).toBeNull();
  });
});
