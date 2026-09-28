// §Chart redesign turn 1 — the action registry must agree with what the store
// actually allows. For every role × action with a role-checked store call we
// ATTEMPT the call and compare: a role refusal must match "hidden".
import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, refillNeedsCures, type Patient } from "@/lib/ehr";
import { STAFF_ROLES, canAccess, canFlagCrisis, CRISIS_FLAG_ROLES, type StaffRole } from "@/lib/roles";
import { CHART_ACTIONS, chartActionState } from "@/lib/chartActions";
import { roleSeesAsamSection, SUD_MED_WITHHELD_ROLES } from "@/lib/asamReporting";
import { addStructuredGoal } from "@/lib/structuredCarePlan";
import { createHlocReferral, dischargeEpisode } from "@/lib/outpatientCare";
import { logContact } from "@/lib/caseloadReview";

const ROLES = STAFF_ROLES.map((r) => r.key);
const ROLE_REFUSAL =
  /only|your role|role can't|role does not|can't (change|edit)|prescriber|case managers/i;

function attempt(fn: () => unknown): "allowed" | "refused" {
  try {
    fn();
    return "allowed";
  } catch (e) {
    return ROLE_REFUSAL.test(String((e as Error).message)) ? "refused" : "allowed";
  }
}

const luis = (): Patient => AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
const jordan = (): Patient => AdelanteEHR.getPatient(demoScenarioPatientId("sud_no_consent")!)!;

// Each probe calls the real store function with deliberately invalid
// non-role input where possible, so an allowed role hits a validation error
// (not a role error) and nothing is written.
const PROBES: Record<string, (role: StaffRole, p: Patient) => unknown> = {
  demographics_edit: (role, p) =>
    AdelanteEHR.updatePatientDemographics(p.id, { firstName: `${p.firstName}X` }, { name: "Probe", role }, ""),
  cures: (role, p) =>
    AdelanteEHR.recordCuresCheck(p.id, (p.orders ?? [])[0]?.id ?? "none", {
      checkedAt: "",
      result: "no_concerns",
      by: "Probe",
      role,
    }),
  // Approve a CURES-required refill with no CURES record: prescribers hit
  // the CURES blocker (validation), everyone else the prescriber-only rule.
  refill_decision: (role) => {
    const r = AdelanteEHR.listRefillRequests().find((x) => refillNeedsCures(x) && !x.curesCheck);
    if (!r) throw new Error("no probe refill");
    return AdelanteEHR.reviewRefill({ id: r.id, decision: "approved", actorRole: role });
  },
  care_plan_goal: (role, p) =>
    addStructuredGoal({ patientId: p.id, owner: "clinician" as never, measure: "", clinicalText: "", actor: { name: "Probe", role } }),
  hloc_referral: (role, p) =>
    createHlocReferral({
      patientId: p.id,
      target: "residential",
      reason: "",
      urgency: "routine",
      destination: "",
      outsideSudProvider: false,
      actor: { name: "Probe", role },
    }),
  discharge_episode: (role, p) =>
    dischargeEpisode({ patientId: p.id, reason: "x" as never, summary: "", actor: { name: "Probe", role }, confirmCancelVisits: false }),
  contact_log: (role, p) => logContact({ role } as never, { patientId: p.id, type: "zz" as never, date: "" }),
};

describe("chart action registry ↔ store consistency", () => {
  it("covers every required action", () => {
    const ids = CHART_ACTIONS.map((a) => a.id);
    for (const id of [
      "progress_note", "addendum", "med_order", "refill_decision", "cures", "lab_order", "screener_request",
      "asam", "care_plan_goal", "activity_assignment", "sdoh_referral", "hloc_referral", "schedule_visit",
      "message_patient", "task", "document_upload", "consent_capture", "contact_log", "crisis_flag",
      "discharge_episode", "demographics_edit",
    ])
      expect(ids).toContain(id);
  });

  for (const [id, probe] of Object.entries(PROBES)) {
    it(`${id}: registry answer matches the store for every role`, () => {
      const p = luis();
      for (const role of ROLES) {
        const reg = chartActionState(id, { role }, p).state === "hidden" ? "refused" : "allowed";
        expect({ role, id, result: attempt(() => probe(role, p)) }).toEqual({ role, id, result: reg });
      }
    });
  }

  it("ASAM follows roleSeesAsamSection on both consented and unconsented patients", () => {
    for (const p of [luis(), jordan()])
      for (const role of ROLES)
        if (!roleSeesAsamSection(role, p)) expect(chartActionState("asam", { role }, p).state).toBe("hidden");
  });

  it("matrix screeners_sud never grants a role that roleSeesAsamSection hides (with consent)", () => {
    const p = luis();
    for (const role of ROLES) {
      const a = canAccess(role, "screeners_sud", p);
      // ECM / coordinator / billing are withheld on top of the matrix (kept
      // consent_gated for Part 2 message masking — earlier product decision).
      if (SUD_MED_WITHHELD_ROLES.includes(role)) continue;
      if (a.level !== "none" && !a.locked) expect({ role, sees: roleSeesAsamSection(role, p) }).toEqual({ role, sees: true });
    }
  });

  it("matrix demographics write equals the demographics editor list", () => {
    const p = luis();
    for (const role of ROLES) {
      const matrixWrite = canAccess(role, "demographics", p).level === "write";
      expect({ role, w: matrixWrite }).toEqual({ role, w: chartActionState("demographics_edit", { role }, { ...p, primaryClinicianId: undefined }).state !== "hidden" });
    }
  });

  it("matrix care_plan write equals the care plan edit rule", () => {
    for (const role of ROLES) {
      const matrixWrite = canAccess(role, "care_plan").level === "write";
      expect({ role, w: matrixWrite }).toEqual({ role, w: chartActionState("care_plan_goal", { role }).state !== "hidden" });
    }
  });
});

describe("CURES — prescribers only", () => {
  it("only physician and PMHNP can record CURES", () => {
    for (const role of ROLES)
      expect({ role, ok: chartActionState("cures", { role }).state === "allowed" }).toEqual({
        role,
        ok: role === "physician" || role === "pmhnp",
      });
  });
  it("store refuses sys_admin", () => {
    const p = luis();
    expect(() => PROBES.cures("sys_admin", p)).toThrow(/prescriber/i);
  });
});

describe("crisis flag — every patient-contact role", () => {
  const expected: StaffRole[] = [
    "physician", "pmhnp", "therapist", "clinical_trainee", "sud_counselor", "peer_specialist",
    "community_health_worker", "ecm_provider", "cf_care_manager", "clinical_coordinator",
  ];
  it("lists exactly the patient-contact roles", () => {
    expect([...CRISIS_FLAG_ROLES].sort()).toEqual([...expected].sort());
  });
  it("billing and sys_admin cannot raise a flag", () => {
    for (const role of ["billing", "billing_coordinator", "sys_admin"] as StaffRole[]) {
      expect(canFlagCrisis(role)).toBe(false);
      expect(chartActionState("crisis_flag", { role }).state).toBe("hidden");
    }
  });
});

describe("sections with nothing to do are hidden", () => {
  // Mirrors useRecordSections: visible when the role can view (not locked) OR act.
  const visible = (role: StaffRole, cls: Parameters<typeof canAccess>[1], sectionId: string, p: Patient) => {
    const a = canAccess(role, cls, p);
    return (a.level !== "none" && !a.locked) || CHART_ACTIONS.some(
      (x) => x.sectionId === sectionId && !x.pending && x.allowed({ role }, p).state !== "hidden",
    );
  };
  it("billing sees no Tasks section; sys_admin and peer see no Eligibility", () => {
    const p = luis();
    expect(visible("billing", "case_notes", "tasks", p)).toBe(false);
    expect(visible("sys_admin", "eligibility", "eligibility", p)).toBe(false);
    expect(visible("peer_specialist", "eligibility", "eligibility", p)).toBe(false);
  });
  it("ECM provider keeps Tasks and Eligibility (she writes both) but never ASAM", () => {
    const p = luis();
    expect(visible("ecm_provider", "case_notes", "tasks", p)).toBe(true);
    expect(visible("ecm_provider", "eligibility", "eligibility", p)).toBe(true);
    expect(roleSeesAsamSection("ecm_provider", p)).toBe(false);
  });
});
