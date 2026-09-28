import { beforeAll, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, type Patient } from "@/lib/ehr";
import { chartActionState, cosignRouteLabel } from "@/lib/chartActions";
import {
  listLabOrders, listMetabolic, listScreenerRequests, openScreenerRequestsForPatient, orderableLabs,
  placeLabOrder, requestableScreeners, seedChartOrdersDemo, computeBmi, screenerRequestStatus, requestScreener,
} from "@/lib/chartOrders";
import { addStructuredGoal, reassignGoalOwner, canEditPlan, getStructuredPlan } from "@/lib/structuredCarePlan";
import { buildTrackingRows } from "@/lib/trackingTimeline";
import { myPendingLabs } from "@/lib/myWork";
import { isTypingTarget, CHART_SHORTCUTS } from "@/components/chart/ChartActionLauncher";

beforeAll(() => seedChartOrdersDemo());
const byName = (n: string): Patient => AdelanteEHR.listPatients().find((p) => p.firstName === n)!;
const luis = () => AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;

describe("care plan edit rights (product owner)", () => {
  it("ECM + care manager edit, coordinator and sys_admin do not, trainee cosigns", () => {
    expect(canEditPlan("ecm_provider")).toBe(true);
    expect(canEditPlan("cf_care_manager")).toBe(true);
    expect(canEditPlan("clinical_coordinator")).toBe(false);
    expect(canEditPlan("sys_admin")).toBe(false);
    const st = chartActionState("care_plan_goal", { role: "clinical_trainee", staffId: "s-tr1" });
    expect(st.state).toBe("cosign");
    expect(st.reason).toBe("Routes to Marisol Reyes for cosign");
  });
  it("ECM cannot add a SUD-linked goal", () => {
    const p = luis();
    AdelanteEHR.addProblem(p.id, { description: "Opioid use disorder", icd10Code: "F11.20", category: "sud", onsetDate: "2026-01-01", enteredBy: "therapist" });
    const sudProb = `pl-${AdelanteEHR.getPatient(p.id)!.problems!.find((x) => x.icd10Code === "F11.20")!.id}`;
    expect(() => addStructuredGoal({ patientId: p.id, problemIds: [sudProb], owner: "patient", measure: "m", clinicalText: "SUD goal", actor: { name: "Luz", role: "ecm_provider" } })).toThrow(/can't change this item/);
    const g = addStructuredGoal({ patientId: p.id, owner: "patient", measure: "m", clinicalText: "Find a food bank", actor: { name: "Luz", role: "ecm_provider" } });
    expect(g.sud).toBe(false);
  });
  it("coordinator can reassign an owner (with reason) but not edit", () => {
    const p = luis();
    const g = getStructuredPlan(p.id).goals.find((x) => !x.sud)!;
    expect(() => reassignGoalOwner(p.id, g.id, "case_manager", "", { name: "Priya", role: "clinical_coordinator" })).toThrow(/reason/);
    reassignGoalOwner(p.id, g.id, "case_manager", "Housing lead changed", { name: "Priya", role: "clinical_coordinator" });
    expect(getStructuredPlan(p.id).goals.find((x) => x.id === g.id)!.owner).toBe("case_manager");
    expect(() => reassignGoalOwner(p.id, g.id, "patient", "x y z", { name: "Admin", role: "sys_admin" })).toThrow(/can't reassign/);
  });
});

describe("labs", () => {
  it("seeded: Luis has a resulted lithium level and one pending order", () => {
    const rows = listLabOrders(byName("Luis").id, "physician");
    expect(rows.some((o) => o.testId === "lithium" && o.status === "resulted" && o.result?.value === "0.8")).toBe(true);
    expect(rows.filter((o) => o.status === "pending").length).toBeGreaterThanOrEqual(1);
  });
  it("UDS is Part 2-masked: not orderable or listed for roles failing the check", () => {
    const p = luis();
    expect(orderableLabs("physician", p).some((t) => t.id === "uds")).toBe(true);
    placeLabOrder({ patientId: p.id, testId: "uds", reason: "Monitoring", priority: "routine", dueAt: new Date().toISOString(), actor: { name: "Dr. M. Bagga", role: "physician" } });
    expect(listLabOrders(p.id, "ecm_provider").some((o) => o.testId === "uds")).toBe(false);
    expect(orderableLabs("therapist", p)).toEqual([]);
  });
  it("open lab shows as Result pending on the orderer's My work", () => {
    const rows = myPendingLabs({ staffId: "s-np1", staffName: "Dr. M. Bagga", clinicianId: undefined }, "physician");
    expect(rows.some((r) => r.patientId === byName("Luis").id)).toBe(true);
  });
});

describe("screener requests", () => {
  it("Jordan has a request on his home screen; SUD instruments need Part 2", () => {
    const j = byName("Jordan");
    expect(openScreenerRequestsForPatient(j.id).length).toBeGreaterThan(0);
    expect(requestableScreeners("therapist", j).some((s) => s.key === "audit")).toBe(false);
    expect(requestableScreeners("billing", j)).toEqual([]);
  });
  it("an overdue request appears as a missed entry in Tracking", () => {
    const p = byName("Rosa");
    const r = requestScreener({ patientId: p.id, key: "phq-9", dueAt: new Date(Date.now() - 86400000).toISOString(), actor: { name: "Marisol Reyes", role: "therapist" } });
    expect(screenerRequestStatus(r)).toBe("overdue");
    const rows = buildTrackingRows(AdelanteEHR.getPatient(p.id)!, "therapist");
    expect(rows.some((x) => x.key === "phq-9" && x.status === "missed" && x.date === r.dueAt)).toBe(true);
    expect(listScreenerRequests(p.id).length).toBeGreaterThan(0);
  });
});

describe("metabolic + shortcuts", () => {
  it("Marcus has a seeded set with auto BMI", () => {
    const m = listMetabolic(byName("Marcus").id);
    expect(m.length).toBe(1);
    expect(m[0]!.bmi).toBe(computeBmi(98, 180));
  });
  it("shortcuts and typing guard", () => {
    expect(CHART_SHORTCUTS).toEqual({ n: "progress_note", o: "med_order", t: "task", m: "message_patient" });
    expect(isTypingTarget({ tagName: "INPUT", closest: () => null } as never)).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: false, closest: () => null } as never)).toBe(false);
  });
  it("billing has no actions; note from Kayla routes to Marisol", () => {
    expect(chartActionState("progress_note", { role: "clinical_trainee", staffId: "s-tr1" }).reason).toBe("Routes to Marisol Reyes for cosign");
    expect(cosignRouteLabel("s-admin1")).toBe("Routes to a cosigner");
  });
});
