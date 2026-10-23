import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { consentGate, categoryNeed } from "@/lib/consentGate";
import { PART2_ELEMENT_KEYS } from "@/lib/consentRecordModel";
import { part2ConsentFor } from "@/lib/part2Disclosure";
import { hlocSendBlocker } from "@/lib/outpatientCare";

const actor = { role: "sys_admin" as const, staffId: "s-admin1", staffName: "Adelante System Admin" };
const storeActor = { role: actor.role, staffId: actor.staffId, name: actor.staffName };
function fresh() {
  const result = runAction("patient_create", actor, undefined, {
    via: "createPatient", args: [{ firstName: "Live", lastName: "Consent QA", dob: "1990-01-01" }],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  const patient = result.value as ReturnType<typeof AdelanteEHR.createPatient>;
  return patient;
}

describe("B2-5 live untyped consistency", () => {
  it("ignores a flag callback, accepts a live section through the real action, and denies legacy history", () => {
    const p = fresh();
    const need = categoryNeed("sud_treatment");
    if (!need) throw new Error("Missing treatment need");
    expect(consentGate(p.id, need, () => true)).toBe(false);
    const result = runAction("consent_capture", actor, p, {
      via: "createConsentRecord", args: [{ patientId: p.id, formType: "NonAB133", source: "Live staff entry QA", signedByName: "Live Consent QA", attested: true,
        effectiveDate: new Date().toISOString().slice(0, 10), sections: [{ category: "sud_treatment", authorized: true }],
        capturedBy: { staffName: actor.staffName, role: actor.role } }],
    });
    expect(result.ok).toBe(true);
    expect(consentGate(p.id, need, () => false)).toBe(true);
    const migrate = runAction("consent_legacy_migrate", actor, p, {
      via: "migrateUnprovenConsents", args: [{ patientId: p.id, actor: storeActor }],
    });
    expect(migrate.ok).toBe(true);
    expect(consentGate(p.id, need, () => true)).toBe(false);
  });

  it("live legal walkthrough retains its scope and audits; applicable revoked typed evidence prevents fallback", () => {
    const p = fresh();
    const recipient = "Live Outside Recovery QA";
    expect(part2ConsentFor(p.id, { name: recipient, type: "legal" }, "Referral for treatment").ok).toBe(false);
    const result = runAction("legal_disclosure_record", actor, p, {
      via: "recordLegalDisclosureConsent", args: [p.id, storeActor, "Live Consent QA", { recipient, purpose: "Referral for treatment" }],
    });
    expect(result.ok).toBe(true);
    const live = AdelanteEHR.activeConsentRecord(p.id);
    expect(live?.consentType).toBeUndefined();
    expect(live?.legacyUnverified).not.toBe(true);
    expect(live?.signature?.signer).toBe("Live Consent QA");
    expect(live?.document).toBeUndefined();
    expect(part2ConsentFor(p.id, { name: recipient, type: "legal" }, "Referral for treatment").ok).toBe(true);
    const capture = runAction("consent_record_capture", actor, p, {
      via: "captureConsentRecord", args: [{ draft: { patientId: p.id, consentType: "legal_part2_disclosure", recipients: [{ kind: "org", name: recipient }],
        purpose: "Referral for treatment", items: ["SUD referral information"], expiresOnEvent: "Patient revokes", part2Elements: Object.fromEntries(PART2_ELEMENT_KEYS.map(k => [k, true])) },
        method: "e_sign", signer: "Live Consent QA", relationship: "patient", attested: true, actor: storeActor }],
    });
    expect(capture.ok).toBe(true);
    if (!capture.ok) throw new Error(capture.reason);
    const record = capture.value as ReturnType<typeof AdelanteEHR.createConsentRecord>;
    const revoke = runAction("consent_record_revoke", actor, p, {
      args: [{ recordId: record.id, method: "in_person", note: "Patient asked to stop", actor: storeActor }],
    });
    expect(revoke.ok).toBe(true);
    expect(part2ConsentFor(p.id, { name: recipient, type: "legal" }, "Referral for treatment").ok).toBe(false);
    expect(hlocSendBlocker({ patientId: p.id, outsideSudProvider: true, destination: recipient } as Parameters<typeof hlocSendBlocker>[0])).toMatch(/consent/);
  });
});