import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { codeIdentityMatches, duplicateDecision, phoneKey, referralMatches, validAge } from "@/lib/signupMatch";
import { runSignupCommand, signupActor, signupReviewFor, type SignupResult } from "@/lib/website/signupStore";

const base = { firstName: "José", lastName: "Peña-Ruiz", dob: "1990-02-03", phone: "(555) 010-0101", email: "A@EXAMPLE.ORG" };
const draft = (over = {}) => ({ ...base, preferredLanguage: "en" as const, credentialKind: "pin" as const, ...over });
const act = (input: Record<string, unknown>, now?: number) => { const r = runAction<SignupResult>("website_signup", signupActor, undefined, { via: "runSignupCommand", args: [signupActor, input, now] }); if (!r.ok) throw new Error(r.reason); return r.value; };
const start = () => act({ operation: "start" }).sessionId;

describe("signup match rules", () => {
  it("normalizes names and contacts; code first name may share first letter", () => {
    expect(phoneKey("555-010-0101")).toBe("+15550100101");
    expect(codeIdentityMatches(base, { ...base, firstName: "Jo", lastName: "pena ruiz" })).toBe(true);
    expect(codeIdentityMatches(base, { ...base, firstName: "Maria" })).toBe(false);
    expect(codeIdentityMatches(base, { ...base, dob: "1990-02-04" })).toBe(false);
  });
  it("open referral auto-match needs DOB, same name and contact", () => {
    expect(referralMatches(base, [{ ...base, id: "a", status: "submitted" }, { ...base, id: "b", status: "enrolled" }, { ...base, id: "c", status: "contacted", dob: "" }]).map((r) => r.id)).toEqual(["a"]);
  });
  it("contact match blocks, missing contact match only flags possible duplicate", () => {
    expect(duplicateDecision(base, [{ ...base, id: "a", hasAccount: true }]).blocked).toBe(true);
    expect(duplicateDecision(base, [{ ...base, id: "b", hasAccount: true, phone: "", email: "x@y.org" }])).toEqual({ blocked: false, possible: true });
    expect(validAge("2020-01-01", new Date("2026-10-26"))).toBe(false);
  });
});

describe("public signup outcomes", () => {
  it("code path matches only the code record's identity, consumes it and audits ids only", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Jonas", lastName: "Codeclaim", dob: "1988-08-08", matchSource: "staff_create" });
    const code = AdelanteEHR.issueRecordClaimCode({ patientId: p.id, actorStaffId: "s-ecm1", actorName: "ECM", actorRole: "ecm_provider" }).code;
    const sid = start();
    expect(act({ operation: "finish", sessionId: sid, path: "code", code, draft: draft({ firstName: "J", lastName: "Codeclaim", dob: "1988-08-09" }) }).outcome).toBe("mismatch");
    const ok = act({ operation: "retry", sessionId: sid, code, draft: draft({ firstName: "Jay", lastName: "Codeclaim", dob: "1988-08-08" }) });
    expect(ok).toMatchObject({ outcome: "matched", patientId: p.id });
    expect(JSON.stringify(AdelanteEHR.listAuditEvents().filter((e) => (e.detail as { sessionId?: string })?.sessionId === sid))).not.toMatch(/Codeclaim|1988-08|Jay/);
  });
  it("limits code attempts to five per fifteen minutes", () => {
    const sid = start(); const now = Date.parse("2026-10-26T12:00:00Z");
    for (let i = 0; i < 5; i++) expect(act({ operation: "retry", sessionId: sid, code: "RE-0000-0000", draft: draft({ lastName: `Limit${i}` }) }, now + i).limited).toBeUndefined();
    expect(act({ operation: "retry", sessionId: sid, code: "RE-0000-0000" }, now + 6).limited).toBe(true);
  });
  it("no-code verification is identical for none, one and many; one-time code uses file contact and expires", () => {
    const one = AdelanteEHR.createReferral({ firstName: "Otp", lastName: "Single", dob: "1991-01-01", phone: "+15550111111", referringAgency: "Clinic", referrerName: "Referrer", referralSource: "community_based_organization", consentToContact: true, channel: "public" } as never);
    const sid = start();
    const v = act({ operation: "finish", sessionId: sid, path: "no_code", draft: draft({ firstName: "Otp", lastName: "Single", dob: "1991-01-01", phone: "5550111111", email: "" }) }, 1000);
    expect(v.outcome).toBe("verify");
    expect(act({ operation: "verify", sessionId: sid, otp: v.demoCode }, 1000 + 10 * 60 * 1000).outcome).toBe("verify");
    const fresh = act({ operation: "resend", sessionId: sid }, 2_000_000);
    expect(act({ operation: "verify", sessionId: sid, otp: fresh.demoCode }, 2_000_001)).toMatchObject({ outcome: "matched" });
    expect(AdelanteEHR.listReferrals().find((r) => r.id === one.id)?.status).toBe("enrolled");
    expect(act({ operation: "finish", sessionId: start(), path: "no_code", draft: draft({ lastName: "Nobody" }) }).outcome).toBe("verify");
  });
  it("continue without code creates the account and a coordinator-only task", () => {
    const sid = start(); act({ operation: "finish", sessionId: sid, path: "no_code", draft: draft({ lastName: "Continue" }) });
    const out = act({ operation: "continue", sessionId: sid });
    const tasks = AdelanteEHR.listCaseTasks().filter((t) => t.patientId === out.patientId);
    expect(out.outcome).toBe("new");
    expect(tasks.some((t) => t.title === "Connect referral after signup" && t.allowedRoles?.join() === "clinical_coordinator")).toBe(true);
    const task = tasks.find((t) => t.title === "Connect referral after signup")!;
    expect(signupReviewFor({ role: "sys_admin", staffId: "s-admin1" }, task.id)).toBeUndefined();
    expect(signupReviewFor({ role: "clinical_coordinator", staffId: "s-cc1" }, task.id)?.entries.lastName).toBe("Continue");
  });
  it("duplicate privacy: contact match blocks; no contact match creates new account plus review", () => {
    const old = AdelanteEHR.createPatient({ firstName: "Dupe", lastName: "Case", dob: "1980-01-01", phone: "+15550222222", signupCredential: { kind: "pin", verificationAvailable: false, setAt: "2026-01-01" }, matchSource: "staff_create" });
    expect(act({ operation: "finish", sessionId: start(), path: "new", draft: draft({ firstName: "Dupe", lastName: "Case", dob: old.dob, phone: "5550222222", email: "" }) }).outcome).toBe("blocked");
    const made = act({ operation: "finish", sessionId: start(), path: "new", draft: draft({ firstName: "Dupe", lastName: "Case", dob: old.dob, phone: "5550333333", email: "" }) });
    expect(made.outcome).toBe("new");
    expect(AdelanteEHR.getPatient(made.patientId!)?.possibleDuplicate).toBeTruthy();
    expect(AdelanteEHR.listCaseTasks().some((t) => t.patientId === made.patientId && t.title === "Possible duplicate account" && t.allowedRoles?.join() === "clinical_coordinator")).toBe(true);
  });
});