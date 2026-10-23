import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { consentGate } from "@/lib/consentGate";

const actor = { role: "sys_admin" as const, staffId: "s-admin1", staffName: "Adelante System Admin" };
const storeActor = { role: actor.role, staffId: actor.staffId, name: actor.staffName };
const scribeActor = { role: "therapist" as const, staffId: "s-th1", staffName: "Live QA therapist" };
let fixture = 0;
function fresh() {
  const result = runAction("patient_create_anyway", actor, undefined, {
    via: "createPatient", args: [{ firstName: "Live", lastName: `Consent QA ${++fixture}`, dob: `1990-01-0${fixture}` }],
  });
  expect(result.ok, result.ok ? "" : result.reason).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  const patient = result.value as ReturnType<typeof AdelanteEHR.createPatient>;
  return patient;
}

describe("B2-5 live untyped consistency", () => {
  it("ignores a flag callback, accepts a live section through the real action, and denies legacy history", () => {
    const p = fresh();
    const need = { types: ["ai_recording"] as const, recipients: ["Adelante"], purposes: ["ai_recording"], liveCategory: "ai_session_recording" };
    expect(consentGate(p.id, need, () => true)).toBe(false);
    const count = AdelanteEHR.listAuditEvents().length;
    const result = runAction("scribe_consent_grant", scribeActor, p, {
      args: [{ patientId: p.id, signedByName: "Live Consent QA", attested: true, part2: false,
        capturedBy: { staffName: scribeActor.staffName, role: scribeActor.role } }],
    });
    expect(result.ok, result.ok ? "" : result.reason).toBe(true);
    expect(AdelanteEHR.listAuditEvents().length - count).toBe(3);
    expect(AdelanteEHR.activeConsentRecord(p.id)?.signature?.signer).toBe("Live Consent QA");
    expect(AdelanteEHR.activeConsentRecord(p.id)?.document).toBeUndefined();
    expect(consentGate(p.id, need, () => false)).toBe(true);
    const migrate = runAction("consent_legacy_migrate", actor, p, {
      via: "migrateUnprovenConsents", args: [{ patientId: p.id, actor: storeActor }],
    });
    expect(migrate.ok).toBe(true);
    expect(consentGate(p.id, need, () => true)).toBe(false);
  });

  it("applicable revoked typed evidence prevents fallback to a live untyped record", () => {
    const p = fresh();
    const recipient = "Adelante";
    const need = { types: ["ai_recording"] as const, recipients: [recipient], purposes: ["ai_recording"], liveCategory: "ai_session_recording" };
    expect(consentGate(p.id, need, () => true)).toBe(false);
    const result = runAction("scribe_consent_grant", scribeActor, p, {
      args: [{ patientId: p.id, signedByName: "Live Consent QA", attested: true, part2: false, capturedBy: { staffName: scribeActor.staffName, role: scribeActor.role } }],
    });
    expect(result.ok).toBe(true);
    const live = AdelanteEHR.activeConsentRecord(p.id);
    expect(live?.consentType).toBeUndefined();
    expect(live?.legacyUnverified).not.toBe(true);
    expect(live?.signature?.signer).toBe("Live Consent QA");
    expect(live?.document).toBeUndefined();
    expect(consentGate(p.id, need, () => false)).toBe(true);
    const capture = runAction("consent_record_capture", actor, p, {
      via: "captureConsentRecord", args: [{ draft: { patientId: p.id, consentType: "ai_recording", recipients: [{ kind: "org", name: recipient }],
        purpose: "ai_recording", items: ["AI recording"], expiresOnEvent: "Patient revokes" },
        method: "e_sign", signer: "Live Consent QA", relationship: "patient", attested: true, actor: storeActor }],
    });
    expect(capture.ok).toBe(true);
    if (!capture.ok) throw new Error(capture.reason);
    const record = capture.value as ReturnType<typeof AdelanteEHR.createConsentRecord>;
    const revoke = runAction("consent_record_revoke", actor, p, {
      args: [{ recordId: record.id, method: "in_person", note: "Patient asked to stop", actor: storeActor }],
    });
    expect(revoke.ok).toBe(true);
    expect(consentGate(p.id, need, () => true)).toBe(false);
  });
});