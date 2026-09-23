// §SDOH Referral Thread, Phase 5d-1 — safety first: a staff resource referral
// in a Part 2 sensitive category requires the patient's real SUD consent, and
// every need/referral write carries real attribution and a real audit entry.
import { describe, expect, it } from "vitest";
import {
  AdelanteEHR,
  Part2ConsentRequiredError,
  PART2_SENSITIVE_REFERRAL_CATEGORIES,
  isPart2SensitiveCategory,
} from "@/lib/ehr";
import { isReferralSudSensitive } from "@/lib/noteAutofill";
import { PART2_CAUTION_CATEGORY_IDS } from "@/lib/sdohResourceMatch";

const ACTOR = { staffName: "Luz Herrera", role: "ecm_provider" as const };

function patient(name: string) {
  return AdelanteEHR.createPatient({ firstName: name, lastName: "Part2" }).id;
}

function grantSudConsent(patientId: string) {
  AdelanteEHR.createConsentRecord({
    patientId,
    formType: "AB133",
    source: "test",
    signedByName: "Test Patient",
    attested: true,
    effectiveDate: "2020-01-01",
    sections: [{ category: "sud_treatment", authorized: true }],
    capturedBy: ACTOR,
  });
}

function referrals(id: string) {
  return AdelanteEHR.getPatient(id)?.resourceReferrals ?? [];
}
function audits(id: string, action: string) {
  return AdelanteEHR.listAuditEvents({ patientId: id }).filter((a) => a.action === action);
}


describe("Part 2 consent gate on staff resource referrals", () => {
  it("blocks a sensitive-category referral when the patient has no SUD consent", () => {
    const id = patient("Blocked");
    for (const category of PART2_SENSITIVE_REFERRAL_CATEGORIES) {
      expect(() =>
        AdelanteEHR.addResourceReferral(id, { category, provider: "Some group" }, ACTOR),
      ).toThrow(Part2ConsentRequiredError);
    }
    expect(referrals(id)).toHaveLength(0);
  });

  it("allows a sensitive-category referral once real consent is on file", () => {
    const id = patient("Allowed");
    grantSudConsent(id);
    AdelanteEHR.addResourceReferral(
      id,
      { category: "recovery_meetings", provider: "Sunrise Recovery" },
      ACTOR,
    );
    const r = referrals(id)[0]!;
    expect(r.sudDisclosureConsent).toBe(true);
    expect(r.createdBy).toBe(ACTOR.staffName);
    expect(r.createdByRole).toBe(ACTOR.role);
  });

  it("never blocks a non-sensitive category, and stamps the live consent honestly", () => {
    const id = patient("Housing");
    AdelanteEHR.addResourceReferral(id, { category: "housing", provider: "Shelter" }, ACTOR);
    const r = referrals(id)[0]!;
    // The flag is the patient's real consent state, not the viewer's access.
    expect(r.sudDisclosureConsent).toBe(false);
  });
});

describe("sensitivity is a property of the category, not the consent flag", () => {
  it("treats sensitive categories as sensitive even when consent was granted", () => {
    const id = patient("Sensitive");
    grantSudConsent(id);
    AdelanteEHR.addResourceReferral(
      id,
      { category: "support_groups", provider: "Peer Circle" },
      ACTOR,
    );
    AdelanteEHR.addResourceReferral(id, { category: "food", provider: "Food Bank" }, ACTOR);
    const all = referrals(id);
    const sensitive = all.find((r) => r.category === "support_groups")!;
    const plain = all.find((r) => r.category === "food")!;
    expect(isReferralSudSensitive(sensitive)).toBe(true);
    expect(isReferralSudSensitive(plain)).toBe(false);

  });

  it("shares one sensitive-category list with the patient-facing matcher", () => {
    expect([...PART2_CAUTION_CATEGORY_IDS].sort()).toEqual(
      [...PART2_SENSITIVE_REFERRAL_CATEGORIES].sort(),
    );
    expect(isPart2SensitiveCategory("recovery_meetings")).toBe(true);
    expect(isPart2SensitiveCategory("housing")).toBe(false);
  });
});

describe("attribution and audit on needs and referrals", () => {
  it("audits referral creation and status change with actor and role", () => {
    const id = patient("Audited");
    AdelanteEHR.addResourceReferral(id, { category: "housing", provider: "Shelter" }, ACTOR);
    const r = referrals(id)[0]!;
    AdelanteEHR.setResourceReferralStatus(id, r.id, "closed", undefined, ACTOR, "Work finished.");

    const created = audits(id, "resource_referral_created");
    const changed = audits(id, "resource_referral_status");
    expect(created).toHaveLength(1);
    expect(changed).toHaveLength(1);
    expect(created[0]!.actorId).toBe(ACTOR.staffName);
    expect(created[0]!.actorRole).toBe(ACTOR.role);
    expect(changed[0]!.actorRole).toBe(ACTOR.role);
    expect(referrals(id)[0]!.lastUpdatedBy).toBe(ACTOR.staffName);
  });

  it("audits need creation and status change with actor and role", () => {
    const id = patient("Needs");
    AdelanteEHR.addSdohItem(id, { need: "Needs a bus pass" }, ACTOR);
    const item = AdelanteEHR.getPatient(id)!.sdohPlan!.items[0]!;
    expect(item.createdBy).toBe(ACTOR.staffName);
    AdelanteEHR.setSdohStatus(id, item.id, "completed", undefined, ACTOR);
    const after = AdelanteEHR.getPatient(id)!.sdohPlan!.items[0]!;
    expect(after.lastUpdatedBy).toBe(ACTOR.staffName);
    expect(after.lastUpdatedByRole).toBe(ACTOR.role);
    expect(audits(id, "sdoh_need_created")).toHaveLength(1);
    expect(audits(id, "sdoh_need_status")).toHaveLength(1);
  });

  it("records an unattributed write honestly rather than faking an actor", () => {
    const id = patient("Anon");
    AdelanteEHR.addSdohItem(id, { need: "Legacy caller need" });
    const item = AdelanteEHR.getPatient(id)!.sdohPlan!.items[0]!;
    expect(item.createdBy).toBeUndefined();
    expect(audits(id, "sdoh_need_created")[0]!.actorId).toBe("unattributed");
  });
});
