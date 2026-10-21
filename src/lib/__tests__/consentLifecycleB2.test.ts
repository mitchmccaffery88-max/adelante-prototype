// §B2-3 — revoke / renew / expiry / missing-or-expiring view for typed consent
// records. Enforcement stays OFF (B2-4): the parity test proves no gate result
// changes. NEW file; no existing test touched.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { chartAction } from "@/lib/chartActions";
import { _resetConsentCapture, captureConsentRecord, consentRecordHistory, requestSelfReSign } from "@/lib/consentCapture";
import { consentGapFor, consentGapWorklist, consentGateSnapshot, renewTypedConsent, revokeTypedConsent } from "@/lib/consentLifecycle";
import { ADVOCATE_ACTOR_ROLE, PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import type { ConsentType } from "@/lib/consentRecordModel";

const STAFF = { role: "ecm_provider" as const, staffId: "s-ecm", name: "Luz Herrera" };
const NOW = new Date("2026-10-21T12:00:00Z");

function capture(patientId: string, type: ConsentType, over: { recipient?: string; expiresOn?: string } = {}) {
  return captureConsentRecord({
    draft: {
      patientId,
      consentType: type,
      recipients: [{ kind: "org", name: over.recipient ?? "Valley Clinic" }],
      purpose: "Coordinate care",
      items: ["visit summaries"],
      expiresOn: over.expiresOn ?? "2027-10-21",
    },
    method: "e_sign",
    signer: "Test Signer",
    relationship: "patient",
    attested: true,
    actor: STAFF,
  });
}

const auditCount = () => AdelanteEHR.listAuditEvents({}).length;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("B2-3 consent lifecycle", () => {
  it("revoke is effective from that point on and keeps the record in history", () => {
    const p = AdelanteEHR.listPatients()[0];
    const rec = capture(p.id, "hipaa_authorization");
    expect(AdelanteEHR.consentCovers(p.id, { type: "hipaa_authorization", at: NOW })).toBe(true);
    const before = auditCount();
    const r = runAction("consent_record_revoke", STAFF, p, {
      via: "revokeTypedConsent",
      args: [{ recordId: rec.id, method: "written", note: "Patient asked in writing", actor: STAFF }],
    });
    expect(r.ok).toBe(true);
    expect(auditCount() - before).toBe(1); // the registry action is the one event
    const row = consentRecordHistory(p.id, NOW).find((h) => h.id === rec.id);
    expect(row?.status).toBe("revoked"); // history kept, nothing deleted
    expect(row?.revocation?.method).toBe("written");
    expect(AdelanteEHR.consentCovers(p.id, { type: "hipaa_authorization", at: NOW })).toBe(false);
  });

  it("renew supersedes only within the same type + recipient key", () => {
    const p = AdelanteEHR.listPatients()[1];
    const a = capture(p.id, "hipaa_authorization", { recipient: "Valley Clinic" });
    const b = capture(p.id, "hipaa_authorization", { recipient: "Other Org" });
    const r = runAction("consent_record_renew", STAFF, p, {
      via: "renewTypedConsent",
      args: [{ recordId: a.id, expiresOn: "2028-10-21", method: "e_sign", signer: "Test Signer", relationship: "patient", attested: true, actor: STAFF }],
    });
    expect(r.ok).toBe(true);
    const rows = consentRecordHistory(p.id, NOW);
    const oldRow = rows.find((h) => h.id === a.id);
    const newRow = rows.find((h) => h.supersedesId === a.id);
    const other = rows.find((h) => h.id === b.id);
    expect(oldRow?.status).toBe("superseded");
    expect(newRow?.status).toBe("active");
    expect(newRow?.expirationDate).toBe("2028-10-21");
    expect(other?.status).toBe("active"); // different recipient key: untouched
  });

  it("renew applies the same capture rules (Part 2 checklist, verbal assent limits)", () => {
    const p = AdelanteEHR.listPatients()[2];
    const rec = capture(p.id, "sms_reminder");
    expect(() =>
      renewTypedConsent({ recordId: rec.id, expiresOn: "2028-01-01", method: "e_sign", signer: "T S", relationship: "patient", attested: false, actor: STAFF }),
    ).toThrow(/Attestation/);
    expect(() =>
      renewTypedConsent({ recordId: rec.id, method: "e_sign", signer: "Test Signer", relationship: "patient", attested: true, actor: STAFF }),
    ).toThrow(/end date or an end event/);
  });

  it("expiry is computed on read under a pinned clock; the gap view flags it", () => {
    const p = AdelanteEHR.listPatients()[3];
    const rec = capture(p.id, "telehealth", { expiresOn: "2026-10-01" });
    expect(consentRecordHistory(p.id, NOW).find((h) => h.id === rec.id)?.status).toBe("expired");
    expect(AdelanteEHR.consentCovers(p.id, { type: "telehealth", at: NOW })).toBe(false);
    expect(consentGapFor(p.id, NOW).find((g) => g.consentType === "telehealth")?.state).toBe("expired");
    expect(consentGapFor(p.id, NOW).find((g) => g.consentType === "part2_tpo_single")?.state).toBe("missing");
    // Expiring within 30 days
    const soon = capture(p.id, "hipaa_authorization", { expiresOn: "2026-11-10" });
    expect(consentRecordHistory(p.id, NOW).find((h) => h.id === soon.id)?.status).toBe("active");
    expect(consentGapFor(p.id, NOW).find((g) => g.consentType === "hipaa_authorization")?.state).toBe("expiring");
  });

  it("the patient can revoke only their own records; advocates are denied", () => {
    const [p1, p2] = AdelanteEHR.listPatients();
    const own = capture(p1.id, "sms_reminder", { recipient: "Adelante" });
    const other = capture(p2.id, "sms_reminder", { recipient: "Adelante" });
    AdelanteEHR.setCurrentPatientId(p1.id);
    const okR = runAction("consent_record_patient_revoke", { role: PATIENT_ACTOR_ROLE }, p1, {
      via: "revokeTypedConsent",
      args: [{ recordId: own.id, method: "e_sign", actor: { role: "patient", name: "Patient One" } }],
    });
    expect(okR.ok).toBe(true);
    expect(consentRecordHistory(p1.id, NOW).find((h) => h.id === own.id)?.status).toBe("revoked");
    // Registry hides the action on someone else's record…
    const blocked = runAction("consent_record_patient_revoke", { role: PATIENT_ACTOR_ROLE }, p2, {
      via: "revokeTypedConsent",
      args: [{ recordId: other.id, method: "e_sign", actor: { role: "patient", name: "Patient One" } }],
    });
    expect(blocked.ok).toBe(false);
    // …and the store refuses even if called directly.
    expect(() => revokeTypedConsent({ recordId: other.id, method: "e_sign", actor: { role: "patient", name: "Patient One" } })).toThrow(/your own/);
    expect(consentRecordHistory(p2.id, NOW).find((h) => h.id === other.id)?.status).toBe("active");
    // Advocates have no revoke key at all.
    expect(chartAction("consent_record_revoke").allowed({ role: ADVOCATE_ACTOR_ROLE }, p1).state).toBe("hidden");
    expect(chartAction("consent_record_patient_revoke").allowed({ role: ADVOCATE_ACTOR_ROLE }, p1).state).toBe("hidden");
    expect(chartAction("consent_record_renew").allowed({ role: ADVOCATE_ACTOR_ROLE }, p1).state).toBe("hidden");
  });

  it("patient sign-again on an expired record reuses the e-sign path", () => {
    const p = AdelanteEHR.listPatients()[4];
    const rec = capture(p.id, "sms_reminder", { recipient: "Adelante", expiresOn: "2026-10-01" });
    AdelanteEHR.setCurrentPatientId(p.id);
    const req = requestSelfReSign(rec.id);
    expect(req.status).toBe("waiting");
    expect(req.draft.consentType).toBe("sms_reminder");
    // An active record cannot be re-signed.
    const active = capture(p.id, "hipaa_authorization");
    expect(() => requestSelfReSign(active.id)).toThrow(/still in effect/);
  });

  it("worklist is chart-entry only and labels follow the name policy", () => {
    const p = AdelanteEHR.listPatients()[5];
    expect(consentGapWorklist({ role: "billing" }, NOW)).toEqual([]); // no chart entry
    const rows = consentGapWorklist({ role: "ecm_provider", staffId: "s-ecm" }, NOW);
    expect(rows.length).toBeGreaterThan(0);
    const row = rows.find((r) => r.patientId === p.id);
    expect(row?.label).toBeTruthy();
    expect(rows.every((r) => r.state !== "ok")).toBe(true);
  });

  it("parity: no gate result changes from revoke / renew / expiry (enforcement is off until B2-4)", () => {
    const patients = AdelanteEHR.listPatients();
    const before = patients.map((p) => JSON.stringify(consentGateSnapshot(p.id, NOW)));
    // Exercise every B2-3 write on the first patient.
    const p = patients[0];
    const rec = capture(p.id, "hipaa_authorization", { recipient: "Parity Org" });
    revokeTypedConsent({ recordId: rec.id, method: "oral", actor: STAFF });
    const rec2 = capture(p.id, "telehealth", { recipient: "Parity Org" });
    renewTypedConsent({ recordId: rec2.id, expiresOn: "2028-01-01", method: "e_sign", signer: "Test Signer", relationship: "patient", attested: true, actor: STAFF });
    capture(p.id, "sms_reminder", { recipient: "Parity Org", expiresOn: "2026-10-01" }); // expired on read
    const after = patients.map((x) => JSON.stringify(consentGateSnapshot(x.id, NOW)));
    expect(after).toEqual(before);
  });
});

// Reset shared e-sign request state so repeat runs stay deterministic.
_resetConsentCapture();
