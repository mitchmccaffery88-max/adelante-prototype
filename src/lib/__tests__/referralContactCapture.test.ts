// Referral contact capture — person's email + referrer phone-or-email rule.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "../ehr";
import { needsReferrerFallback, NO_REFERRER_CONTACT_NOTE } from "../referralOutreach";
import {
  isValidEmail,
  referralContactProblem,
  REFERRER_CONTACT_REQUIRED_MSG,
} from "@/components/referral/ReferralSubmissionForm";

const base = {
  firstName: "Email",
  lastName: "Capture",
  referringAgency: "County Probation",
  referrerName: "Officer Diaz",
  referralSource: "probation" as const,
};

describe("referrer phone-or-email rule", () => {
  it("blocks when the referrer gives neither", () => {
    expect(referralContactProblem({ referrerPhone: " ", referrerEmail: "", email: "" })).toBe(
      REFERRER_CONTACT_REQUIRED_MSG,
    );
  });
  it("accepts phone only or email only", () => {
    expect(referralContactProblem({ referrerPhone: "5105551212", referrerEmail: "", email: "" })).toBeNull();
    expect(referralContactProblem({ referrerPhone: "", referrerEmail: "a@b.org", email: "" })).toBeNull();
  });
  it("a malformed referrer email does not satisfy the rule", () => {
    expect(referralContactProblem({ referrerPhone: "", referrerEmail: "nope", email: "" })).toMatch(/valid email/);
  });
  it("validates the person's optional email", () => {
    expect(referralContactProblem({ referrerPhone: "1", referrerEmail: "", email: "bad@" })).toMatch(/person's email/);
    expect(isValidEmail("jo@example.com")).toBe(true);
  });
});

describe("person's email flows to the patient at enrollment", () => {
  it("copies Referral.email onto Patient.email", () => {
    const r = AdelanteEHR.createReferral({
      ...base,
      referrerPhone: "5105551212",
      phone: "5105550000",
      email: "jo@example.com",
      consentToContact: true,
    });
    expect(r.email).toBe("jo@example.com");
    const pid = AdelanteEHR.enrollReferral(r.id)!;
    expect(AdelanteEHR.getPatient(pid)?.email).toBe("jo@example.com");
  });
});

describe("referrer fallback respects real referrer contact", () => {
  it("is suppressed, honestly flagged, when the referrer has no contact (legacy)", () => {
    const f = needsReferrerFallback({ status: "submitted", referrerPhone: "", referrerEmail: undefined });
    expect(f.due).toBe(false);
    expect(f.referrerUnreachable).toBe(true);
    expect(NO_REFERRER_CONTACT_NOTE).toMatch(/no one to fall back on/);
  });
  it("is still due with only an email or only a phone", () => {
    expect(needsReferrerFallback({ status: "submitted", referrerEmail: "a@b.org" }).due).toBe(true);
    expect(needsReferrerFallback({ status: "submitted", referrerPhone: "5105551212" }).due).toBe(true);
  });
});
