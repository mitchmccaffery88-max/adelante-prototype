import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR, REPORTED_BENEFITS_SOURCES, type ReportedBenefitsSource } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { BILLING_WRITE_REFUSED } from "@/lib/rates";
import { setActingRole, type StaffRole } from "@/lib/roles";
import {
  _resetManagedCarePlans,
  addManagedCarePlan,
  listManagedCarePlans,
  updateManagedCarePlan,
} from "@/lib/managedCarePlans";
import { coverageWorklistRows } from "@/lib/coverageWorklist";
import { partnerBenefitsAnswers, recordIntakeBenefits } from "@/lib/intakeBenefits";
import { previewPreReleaseRoster } from "@/lib/preReleaseRoster";

const pt = () => AdelanteEHR.createPatient({ firstName: "B", lastName: `Ben${Math.random()}` } as never).id;
const cin = () => `9${Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "0")}`;
const who = (source: ReportedBenefitsSource) => ({
  source,
  via: "chart" as const,
  actorId: "s1",
  actorName: "Staff One",
  actorRole: "case_manager",
});
const mediCal = (c?: string) => ({
  coverageType: "medi_cal" as const,
  mediCalStatus: "active" as const,
  ...(c ? { cin: c } : {}),
  managedCarePlan: { id: "mcp-anthem", name: "Anthem Blue Cross", kind: "plan" as const },
});
const row = (id: string) =>
  coverageWorklistRows(AdelanteEHR.listPatients(), AdelanteEHR.listCaseTasks()).find((r) => r.patientId === id);
const tasksFor = (id: string) =>
  AdelanteEHR.listCaseTasks().filter((t) => t.dedupeKey === `payment-arrangement:${id}` && t.status !== "done");

describe("Phase 8b — managed care plan list", () => {
  beforeEach(() => _resetManagedCarePlans());
  it("seeds drafts incl. FFS, Other and I don't know", () => {
    const l = listManagedCarePlans();
    expect(l.every((p) => p.draft)).toBe(true);
    expect(l.map((p) => p.kind)).toEqual(expect.arrayContaining(["ffs", "other", "unknown"]));
  });
  it("billing roles edit, audited; editing clears draft", () => {
    for (const r of ["billing", "billing_coordinator"] as StaffRole[]) {
      setActingRole(r);
      const a = addManagedCarePlan({ name: `Plan ${r}` });
      expect(a.ok).toBe(true);
      const u = updateManagedCarePlan("mcp-kaiser", { name: "Kaiser Permanente (confirmed)" });
      expect(u.ok && u.plan.draft).toBe(false);
    }
    expect(AdelanteEHR.listAuditEvents({}).some((e) => e.action === "managed_care_plan_updated")).toBe(true);
  });
  it("sys admin and clinical roles are refused, nothing changes", () => {
    for (const r of ["sys_admin", "clinician"] as StaffRole[]) {
      setActingRole(r);
      const before = listManagedCarePlans({ includeRetired: true });
      expect(addManagedCarePlan({ name: "X" })).toEqual({ ok: false, error: BILLING_WRITE_REFUSED });
      expect(updateManagedCarePlan("mcp-anthem", { active: false })).toMatchObject({ ok: false });
      expect(listManagedCarePlans({ includeRetired: true })).toEqual(before);
    }
  });
});

describe("Phase 8b — recordIntakeBenefits", () => {
  it("Medi-Cal: CIN to Patient.cin, plan span + reported record, needs verification", () => {
    const id = pt();
    const c = cin();
    const r = recordIntakeBenefits(id, mediCal(c), who("patient_reported"));
    expect(r).toMatchObject({ ok: true, cinWritten: true, planSpanAdded: true, verificationAdded: true });
    const p = AdelanteEHR.getPatient(id)!;
    expect(p.cin).toBe(c);
    expect(JSON.stringify(p.coverage)).not.toContain(c); // no second CIN field
    expect(p.coverage!.plans![0]).toMatchObject({ source: "patient_reported", managedCarePlanId: "mcp-anthem", managedCarePlanName: "Anthem Blue Cross" });
    expect(p.coverage!.verifications![0]).toMatchObject({ channel: "reported", result: "pending", reportSource: "patient_reported" });
    expect(p.coverage!.verified).toBe("self_reported");
    expect(row(id)?.state).toBe("needs_verification");
  });

  it.each(REPORTED_BENEFITS_SOURCES)("source %s lands on span, record and audit, never a check", (source) => {
    const id = pt();
    recordIntakeBenefits(id, mediCal(), who(source));
    const cov = AdelanteEHR.getPatient(id)!.coverage!;
    expect(cov.plans![0]!.source).toBe(source);
    expect(cov.verifications![0]!.reportSource).toBe(source);
    expect(cov.verified).not.toBe("verified");
    const ev = AdelanteEHR.listAuditEvents({ patientId: id }).find((e) => e.action === "intake_benefits_recorded");
    expect(JSON.stringify(ev?.detail)).toContain(source);
    expect(row(id)?.state).toBe("needs_verification");
    expect(row(id)?.lastCheck).toBeUndefined();
  });

  it("never-checked outranks needs-verification", () => {
    const a = pt();
    const b = pt();
    recordIntakeBenefits(b, mediCal(), who("patient_reported"));
    const rows = coverageWorklistRows(AdelanteEHR.listPatients(), AdelanteEHR.listCaseTasks());
    expect(rows.findIndex((r) => r.patientId === a)).toBeLessThan(rows.findIndex((r) => r.patientId === b));
  });

  it("re-running doesn't duplicate plan spans, records or tasks", () => {
    const id = pt();
    recordIntakeBenefits(id, mediCal(), who("patient_reported"));
    recordIntakeBenefits(id, mediCal(), who("patient_reported"));
    const cov = AdelanteEHR.getPatient(id)!.coverage!;
    expect(cov.plans!.length).toBe(1);
    expect(cov.verifications!.length).toBe(1);
    const n = pt();
    const ans = { coverageType: "self_pay" as const, nonMediCalReport: "no_insurance" as const };
    recordIntakeBenefits(n, ans, who("patient_reported"));
    recordIntakeBenefits(n, ans, who("staff_recorded_patient_report"));
    expect(tasksFor(n).length).toBe(1);
  });

  it("non-Medi-Cal: one billing task for billing roles, never sets the arrangement", () => {
    const id = pt();
    const r = recordIntakeBenefits(id, { coverageType: "private", nonMediCalReport: "private_insurance", planName: "Blue Shield" }, who("patient_reported"));
    expect(r.taskId).toBeTruthy();
    const t = tasksFor(id);
    expect(t.length).toBe(1);
    expect(t[0]!.allowedRoles).toEqual(expect.arrayContaining(["billing", "billing_coordinator"]));
    const p = AdelanteEHR.getPatient(id)!;
    expect(p.paymentArrangement).toBeUndefined();
    expect(p.coverage!.plans![0]!.payer).toBe("Blue Shield");
    expect(p.coverage!.verifications ?? []).toHaveLength(0);
    setActingRole("billing");
    AdelanteEHRExt.setPaymentArrangement(id, "sliding_fee");
    expect(tasksFor(id).length).toBe(0);
  });

  it("existing CIN is never overwritten", () => {
    const id = pt();
    const c1 = cin();
    recordIntakeBenefits(id, mediCal(c1), who("patient_reported"));
    const r = recordIntakeBenefits(id, mediCal(cin()), who("referrer_reported"));
    expect(r.cinMismatch).toBe(true);
    expect(AdelanteEHR.getPatient(id)!.cin).toBe(c1);
  });

  it("a staff check still outranks reports; staff check can't use the reported channel", () => {
    const id = pt();
    expect(AdelanteEHR.recordCoverageCheck(id, { channel: "reported", result: "verified", actorId: "x", actorRole: "case_manager" }).ok).toBe(false);
    recordIntakeBenefits(id, mediCal(), who("patient_reported"));
    AdelanteEHR.recordCoverageCheck(id, { channel: "phone_county", result: "verified", actorId: "x", actorRole: "case_manager" });
    expect(row(id)?.state).toBe("current");
  });
});

describe("Phase 8b — pre-release columns", () => {
  it("validates cin and coverage_type per row", () => {
    const csv = [
      "first_name,last_name,dob,anticipated_release_date,cin,coverage_type",
      "A,One,1990-01-01,2099-01-01,91234567A,medi_cal",
      "B,Two,1990-01-01,2099-01-01,123,medi_cal",
      "C,Three,1990-01-01,2099-01-01,,gold_plan",
      "D,Four,1990-01-01,2099-01-01,,",
    ].join("\n");
    const pv = previewPreReleaseRoster(csv, []);
    expect(pv.candidates.map((c) => c.lastName)).toEqual(["One", "Four"]);
    expect(pv.candidates[0]).toMatchObject({ cin: "91234567A", coverageType: "medi_cal" });
    expect(pv.rejections.length).toBe(2);
  });
  it("partner answers invent no Medi-Cal status", () => {
    expect(partnerBenefitsAnswers("medi_cal", "91234567A")).toEqual({ coverageType: "medi_cal", cin: "91234567A" });
  });
});
