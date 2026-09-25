// §Phase 10d-1 — ASAM clinical worklists and reporting.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import "@/lib/ehr-ext";
import {
  asamClinicalReport,
  asamLevelHistory,
  asamTaskRows,
  myAsamWork,
  roleSeesAsam,
} from "@/lib/asamReporting";
import { MIN_COHORT_SIZE } from "@/lib/cohortGuard";

const THERAPIST = { role: "therapist" as const, staffId: "s-th1", staffName: "Dr. Marisol Reyes", clinicianId: "c1" };
const COUNSELOR = { role: "sud_counselor" as const, staffId: "s-sudc1", staffName: "Renee Castillo" };

describe("10d-1 Part 2 visibility", () => {
  it("hides (null, not zero) for roles that fail the Part 2 check", () => {
    for (const role of ["billing", "advocate"] as const) {
      if (roleSeesAsam(role as never)) continue;
      expect(asamClinicalReport(role as never)).toBeNull();
      expect(asamTaskRows(role as never)).toBeNull();
    }
    expect(asamClinicalReport("billing")).toBeNull();
  });

  it("case manager sees no ASAM row for a patient without Part 2 consent", () => {
    const jordan = demoScenarioPatientId("sud_no_consent")!;
    const rows = asamTaskRows("ecm_provider") ?? [];
    expect(rows.some((r) => r.patientId === jordan)).toBe(false);
    expect((asamTaskRows("therapist") ?? []).some((r) => r.patientId === jordan)).toBe(true);
  });
});

describe("10d-1 worklists and report", () => {
  it("shows the seeded overdue task (Marcus) and a due task (Daniel)", () => {
    const rows = asamTaskRows("therapist")!;
    expect(rows.find((r) => r.patientId === "p3")?.state).toBe("overdue");
    expect(rows.some((r) => r.patientId === "p1")).toBe(true);
  });

  it("reports the recommended ≠ actual difference with its reason", () => {
    const r = asamClinicalReport("therapist")!;
    const d = r.differences.find((x) => x.reason === "Level not available");
    expect(d).toBeTruthy();
    expect(d!.recommended).not.toBe(d!.actual);
  });

  it("carries the cohort guard caveat below 11", () => {
    const r = asamClinicalReport("therapist")!;
    expect(r.guard.minimumCohortSize).toBe(MIN_COHORT_SIZE);
    expect(r.guard.belowMinimumCohort).toBe(true);
  });

  it("lists Jasmine's counselor draft as awaiting cosign", () => {
    const jasmine = demoScenarioPatientId("combination")!;
    const mine = myAsamWork(COUNSELOR)!;
    expect(mine.myDraftsAwaitingCosign.some((c) => c.patientId === jasmine)).toBe(true);
    const lpha = myAsamWork(THERAPIST)!;
    expect(lpha.cosignsForMe.some((c) => c.patientId === jasmine)).toBe(true);
    expect(mine.cosignsForMe).toHaveLength(0);
  });

  it("level history keeps both signed versions of Luis in order", () => {
    const luis = AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
    const h = asamLevelHistory("therapist", luis)!;
    expect(h.map((x) => x.version)).toEqual([1, 2]);
    expect(h[1]!.amendsId).toBe(h[0]!.asamId);
    expect(h[1]!.recommended).toBeTruthy();
    expect(asamLevelHistory("billing", luis)).toBeNull();
  });

  it("an amendment does not bill a second H0001", () => {
    const luis = AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
    const v2 = luis.asamAssessments!.find((a) => a.version === 2)!;
    expect(v2.outputs?.claimId).toBeUndefined();
  });
});

describe("10d-1 amendment reassessment clock", () => {
  it("Luis has exactly one open reassessment task after the amendment", () => {
    const id = demoScenarioPatientId("sud_consented")!;
    const open = AdelanteEHR.listCaseTasks().filter(
      (t) => t.patientId === id && t.dedupeKey?.startsWith("asam-reassess:") && t.status !== "done",
    );
    expect(open).toHaveLength(1);
  });
  it("clinical coordinator gets totals only (draft access rule), never unconsented names", () => {
    const r = asamClinicalReport("clinical_coordinator")!;
    expect(r.mode).toBe("totals");
    const therapist = asamClinicalReport("therapist")!;
    expect(r.tasks.length).toBe(therapist.tasks.length);
    const jordan = demoScenarioPatientId("sud_no_consent")!;
    expect(r.tasks.some((t) => t.patientId === jordan)).toBe(false);
    for (const t of r.tasks) {
      if (!t.patientId) continue;
      expect(AdelanteEHR.isConsentCategoryAuthorized(t.patientId, "sud_treatment")).toBe(true);
    }
  });
});
