import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { visibleGroupJoinRequests, patientGroupLabel } from "@/lib/groupJoinView";

const T = { name: "Dr. Test", role: "therapist" as const };
const ECM = { name: "Luz Herrera", role: "ecm_provider" as const };
const groups = () => AdelanteEHR.listGroupSessions();
const skills = () => groups().find((g) => g.category === "skills_education")!;
const virtual = () => groups().find((g) => g.modality === "video")!;
const sud = () => groups().find((g) => g.category === "sud_clinical_preauth")!;
const audit = (action: string) =>
  AdelanteEHR.listAuditEvents({ category: "clinical" }).filter((e) => e.action === action);

describe("group join requests", () => {
  it("demo seed: pending, approved, declined and blocked", () => {
    const all = AdelanteEHR.listGroupJoinRequests();
    expect(all.some((r) => r.status === "pending" && !r.protected && !r.lastBlocked)).toBe(true);
    expect(all.some((r) => r.status === "approved")).toBe(true);
    expect(all.some((r) => r.status === "declined" && r.declineReason)).toBe(true);
    expect(all.some((r) => r.status === "pending" && r.lastBlocked)).toBe(true);
    expect(audit("group_join_approval_blocked").length).toBeGreaterThan(0);
  });

  it("request → approve sets eligibility and enrolls; audited", () => {
    const pid = demoScenarioPatientId("mh_only")!;
    const r = AdelanteEHR.requestJoinGroup({ sessionId: skills().id, patientId: pid, note: "hi" });
    expect(r.status).toBe("pending");
    AdelanteEHR.approveGroupJoinRequest(r.id, T);
    expect(AdelanteEHR.isGroupEligible(pid)).toBe(true);
    expect(AdelanteEHR.groupsForPatient(pid).some((g) => g.id === skills().id)).toBe(true);
    expect(audit("group_join_approved").some((e) => e.patientId === pid)).toBe(true);
  });

  it("virtual group approval blocked without telehealth consent", () => {
    const pid = demoScenarioPatientId("medication")!;
    const r = AdelanteEHR.requestJoinGroup({ sessionId: virtual().id, patientId: pid });
    expect(() => AdelanteEHR.approveGroupJoinRequest(r.id, T)).toThrow(/telehealth consent/);
    expect(AdelanteEHR.listGroupJoinRequests({ patientId: pid })[0]!.status).toBe("pending");
  });

  it("decline needs a reason; roles outside the eligibility roles refused", () => {
    const pid = demoScenarioPatientId("ji_self_report")!;
    const r = AdelanteEHR.requestJoinGroup({ sessionId: skills().id, patientId: pid });
    expect(() => AdelanteEHR.declineGroupJoinRequest(r.id, " ", T)).toThrow(/reason/);
    expect(() =>
      AdelanteEHR.approveGroupJoinRequest(r.id, { name: "x", role: "medical_assistant" }),
    ).toThrow();
    AdelanteEHR.declineGroupJoinRequest(r.id, "Not a fit yet", T);
    expect(audit("group_join_declined").some((e) => e.patientId === pid)).toBe(true);
  });

  it("SUD group request is masked for ECM without consent and not reviewable by ECM", () => {
    const pid = demoScenarioPatientId("sud_no_consent")!;
    const r = AdelanteEHR.requestJoinGroup({ sessionId: sud().id, patientId: pid });
    expect(r.protected).toBe(true);
    const ecm = visibleGroupJoinRequests("ecm_provider");
    expect(ecm.rows.some((x) => x.id === r.id)).toBe(false);
    expect(ecm.hidden).toBeGreaterThan(0);
    expect(visibleGroupJoinRequests("therapist").rows.some((x) => x.id === r.id)).toBe(true);
    expect(() => AdelanteEHR.approveGroupJoinRequest(r.id, ECM)).toThrow();
    expect(patientGroupLabel(sud())).toBe("Substance use support group");
    const ev = audit("group_join_requested").find((e) => e.patientId === pid)!;
    expect((ev.detail as Record<string, unknown>).topic).toBeUndefined();
  });
});
