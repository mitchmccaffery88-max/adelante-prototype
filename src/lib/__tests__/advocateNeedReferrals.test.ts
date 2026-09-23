// §5d-4 — referral status reaches an advocate only as far as their own tier
// allows, and a Part 2 sensitive referral is a restricted row with NO category
// for anyone whose SUD axis resolves masked.
import { describe, expect, it } from "vitest";
import { activateAhcdForTest } from "./helpers/ahcdTestActivation";
import { AdelanteEHR, type ConsentCategory } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import {
  ADVOCATE_SUD_DISCLOSURE_CATEGORY,
  type AdvocateAuthorizationType,
} from "@/lib/advocate";

const actor = { staffName: "Test Staff", role: "ecm_provider" as StaffRole };

function cleanPatient(i: number) {
  const list = AdelanteEHR.listPatients();
  const p = list[i % list.length]!;
  for (const item of [...(p.sdohPlan?.items ?? [])]) AdelanteEHR.removeSdohItem(p.id, item.id);
  if (p.resourceReferrals) p.resourceReferrals.length = 0;
  return p;
}

function addNeed(pid: string, need: string, safetySensitive = false) {
  AdelanteEHR.addSdohItem(pid, { need, source: "staff_assessed", safetySensitive }, actor);
  return AdelanteEHR.getPatient(pid)!.sdohPlan!.items[0]!;
}

function connect(patientId: string, type: AdvocateAuthorizationType) {
  const link = AdelanteEHR.createAdvocateInvitation({
    patientId,
    advocateName: "Rosa Ibarra",
    relationship: "Sister",
    invitationSentTo: "rosa@example.org",
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: type,
    attestedName: "Rosa Ibarra",
  });
  if (type === "ahcd") activateAhcdForTest(link.id);
  if (type === "conservatorship")
    AdelanteEHR.recordAdvocateConservatorshipDocs(link.id, {
      verifiedBy: "Records Clerk",
      courtOrderRef: "PR-2026-0001",
    });
  return link.id;
}

function signSudDisclosure(patientId: string) {
  signSections(patientId, [{ category: ADVOCATE_SUD_DISCLOSURE_CATEGORY, authorized: true }]);
}

function signSections(
  patientId: string,
  sections: { category: ConsentCategory; authorized: boolean }[],
) {
  AdelanteEHR.createConsentRecord({
    patientId,
    formType: "NonAB133",
    source: "placeholder — pending DHCS-sourced language",
    signedByName: "Test Patient",
    attested: true,
    effectiveDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    sections,
    capturedBy: { staffName: "Test", role: "therapist" },
  });
}

describe("advocate sees referrals alongside needs", () => {
  it("shows an ordinary referral with its organisation to a HIPAA-only advocate", () => {
    const p = cleanPatient(0);
    const need = addNeed(p.id, "Needs housing");
    AdelanteEHR.addResourceReferral(
      p.id,
      { category: "housing", provider: "Casa Esperanza", sdohItemId: need.id },
      actor,
    );
    const linkId = connect(p.id, "hipaa_authorization");
    const view = AdelanteEHR.advocateCoordination(linkId);
    const item = view.items.find((i) => i.id === need.id)!;
    expect(item.referrals[0]!.provider).toBe("Casa Esperanza");
    expect(item.referrals[0]!.restricted).toBe(false);
  });

  it("restricts a Part 2 sensitive referral for an authorized representative, always", () => {
    const p = cleanPatient(1);
    AdelanteEHR.setConsent(p.id, "part2Sud", true);
    // One record: only the ACTIVE consent record counts, so both sections
    // must live on it. Even WITH both, an AR is categorically barred.
    signSections(p.id, [
      { category: "sud_treatment", authorized: true },
      { category: ADVOCATE_SUD_DISCLOSURE_CATEGORY, authorized: true },
    ]);
    const need = addNeed(p.id, "Wants a group");
    AdelanteEHR.addResourceReferral(
      p.id,
      { category: "support_groups", provider: "Sunrise Group", sdohItemId: need.id },
      actor,
    );
    const linkId = connect(p.id, "dhcs_authorized_representative");
    const view = AdelanteEHR.advocateCoordination(linkId);
    const row = view.items.find((i) => i.id === need.id)!.referrals[0]!;
    expect(row.restricted).toBe(true);
    expect(row.category).toBeUndefined();
    expect(row.provider).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("Sunrise Group");
    expect(JSON.stringify(view)).not.toContain("support_groups");
  });

  it("restricts it for HIPAA-only without the disclosure, and lifts with it", () => {
    const p = cleanPatient(2);
    AdelanteEHR.setConsent(p.id, "part2Sud", true);
    const need = addNeed(p.id, "Wants a group");
    AdelanteEHR.addResourceReferral(
      p.id,
      { category: "recovery_meetings", provider: "Sunrise Group", sdohItemId: need.id },
      actor,
    );
    const masked = AdelanteEHR.advocateCoordination(connect(p.id, "hipaa_authorization"));
    expect(masked.items.find((i) => i.id === need.id)!.referrals[0]!.restricted).toBe(true);

    signSudDisclosure(p.id);
    const unmasked = AdelanteEHR.advocateCoordination(connect(p.id, "hipaa_authorization"));
    expect(unmasked.items.find((i) => i.id === need.id)!.referrals[0]!.restricted).toBe(false);
  });

  it("gives an authority tier the unmasked row without any consent form", () => {
    const p = cleanPatient(3);
    AdelanteEHR.setConsent(p.id, "part2Sud", true);
    const need = addNeed(p.id, "Wants a group");
    AdelanteEHR.addResourceReferral(
      p.id,
      { category: "recovery_meetings", provider: "Sunrise Group", sdohItemId: need.id },
      actor,
    );
    const view = AdelanteEHR.advocateCoordination(connect(p.id, "conservatorship"));
    expect(view.items.find((i) => i.id === need.id)!.referrals[0]!.restricted).toBe(false);
  });

  it("never shows a safety need or its referral to any advocate", () => {
    const p = cleanPatient(4);
    const need = addNeed(p.id, "Unsafe at home", true);
    AdelanteEHR.addResourceReferral(
      p.id,
      { category: "legal", provider: "Legal Aid", sdohItemId: need.id },
      actor,
    );
    const view = AdelanteEHR.advocateCoordination(connect(p.id, "conservatorship"));
    expect(view.items.find((i) => i.id === need.id)).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("Legal Aid");
    expect(view.maskedCount).toBeGreaterThan(0);
  });

  it("never carries the staff activity log to an advocate", () => {
    const p = cleanPatient(5);
    const need = addNeed(p.id, "Needs food");
    AdelanteEHR.appendSdohNeedLog(p.id, need.id, { entryType: "contact_attempt", text: "Left a voicemail" }, actor);
    const view = AdelanteEHR.advocateCoordination(connect(p.id, "hipaa_authorization"));
    expect(JSON.stringify(view)).not.toContain("voicemail");
  });
});
