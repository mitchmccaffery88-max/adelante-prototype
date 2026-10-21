// §B2-2 — consent capture flows: staff capture, verbal-assent limits, Part 2
// validation, paper upload (Simulated), patient e-sign, history and the
// advocate's own-release view. Each action writes exactly one standard
// audit event; existing gates stay byte-identical.
import "@/test/freezeClock";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { runAction } from "../actions/runAction";
import { PATIENT_ACTOR_ROLE } from "../patientBooking";
import { PART2_ELEMENT_KEYS } from "../consentRecordModel";
import { advocateOwnReleaseStatus, consentRecordHistory, listESignRequests, myConsentRecords, type CaptureDraft } from "../consentCapture";
import { chartAction } from "../chartActions";
import { consentParitySnapshot } from "./consentRecordModelB2.test";

const staff = { role: "clinical_coordinator" as const, staffId: "s-cc", staffName: "Coordinator Test" };
const storeActor = { role: "clinical_coordinator" as const, staffId: "s-cc", name: "Coordinator Test" };
const allElements = Object.fromEntries(PART2_ELEMENT_KEYS.map((k) => [k, true]));
const patient = () => AdelanteEHR.listPatients()[2]!;
const draft = (over: Partial<CaptureDraft> = {}): CaptureDraft => ({
  patientId: patient().id,
  consentType: "hipaa_authorization",
  recipients: [{ kind: "org", name: "Valley Clinic" }],
  purpose: "Coordinate care",
  items: ["visit summaries"],
  expiresOn: "2027-10-21",
  ...over,
});
const succeeded = (actionId: string) =>
  AdelanteEHR.listAuditEvents({}).filter((e) => e.action === "action.succeeded" && (e.detail as { actionId?: string }).actionId === actionId).length;

describe("B2-2 consent capture", () => {
  it("staff in-person e-sign writes one typed record and one action.succeeded; gates unchanged", () => {
    const before = JSON.stringify(consentParitySnapshot());
    const n = succeeded("consent_record_capture");
    const r = runAction("consent_record_capture", staff, patient(), { args: [{ draft: draft(), method: "e_sign", signer: "Test Person", relationship: "patient", attested: true, actor: storeActor }] });
    expect(r.ok).toBe(true);
    expect(succeeded("consent_record_capture")).toBe(n + 1);
    const h = consentRecordHistory(patient().id).find((x) => x.consentType === "hipaa_authorization")!;
    expect(h.status).toBe("active");
    expect(h.method).toBe("e_sign");
    expect(h.document?.documentHash).toMatch(/^fnv1a:/);
    expect(JSON.stringify(consentParitySnapshot())).toBe(before);
    expect(JSON.stringify(consentParitySnapshot())).toBe(readFileSync("src/lib/__tests__/fixtures/consentParityB2-1.json", "utf8").trim());
  });

  it("verbal assent: allowed for referrer enrolled update with exact words, refused for Part 2 and HIPAA", () => {
    const ok = runAction("consent_record_capture", staff, patient(), { args: [{ draft: draft({ consentType: "referrer_authorization", purposeCode: "enrolled_update", recipients: [{ kind: "person", name: "Aunt Rosa" }] }), method: "verbal_assent", signer: "Test Person", relationship: "patient", attested: true, assentWording: "Can we tell your aunt you are enrolled?", actor: storeActor }] });
    expect(ok.ok).toBe(true);
    const h = consentRecordHistory(patient().id).find((x) => x.consentType === "referrer_authorization")!;
    expect(h.assentWording).toBe("Can we tell your aunt you are enrolled?");
    for (const consentType of ["part2_tpo_single", "hipaa_authorization", "counseling_notes_release"] as const) {
      const r = runAction("consent_record_capture", staff, patient(), { args: [{ draft: draft({ consentType, part2Elements: allElements }), method: "verbal_assent", signer: "Test Person", relationship: "patient", attested: true, assentWording: "Some words read aloud here", actor: storeActor }] });
      expect(r.ok).toBe(false);
    }
  });

  it("Part 2 cannot be saved without all eight elements", () => {
    const missing = runAction("consent_record_capture", staff, patient(), { args: [{ draft: draft({ consentType: "part2_tpo_single", part2Elements: { patientName: true } }), method: "e_sign", signer: "Test Person", relationship: "patient", attested: true, actor: storeActor }] });
    expect(missing.ok).toBe(false);
    const full = runAction("consent_record_capture", staff, patient(), { args: [{ draft: draft({ consentType: "part2_tpo_single", part2Elements: allElements }), method: "e_sign", signer: "Test Person", relationship: "patient", attested: true, actor: storeActor }] });
    expect(full.ok).toBe(true);
  });

  it("paper upload is Simulated in its audit and keeps the optional witness", () => {
    const r = runAction("consent_record_upload", staff, patient(), { args: [{ draft: draft({ consentType: "telehealth" }), signer: "Test Person", relationship: "patient", signedOn: "2026-10-20", fileName: "scan.pdf", witness: "Front desk", actor: storeActor }] });
    expect(r.ok).toBe(true);
    expect((r.event.detail as { simulated?: boolean }).simulated).toBe(true);
    const h = consentRecordHistory(patient().id).find((x) => x.consentType === "telehealth")!;
    expect(h.method).toBe("wet_sign_upload");
    expect(h.witness).toBe("Front desk");
    expect(h.simulatedUpload).toBe(true);
  });

  it("patient e-signs their own request; another patient cannot", () => {
    const p = patient();
    const sent = runAction<{ id: string }>("consent_record_request_esign", staff, p, { args: [{ draft: draft({ consentType: "sms_reminder" }), actor: storeActor }] });
    expect(sent.ok).toBe(true);
    const req = (sent as { value: { id: string } }).value;
    AdelanteEHR.setCurrentPatientId(AdelanteEHR.listPatients()[3]!.id);
    expect(runAction("consent_record_patient_sign", { role: PATIENT_ACTOR_ROLE }, p, { args: [{ requestId: req.id, typedName: "Test Person", attested: true, language: "es" }] }).ok).toBe(false);
    AdelanteEHR.setCurrentPatientId(p.id);
    const n = succeeded("consent_record_patient_sign");
    expect(runAction("consent_record_patient_sign", { role: PATIENT_ACTOR_ROLE }, p, { args: [{ requestId: req.id, typedName: "Test Person", attested: true, language: "es" }] }).ok).toBe(true);
    expect(succeeded("consent_record_patient_sign")).toBe(n + 1);
    expect(listESignRequests(p.id).find((r) => r.id === req.id)!.status).toBe("signed");
    expect(myConsentRecords(p.id).some((r) => r.consentType === "sms_reminder" && r.status === "active")).toBe(true);
  });

  it("advocate sees only their own release status", () => {
    const link = AdelanteEHR.listAdvocateLinks()[0]!;
    const before = advocateOwnReleaseStatus(link.id);
    expect(before).toBe("none");
    runAction("consent_record_capture", staff, AdelanteEHR.getPatient(link.patientId), { args: [{ draft: draft({ patientId: link.patientId, consentType: "advocate_release", recipients: [{ kind: "person", name: "Helper", directoryRef: link.id }] }), method: "e_sign", signer: "Test Person", relationship: "patient", attested: true, actor: storeActor }] });
    expect(advocateOwnReleaseStatus(link.id)).toBe("active");
    expect(advocateOwnReleaseStatus("not-a-link")).toBe("none");
  });

  it("new keys are gated exactly like the consent_form_* keys", () => {
    const roles = ["clinician", "billing", "peer_specialist", "clinical_coordinator", "sys_admin", "medical_assistant"] as const;
    for (const role of roles) {
      const a = { role };
      expect(chartAction("consent_record_capture").allowed(a, undefined).state).toBe(chartAction("consent_form_revoke").allowed(a, undefined).state);
      expect(chartAction("consent_record_upload").allowed(a, undefined).state).toBe(chartAction("consent_form_revoke").allowed(a, undefined).state);
      expect(chartAction("consent_record_request_esign").allowed(a, undefined).state).toBe(chartAction("consent_form_send").allowed(a, undefined).state);
      expect(chartAction("consent_record_patient_sign").allowed(a, undefined).state).toBe("hidden");
    }
  });
});
