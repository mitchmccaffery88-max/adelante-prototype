// §B2-1 — consent record model extension: additive fields, multi-active per
// (type + recipient), consentCovers, validation, and rollback parity.
import "@/test/freezeClock";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type ConsentCategory } from "../ehr";
import { PART2_ELEMENT_KEYS, PART2_CHECKLIST_DRAFT_LABEL, validateConsentExtension, type ConsentRecordExtension } from "../consentRecordModel";

const CATS: ConsentCategory[] = ["sud_treatment", "mental_health", "case_coordination", "billing"] as ConsentCategory[];

/** Gate outputs for every seeded patient, captured identically on rollback a2601c9f. */
export function consentParitySnapshot() {
  return AdelanteEHR.listPatients().map((p) => {
    const a = AdelanteEHR.activeConsentRecord(p.id);
    return {
      id: p.id,
      active: a ? { id: a.id, formType: a.formType, status: a.status, sections: a.sections } : null,
      cats: CATS.map((c) => AdelanteEHR.isConsentCategoryAuthorized(p.id, c)),
      state: AdelanteEHR.getConsentState(p.id),
    };
  });
}

const by = { staffName: "Luz Herrera", role: "ecm_provider" };
const allElements = Object.fromEntries(PART2_ELEMENT_KEYS.map((k) => [k, true]));
const pid = () => AdelanteEHR.listPatients()[1]!.id;
const sig = (method: "e_sign" | "wet_sign_upload" | "verbal_assent") => ({
  method, signer: "Test Person", relationship: "patient" as const,
  signedAt: "2026-09-29T15:00:00.000Z", recordedAt: "2026-09-29T15:00:00.000Z", recordedBy: by,
});
function typed(ext: ConsentRecordExtension, over: { expirationDate?: string } = {}) {
  return AdelanteEHR.createConsentRecord({
    patientId: pid(), formType: "NonAB133", source: "test", signedByName: "Test Person", attested: true,
    effectiveDate: "2026-01-01", expirationDate: over.expirationDate, sections: [], capturedBy: by, extension: ext,
  });
}

describe("B2-1 parity with rollback", () => {
  it("activeConsentRecord / isConsentCategoryAuthorized / getConsentState are byte-identical for every seeded patient", () => {
    const golden = readFileSync("src/lib/__tests__/fixtures/consentParityB2-1.json", "utf8");
    expect(JSON.stringify(consentParitySnapshot())).toBe(golden.trim());
  });
});

describe("B2-1 consent record model", () => {
  it("old records stay valid with no extension fields", () => {
    const seed = AdelanteEHR.listConsentRecords("p1").find((r) => r.id === "cr-seed-1")!;
    expect(seed.consentType).toBeUndefined();
    expect(validateConsentExtension(seed)).toEqual([]);
  });

  it("keeps several active records per type + recipient and supersedes only within its own pair", () => {
    const before = JSON.stringify(consentParitySnapshot());
    const r = (name: string) => [{ kind: "org" as const, name }];
    const a = typed({ consentType: "hipaa_authorization", recipients: r("Clinic A"), signature: sig("e_sign") });
    const b = typed({ consentType: "hipaa_authorization", recipients: r("Clinic B"), signature: sig("e_sign") });
    const c = typed({ consentType: "telehealth", recipients: r("Clinic A"), signature: sig("e_sign") });
    const a2 = typed({ consentType: "hipaa_authorization", recipients: r("Clinic A"), signature: sig("e_sign") });
    const all = AdelanteEHR.listConsentRecords(pid());
    const st = (id: string) => all.find((x) => x.id === id)!.status;
    expect([st(a.id), st(b.id), st(c.id), st(a2.id)]).toEqual(["superseded", "active", "active", "active"]);
    expect(a2.supersedesId).toBe(a.id);
    // Typed records never change the existing gates.
    expect(JSON.stringify(consentParitySnapshot())).toBe(before);
  });

  it("consentCovers denies expired, revoked, superseded and legacyUnverified records live", () => {
    const at = new Date("2026-09-29T15:00:00.000Z");
    const r = [{ kind: "org" as const, name: "Covers Org" }];
    const q = { type: "ai_recording" as const, recipient: "Covers Org", at };
    const live = typed({ consentType: "ai_recording", recipients: r, purposeCode: "scribe", items: ["audio"], signature: sig("e_sign") });
    expect(AdelanteEHR.consentCovers(pid(), q)).toBe(true);
    expect(AdelanteEHR.consentCovers(pid(), { ...q, purpose: "scribe", item: "audio" })).toBe(true);
    expect(AdelanteEHR.consentCovers(pid(), { ...q, item: "video" })).toBe(false);
    expect(AdelanteEHR.consentCovers(pid(), { ...q, recipient: "Other" })).toBe(false);
    expect(AdelanteEHR.consentCovers(pid(), { ...q, at: new Date("2025-06-01") })).toBe(false); // not yet in force
    typed({ consentType: "ai_recording", recipients: r, signature: sig("e_sign") }); // supersedes `live`
    expect(AdelanteEHR.listConsentRecords(pid()).find((x) => x.id === live.id)!.status).toBe("superseded");
    const cur = AdelanteEHR.listConsentRecords(pid()).find((x) => x.consentType === "ai_recording" && x.status === "active")!;
    AdelanteEHR.revokeConsentRecord(cur.id, { reason: "patient asked", revokedBy: "Luz Herrera", role: "ecm_provider" });
    expect(AdelanteEHR.consentCovers(pid(), q)).toBe(false);
    typed({ consentType: "ai_recording", recipients: r, signature: sig("e_sign") }, { expirationDate: "2026-02-01" });
    expect(AdelanteEHR.consentCovers(pid(), q)).toBe(false); // expired by clock
    typed({ consentType: "ai_recording", recipients: r, signature: sig("e_sign"), legacyUnverified: true });
    expect(AdelanteEHR.consentCovers(pid(), q)).toBe(false);
  });

  it("verbal assent covers only referrer 'enrolled' updates and sms / portal reminders", () => {
    const at = new Date("2026-09-29T15:00:00.000Z");
    typed({ consentType: "referrer_authorization", recipients: [{ kind: "org", name: "Ref Org" }], purposeCode: "enrolled_update", signature: sig("verbal_assent") });
    expect(AdelanteEHR.consentCovers(pid(), { type: "referrer_authorization", recipient: "Ref Org", at })).toBe(true);
    typed({ consentType: "sms_reminder", signature: sig("verbal_assent") });
    typed({ consentType: "portal_reminder", signature: sig("verbal_assent") });
    expect(AdelanteEHR.consentCovers(pid(), { type: "sms_reminder", at })).toBe(true);
    expect(AdelanteEHR.consentCovers(pid(), { type: "portal_reminder", at })).toBe(true);
    expect(() => typed({ consentType: "referrer_authorization", purposeCode: "status_update", signature: sig("verbal_assent") })).toThrow(/Verbal assent/);
    expect(() => typed({ consentType: "telehealth", signature: sig("verbal_assent") })).toThrow(/Verbal assent/);
    expect(() => typed({ consentType: "hipaa_authorization", signature: sig("verbal_assent") })).toThrow(/Verbal assent/);
  });

  it("Part 2 types need every element checked plus e-sign or wet-sign upload", () => {
    expect(PART2_CHECKLIST_DRAFT_LABEL).toBe("Draft — pending counsel");
    const base = { consentType: "part2_specific_written" as const, recipients: [{ kind: "org" as const, name: "P2 Org" }] };
    expect(() => typed({ ...base, signature: sig("e_sign") })).toThrow(/missing required elements/);
    const partial = { ...allElements, redisclosureNotice: false };
    expect(() => typed({ ...base, part2Elements: partial, signature: sig("e_sign") })).toThrow(/redisclosureNotice/);
    expect(() => typed({ ...base, part2Elements: allElements, signature: sig("verbal_assent") })).toThrow(/e-signature or an uploaded wet signature/);
    expect(() => typed({ ...base, part2Elements: allElements })).toThrow(/e-signature/);
    expect(typed({ ...base, part2Elements: allElements, signature: sig("wet_sign_upload") }).status).toBe("active");
    expect(typed({ ...base, part2Elements: allElements, signature: sig("e_sign"), redisclosureNoticeVersion: "draft-1" }).status).toBe("active");
  });
});
