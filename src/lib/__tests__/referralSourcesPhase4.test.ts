// §Front-door Phase 4 — new community referral sources.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, REFERRAL_SOURCE_LABELS, type ReferralSource } from "@/lib/ehr";

const base = {
  referringAgency: "Valley CBO",
  referrerName: "Rosa M.",
  consentToContact: true,
  phone: "+15555550101",
};

describe("community referral sources", () => {
  it("stores the real source value, never remapped to other", () => {
    for (const src of ["community_based_organization", "community_peer"] as ReferralSource[]) {
      const r = AdelanteEHR.createReferral({
        ...base,
        firstName: "Ana",
        lastName: `Test-${src}`,
        referralSource: src,
      } as never);
      expect(r.referralSource).toBe(src);
      expect(AdelanteEHR.listReferrals().find((x) => x.id === r.id)?.referralSource).toBe(src);
    }
  });

  it("keeps the community peer label distinct from the Adelante StaffRole", () => {
    expect(REFERRAL_SOURCE_LABELS.community_peer).toMatch(/not Adelante staff/i);
    expect(REFERRAL_SOURCE_LABELS.community_based_organization).toBe(
      "Community-based organization",
    );
  });

  it("CIN duplicate lookup is source-agnostic", () => {
    const cin = "90000777A";
    AdelanteEHR.createReferral({
      ...base,
      firstName: "Dup",
      lastName: "Cbo",
      cin,
      referralSource: "community_based_organization",
    } as never);
    const dup = AdelanteEHR.listReferrals().filter((r) => r.cin === cin);
    expect(dup.length).toBeGreaterThan(0);
  });
});
