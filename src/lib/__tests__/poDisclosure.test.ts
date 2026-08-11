// §Adelante Journey Phase 3 — the PO two-tier split, proven the same way the
// AB 133 split was proven: by spying on the consent ledger to show the two
// paths are mechanically distinct, not just documented as distinct.
import { describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  assertPatientControllable,
  isPoItemPatientControllable,
  poDisclosureDecision,
  poMandatoryDisclosure,
  poVoluntaryDisclosure,
  PO_DISCLOSURE_ITEMS,
} from "@/lib/poDisclosure";

const authorizeVoluntary = (patientId: string) =>
  AdelanteEHR.createConsentRecord({
    patientId,
    formType: "NonAB133",
    source: "test",
    signedByName: "Test Member",
    attested: true,
    effectiveDate: "2026-01-01",
    sections: [{ category: "po_voluntary_coordination", authorized: true }],
    capturedBy: { staffName: "test", role: "case_manager" },
  });

describe("PO disclosure — mandatory tier is not patient-controllable", () => {
  it("never consults the consent ledger", () => {
    const spy = vi.spyOn(AdelanteEHR, "isConsentCategoryAuthorized");
    const activeSpy = vi.spyOn(AdelanteEHR, "activeConsentRecord");
    const d = poMandatoryDisclosure({
      item: "mandated_session_attendance",
      mandate: { kind: "supervision_condition" },
    });
    expect(d.allowed).toBe(true);
    expect(d.gate).toBe("legal_mandate");
    expect(d.consentChecked).toBe(false);
    expect(d.patientControllable).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(activeSpy).not.toHaveBeenCalled();
    spy.mockRestore();
    activeSpy.mockRestore();
  });

  it("cannot be turned off by revoking consent — a full authorize/revoke cycle changes nothing", () => {
    const pid = "p2";
    const rec = authorizeVoluntary(pid);
    const withConsent = poDisclosureDecision({
      patientId: pid,
      item: "mandated_program_enrollment",
      mandate: { kind: "court_order" },
    });
    AdelanteEHR.revokeConsentRecord(rec.id, {
      reason: "member withdrew",
      revokedBy: "Test Member",
      role: "case_manager",
    });
    const afterRevoke = poDisclosureDecision({
      patientId: pid,
      item: "mandated_program_enrollment",
      mandate: { kind: "court_order" },
    });
    expect(withConsent.allowed).toBe(true);
    expect(afterRevoke.allowed).toBe(true);
    expect(afterRevoke.gate).toBe("legal_mandate");
  });

  it("offers no write path: the consent path refuses mandatory items outright", () => {
    const d = poVoluntaryDisclosure({ patientId: "p2", item: "mandated_program_discharge" });
    expect(d.allowed).toBe(false);
    expect(d.consentChecked).toBe(false);
    expect(() => assertPatientControllable("mandated_program_discharge")).toThrow(/legal mandate/);
    expect(isPoItemPatientControllable("mandated_program_discharge")).toBe(false);
  });

  it("denies when no order or supervision condition is on file", () => {
    const d = poMandatoryDisclosure({ item: "mandated_session_attendance" });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/No court order/);
  });
});

describe("PO disclosure — voluntary tier is real revocable consent", () => {
  it("denies by default, allows once authorized, and stops on revocation", () => {
    const pid = "p3";
    const before = poDisclosureDecision({ patientId: pid, item: "care_plan_progress" });
    expect(before.allowed).toBe(false);
    expect(before.consentChecked).toBe(true);

    const rec = authorizeVoluntary(pid);
    const during = poDisclosureDecision({ patientId: pid, item: "care_plan_progress" });
    expect(during.allowed).toBe(true);
    expect(during.gate).toBe("consent_record");
    expect(during.patientControllable).toBe(true);

    AdelanteEHR.revokeConsentRecord(rec.id, {
      reason: "member withdrew",
      revokedBy: "Test Member",
      role: "case_manager",
    });
    const after = poDisclosureDecision({ patientId: pid, item: "care_plan_progress" });
    expect(after.allowed).toBe(false);
  });

  it("consults the ledger with the PO-specific category only", () => {
    const spy = vi.spyOn(AdelanteEHR, "isConsentCategoryAuthorized");
    poVoluntaryDisclosure({ patientId: "p9", item: "appointment_logistics" });
    expect(spy).toHaveBeenCalledWith("p9", "po_voluntary_coordination", expect.any(Date));
    spy.mockRestore();
  });

  it("a mandate cannot substitute for consent on a voluntary item", () => {
    const d = poMandatoryDisclosure({
      item: "wellness_check_in",
      mandate: { kind: "court_order" },
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/voluntary/);
  });
});

describe("PO disclosure — the two paths are mechanically distinct", () => {
  it("same patient, same moment: mandate allows while consent denies, via different gates", () => {
    const pid = "p4";
    const mandated = poDisclosureDecision({
      patientId: pid,
      item: "mandated_session_attendance",
      mandate: { kind: "supervision_condition" },
    });
    const voluntary = poDisclosureDecision({ patientId: pid, item: "wellness_check_in" });
    expect(mandated.allowed).toBe(true);
    expect(voluntary.allowed).toBe(false);
    expect(mandated.gate).not.toBe(voluntary.gate);
    expect(mandated.consentChecked).toBe(false);
    expect(voluntary.consentChecked).toBe(true);
  });

  it("every item declares exactly one tier and the tiers are both populated", () => {
    expect(PO_DISCLOSURE_ITEMS.filter((i) => i.tier === "mandatory").length).toBeGreaterThan(0);
    expect(PO_DISCLOSURE_ITEMS.filter((i) => i.tier === "voluntary").length).toBeGreaterThan(0);
  });
});
