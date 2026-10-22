// §B2-6 — consent audit events + disclosure links. Event names ride on the
// EXISTING audit entry of each write (counts unchanged); consent.expired is the
// only new entry, written once per record on first read. Disclosure links are
// read-only and never change a decision. Cross-version parity lives in
// consentAuditB2Parity.test.ts.
import "@/test/freezeClock";
import { describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "../ehr";
import { runAction } from "../actions/runAction";
import { PART2_ELEMENT_KEYS } from "../consentRecordModel";
import { consentRecordHistory, type CaptureDraft } from "../consentCapture";
import { CONSENT_EXPIRED_AUDIT_ACTION } from "../consentEvents";
import { consentGateSnapshot } from "../consentLifecycle";
import { disclose, disclosureLinkLabel, getDisclosureEntry, NO_TYPED_RECORD_LABEL, type DisclosureRequest } from "../part2Disclosure";
import { signChecked, revokeForm } from "../consentForms";

const staff = { role: "ecm_provider" as const, staffId: "s-ecm", staffName: "ECM Test" };
const storeActor = { role: "ecm_provider" as const, staffId: "s-ecm", name: "Luz Herrera" };
const allElements = Object.fromEntries(PART2_ELEMENT_KEYS.map((k) => [k, true]));
const enroll = (last: string) => {
  const r = AdelanteEHR.createReferral({ firstName: "Prueba", lastName: last, dob: "1990-01-01", phone: "5595550311", referringAgency: "Clinic", referrerName: "Ref", referrerPhone: "5595550100", referralSource: "community_based_organization", consentToContact: true, channel: "staff" } as never);
  return AdelanteEHR.enrollReferral(r.id) as string;
};
const draft = (pid: string, over: Partial<CaptureDraft> = {}): CaptureDraft => ({
  patientId: pid, consentType: "hipaa_authorization", recipients: [{ kind: "org", name: "Valley Clinic" }], purpose: "Coordinate care", items: ["visit summaries"], expiresOn: "2027-10-21", ...over,
});
const capture = (pid: string, over: Partial<CaptureDraft> = {}) =>
  runAction("consent_record_capture", staff, AdelanteEHR.getPatient(pid), { args: [{ draft: draft(pid, over), method: "e_sign", signer: "Test Person", relationship: "patient", attested: true, actor: storeActor }] });
const events = (pid: string) => AdelanteEHR.listAuditEvents({ patientId: pid });
const withEvent = (pid: string, name: string) => events(pid).filter((e) => (e.detail as Record<string, unknown>)?.["consentEvent"] === name);

describe("B2-6 consent event names on existing audit entries", () => {
  it("capture: consent.captured once, on consent_record_created; capture still writes 2 entries", () => {
    const pid = enroll("AuditCapture");
    const n = events(pid).length;
    expect(capture(pid).ok).toBe(true);
    expect(events(pid).length - n).toBe(2);
    const hits = withEvent(pid, "consent.captured");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.action).toBe("consent_record_created");
  });

  it("paper upload: consent.uploaded; patient e-sign: consent.signed", () => {
    const pid = enroll("AuditUpload");
    const up = runAction("consent_record_upload", staff, AdelanteEHR.getPatient(pid), { args: [{ draft: draft(pid, { consentType: "telehealth" }), signer: "Test Person", relationship: "patient", signedOn: "2026-09-01", fileName: "scan.pdf", actor: storeActor }] });
    expect(up.ok ? "" : up.reason).toBe("");
    {
      expect(withEvent(pid, "consent.uploaded")).toHaveLength(1);
      expect(withEvent(pid, "consent.uploaded")[0]!.action).toBe("consent_record_created");
    }
    const created = AdelanteEHR.createConsentRecord({ patientId: pid, formType: "NonAB133", source: "portal e-sign", signedByName: "Test Person", attested: true, effectiveDate: "2026-09-29", sections: [], capturedBy: { staffName: "Patient (self-service)", role: "patient" }, extension: { consentType: "sms_reminder", recipients: [], signature: { method: "e_sign", signer: "Test Person", relationship: "patient", signedAt: "x", recordedAt: "x", recordedBy: { staffName: "Patient (self-service)", role: "patient" } } } });
    const signed = withEvent(pid, "consent.signed");
    expect(signed).toHaveLength(1);
    expect((signed[0]!.detail as Record<string, unknown>)["consentEventRecordId"]).toBe(created.id);
  });

  it("revoke: consent.revoked on the single registry entry (count stays 1)", () => {
    const pid = enroll("AuditRevoke");
    capture(pid);
    const rec = AdelanteEHR.listConsentRecords(pid).find((r) => r.consentType)!;
    const n = events(pid).length;
    const r = runAction("consent_record_revoke", staff, AdelanteEHR.getPatient(pid), { args: [{ recordId: rec.id, method: "written", actor: storeActor }] });
    expect(r.ok ? "" : r.reason).toBe("");
    expect(events(pid).length - n).toBe(1);
    const hits = withEvent(pid, "consent.revoked");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.action).toBe("action.succeeded");
    expect((hits[0]!.detail as Record<string, unknown>)["consentRecordId"]).toBe(rec.id);
  });

  it("renew: consent.renewed + consent.superseded on the created entry; renew still writes 2 entries", () => {
    const pid = enroll("AuditRenew");
    capture(pid);
    const old = AdelanteEHR.listConsentRecords(pid).find((r) => r.consentType)!;
    const n = events(pid).length;
    const r = runAction("consent_record_renew", staff, AdelanteEHR.getPatient(pid), { args: [{ recordId: old.id, expiresOn: "2028-01-01", method: "e_sign", signer: "Test Person", relationship: "patient", attested: true, actor: storeActor }] });
    expect(r.ok ? "" : r.reason).toBe("");
    expect(events(pid).length - n).toBe(2);
    const renewed = withEvent(pid, "consent.renewed");
    expect(renewed).toHaveLength(1);
    expect(renewed[0]!.action).toBe("consent_record_created");
    const d = renewed[0]!.detail as Record<string, unknown>;
    expect(d["supersededConsentEvent"]).toBe("consent.superseded");
    expect(d["supersededRecordId"]).toBe(old.id);
    expect(withEvent(pid, "consent.captured")).toHaveLength(1); // the original capture only
  });

  it("legacy consent_form flows: the sources signOne/revokeForm write map to consent.signed / consent.revoked", () => {
    const pid = enroll("AuditLegacyForm");
    const mk = (source: string) => AdelanteEHR.createConsentRecord({ patientId: pid, formType: "NonAB133", source, signedByName: "Test Person", attested: true, effectiveDate: "2026-09-01", sections: [{ category: "telehealth" as never, authorized: true }], capturedBy: { staffName: "Patient (self-signed)", role: "patient" } });
    const a = mk("form:telehealth v1");
    const b = mk("form:telehealth revoked");
    const signed = withEvent(pid, "consent.signed");
    const revoked = withEvent(pid, "consent.revoked");
    expect(signed.map((e) => (e.detail as Record<string, unknown>)["consentEventRecordId"])).toEqual([a.id]);
    expect(revoked.map((e) => (e.detail as Record<string, unknown>)["consentEventRecordId"])).toEqual([b.id]);
    expect(revoked[0]!.action).toBe("consent_record_created");
    expect((revoked[0]!.detail as Record<string, unknown>)["supersededRecordId"]).toBe(a.id);
    expect(typeof signChecked).toBe("function");
    expect(typeof revokeForm).toBe("function");
  });

  it("metadata carries no names, reasons or SUD content", () => {
    const pid = enroll("AuditNeutral");
    capture(pid, { consentType: "part2_tpo_single", part2Elements: allElements, recipients: [{ kind: "person", name: "Aunt Rosa" }], purpose: "Opioid treatment coordination" });
    const e = withEvent(pid, "consent.captured")[0]!;
    const d = e.detail as Record<string, unknown>;
    const meta = Object.fromEntries(Object.entries(d).filter(([k]) => ["consentEvent", "consentType", "consentEventRecordId", "consentEventActorRole", "recipientKind"].includes(k)));
    expect(Object.keys(meta).sort()).toEqual(["consentEvent", "consentEventActorRole", "consentEventRecordId", "consentType", "recipientKind"]);
    const text = JSON.stringify(meta);
    for (const bad of ["Aunt Rosa", "Rosa", "Test Person", "Luz", "Opioid", "Prueba", "AuditNeutral"]) expect(text).not.toContain(bad);
    expect(meta["recipientKind"]).toBe("person");
    expect(meta["consentEventActorRole"]).toBe("ecm_provider");
  });
});

describe("B2-6 consent.expired", () => {
  it("is emitted exactly once per record, the first time a read finds it expired", () => {
    const pid = enroll("AuditExpired");
    capture(pid, { consentType: "telehealth", expiresOn: "2026-10-15" });
    const rec = AdelanteEHR.listConsentRecords(pid).find((r) => r.consentType)!;
    const count = () => events(pid).filter((e) => e.action === CONSENT_EXPIRED_AUDIT_ACTION).length;
    consentRecordHistory(pid); // still active at the frozen 2026-09-29
    expect(count()).toBe(0);
    consentRecordHistory(pid, new Date("2026-11-01T00:00:00Z")); // future read never emits
    expect(count()).toBe(0);
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    try {
      consentRecordHistory(pid);
      consentRecordHistory(pid);
      consentRecordHistory(pid);
      expect(count()).toBe(1);
      const e = events(pid).find((x) => x.action === CONSENT_EXPIRED_AUDIT_ACTION)!;
      expect((e.detail as Record<string, unknown>)["consentEvent"]).toBe("consent.expired");
      expect((e.detail as Record<string, unknown>)["consentRecordId"]).toBe(rec.id);
    } finally {
      vi.setSystemTime(new Date("2026-09-29T15:00:00.000Z"));
    }
  });
});

describe("B2-6 disclosure links", () => {
  const actor = { name: "Dr. Test Person", role: "therapist", staffId: "s-test" };
  const req = (pid: string, over: Partial<DisclosureRequest> = {}): DisclosureRequest => ({ patientId: pid, actor, recipient: { name: "Outside Clinic", type: "provider" }, purpose: "Referral for treatment", channel: "referral_out", recordClasses: ["SUD treatment notes"], ...over });

  it("links a covering typed record and appends the disclosure id; null is labelled legacy", () => {
    // A seeded person whose existing (legacy) consent already allows this disclosure — enforcement is unchanged.
    const pid = enroll("LinkCovered");
    AdelanteEHR.createConsentRecord({ patientId: pid, formType: "NonAB133", source: "test", signedByName: "Test Person", attested: true, effectiveDate: "2026-09-01", sections: [{ category: "information_sharing_disclosure", authorized: true }], capturedBy: { staffName: "Luz Herrera", role: "ecm_provider" } });
    expect(disclose(req(pid)).ok).toBe(true);
    const none = disclose(req(pid, { recipient: { name: "Me", type: "patient" }, purpose: "Own copy", channel: "record_print" }));
    expect(none.ok && none.entry?.consentRecordId).toBeNull();
    expect(none.ok && disclosureLinkLabel(none.entry!)).toBe(NO_TYPED_RECORD_LABEL);
    expect(NO_TYPED_RECORD_LABEL).toBe("No typed record (legacy)");
    expect(capture(pid, { consentType: "part2_specific_written", part2Elements: allElements, recipients: [{ kind: "org", name: "Outside Clinic" }], purpose: "Referral for treatment" }).ok).toBe(true);
    const rec = AdelanteEHR.listConsentRecords(pid).find((r) => r.consentType === "part2_specific_written")!;
    const r = disclose(req(pid));
    if (!r.ok) throw new Error(r.reason);
    expect(r.entry!.consentRecordId).toBe(rec.id);
    expect(getDisclosureEntry(r.entry!.id)!.consentRecordId).toBe(rec.id);
    expect(AdelanteEHR.listConsentRecords(pid).find((x) => x.id === rec.id)!.disclosureIds).toEqual([r.entry!.id]);
    expect(consentRecordHistory(pid).find((h) => h.id === rec.id)!.disclosureIds).toEqual([r.entry!.id]);
  });

  it("a different recipient or purpose does not link", () => {
    const pid = enroll("LinkMismatch");
    capture(pid, { consentType: "part2_specific_written", part2Elements: allElements, recipients: [{ kind: "org", name: "Outside Clinic" }], purpose: "Referral for treatment" });
    const r = disclose(req(pid, { recipient: { name: "Other Clinic", type: "provider" } }));
    expect(r.ok ? r.entry?.consentRecordId : "blocked").toSatisfy((v: unknown) => v === null || v === "blocked");
  });

  it("the lookup never changes a decision or an existing gate read", () => {
    for (const p of AdelanteEHR.listPatients().slice(0, 6)) {
      const at = new Date();
      const gatesBefore = JSON.stringify(consentGateSnapshot(p.id, at));
      const before = disclose(req(p.id));
      capture(p.id, { consentType: "part2_specific_written", part2Elements: allElements, recipients: [{ kind: "org", name: "Outside Clinic" }], purpose: "Referral for treatment" });
      const after = disclose(req(p.id));
      expect(after.ok).toBe(before.ok);
      if (!before.ok && !after.ok) expect(after.reason).toBe(before.reason);
      if (before.ok && after.ok) {
        const { id: _a, consentRecordId: _b, at: _c, ...rest1 } = before.entry!;
        const { id: _d, consentRecordId: _e, at: _f, ...rest2 } = after.entry!;
        expect(rest2).toEqual(rest1);
        expect(after.notice).toBe(before.notice);
      }
      expect(JSON.stringify(consentGateSnapshot(p.id, at))).toBe(gatesBefore);
    }
  });
});
