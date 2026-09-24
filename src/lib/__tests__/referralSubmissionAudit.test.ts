// Referrer contact enforced in the data layer + real submission attribution.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { REFERRER_CONTACT_REQUIRED_MSG } from "@/lib/referralOutreach";
import { getActingStaff } from "@/lib/roles";

const base = {
  firstName: "Audit",
  lastName: "Trail",
  referringAgency: "County Probation",
  referrerName: "Officer Diaz",
  referralSource: "probation" as const,
  consentToContact: false,
};

const submittedRows = (id: string) =>
  AdelanteEHR.listAuditEvents().filter(
    (e) => e.action === "referral_submitted" && (e.detail as { referralId?: string })?.referralId === id,
  );

describe("referrer contact rule in the data layer", () => {
  it("rejects neither phone nor email, including whitespace, and stores nothing", () => {
    const before = AdelanteEHR.listReferrals().length;
    const auditBefore = AdelanteEHR.listAuditEvents().filter((e) => e.action === "referral_submitted").length;
    expect(() => AdelanteEHR.createReferral({ ...base, channel: "public" })).toThrow(REFERRER_CONTACT_REQUIRED_MSG);
    expect(() =>
      AdelanteEHR.createReferral({ ...base, referrerPhone: "  ", referrerEmail: " ", channel: "staff" }),
    ).toThrow(REFERRER_CONTACT_REQUIRED_MSG);
    expect(AdelanteEHR.listReferrals().length).toBe(before);
    expect(AdelanteEHR.listAuditEvents().filter((e) => e.action === "referral_submitted").length).toBe(auditBefore);
  });
  it("accepts only a phone or only an email", () => {
    expect(AdelanteEHR.createReferral({ ...base, referrerPhone: "5105551212", channel: "public" }).id).toBeTruthy();
    expect(AdelanteEHR.createReferral({ ...base, referrerEmail: "d@county.gov", channel: "public" }).id).toBeTruthy();
  });
});

describe("submission attribution", () => {
  it("staff channel records the acting staff member and writes one audit row", () => {
    const r = AdelanteEHR.createReferral({ ...base, referrerPhone: "5105551212", channel: "staff" });
    expect(r.submittedBy).toMatchObject({ kind: "staff", actor: { staffId: getActingStaff().id } });
    const rows = submittedRows(r.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBe(getActingStaff().id);
    expect((rows[0].detail as { referrerContactProvided: string[] }).referrerContactProvided).toEqual(["phone"]);
    expect(JSON.stringify(rows[0].detail)).not.toContain("5105551212");
  });
  it("public channel is recorded as external with no staff actor", () => {
    const r = AdelanteEHR.createReferral({ ...base, referrerEmail: "d@county.gov", channel: "public" });
    expect(r.submittedBy).toEqual({ kind: "external" });
    const rows = submittedRows(r.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBe("external");
    expect(rows[0].actorRole).toBeUndefined();
  });
});
