// §Referrals Rework Phase 4a — referrals can actually be moved, and the
// welcome text never claims a send that didn't happen.
import { describe, expect, it, beforeEach } from "vitest";
import { AdelanteEHR, isReferralClosed, REFERRAL_PROGRESS_STAGES } from "@/lib/ehr";
import {
  canPerformReferralAction,
  REFERRAL_DISPOSITION_ROLES,
  referralDeclineReasonLabel,
} from "@/lib/referralActions";
import { composeReferralWelcome } from "@/lib/referralWelcome.functions";

const base = {
  referringAgency: "Valley CBO",
  referrerName: "Rosa M.",
  consentToContact: true,
  phone: "+15555550101",
  referralSource: "community_based_organization",
} as const;

let n = 0;
function makeReferral(extra: Record<string, unknown> = {}) {
  n += 1;
  return AdelanteEHR.createReferral({
    ...base,
    firstName: "Ana",
    lastName: `Disp-${n}`,
    ...extra,
  } as never);
}

beforeEach(() => {
  AdelanteEHR.setActingRole("ecm_provider");
});

describe("referral disposition", () => {
  it("marks contacted with real attribution", () => {
    const r = makeReferral();
    AdelanteEHR.markReferralContacted(r.id);
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(after.status).toBe("contacted");
    expect(after.contactedAt).toBeTruthy();
    expect(after.contactedBy?.staffId).toBeTruthy();
  });

  it("enrolling creates a patient carrying the referral's real context", () => {
    const r = makeReferral({ releaseDate: "2026-02-01", countyOfRelease: "Tulare", dob: "1990-05-05" });
    const patientId = AdelanteEHR.enrollReferral(r.id)!;
    const p = AdelanteEHR.getPatient(patientId)!;
    expect(p.referralId).toBe(r.id);
    expect(p.releaseDate).toBe("2026-02-01");
    expect(p.coverage?.countyOfRelease).toBe("Tulare");
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(after.status).toBe("enrolled");
    expect(after.enrolledBy?.staffId).toBeTruthy();
    const audit = AdelanteEHR.listAuditEvents().find(
      (e) => e.action === "referral_enrolled" && e.patientId === patientId,
    );
    expect(audit).toBeTruthy();
    expect(audit?.actorId).toBeTruthy();
  });

  it("declining requires a reason and records who did it", () => {
    const r = makeReferral();
    expect(() => AdelanteEHR.declineReferral(r.id, { reason: "" })).toThrow();
    AdelanteEHR.declineReferral(r.id, { reason: "not_eligible", note: "out of area" });
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(after.status).toBe("declined");
    expect(after.declineReason).toBe("not_eligible");
    expect(after.declineNote).toBe("out of area");
    expect(after.declinedBy?.staffId).toBeTruthy();
    expect(isReferralClosed(after.status)).toBe(true);
  });

  it("an enrolled referral cannot then be declined", () => {
    const r = makeReferral();
    AdelanteEHR.enrollReferral(r.id);
    expect(() => AdelanteEHR.declineReferral(r.id, { reason: "duplicate" })).toThrow();
  });

  it("declined is an ended state, never a fourth progress stage", () => {
    expect(REFERRAL_PROGRESS_STAGES).toHaveLength(3);
    expect(REFERRAL_PROGRESS_STAGES).not.toContain("declined");
    expect(isReferralClosed("submitted")).toBe(false);
    expect(isReferralClosed("enrolled")).toBe(true);
  });
});

describe("referral action permissions", () => {
  it("enroll and decline are limited to the named disposition roles", () => {
    for (const role of REFERRAL_DISPOSITION_ROLES) {
      expect(canPerformReferralAction(role, "enroll")).toBe(true);
      expect(canPerformReferralAction(role, "decline")).toBe(true);
    }
    expect(canPerformReferralAction("peer_specialist", "enroll")).toBe(false);
    expect(canPerformReferralAction("trainee", "decline")).toBe(false);
  });

  it("contact is the wider, care-coordination tier", () => {
    expect(canPerformReferralAction("ecm_provider", "contact")).toBe(true);
  });

  it("decline reasons have human labels", () => {
    expect(referralDeclineReasonLabel("unable_to_reach")).toMatch(/reach/i);
  });
});

describe("honest welcome text", () => {
  it("never stamps a send at submission time", () => {
    const r = makeReferral();
    expect(r.smsSentAt).toBeUndefined();
    expect(r.welcomeSms).toBeUndefined();
    expect(AdelanteEHR.referralWantsWelcomeSms(r)).toBe(true);
  });

  it("records not_configured without claiming a send", () => {
    const r = makeReferral();
    AdelanteEHR.recordReferralWelcomeDelivery(r.id, {
      status: "not_configured",
      detail: "no credentials",
    });
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(after.welcomeSms?.status).toBe("not_configured");
    expect(after.smsSentAt).toBeUndefined();
  });

  it("stamps smsSentAt only on a genuine send", () => {
    const r = makeReferral();
    AdelanteEHR.recordReferralWelcomeDelivery(r.id, { status: "sent" });
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(after.smsSentAt).toBeTruthy();
  });

  it("welcome copy names the referrer, offers opt-out, and says nothing clinical", () => {
    const body = composeReferralWelcome({
      firstName: "Ana",
      referrerName: "Rosa M.",
      referringAgency: "Valley CBO",
    });
    expect(body).toContain("Rosa M.");
    expect(body).toContain("Valley CBO");
    expect(body).toMatch(/STOP/);
    expect(body.length).toBeLessThanOrEqual(320);
    expect(body).not.toMatch(/diagnos|treatment|substance|mental health|therapy/i);
  });
});
