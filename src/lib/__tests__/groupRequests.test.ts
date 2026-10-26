// 26 Oct (Mitch) — group join rules, per-type requirements, routing and decisions.
import { describe, expect, it } from "vitest";
import "@/lib/chartActions";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import {
  DEMO_GROUP_TOPICS,
  GROUP_DECISION_MESSAGES,
  REQUIREMENTS,
  groupRequestReview,
  patientGroupCatalog,
  routeGroupRequest,
} from "@/lib/groupRequests";

const group = (topic: string) => AdelanteEHR.listGroupSessions().find((g) => g.topic === topic)!;
const stress = () => group(DEMO_GROUP_TOPICS.stress);
const sud = () => group(DEMO_GROUP_TOPICS.sud);
const reentry = () => group(DEMO_GROUP_TOPICS.reentry);
const self = (pid: string) => ({ role: "patient" as StaffRole, staffId: pid, staffName: "Patient (self)" });
const staffFor = (pred: (s: (typeof STAFF_ROSTER)[number]) => boolean) => STAFF_ROSTER.find((s) => s.active !== false && pred(s))!;
const actorOf = (s: (typeof STAFF_ROSTER)[number]) => ({ role: s.role, staffId: s.id, staffName: s.name });
const row = (pid: string, id: string) => patientGroupCatalog(pid).find((r) => r.group.id === id);
const run = (id: string, actor: ReturnType<typeof actorOf>, ...args: unknown[]) => runAction(id, actor, undefined, { args: [actor, ...args], auditReason: String(args[args.length - 1]) });

/** A patient with an assigned care manager and primary clinician. */
const PID = "p-demo-refusal";
const cm = () => staffFor((s) => s.caseManagerId === AdelanteEHR.getPatient(PID)!.caseManagerId);
const clinician = () => staffFor((s) => s.clinicianId === AdelanteEHR.getPatient(PID)!.primaryClinicianId);

describe("group roster rules", () => {
  it("seeds the three example groups with join rules, audiences and billable flag", () => {
    expect([stress().joinRule, stress().audiences, stress().billable]).toEqual(["open", [], true]);
    expect([sud().joinRule, sud().audiences, sud().billable]).toEqual(["care_team_approval", ["sud"], true]);
    expect([reentry().joinRule, reentry().audiences]).toEqual(["invite_only", ["justice_involved"]]);
  });

  it("visibility follows audience; invite-only never shows to the patient", () => {
    const mh = demoScenarioPatientId("mh_only")!;
    const ids = patientGroupCatalog(mh).map((r) => r.group.id);
    expect(ids).toContain(stress().id);
    expect(ids).not.toContain(sud().id);
    expect(ids).not.toContain(reentry().id);
    const sp = demoScenarioPatientId("sud_consented")!;
    expect(patientGroupCatalog(sp).some((r) => r.group.id === sud().id)).toBe(true);
  });

  it("open + requirements met is Join; missing eligibility or approval group is Ask to join", () => {
    expect(row("p1", stress().id)?.action).toBe("join"); // p1 is group-eligible, in person
    expect(row("p2", stress().id)?.action).toBe("ask"); // eligibility cleared
    const sp = demoScenarioPatientId("sud_consented")!;
    expect(row(sp, sud().id)?.action).toBe("ask");
  });

  it("the patient never sees which clinical or Part 2 requirement is missing", () => {
    for (const pid of ["p2", demoScenarioPatientId("sud_consented")!, demoScenarioPatientId("sud_no_consent")!])
      for (const r of patientGroupCatalog(pid))
        for (const need of r.selfNeeds) expect(REQUIREMENTS[need].kind).toBe("self");
  });

  it("Join enrolls directly; invite-only groups cannot be requested", () => {
    const j = runAction("patient_group_join", self("p1"), undefined, { args: [self("p1"), "p1", stress().id] });
    expect(j.ok).toBe(true);
    expect(AdelanteEHR.groupsForPatient("p1").some((g) => g.id === stress().id)).toBe(true);
    const a = runAction("patient_group_ask", self("p1"), undefined, { args: [self("p1"), "p1", reentry().id] });
    expect(a.ok).toBe(false);
    expect(() => AdelanteEHR.requestJoinGroup({ sessionId: reentry().id, patientId: "p1" })).toThrow(/invitation/);
  });
});

describe("routing and decisions", () => {
  it("SUD request routes to care manager and clinician; skills request to care manager only", () => {
    expect(routeGroupRequest(sud(), PID).staff.map((s) => s.id).sort()).toEqual([cm().id, clinician().id].sort());
    expect(routeGroupRequest(stress(), PID).staff.map((s) => s.id)).toEqual([cm().id]);
    const r = AdelanteEHR.requestJoinGroup({ sessionId: stress().id, patientId: PID });
    expect(r.routing?.lane).toBe("care_team");
    const t = AdelanteEHR.listCaseTasks().find((x) => x.id === r.routing!.taskIds[0])!;
    expect(t.title).toBe(`Group request: ${DEMO_GROUP_TOPICS.stress} — check and decide`);
  });

  it("no one assigned: Intake when intake is open, clinical coordinator otherwise", () => {
    const withRef = AdelanteEHR.listReferrals().find((r) => r.enrolledPatientId && !AdelanteEHR.getPatient(r.enrolledPatientId)?.caseManagerId && !AdelanteEHR.getPatient(r.enrolledPatientId)?.primaryClinicianId)!;
    const a = routeGroupRequest(stress(), withRef.enrolledPatientId!);
    expect(a.lane).toBe("intake");
    expect(a.staff[0]!.role).toBe("intake_coordinator");
    const b = routeGroupRequest(stress(), demoScenarioPatientId("sud_consented")!);
    expect(b.lane).toBe("clinical_coordinator");
    expect(b.staff[0]!.role).toBe("clinical_coordinator");
  });

  it("only a clinician can approve when clinical approval is required", () => {
    const r = AdelanteEHR.requestJoinGroup({ sessionId: sud().id, patientId: PID });
    const ecm = staffFor((s) => s.role === "ecm_provider");
    const res = run("group_request_approve", actorOf(ecm), r.id, "Looks right for them");
    expect(res.ok).toBe(false);
    const review = groupRequestReview(r.id, "ecm_provider")!;
    expect(review.clinicianRequired).toBe(true);
    expect(review.requirements.filter((x) => REQUIREMENTS[x.id].kind === "part2").every((x) => x.status === "locked")).toBe(true);
  });

  it("care manager approves a non-clinical group and the patient gets a portal message", () => {
    const r = AdelanteEHR.listGroupJoinRequests({ patientId: PID, status: "pending" }).find((x) => x.sessionId === stress().id)!;
    if (!AdelanteEHR.isGroupEligible(PID)) AdelanteEHR.setGroupEligibility({ patientId: PID, reason: "test", role: "therapist", actor: "Dr. Test" });
    const res = run("group_request_approve", actorOf(cm()), r.id, "Space and forms on file");
    expect(res.ok).toBe(true);
    expect(AdelanteEHR.listMemberNotifications("patient", PID).some((n) => n.body === GROUP_DECISION_MESSAGES.approved.en)).toBe(true);
    for (const id of r.routing!.taskIds) expect(AdelanteEHR.listCaseTasks().find((t) => t.id === id)?.status).toBe("done");
  });

  it("Not right now and Needs something first message the patient", () => {
    const r1 = AdelanteEHR.requestJoinGroup({ sessionId: sud().id, patientId: PID });
    const n = run("group_request_needs_first", actorOf(clinician()), r1.id, "confidentiality_form", "Needs the form");
    expect(n.ok ? "ok" : n.reason).toBe("ok");
    expect(AdelanteEHR.listMemberNotifications("patient", PID).some((x) => x.body === GROUP_DECISION_MESSAGES.needs_first.en)).toBe(true);
    const d = run("group_request_not_now", actorOf(clinician()), r1.id, "Individual sessions first");
    expect(d.ok).toBe(true);
    expect(AdelanteEHR.listMemberNotifications("patient", PID).some((x) => x.body === GROUP_DECISION_MESSAGES.not_now.en)).toBe(true);
  });

  it("care-team on-behalf request uses the same item, attributed to staff; outsiders refused", () => {
    const res = run("group_request_staff", actorOf(cm()), PID, reentry().id, "Invite to cohort");
    expect(res.ok).toBe(true);
    const r = AdelanteEHR.listGroupJoinRequests({ patientId: PID, status: "pending" }).find((x) => x.sessionId === reentry().id)!;
    expect(r.requestedBy?.staffId).toBe(cm().id);
    const other = staffFor((s) => s.role === "therapist" && !!s.clinicianId && s.clinicianId !== AdelanteEHR.getPatient(PID)!.primaryClinicianId && s.caseManagerId !== AdelanteEHR.getPatient(PID)!.caseManagerId);
    expect(run("group_request_staff", actorOf(other), PID, stress().id, "Not mine").ok).toBe(false);
    const ev = AdelanteEHR.listAuditEvents({ category: "clinical" }).find((e) => e.action === "group_join_requested" && (e.detail as Record<string, unknown>).requestId === r.id)!;
    expect(ev.actorId).toBe(cm().id);
  });
});
