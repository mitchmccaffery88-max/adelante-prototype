import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { AdelanteEHR } from "@/lib/ehr";
import { setActingRole } from "@/lib/roles";
import { checkEligibility } from "@/lib/eligibility/eligibility";
import { mockAdapter } from "@/lib/eligibility/__mocks__/mockAdapter";
import { listManagedCarePlans } from "@/lib/managedCarePlans";
import { coverageWorklistRows } from "@/lib/coverageWorklist";
import { verificationSourceLabel } from "@/lib/verificationSource";
import { recordIntakeBenefits } from "@/lib/intakeBenefits";

const pt = () => AdelanteEHR.createPatient({ firstName: "E", lastName: `El${Math.random()}` } as never).id;
const actor = { actorId: "s-el", actorName: "Elig Tester", actorRole: "ecm_provider" as const };
const apply = async (id: string, kind: Parameters<typeof mockAdapter>[0]) => {
  const r = await mockAdapter(kind).send270({ patientId: id, firstName: "E", lastName: "L", serviceDate: "2026-09-24" });
  return AdelanteEHR.applyEligibilityResponse(id, r, { ...actor, planList: listManagedCarePlans() });
};
const row = (id: string) =>
  coverageWorklistRows(AdelanteEHR.listPatients(), AdelanteEHR.listCaseTasks()).find((r) => r.patientId === id);

describe("Phase 8c — electronic eligibility", () => {
  it("stub returns not_connected, audits, writes no record", () => {
    setActingRole("ecm_provider");
    const id = pt();
    const r = checkEligibility(id);
    expect(r.status).toBe("not_connected");
    expect(AdelanteEHR.getPatient(id)!.coverage?.verifications ?? []).toHaveLength(0);
    expect(AdelanteEHR.listAuditEvents({ patientId: id }).some((e) => e.action === "eligibility_check_attempted")).toBe(true);
  });

  it("mock active response fills every field end to end and counts as verified", async () => {
    const id = pt();
    AdelanteEHR.setCin?.(id, "91111111A");
    const r = await apply(id, "active");
    expect(r).toMatchObject({ ok: true, spanAction: "added" });
    const cov = AdelanteEHR.getPatient(id)!.coverage!;
    const v = cov.verifications![0]!;
    expect(v.channel).toBe("electronic_270_271");
    expect(v.result).toBe("verified");
    expect(v.electronic).toMatchObject({
      transactionId: "MOCK-TRN-0001",
      rawResponseRef: "mock://271/0001",
      responseStatus: "active",
      benefits: { aidCode: "1H", shareOfCostCents: 25000, coverageStart: "2026-09-01", payerId: "MCAL-CA", managedCarePlan: { matchedListId: "mcp-anthem" } },
    });
    expect(JSON.stringify(v)).not.toContain("ISA*"); // pointer only, no payload
    expect(cov.plans![0]).toMatchObject({ source: "electronic_270_271", aidCode: "1H", shareOfCostCents: 25000, managedCarePlanId: "mcp-anthem", from: "2026-09-01" });
    expect(cov.verified).toBe("verified");
    expect(row(id)?.state).not.toBe("never_checked");
    expect(row(id)?.state).not.toBe("needs_verification");
    const ev = AdelanteEHR.listAuditEvents({ patientId: id }).find((e) => e.action === "electronic_eligibility_applied");
    expect(ev?.detail).toMatchObject({ vendor: "MOCK", transactionId: "MOCK-TRN-0001", spanAction: "added", actorName: "Elig Tester" });
  });

  it("repeat active response updates the open span instead of duplicating", async () => {
    const id = pt();
    await apply(id, "active");
    const r = await apply(id, "active");
    expect(r.spanAction).toBe("updated");
    expect(AdelanteEHR.getPatient(id)!.coverage!.plans!.length).toBe(1);
    expect(AdelanteEHR.getPatient(id)!.coverage!.verifications!.length).toBe(2);
  });

  it("unmatched plan keeps the name, flags it, and never edits the list", async () => {
    const id = pt();
    const before = listManagedCarePlans({ includeRetired: true }).length;
    await apply(id, "active_unlisted");
    const span = AdelanteEHR.getPatient(id)!.coverage!.plans![0]!;
    expect(span).toMatchObject({ payer: "Sunrise Community Plan", planNotOnList: true });
    expect(span.managedCarePlanId).toBeUndefined();
    expect(listManagedCarePlans({ includeRetired: true }).length).toBe(before);
  });

  it.each(["not_found", "error"] as const)("%s never clears a CIN or closes a span; one follow-up task", async (kind) => {
    const id = pt();
    recordIntakeBenefits(id, { coverageType: "medi_cal", cin: "92222222B", mediCalStatus: "active", managedCarePlan: { id: "mcp-anthem", name: "Anthem Blue Cross", kind: "plan" } }, { source: "patient_reported", via: "chart", actorId: "x", actorName: "X", actorRole: "patient" });
    const before = AdelanteEHR.getPatient(id)!;
    const plansBefore = JSON.stringify(before.coverage!.plans);
    const r1 = await apply(id, kind);
    await apply(id, kind);
    const after = AdelanteEHR.getPatient(id)!;
    expect(after.cin).toBe("92222222B");
    expect(JSON.stringify(after.coverage!.plans)).toBe(plansBefore);
    expect(after.coverage!.verifications!.length).toBe(3); // reported + two electronic, none erased
    expect(r1.taskId).toBeTruthy();
    expect(AdelanteEHR.listCaseTasks().filter((t) => t.dedupeKey === `eligibility-electronic:${id}` && t.status !== "done")).toHaveLength(1);
    if (kind === "error") expect(after.coverage!.verifications![0]!.electronic?.errorReason).toContain("AAA 42");
  });

  it("the manual check form can't use the electronic or reported channels", () => {
    const id = pt();
    for (const channel of ["electronic_270_271", "reported"] as const)
      expect(AdelanteEHR.recordCoverageCheck(id, { channel, result: "verified", actorId: "x", actorRole: "ecm_provider" }).ok).toBe(false);
  });

  it("source labels for reported, staff and electronic", async () => {
    const id = pt();
    recordIntakeBenefits(id, { coverageType: "medi_cal", mediCalStatus: "active" }, { source: "referrer_reported", via: "referral_conversion", actorId: "x", actorName: "X", actorRole: "ecm_provider" });
    AdelanteEHR.recordCoverageCheck(id, { channel: "phone_county", result: "verified", actorId: "x", actorRole: "ecm_provider" });
    await apply(id, "active");
    const labels = AdelanteEHR.getPatient(id)!.coverage!.verifications!.map(verificationSourceLabel);
    expect(labels[0]).toBe("Electronic 270/271 · active");
    expect(labels[1]).toMatch(/^Staff check · Phone/);
    expect(labels[2]).toMatch(/not verified$/);
  });

  it("the mock adapter is not imported by any app file", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        if (statSync(full).isDirectory()) {
          if (f === "__tests__" || f === "__mocks__") continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(f) && readFileSync(full, "utf8").includes("mockAdapter")) hits.push(full);
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});

describe("8b follow-up — worklist: reported not Medi-Cal", () => {
  it("is its own state, not never-checked, and a Medi-Cal report moves it back", () => {
    const id = pt();
    recordIntakeBenefits(id, { coverageType: "self_pay", nonMediCalReport: "no_insurance" }, { source: "patient_reported", via: "chart", actorId: "x", actorName: "X", actorRole: "patient" });
    expect(row(id)?.state).toBe("not_medi_cal_reported");
    recordIntakeBenefits(id, { coverageType: "medi_cal", mediCalStatus: "active" }, { source: "patient_reported", via: "chart", actorId: "x", actorName: "X", actorRole: "patient" });
    expect(row(id)?.state).toBe("needs_verification");
  });
});
