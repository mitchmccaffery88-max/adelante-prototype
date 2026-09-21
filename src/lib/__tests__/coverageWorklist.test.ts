import { describe, expect, it } from "vitest";
import {
  COVERAGE_STALENESS_DRAFT,
  coverageCheckState,
  coverageWorklistRows,
  coverageWorklistSummary,
} from "../coverageWorklist";
import { AdelanteEHR, type CaseTask, type Patient } from "../ehr";

const NOW = +new Date("2026-09-21T00:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();

function patient(over: Partial<Patient> & { id: string; firstName: string }): Patient {
  return {
    programId: `PRG-${over.id}`,
    lastName: "Test",
    ...over,
  } as Patient;
}

describe("coverage staleness thresholds", () => {
  it("treats a check inside one eligibility month as current", () => {
    expect(coverageCheckState(daysAgo(10), NOW).state).toBe("current");
  });
  it("flags due at 30 days and overdue at 60", () => {
    expect(coverageCheckState(daysAgo(COVERAGE_STALENESS_DRAFT.dueDays), NOW).state).toBe("due");
    expect(coverageCheckState(daysAgo(COVERAGE_STALENESS_DRAFT.overdueDays), NOW).state).toBe(
      "overdue",
    );
  });
  it("calls a missing check never_checked, not current", () => {
    expect(coverageCheckState(undefined, NOW).state).toBe("never_checked");
  });
});

describe("coverageWorklistRows", () => {
  const rows = () =>
    coverageWorklistRows(
      [
        patient({ id: "a", firstName: "Ana", coverage: { status: "active", verified: "pending" } as never }),
        patient({
          id: "b",
          firstName: "Ben",
          coverage: {
            status: "active",
            verified: "verified",
            countyOfRelease: "Tulare",
            verifications: [
              {
                id: "v1",
                checkedAt: daysAgo(90),
                checkedBy: "Luz Herrera",
                checkedByRole: "ecm_provider",
                channel: "phone_county",
                result: "verified",
                cinOnFile: true,
              },
            ],
          } as never,
        }),
        patient({
          id: "c",
          firstName: "Cruz",
          coverage: {
            status: "active",
            verified: "verified",
            verifications: [
              {
                id: "v2",
                checkedAt: daysAgo(2),
                checkedBy: "Luz Herrera",
                checkedByRole: "ecm_provider",
                channel: "medi_cal_portal",
                result: "verified",
                cinOnFile: true,
              },
            ],
          } as never,
        }),
      ],
      [
        {
          id: "t1",
          patientId: "b",
          title: "Medi-Cal reactivation — follow up with county",
          taskType: "medi_cal_reactivation",
          dueDate: "2026-09-24",
          status: "open",
        } as unknown as CaseTask,
        {
          id: "t2",
          patientId: "b",
          title: "done one",
          taskType: "benefitscal_enrollment",
          status: "done",
        } as unknown as CaseTask,
      ],
      NOW,
    );

  it("orders never-checked first, then oldest check", () => {
    expect(rows().map((r) => r.patientId)).toEqual(["a", "b", "c"]);
    expect(rows()[0]?.state).toBe("never_checked");
    expect(rows()[1]?.state).toBe("overdue");
    expect(rows()[2]?.state).toBe("current");
  });

  it("carries open Phase 3a follow-ups with their due dates and drops completed ones", () => {
    const b = rows().find((r) => r.patientId === "b")!;
    expect(b.openFollowUps).toHaveLength(1);
    expect(b.openFollowUps[0]?.dueDate).toBe("2026-09-24");
  });

  it("summarises the scoped rows", () => {
    const s = coverageWorklistSummary(rows());
    expect(s).toMatchObject({ total: 3, neverChecked: 1, overdue: 1, current: 1, openFollowUps: 1 });
  });

  it("runs against the real seeded store", () => {
    const live = coverageWorklistRows();
    expect(live.length).toBe(AdelanteEHR.listPatients().length);
  });
});
