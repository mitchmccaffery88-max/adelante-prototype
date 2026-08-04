// §ASCMI consent audit viewer — RBAC + filtering, asserted not assumed.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { STAFF_ROLES, canAccess } from "../roles";
import { STAFF_NAV, canSeeNavEntry } from "../navSections";
import { resolveNavAccess } from "../navGuard";
import { categoriesForAuditEvent } from "../consentAudit";

const entry = STAFF_NAV.find((e) => e.to === "/consent-audit")!;

describe("consent audit viewer gating", () => {
  it("is registered in the nav registry", () => {
    expect(entry).toBeTruthy();
    expect(entry.group).toBe("revenue");
  });

  it("is visible exactly to roles with consent_ledger read access", () => {
    for (const { key: role } of STAFF_ROLES) {
      const level = canAccess(role, "consent_ledger").level;
      const readable = level === "read" || level === "write";
      expect(canSeeNavEntry(role, entry)).toBe(readable);
    }
  });

  it("redirects roles without access away from the deep link", () => {
    for (const { key: role } of STAFF_ROLES) {
      const res = resolveNavAccess(role, "/consent-audit");
      const level = canAccess(role, "consent_ledger").level;
      const readable = level === "read" || level === "write";
      expect(res.status).toBe(readable ? "allowed" : "denied");
    }
  });
});

describe("consent audit filtering", () => {
  const patient = AdelanteEHR.listPatients()[0]!;
  const other = AdelanteEHR.listPatients()[1]!;

  it("narrows by patient", () => {
    AdelanteEHR.createConsentRecord({
      patientId: patient.id,
      formType: "AB133",
      source: "test",
      signedByName: "Test Patient",
      attested: true,
      effectiveDate: "2020-01-01",
      sections: [
        { category: "sud_treatment", authorized: true },
        { category: "billing", authorized: false },
      ],
      capturedBy: { staffName: "Luz Herrera", role: "case_manager" },
    });
    const mine = AdelanteEHR.listAuditEvents({
      category: ["consent", "disclosure"],
      patientId: patient.id,
    });
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((e) => e.patientId === patient.id)).toBe(true);
    expect(
      AdelanteEHR.listAuditEvents({ category: ["consent", "disclosure"], patientId: other.id }).every(
        (e) => e.patientId === other.id,
      ),
    ).toBe(true);
  });

  it("narrows by consent category", () => {
    const events = AdelanteEHR.listAuditEvents({ category: "consent", patientId: patient.id });
    const sud = events.filter((e) => categoriesForAuditEvent(e).includes("sud_treatment"));
    const billing = events.filter((e) => categoriesForAuditEvent(e).includes("billing"));
    expect(sud.length).toBeGreaterThan(0);
    expect(billing.length).toBe(0);
  });
});

describe("patient consent view scoping", () => {
  it("only ever returns the patient's own records", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    expect(AdelanteEHR.listConsentRecords(p.id).every((r) => r.patientId === p.id)).toBe(true);
  });
});
