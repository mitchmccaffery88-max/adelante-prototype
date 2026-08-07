// §ASCMI consent infrastructure — structured record, live gate, auto-stop.
import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { canAccess } from "../roles";
import { buildPrintRecordDocument } from "../printRecord";

const patient = () => AdelanteEHR.listPatients()[0]!;

function capture(over: { effectiveDate?: string; expirationDate?: string } = {}) {
  return AdelanteEHR.createConsentRecord({
    patientId: patient().id,
    formType: "AB133",
    source: "test",
    signedByName: "Test Patient",
    attested: true,
    effectiveDate: over.effectiveDate ?? "2020-01-01",
    expirationDate: over.expirationDate,
    sections: [
      { category: "sud_treatment", authorized: true },
      { category: "mental_health", authorized: true },
      { category: "case_coordination", authorized: false },
      { category: "billing", authorized: false },
    ],
    capturedBy: { staffId: "s-cm1", staffName: "Luz Herrera", role: "ecm_provider" },
  });
}

describe("structured consent records", () => {
  beforeEach(() => {
    // Leave every prior record inactive so each test starts from a known state.
    for (const r of AdelanteEHR.listConsentRecords(patient().id)) {
      if (r.status === "active")
        AdelanteEHR.revokeConsentRecord(r.id, {
          reason: "test reset",
          revokedBy: "test",
          role: "sys_admin",
        });
    }
  });

  it("requires attestation and a typed signature", () => {
    expect(() =>
      AdelanteEHR.createConsentRecord({
        patientId: patient().id,
        formType: "AB133",
        source: "test",
        signedByName: "Test Patient",
        attested: false,
        effectiveDate: "2020-01-01",
        sections: [],
        capturedBy: { staffName: "Luz Herrera", role: "ecm_provider" },
      }),
    ).toThrow(/Attestation/);
  });

  it("creates an auditable record and derives getConsentState from it", () => {
    const rec = capture();
    expect(rec.status).toBe("active");
    expect(AdelanteEHR.getConsentState(patient().id).part2Sud).toBe(true);
    const audit = AdelanteEHR.listAuditEvents({ patientId: patient().id, category: "consent" });
    expect(audit.some((e) => e.action === "consent_record_created")).toBe(true);
  });

  it("supersedes the prior active record instead of deleting it", () => {
    const first = capture();
    const second = capture();
    const all = AdelanteEHR.listConsentRecords(patient().id);
    expect(all.find((r) => r.id === first.id)?.status).toBe("superseded");
    expect(second.supersedesId).toBe(first.id);
  });

  it("keeps the revoked original on file with reason + timestamp", () => {
    const rec = capture();
    AdelanteEHR.revokeConsentRecord(rec.id, {
      reason: "patient withdrew",
      revokedBy: "Luz Herrera",
      role: "ecm_provider",
    });
    const stored = AdelanteEHR.listConsentRecords(patient().id).find((r) => r.id === rec.id)!;
    expect(stored.status).toBe("revoked");
    expect(stored.revocationReason).toBe("patient withdrew");
    expect(stored.revokedAt).toBeTruthy();
  });

  // §6 — auto-stop, proved rather than assumed.
  it("auto-stops the SAME canAccess call on revocation, with nothing else notified", () => {
    const rec = capture();
    const check = () => canAccess("ecm_provider", "screeners_sud", patient());
    expect(check().locked).toBe(false);
    AdelanteEHR.revokeConsentRecord(rec.id, {
      reason: "revoked",
      revokedBy: "Luz Herrera",
      role: "ecm_provider",
    });
    expect(check().locked).toBe(true);
  });

  it("auto-stops on expiry with no revocation and no write of any kind", () => {
    capture({ effectiveDate: "2020-01-01", expirationDate: "2020-01-02" });
    expect(canAccess("ecm_provider", "screeners_sud", patient()).locked).toBe(true);
  });

  it("does not unlock a category the record did not authorize", () => {
    capture();
    expect(AdelanteEHR.isConsentCategoryAuthorized(patient().id, "billing")).toBe(false);
  });

  it("logs a disclosure audit entry when gated content is included in an export", () => {
    capture();
    const p = patient();
    // Guarantee there is consent-gated content to disclose.
    const note = AdelanteEHR.addProgressNote(p.id, {
      clinicianId: "c1",
      date: new Date().toISOString().slice(0, 10),
      sessionType: "individual",
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
      category: "sud",
    });
    AdelanteEHR.signProgressNote(p.id, note!.id, {
      signedBy: "Dr. R. Bagga",
      role: "pmhnp",
      attested: true,
    });
    const before = AdelanteEHR.listAuditEvents({
      patientId: p.id,
      category: "disclosure",
    }).length;
    buildPrintRecordDocument({
      patient: p,
      role: "pmhnp",
      flags: { meds: false, mar: false, notes: true, notesScope: "all" },
    });
    const after = AdelanteEHR.listAuditEvents({ patientId: p.id, category: "disclosure" });
    expect(after.length).toBe(before + 1);
    expect(after[0]!.detail?.["categories"]).toEqual(["sud_treatment"]);
    expect(after[0]!.detail?.["consentRecordId"]).toBeTruthy();
  });

  it("does not log a disclosure when the gated note is masked for the role", () => {
    // No active consent → ecm_provider sees the SUD note masked.
    const p = patient();
    const before = AdelanteEHR.listAuditEvents({ patientId: p.id, category: "disclosure" }).length;
    buildPrintRecordDocument({
      patient: p,
      role: "ecm_provider",
      flags: { meds: false, mar: false, notes: true, notesScope: "all" },
    });
    expect(
      AdelanteEHR.listAuditEvents({ patientId: p.id, category: "disclosure" }).length,
    ).toBe(before);
  });
});