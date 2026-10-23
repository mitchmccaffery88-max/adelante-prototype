// B2-5 — regression tests for the three defects from Mitch's review (Oct 23).
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { consentGate } from "@/lib/consentGate";
import { revokeTypedConsent, type RevokeMethod } from "@/lib/consentLifecycle";
import {
  advanceHlocReferral, createHlocReferral, hlocSendBlocker, listHlocReferrals, recordLegalDisclosureConsent,
} from "@/lib/outpatientCare";
import { listDisclosureLog } from "@/lib/part2Disclosure";
import { recordReferrerAuthorization } from "@/lib/referrerAuthorizationStore";
import { referrerDecisionFor } from "@/lib/referrerUpdateGate";

const admin = { role: "sys_admin" as const, staffId: "s-admin1", staffName: "Adelante System Admin" };
const storeAdmin = { role: admin.role, staffId: admin.staffId, name: admin.staffName };
const clin = { role: "therapist" as const, name: "QA therapist", staffId: "s-th1" };
let n = 0;
function fresh() {
  const r = runAction("patient_create_anyway", admin, undefined, {
    via: "createPatient", args: [{ firstName: "Defect", lastName: `QA ${++n}`, dob: `1991-02-0${n}` }],
  });
  if (!r.ok) throw new Error(r.reason);
  return r.value as ReturnType<typeof AdelanteEHR.createPatient>;
}
function captureAi(pid: string) {
  const p = AdelanteEHR.getPatient(pid)!;
  const c = runAction("consent_record_capture", admin, p, {
    via: "captureConsentRecord", args: [{ draft: { patientId: pid, consentType: "ai_recording", recipients: [{ kind: "org", name: "Adelante" }],
      purpose: "ai_recording", items: ["AI recording"], expiresOnEvent: "Patient revokes" },
      method: "e_sign", signer: "Defect QA", relationship: "patient", attested: true, actor: storeAdmin }],
  });
  if (!c.ok) throw new Error(c.reason);
  return c.value as ReturnType<typeof AdelanteEHR.createConsentRecord>;
}

describe("Defect 1 — revoke method is saved as chosen", () => {
  const expected: Record<RevokeMethod, string> = { written: "written", e_sign: "portal", oral: "in_person" };
  for (const m of Object.keys(expected) as RevokeMethod[]) {
    it(`method "${m}" lands on rec.revocation.method and the audit metadata`, () => {
      const p = fresh();
      const rec = captureAi(p.id);
      const before = AdelanteEHR.listAuditEvents().length;
      const r = runAction("consent_record_revoke", admin, p, { via: "revokeTypedConsent", args: [{ recordId: rec.id, method: m, note: "QA", actor: storeAdmin }] });
      expect(r.ok, r.ok ? "" : r.reason).toBe(true);
      const saved = AdelanteEHR.listConsentRecords(p.id).find((x) => x.id === rec.id)!;
      expect(saved.revocation?.method).toBe(expected[m]);
      const events = AdelanteEHR.listAuditEvents().slice(0, AdelanteEHR.listAuditEvents().length - before);
      const all = JSON.stringify([...events, ...AdelanteEHR.listAuditEvents().slice(before)]);
      expect(all).toContain(`"${m}"`);
    });
  }
  it("the store refuses nothing silently: the mapping is exhaustive", () => {
    const p = fresh();
    const rec = captureAi(p.id);
    revokeTypedConsent({ recordId: rec.id, method: "oral", actor: storeAdmin });
    expect(AdelanteEHR.listConsentRecords(p.id).find((x) => x.id === rec.id)!.revocation?.method).toBe("in_person");
  });
});

describe("Defect 2 — HLOC send uses the shared precedence", () => {
  const draft = (pid: string, destination: string) =>
    createHlocReferral({ patientId: pid, target: "residential", reason: "QA", urgency: "routine", destination, outsideSudProvider: true, actor: clin });

  it("a consent recorded through the blocked-send panel unblocks the send and writes its disclosure", () => {
    const p = fresh();
    const r = draft(p.id, "Kings River Residential (demo)");
    expect(hlocSendBlocker(r)).toBeDefined();
    expect(() => advanceHlocReferral(r.id, "sent", clin)).toThrow();
    // Exactly what CareEpisodesPanel's ConsentCapture records.
    recordLegalDisclosureConsent(p.id, clin, "Defect QA", { recipient: r.destination, purpose: "Referral — Residential" });
    expect(hlocSendBlocker(r)).toBeUndefined();
    const logBefore = listDisclosureLog({ patientId: p.id }).length;
    advanceHlocReferral(r.id, "sent", clin);
    expect(listHlocReferrals(p.id).find((x) => x.id === r.id)?.status).toBe("sent");
    expect(listDisclosureLog({ patientId: p.id }).length).toBe(logBefore + 1);
  });

  it("a legacyUnverified-only record keeps it blocked", () => {
    const p = fresh();
    const r = draft(p.id, "Kings River Residential (demo)");
    recordLegalDisclosureConsent(p.id, clin, "Defect QA", { recipient: r.destination, purpose: "Referral — Residential" });
    expect(AdelanteEHR.markLegacyConsentsUnverified(p.id)).toBeGreaterThan(0);
    expect(hlocSendBlocker(r)).toBeDefined();
    expect(() => advanceHlocReferral(r.id, "sent", clin)).toThrow();
  });

  it("an applicable typed record decides (seeded Jordan still sends)", () => {
    const jordan = AdelanteEHR.listPatients().find((p) => p.firstName === "Jordan" && p.lastName === "Vega");
    expect(jordan).toBeDefined();
    const r = listHlocReferrals(jordan!.id).find((x) => x.outsideSudProvider);
    expect(r).toBeDefined();
    expect(hlocSendBlocker(r!)).toBeUndefined();
  });
});

describe("Defect 3 — consentGate calls the live answer when no typed record applies", () => {
  const need = (recipient: string) => ({ types: ["referrer_authorization"] as const, recipients: [recipient], purposes: ["enrolled_update", "status_updates"] });

  it("calls today() when no typed record applies", () => {
    const p = fresh();
    expect(consentGate(p.id, need("Fresno Reentry (demo)"), () => true)).toBe(true);
    expect(consentGate(p.id, need("Fresno Reentry (demo)"), () => false)).toBe(false);
  });

  it("a typed record, when present, decides over today()", () => {
    const p = fresh();
    const rec = captureAi(p.id);
    const aiNeed = { types: ["ai_recording"] as const, recipients: ["Adelante"], purposes: ["ai_recording"] };
    expect(consentGate(p.id, aiNeed, () => false)).toBe(true);
    revokeTypedConsent({ recordId: rec.id, method: "written", actor: storeAdmin });
    expect(consentGate(p.id, aiNeed, () => true)).toBe(false);
  });
});

describe("Defect 3 — live referrer authorization (ReferrerAuthorizationCard write)", () => {
  const make = (pid: string) => AdelanteEHR.createReferral({
    firstName: "Rae", lastName: `Live ${pid}`, referringAgency: "Hope CBO", referrerName: "Jo", referrerPhone: "+15555550101",
    referralSource: "community_based_organization", consentToContact: false, channel: "public", referrerType: "community_org", enrolledPatientId: pid,
  } as unknown as Parameters<typeof AdelanteEHR.createReferral>[0]);

  it("an authorization recorded live authorizes the enrolled update; none (flag/legacy only) holds it", () => {
    const p = fresh();
    const r = make(p.id);
    const ref = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(ref.enrolledPatientId).toBe(p.id);
    // Legacy-only: mark everything unverified; no live authorization → held.
    AdelanteEHR.markLegacyConsentsUnverified(p.id);
    expect(referrerDecisionFor(ref, "enrolled").send).toBe(false);
    recordReferrerAuthorization(r.id, "yes", "Jo");
    const d = referrerDecisionFor(ref, "enrolled");
    expect(d.send, JSON.stringify(d)).toBe(true);
  });
});
