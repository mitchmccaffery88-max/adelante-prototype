import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { intakeCoveragePatch, mediCalStatusApplies, coverageStatusLabel } from "@/lib/coverageStatus";

const answers = (o: Partial<Parameters<typeof intakeCoveragePatch>[1]> = {}) => ({
  coverageType: "medi_cal" as const,
  mediCalStatus: "active" as const,
  countyOfRelease: "Tulare",
  jiReentryFlag: false,
  justiceInvolvement: "no" as const,
  ecmEligible: false,
  ...o,
});
function pt() {
  return AdelanteEHR.createPatient({ firstName: "T", lastName: `Cov${Math.random()}` } as never).id;
}
const actor = { actorId: "Lupita Sanchez, MSW", actorRole: "ecm_provider" as const };

describe("Phase 8a — coverage integrity", () => {
  it("re-saving intake preserves plans, verifications and flags", () => {
    const id = pt();
    AdelanteEHR.setEcmEligible(id, true, actor);
    AdelanteEHR.setCommunitySupport(id, "housing", true, actor);
    AdelanteEHR.recordCoverageCheck(id, { channel: "phone_county", result: "verified", ...actor });
    AdelanteEHR.addCoveragePlan?.(id, { payer: "Medi-Cal FFS", from: "2025-01-01", source: "staff_checked" } as never);
    const before = AdelanteEHR.getPatient(id)!.coverage!;
    const p = AdelanteEHR.getPatient(id);
    AdelanteEHR.setCoverage(id, intakeCoveragePatch(p?.coverage, answers({ coverageType: "private" })));
    const after = AdelanteEHR.getPatient(id)!.coverage!;
    expect(after.verifications).toEqual(before.verifications);
    expect(after.plans).toEqual(before.plans);
    expect(after.ecmEligible).toBe(true);
    expect(after.communitySupports?.housing).toBe(true);
    expect(after.verified).toBe("verified"); // real check kept
    expect(after.status).toBe(before.status); // non-Medi-Cal type doesn't touch status
  });

  it("audits what changed", () => {
    const id = pt();
    AdelanteEHR.setCoverage(id, intakeCoveragePatch(undefined, answers()));
    const ev = AdelanteEHR.listAuditEvents?.().find((e: { action: string; patientId?: string }) => e.action === "coverage_updated" && e.patientId === id);
    if (AdelanteEHR.listAuditEvents) expect(ev).toBeTruthy();
  });

  it("self-report is never verified", () => {
    const id = pt();
    AdelanteEHR.setCoverage(id, intakeCoveragePatch(undefined, answers({ mediCalStatus: "active" })));
    expect(AdelanteEHR.getPatient(id)!.coverage!.verified).toBe("self_reported");
    AdelanteEHR.setCoverage(id, { verified: "verified" });
    expect(AdelanteEHR.getPatient(id)!.coverage!.verified).toBe("self_reported");
  });

  it("Medi-Cal status only applies to Medi-Cal / dual", () => {
    expect(mediCalStatusApplies("medi_cal")).toBe(true);
    expect(mediCalStatusApplies("dual")).toBe(true);
    for (const t of ["medicare", "private", "self_pay", "unknown"] as const) expect(mediCalStatusApplies(t)).toBe(false);
    const id = pt();
    AdelanteEHR.setCoverage(id, intakeCoveragePatch(undefined, answers({ coverageType: "private", mediCalStatus: "active" })));
    expect(AdelanteEHR.getPatient(id)!.coverage!.status).toBe("not_applicable");
  });

  it("labels an older private + active record honestly", () => {
    expect(coverageStatusLabel({ status: "active", verified: "verified", coverageType: "private" })).toMatch(/older intake — confirm/);
  });
});
