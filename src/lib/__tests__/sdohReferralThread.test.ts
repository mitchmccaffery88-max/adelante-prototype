import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { listResources } from "@/lib/communityResources";

const ACTOR = { staffName: "Case Manager", role: "ecm_provider" as const };

function patient(name: string) {
  const p = AdelanteEHR.createPatient({
    firstName: name,
    lastName: "Thread",
    dob: "1990-01-01",
  });
  return p.id;
}

function need(patientId: string, label: string, safety = false) {
  AdelanteEHR.addSdohItem(
    patientId,
    { need: label, ...(safety ? { safetySensitive: true } : {}) },
    ACTOR,
  );
  const p = AdelanteEHR.getPatient(patientId)!;
  return p.sdohPlan!.items.find((i) => i.need === label)!;
}

describe("SDOH referral thread (5d-2)", () => {
  it("links a referral to its need and moves the need to sent", () => {
    const id = patient("Linked");
    const item = need(id, "Housing support");
    AdelanteEHR.addResourceReferral(
      id,
      { category: "housing", provider: "Shelter", sdohItemId: item.id },
      ACTOR,
    );
    const linked = AdelanteEHR.referralsForNeed(id, item.id);
    expect(linked).toHaveLength(1);
    expect(linked[0]!.sdohItemId).toBe(item.id);
    const after = AdelanteEHR.getPatient(id)!.sdohPlan!.items.find((i) => i.id === item.id)!;
    expect(after.status).toBe("sent");
  });

  it("supports more than one referral per need", () => {
    const id = patient("Multi");
    const item = need(id, "Food access");
    AdelanteEHR.addResourceReferral(
      id,
      { category: "food", provider: "Pantry A", sdohItemId: item.id },
      ACTOR,
    );
    AdelanteEHR.addResourceReferral(
      id,
      { category: "food", provider: "Pantry B", sdohItemId: item.id },
      ACTOR,
    );
    expect(AdelanteEHR.referralsForNeed(id, item.id)).toHaveLength(2);
  });

  it("records an off-directory referral without touching the directory", () => {
    const id = patient("OffDir");
    const before = listResources().length;
    const item = need(id, "Transport");
    AdelanteEHR.addResourceReferral(
      id,
      {
        category: "transportation",
        provider: "Neighbour with a van",
        sdohItemId: item.id,
        note: "Informal arrangement",
      },
      ACTOR,
    );
    const r = AdelanteEHR.referralsForNeed(id, item.id)[0]!;
    expect(r.resourceId).toBeUndefined();
    expect(listResources().length).toBe(before);
  });

  it("requires a reason for any outcome other than pending", () => {
    const id = patient("Outcome");
    const item = need(id, "Housing support");
    AdelanteEHR.addResourceReferral(
      id,
      { category: "housing", provider: "Shelter", sdohItemId: item.id },
      ACTOR,
    );
    const r = AdelanteEHR.referralsForNeed(id, item.id)[0]!;
    expect(() =>
      AdelanteEHR.setResourceReferralStatus(id, r.id, "waitlisted", undefined, ACTOR),
    ).toThrow();
    AdelanteEHR.setResourceReferralStatus(
      id,
      r.id,
      "waitlisted",
      undefined,
      ACTOR,
      "Six week list",
    );
    expect(AdelanteEHR.referralsForNeed(id, item.id)[0]!.status).toBe("waitlisted");
  });

  it("does not auto-close the need when a referral is connected", () => {
    const id = patient("NoAutoClose");
    const item = need(id, "Housing support");
    AdelanteEHR.addResourceReferral(
      id,
      { category: "housing", provider: "Shelter", sdohItemId: item.id },
      ACTOR,
    );
    const r = AdelanteEHR.referralsForNeed(id, item.id)[0]!;
    AdelanteEHR.setResourceReferralStatus(id, r.id, "connected", undefined, ACTOR, "Intake booked");
    const after = AdelanteEHR.getPatient(id)!.sdohPlan!.items.find((i) => i.id === item.id)!;
    expect(after.status).not.toBe("completed");
  });

  it("keeps safety needs and their referrals staff-only by default", () => {
    const id = patient("Safety");
    const item = need(id, "Interpersonal safety", true);
    expect(item.visibleToPatient).toBe(false);
    AdelanteEHR.addResourceReferral(
      id,
      { category: "legal", provider: "Advocacy line", sdohItemId: item.id },
      ACTOR,
    );
    expect(AdelanteEHR.referralsForNeed(id, item.id)[0]!.visibleToPatient).toBe(false);
  });

  it("still blocks a Part 2 category without the patient's consent", () => {
    const id = patient("Consent");
    const item = need(id, "Recovery support");
    expect(() =>
      AdelanteEHR.addResourceReferral(
        id,
        { category: "recovery_meetings", provider: "Group", sdohItemId: item.id },
        ACTOR,
      ),
    ).toThrow();
  });
});
