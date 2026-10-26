// Oct 26 review — A1 (HLOC send after blocked-send capture) and A2 (live
// referrer answers count). Store calls mirror CareEpisodesPanel's
// ConsentCapture and ReferrerAuthorizationCard exactly.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { revokeTypedConsent } from "@/lib/consentLifecycle";
import {
  advanceHlocReferral, createHlocReferral, hlocSendBlocker, HLOC_TARGET_LABEL, listHlocReferrals, recordLegalDisclosureConsent,
} from "@/lib/outpatientCare";
import { listDisclosureLog, PART2_REDISCLOSURE_NOTICE } from "@/lib/part2Disclosure";
import { recordReferrerAuthorization, revokeReferrerAuthorization } from "@/lib/referrerAuthorizationStore";
import { referrerDecisionFor } from "@/lib/referrerUpdateGate";
import { referrerDisplayName } from "@/lib/referrerPolicy";

const admin = { role: "sys_admin" as const, staffId: "s-admin1", staffName: "Adelante System Admin" };
const storeAdmin = { role: admin.role, staffId: admin.staffId, name: admin.staffName };
const clin = { role: "therapist" as const, name: "Review therapist", staffId: "s-th1" };
let n = 0;
function fresh() {
  const r = runAction("patient_create_anyway", admin, undefined, {
    via: "createPatient", args: [{ firstName: "Review", lastName: `Oct26 ${++n}`, dob: `1992-03-0${n}` }],
  });
  if (!r.ok) throw new Error(r.reason);
  return r.value as ReturnType<typeof AdelanteEHR.createPatient>;
}
const actions = (pid: string) => AdelanteEHR.listAuditEvents().filter((e) => e.patientId === pid).map((e) => e.action);

describe("A1 — HLOC send after capture in the blocked-send panel", () => {
  it("non-seeded patient: blocked → panel capture → sent with logged disclosure, notice and audit order", () => {
    const p = fresh();
    const r = createHlocReferral({ patientId: p.id, target: "residential", reason: "Needs residential", urgency: "routine", destination: "Valley Oak Residential (demo)", outsideSudProvider: true, actor: clin });
    expect(hlocSendBlocker(r)).toBeDefined();
    expect(() => advanceHlocReferral(r.id, "sent", clin)).toThrow(/42 CFR Part 2/);
    // ConsentCapture: recipient = r.destination, purpose = display text.
    recordLegalDisclosureConsent(p.id, clin, "Review Oct26", { recipient: r.destination, purpose: `Referral — ${HLOC_TARGET_LABEL[r.target]}` });
    expect(hlocSendBlocker(r)).toBeUndefined();
    const before = listDisclosureLog({ patientId: p.id }).length;
    advanceHlocReferral(r.id, "sent", clin);
    const sent = listHlocReferrals(p.id).find((x) => x.id === r.id)!;
    expect(sent.status).toBe("sent");
    expect(sent.part2Notice).toContain(PART2_REDISCLOSURE_NOTICE);
    const log = listDisclosureLog({ patientId: p.id });
    expect(log.length).toBe(before + 1);
    expect(log[0].recipient.name).toBe(r.destination);
    const a = actions(p.id);
    const rec = a.lastIndexOf("legal_disclosure_recorded"), snd = a.lastIndexOf("hloc_referral_sent");
    expect(rec).toBeGreaterThanOrEqual(0);
    expect(snd).toBeGreaterThanOrEqual(0);
    // Audit list may be newest-first or oldest-first; compare timestamps.
    const ev = AdelanteEHR.listAuditEvents().filter((e) => e.patientId === p.id);
    const t = (x: string) => Date.parse(String(ev.find((e) => e.action === x)!.at ?? (ev.find((e) => e.action === x) as { timestamp?: string }).timestamp));
    expect(t("legal_disclosure_recorded")).toBeLessThanOrEqual(t("hloc_referral_sent"));
  });

  it("legacyUnverified history never unblocks", () => {
    const p = fresh();
    const r = createHlocReferral({ patientId: p.id, target: "residential", reason: "Needs residential", urgency: "routine", destination: "Valley Oak Residential (demo)", outsideSudProvider: true, actor: clin });
    recordLegalDisclosureConsent(p.id, clin, "Review Oct26", { recipient: r.destination, purpose: "Referral — Residential" });
    AdelanteEHR.markLegacyConsentsUnverified(p.id);
    expect(hlocSendBlocker(r)).toBeDefined();
  });

  it("a flag alone never unblocks", () => {
    const p = fresh();
    const r = createHlocReferral({ patientId: p.id, target: "residential", reason: "Needs residential", urgency: "routine", destination: "Valley Oak Residential (demo)", outsideSudProvider: true, actor: clin });
    const pat = AdelanteEHR.getPatient(p.id)! as unknown as { consents: Record<string, boolean> };
    pat.consents.part2Sud = true;
    expect(hlocSendBlocker(r)).toBeDefined();
  });
});

describe("A2 — live referrer authorization counts", () => {
  const make = (pid: string, over: Record<string, unknown> = {}) => {
    const r = AdelanteEHR.createReferral({
      firstName: "Rae", lastName: `Ref ${pid}`, referringAgency: "Sierra Hope CBO", referrerName: "Jo Ruiz", referrerPhone: "+15555550111",
      referralSource: "community_based_organization", consentToContact: false, channel: "public", referrerType: "community_org", enrolledPatientId: pid, ...over,
    } as unknown as Parameters<typeof AdelanteEHR.createReferral>[0]);
    return AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
  };
  const captureTyped = (pid: string, recipient: string) => {
    const c = runAction("consent_record_capture", admin, AdelanteEHR.getPatient(pid)!, {
      via: "captureConsentRecord", args: [{ draft: { patientId: pid, consentType: "referrer_authorization", recipients: [{ kind: "org", name: recipient }],
        purpose: "status_updates", purposeCode: "status_updates", items: ["Referral status"], expiresOnEvent: "Patient revokes" },
        method: "e_sign", signer: "Review Oct26", relationship: "patient", attested: true, actor: storeAdmin }],
    });
    if (!c.ok) throw new Error(c.reason);
    return c.value as ReturnType<typeof AdelanteEHR.createConsentRecord>;
  };

  it("no typed record: card answer authorizes; revoking denies", () => {
    const p = fresh(); const ref = make(p.id);
    expect(referrerDecisionFor(ref, "enrolled").send).toBe(false);
    recordReferrerAuthorization(ref.id, "yes", referrerDisplayName(ref));
    expect(referrerDecisionFor(ref, "enrolled").send).toBe(true);
    revokeReferrerAuthorization(ref.id);
    expect(referrerDecisionFor(ref, "enrolled").send).toBe(false);
  });

  it("a 'no' answer denies", () => {
    const p = fresh(); const ref = make(p.id);
    recordReferrerAuthorization(ref.id, "no", referrerDisplayName(ref));
    expect(referrerDecisionFor(ref, "enrolled").send).toBe(false);
  });

  it("an applicable typed record decides over the live answer, even when revoked", () => {
    const p = fresh(); const ref = make(p.id);
    const rec = captureTyped(p.id, "Sierra Hope CBO");
    revokeTypedConsent({ recordId: rec.id, method: "written", actor: storeAdmin });
    recordReferrerAuthorization(ref.id, "yes", referrerDisplayName(ref));
    expect(referrerDecisionFor(ref, "enrolled").send).toBe(false);
  });

  it("SUD referral: live legal disclosure naming the referrer + card answer allow the update; legacy history does not", () => {
    const p = fresh(); const ref = make(p.id, { substanceUseNeed: true, referrerType: "covered_provider" });
    expect(referrerDecisionFor(ref, "enrolled").send).toBe(false);
    recordLegalDisclosureConsent(p.id, clin, "Review Oct26", { recipient: "Sierra Hope CBO", purpose: "Referral status updates" });
    recordReferrerAuthorization(ref.id, "yes", referrerDisplayName(ref));
    expect(referrerDecisionFor(ref, "enrolled").send).toBe(true);
    AdelanteEHR.markLegacyConsentsUnverified(p.id);
    expect(referrerDecisionFor(ref, "enrolled").send).toBe(false);
  });
});
