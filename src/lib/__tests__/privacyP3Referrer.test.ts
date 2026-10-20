// Privacy P3 — referrer status matrix (Mitch, Oct 20).
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  HELD, REFERRER_RECEIPT_TEXT, REFERRER_TYPES, composeReferrerMessage, decideReferrerUpdate,
  type ReferrerType,
} from "@/lib/referrerPolicy";
import { logSentReferrerUpdate, referralIsSud, referrerDecisionFor } from "@/lib/referrerUpdateGate";
import { listDisclosureLog } from "@/lib/part2Disclosure";
import { recordReferrerAuthorization, referrerAuthorizationFor, revokeReferrerAuthorization } from "@/lib/referrerAuthorizationStore";

const types: (ReferrerType | "unknown")[] = [...REFERRER_TYPES, "unknown"];
const ctx = (type: ReferrerType | "unknown", authorized: boolean, sud = false, part2ConsentNamed = false) => ({ type, authorized, sud, part2ConsentNamed });

describe("Privacy P3 — referrer type × status × authorization", () => {
  it.each(types.flatMap((t) => [true, false].map((a) => [t, a] as const)))("%s (authorized=%s)", (type, authorized) => {
    expect(decideReferrerUpdate("received", ctx(type, authorized))).toEqual({ send: true, message: "receipt", recordClassSud: false });
    expect(decideReferrerUpdate("declined", ctx(type, authorized))).toEqual({ send: false, held: HELD.decline });
    const contacted = decideReferrerUpdate("contacted", ctx(type, authorized));
    const enrolled = decideReferrerUpdate("enrolled", ctx(type, authorized));
    if (type === "covered_provider") {
      expect(contacted).toEqual({ send: true, message: "outreach_completed", recordClassSud: false });
      expect(enrolled).toEqual({ send: true, message: "enrolled", recordClassSud: false });
    } else if (authorized) {
      expect(contacted).toEqual({ send: false, held: HELD.enrollmentOnly });
      expect(enrolled).toEqual({ send: true, message: "enrolled", recordClassSud: false });
    } else {
      expect(contacted).toEqual({ send: false, held: "Held: no authorization on file" });
      expect(enrolled).toEqual({ send: false, held: "Held: no authorization on file" });
    }
  });

  it.each(types)("SUD / Part 2 (%s): generic receipt only without a named Part 2 consent", (type) => {
    for (const authorized of [true, false]) {
      expect(decideReferrerUpdate("received", ctx(type, authorized, true)).send).toBe(true);
      for (const e of ["contacted", "enrolled", "declined"] as const)
        expect(decideReferrerUpdate(e, ctx(type, authorized, true)).send).toBe(false);
    }
  });

  it("SUD with a Part 2 consent naming the provider allows the provider's minimum-necessary updates only", () => {
    expect(decideReferrerUpdate("enrolled", ctx("covered_provider", false, true, true))).toEqual({ send: true, message: "enrolled", recordClassSud: true });
    expect(decideReferrerUpdate("declined", ctx("covered_provider", false, true, true)).send).toBe(false);
    expect(decideReferrerUpdate("enrolled", ctx("family", false, true, true))).toEqual({ send: false, held: HELD.noAuthorization });
  });

  it("texts carry no patient name, decline or clinical detail", () => {
    expect(composeReferrerMessage("receipt")).toContain(REFERRER_RECEIPT_TEXT);
    expect(composeReferrerMessage("outreach_completed")).toBe("Adelante: outreach for your referral is completed. Reply STOP to stop these texts.");
    expect(composeReferrerMessage("enrolled", "2026-10-20")).toBe("Adelante: the person you referred enrolled on 2026-10-20. Reply STOP to stop these texts.");
  });
});

describe("Privacy P3 — store gate, authorization and logging", () => {
  const make = (over: Record<string, unknown> = {}) => AdelanteEHR.createReferral({
    firstName: "Zed", lastName: "Quill", referringAgency: "Hope CBO", referrerName: "Jo", referrerPhone: "+15555550100",
    referralSource: "community_based_organization", consentToContact: false, channel: "public", ...over,
  } as Parameters<typeof AdelanteEHR.createReferral>[0]);

  it("existing referrals without a type are unknown and denied by default", () => {
    const r = make();
    expect(referrerDecisionFor(r, "enrolled")).toEqual({ send: false, held: HELD.noAuthorization });
  });

  it("a yes for the named referrer allows enrolled; revoking holds it again, both audited", () => {
    const r = make({ referrerType: "family" });
    const before = AdelanteEHR.listAuditEvents().length;
    const a = recordReferrerAuthorization(r.id, "yes", "Jo (Hope CBO)");
    expect(a.answer).toBe("yes");
    expect(a.referrerNamed).toBe("Jo (Hope CBO)");
    expect(a.recordedAt).toBeTruthy();
    const cur = () => AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(referrerDecisionFor(cur(), "enrolled")).toEqual({ send: true, message: "enrolled", recordClassSud: false });
    revokeReferrerAuthorization(r.id);
    expect(referrerAuthorizationFor(r.id)?.revokedAt).toBeTruthy();
    expect(referrerDecisionFor(cur(), "enrolled")).toEqual({ send: false, held: HELD.noAuthorization });
    const actions = AdelanteEHR.listAuditEvents().slice(0, AdelanteEHR.listAuditEvents().length - before).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["referrer_authorization_recorded", "referrer_authorization_revoked"]));
  });

  it("a yes naming a different referrer does not count", () => {
    const r = make({ referrerType: "community_org" });
    recordReferrerAuthorization(r.id, "yes", "Someone else");
    expect(referrerDecisionFor(AdelanteEHR.listReferrals().find((x) => x.id === r.id)!, "enrolled").send).toBe(false);
  });

  it("an SUD referral holds every status even for a covered provider", () => {
    const r = make({ referrerType: "covered_provider", substanceUseNeed: true });
    expect(referralIsSud(r)).toBe(true);
    expect(referrerDecisionFor(r, "contacted")).toEqual({ send: false, held: HELD.part2 });
    expect(referrerDecisionFor(r, "received").send).toBe(true);
  });

  it("a sent update writes one disclosure-log entry and one audit event, with no name", () => {
    const r = make({ referrerType: "covered_provider" });
    const d = referrerDecisionFor(r, "contacted");
    if (!d.send) throw new Error("expected send");
    const auditBefore = AdelanteEHR.listAuditEvents().length;
    const entry = logSentReferrerUpdate(r, "contacted", d);
    expect(AdelanteEHR.listAuditEvents().length - auditBefore).toBe(1);
    expect(listDisclosureLog().find((e) => e.id === entry.id)?.channel).toBe("referrer_update");
    expect(JSON.stringify(entry)).not.toContain("Zed");
    expect(JSON.stringify(entry)).not.toContain("Quill");
  });
});
