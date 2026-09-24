// §Referrals Rework Phase 4c — aging math, referrer copy, justice tagging.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type Referral } from "@/lib/ehr";
import { REFERRAL_AGING_DRAFT, referralAging, referralAgingLabel } from "@/lib/referralAging";
import {
  composeReferrerUpdate,
  referredPersonLabel,
} from "@/lib/referrerUpdate.functions";

function ref(over: Partial<Referral> = {}): Referral {
  return {
    id: "r1",
    firstName: "Ada",
    lastName: "Lovelace",
    referringAgency: "Probation",
    referrerName: "Officer Reed",
    referralSource: "probation",
    consentToContact: true,
    status: "submitted",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

describe("referral aging", () => {
  it("is fresh inside the draft due window", () => {
    expect(referralAging(ref({ createdAt: daysAgo(1) })).state).toBe("fresh");
  });
  it("is due at the draft due threshold", () => {
    const r = ref({ createdAt: daysAgo(REFERRAL_AGING_DRAFT.dueDays) });
    expect(referralAging(r).state).toBe("due");
  });
  it("is overdue at the draft overdue threshold", () => {
    const r = ref({ createdAt: daysAgo(REFERRAL_AGING_DRAFT.overdueDays) });
    expect(referralAging(r).state).toBe("overdue");
  });
  it("counts from the last real staff action, not submission", () => {
    const r = ref({ createdAt: daysAgo(30), status: "contacted", contactedAt: daysAgo(1) });
    expect(referralAging(r).state).toBe("fresh");
  });
  it("never ages a closed referral", () => {
    expect(referralAging(ref({ createdAt: daysAgo(90), status: "declined" })).state).toBe("closed");
    expect(referralAging(ref({ createdAt: daysAgo(90), status: "enrolled" })).state).toBe("closed");
  });
  it("labels elapsed days honestly", () => {
    expect(referralAgingLabel(1)).toBe("No action for 1 day");
    expect(referralAgingLabel(9)).toBe("No action for 9 days");
  });
});

describe("referrer update copy", () => {
  it("identifies the person by first name and last initial only", () => {
    expect(referredPersonLabel("Ada", "Lovelace")).toBe("Ada L.");
  });
  it("never exposes a decline reason", () => {
    const body = composeReferrerUpdate({ event: "declined", personLabel: "Ada L." });
    expect(body).toContain("closed the referral");
    expect(body.toLowerCase()).not.toContain("reason");
    expect(body).toContain("STOP");
  });
  it("stays inside one message budget for every event", () => {
    for (const event of ["contacted", "enrolled", "declined"] as const) {
      const body = composeReferrerUpdate({ event, personLabel: "Ada L." });
      expect(body.length).toBeLessThanOrEqual(320);
      expect(body).toContain("Ada L.");
    }
  });
});

describe("justice-involved tagging and delivery log", () => {
  it("stores the referrer's answer and reuses the existing CIN field", () => {
    const created = AdelanteEHR.createReferral({
      firstName: "Grace",
      lastName: "Hopper",
      phone: "+15555550100",
      cin: "90000000A",
      referringAgency: "Parole",
      referrerName: "Officer Reed",
      referralSource: "parole",
      consentToContact: true,
      justiceInvolved: "yes",
      referrerPhone: "5555550198",
      channel: "public",
    });
    expect(created.justiceInvolved).toBe("yes");
    expect(created.cin).toBe("90000000A");
  });

  it("logs a referrer update truthfully, never as a silent send", () => {
    const created = AdelanteEHR.createReferral({
      firstName: "Ann",
      lastName: "Smith",
      referringAgency: "CBO",
      referrerName: "Jo",
      referralSource: "community_based_organization",
      consentToContact: false,
      justiceInvolved: "unsure",
      referrerEmail: "jo@cbo.org",
      channel: "public",
    });
    AdelanteEHR.recordReferrerUpdateDelivery(created.id, {
      event: "contacted",
      status: "not_configured",
      detail: "no transport",
    });
    const after = AdelanteEHR.listReferrals().find((r) => r.id === created.id)!;
    expect(after.referrerUpdates).toHaveLength(1);
    expect(after.referrerUpdates![0]!.status).toBe("not_configured");
    expect(after.smsSentAt).toBeUndefined();
  });
});
