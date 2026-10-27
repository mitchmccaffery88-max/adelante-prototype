import { describe, expect, it } from "vitest";
import { STAFF_ROLES, canAccess, type StaffRole } from "@/lib/roles";
import { chartAction, PUBLIC_WEBSITE_ACTIONS } from "@/lib/chartActions";
import { runAction } from "@/lib/actions/runAction";
import { permissionMatrix } from "@/lib/actions/permissionMatrix";
import { AdelanteEHR } from "@/lib/ehr";
import { intakeReferrals } from "@/lib/intakeWorkspace";
import { canSubmitReferral, submitWebsiteReferral, REFERRAL_SUBMIT_DENIED } from "@/lib/website/publicReferral";
import { canUseSignup, signupActor } from "@/lib/website/signupStore";
import { canSubmitWebsiteIntake } from "@/lib/website/websiteInbox";
import { canReportPublicResource } from "@/lib/website/publicResourceReports";

const input = () => ({ firstName: "FictionalReferral", lastName: "SubmissionTest", dob: "1990-01-01", email: "fictional@example.invalid", referrerName: "Fictional Referrer", referringAgency: "Fictional Agency", referralSource: "other" as const, consentToContact: false, channel: "staff" as const });
const gates = { website_referral_submit: canSubmitReferral, website_signup: canUseSignup, website_auth_preview: canUseSignup, website_intake_submit: canSubmitWebsiteIntake, resource_public_report: canReportPublicResource };

describe("website/referral action consistency", () => {
  it("covers the full converted public website inventory", () => {
    expect(Object.keys(gates).sort()).toEqual([...PUBLIC_WEBSITE_ACTIONS].sort());
  });
  for (const { key: role } of STAFF_ROLES) {
    it(`${role}: submission gate, registry and store agree without broader grants`, () => {
      const actor = { role, staffId: `probe-${role}` };
      const expected = role === "intake_coordinator" || role === "clinical_coordinator" || role === "peer_specialist" || canAccess(role, "care_coordination").level === "write";
      expect(canSubmitReferral(actor)).toBe(expected);
      for (const [id, gate] of Object.entries(gates)) {
        expect(chartAction(id).allowed(actor).state === "allowed", id).toBe(gate(actor));
      }
      const before = AdelanteEHR.listReferrals().length;
      const result = runAction("website_referral_submit", actor, undefined, { args: [actor, input()] });
      expect(result.ok).toBe(expected);
      expect(AdelanteEHR.listReferrals().length - before).toBe(expected ? 1 : 0);
      if (!expected) {
        expect(() => submitWebsiteReferral(actor, input())).toThrow(REFERRAL_SUBMIT_DENIED);
        if (!result.ok) expect(result.reason).toBe(REFERRAL_SUBMIT_DENIED);
      }
    });
  }
  for (const role of ["clinical_coordinator", "intake_coordinator", "peer_specialist"] as StaffRole[]) {
    it(`${role}: saved in Intake with exact staff attribution and content-free audits`, () => {
      const actor = { role, staffId: role === "clinical_coordinator" ? "s-coord1" : role === "peer_specialist" ? "s-peer1" : "s-intake1" };
      const before = new Set(AdelanteEHR.listAuditEvents().map(e => e.id));
      const result = runAction<ReturnType<typeof submitWebsiteReferral>>("website_referral_submit", actor, undefined, { args: [actor, input()] });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      expect(intakeReferrals().find(r => r.id === result.value.id)?.status).toBe("submitted");
      expect(result.value.submittedBy).toMatchObject({ kind: "staff", actor: { staffId: actor.staffId, role } });
      expect(result.event).toMatchObject({ actorId: actor.staffId, actorRole: role, detail: { actorId: actor.staffId, actingRole: role } });
      const events = AdelanteEHR.listAuditEvents().filter(e => !before.has(e.id));
      expect(events.filter(e => e.action === "action.succeeded")).toHaveLength(1);
      expect(events.find(e => e.action === "referral_submitted")).toMatchObject({ actorId: actor.staffId, actorRole: role, detail: { referralId: result.value.id, channel: "staff" } });
      expect(JSON.stringify(events)).not.toMatch(/FictionalReferral|SubmissionTest|Fictional Referrer|Fictional Agency|fictional@example|1990-01-01/);
    });
  }
  it("clinical coordinator retains read-only care coordination and contact denial", async () => {
    const { canPerformReferralAction } = await import("@/lib/referralActions");
    expect(canAccess("clinical_coordinator", "care_coordination").level).toBe("read");
    expect(canPerformReferralAction("clinical_coordinator", "contact")).toBe(false);
  });
  // Mitch 27 Oct lifecycle decision: peers may log outreach (contact) through the
  // narrow lifecycle gate; enroll/close stay denied and care coordination is unchanged.
  it("peer may log outreach contact but not enroll, close or widen care coordination", async () => {
    const { canPerformReferralAction } = await import("@/lib/referralActions");
    const { canLogReferralContact, canEnrollReferral, canCloseReferral } = await import("@/lib/referralLifecycleActions");
    expect(canAccess("peer_specialist", "care_coordination").level).toBe("read");
    expect(canLogReferralContact("peer_specialist")).toBe(true);
    expect(canEnrollReferral("peer_specialist")).toBe(false);
    expect(canCloseReferral("peer_specialist")).toBe(false);
    for (const action of ["contact", "enroll", "decline"] as const) {
      expect(canPerformReferralAction("peer_specialist", action)).toBe(false);
    }
  });
  it("public referral stays external and staffless", () => {
    const result = runAction<ReturnType<typeof submitWebsiteReferral>>("website_referral_submit", signupActor, undefined, { args: [signupActor, input()] });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.submittedBy).toEqual({ kind: "external" });
    expect(result.event.actorId).toBeUndefined();
    expect(canSubmitReferral({ role: signupActor.role, staffId: "s-test" })).toBe(false);
  });
  it("peer sending is allowed while trainee sending remains unavailable", () => {
    const rows = permissionMatrix();
    expect(rows.find(r => r.role === "peer_specialist" && r.actionId === "website_referral_submit")?.state).toBe("allowed");
    expect(rows.find(r => r.role === "clinical_trainee" && r.actionId === "website_referral_submit")?.state).toBe("hidden");
  });
});