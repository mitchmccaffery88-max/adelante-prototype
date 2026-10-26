// Oct 26 — canonical purpose codes. Records captured the way the picker
// saves them (code + label/note display text) satisfy each gate without any
// exact wording; the HLOC send cites the specific legal disclosure.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { consentGate, CATEGORY_NEEDS, coordinatorNeed } from "@/lib/consentGate";
import { PURPOSE_LABEL, purposeCodeForText, purposeNeedsReview, type ConsentPurposeCode } from "@/lib/consentPurposes";
import { PART2_ELEMENT_KEYS, type ConsentType } from "@/lib/consentRecordModel";
import { consentRecordHistory } from "@/lib/consentCapture";
import { advanceHlocReferral, createHlocReferral, HLOC_TARGET_LABEL, recordLegalDisclosureConsent } from "@/lib/outpatientCare";
import { listDisclosureLog } from "@/lib/part2Disclosure";

const admin = { role: "sys_admin" as const, staffId: "s-admin1", staffName: "Adelante System Admin" };
const storeAdmin = { role: admin.role, staffId: admin.staffId, name: admin.staffName };
const clin = { role: "therapist" as const, name: "Codes therapist", staffId: "s-th1" };
const all = Object.fromEntries(PART2_ELEMENT_KEYS.map((k) => [k, true]));
let n = 0;
function fresh() {
  const r = runAction("patient_create_anyway", admin, undefined, { via: "createPatient", args: [{ firstName: "Codes", lastName: `Purpose ${++n}`, dob: `1990-04-1${n % 10}` }] });
  if (!r.ok) throw new Error(r.reason);
  return r.value as ReturnType<typeof AdelanteEHR.createPatient>;
}
/** Exactly what the picker sends: code + "Label — note". */
function pick(pid: string, type: ConsentType, recipient: string, code: ConsentPurposeCode, items: string[]) {
  const r = runAction("consent_record_capture", admin, AdelanteEHR.getPatient(pid)!, {
    via: "captureConsentRecord", args: [{ draft: { patientId: pid, consentType: type, recipients: [{ kind: "org", name: recipient }],
      purpose: `${PURPOSE_LABEL[code]} — staff note`, purposeCode: code, items, expiresOnEvent: "Patient revokes", part2Elements: all },
      method: "e_sign", signer: "Codes QA", relationship: "patient", attested: true, actor: storeAdmin }],
  });
  if (!r.ok) throw new Error(r.reason);
}

describe("purpose codes through the picker", () => {
  it("SUD treatment gate unblocks with code 'treatment'", () => {
    const p = fresh();
    pick(p.id, "part2_tpo_single", "Adelante", "treatment", ["SUD treatment information"]);
    expect(consentGate(p.id, CATEGORY_NEEDS.sud_treatment!, () => false)).toBe(true);
  });
  it("telehealth gate unblocks with code 'telehealth'", () => {
    const p = fresh();
    pick(p.id, "telehealth", "Adelante", "telehealth", ["Video visits"]);
    expect(consentGate(p.id, CATEGORY_NEEDS.telehealth_services!, () => false)).toBe(true);
  });
  it("coordinator gate unblocks with code 'care_coordination'", () => {
    const p = fresh();
    pick(p.id, "part2_tpo_single", "Adelante care coordination team", "care_coordination", ["SUD treatment information"]);
    expect(consentGate(p.id, coordinatorNeed(), () => false)).toBe(true);
  });
  it("a wrong code never satisfies the gate", () => {
    const p = fresh();
    pick(p.id, "telehealth", "Adelante", "treatment", ["Video visits"]);
    expect(consentGate(p.id, CATEGORY_NEEDS.telehealth_services!, () => true)).toBe(false);
  });
});

describe("migration of text purposes", () => {
  it("exact known text maps; other text is flagged for review", () => {
    expect(purposeCodeForText("Referral for treatment")).toBe("referral_for_treatment");
    expect(purposeCodeForText("treatment")).toBe("treatment");
    expect(purposeCodeForText("Help with housing")).toBeUndefined();
    expect(purposeNeedsReview({ consentType: "hipaa_authorization", purpose: "Help with housing" })).toBe(true);
    expect(purposeNeedsReview({ consentType: "telehealth", purpose: "telehealth" })).toBe(false);
  });
  it("history row carries the review flag", () => {
    const p = fresh();
    runAction("consent_record_capture", admin, AdelanteEHR.getPatient(p.id)!, {
      via: "captureConsentRecord", args: [{ draft: { patientId: p.id, consentType: "hipaa_authorization", recipients: [{ kind: "org", name: "Clinic" }],
        purpose: "Help with housing", items: ["Summary"], expiresOnEvent: "Patient revokes" },
        method: "e_sign", signer: "Codes QA", relationship: "patient", attested: true, actor: storeAdmin }],
    });
    expect(consentRecordHistory(p.id).some((r) => r.purposeNeedsReview)).toBe(true);
  });
});

describe("HLOC blocked-send panel", () => {
  it("refuses unchecked required elements before creating any consent or disclosure", () => {
    const p = fresh();
    const before = AdelanteEHR.listConsentRecords(p.id).length;
    for (const missing of PART2_ELEMENT_KEYS) {
      expect(() => recordLegalDisclosureConsent(p.id, clin, "Codes QA", { recipient: "Destination", purpose: "Referral", purposeCode: "referral_for_treatment", items: ["SUD referral information"], part2Elements: { ...all, [missing]: false }, expiresOnEvent: "Patient revokes", signedDate: "2026-10-26" })).toThrow(/required Part 2/);
    }
    expect(AdelanteEHR.listConsentRecords(p.id)).toHaveLength(before);
  });
  it("requires an actual signature date and an expiration date or event", () => {
    const p = fresh();
    const meta = { recipient: "Destination", purpose: "Referral", purposeCode: "referral_for_treatment" as const, items: ["SUD referral information"], part2Elements: all };
    expect(() => recordLegalDisclosureConsent(p.id, clin, "Codes QA", meta)).toThrow(/expiration/);
    expect(() => recordLegalDisclosureConsent(p.id, clin, "Codes QA", { ...meta, expiresOnEvent: "Patient revokes" })).toThrow(/signature date/);
  });
  it("saves a typed referral_for_treatment record and the disclosure log cites the specific legal disclosure", () => {
    const p = fresh();
    const r = createHlocReferral({ patientId: p.id, target: "residential", reason: "Needs residential", urgency: "routine", destination: "Codes Residential (demo)", outsideSudProvider: true, actor: clin });
    recordLegalDisclosureConsent(p.id, clin, "Codes QA", { recipient: r.destination, purpose: `Referral — ${HLOC_TARGET_LABEL[r.target]}`, purposeCode: "referral_for_treatment", items: ["SUD referral information"], part2Elements: all, expiresOnEvent: "Patient revokes", signedDate: new Date().toISOString().slice(0, 10) });
    const typed = AdelanteEHR.listConsentRecords(p.id).filter((x) => x.consentType === "legal_part2_disclosure");
    expect(typed).toHaveLength(1);
    expect(typed[0].purposeCode).toBe("referral_for_treatment");
    advanceHlocReferral(r.id, "sent", clin);
    expect(listDisclosureLog({ patientId: p.id })[0].consentRef).toMatch(/^Legal disclosure ld-/);
  });
});
