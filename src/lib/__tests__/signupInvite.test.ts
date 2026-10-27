import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { listIdentityReviewItems } from "@/lib/identityReview";
import { runSignupCommand, signupActor, type SignupResult } from "@/lib/website/signupStore";
import { listInviteOutbox, listInvitesForReferral, sha256Hex, INVITE_TTL_DAYS, INVITE_DEFAULT_TIMING } from "@/lib/signupInvite";
import { issueReferralClaimCode } from "@/lib/identityReview";

const intake = { role: "intake_coordinator" as const, staffId: "s-intake1", staffName: "Intake" };
const pub = (input: Record<string, unknown>, now?: number) => { const r = runAction<SignupResult>("website_signup", signupActor, undefined, { via: "runSignupCommand", args: [signupActor, input, now] }); if (!r.ok) throw new Error(r.reason); return r.value; };
const session = () => pub({ operation: "start" }).sessionId;
function referral(over: Record<string, unknown> = {}) {
  return AdelanteEHR.createReferral({ firstName: "Inez", lastName: `Invite${crypto.randomUUID().slice(0, 6)}`, dob: "1987-04-05", phone: "+15550170123", referringAgency: "Clinic", referrerName: "Ref", referralSource: "community_based_organization", consentToContact: true, channel: "public", ...over } as never);
}
function send(referralId: string, now?: number, actor = intake) {
  return runAction<{ inviteId: string; reused: boolean }>("signup_invite_send", actor, undefined, { args: [actor, referralId, { timing: "now" }, "Ready to invite", now], auditReason: "Ready to invite" });
}
const tokenOf = (referralId: string) => listInviteOutbox(referralId).at(-1)!.link.split("/").pop()!;

describe("27 Oct sign-up invite (Draft)", () => {
  it("Draft settings: 14-day link, default send on release date", () => {
    expect(INVITE_TTL_DAYS).toBe(14);
    expect(INVITE_DEFAULT_TIMING).toBe("release");
  });
  it("Intake, care managers and clinical coordinator send; peer and trainee cannot", () => {
    for (const role of ["intake_coordinator", "ecm_provider", "cf_care_manager", "clinical_coordinator"] as const) expect(send(referral().id, Date.now(), { role, staffId: "x", staffName: "x" }).ok).toBe(true);
    for (const role of ["peer_specialist", "trainee"] as const) expect(send(referral().id, Date.now(), { role, staffId: "x", staffName: "x" } as never).ok).toBe(false);
  });
  it("token is hashed at rest and goes only to the contact on file", () => {
    const r = referral(); expect(send(r.id).ok).toBe(true);
    const token = tokenOf(r.id); const inv = listInvitesForReferral(r.id)[0];
    expect(inv.tokenHash).toBe(sha256Hex(token));
    expect(JSON.stringify(inv)).not.toContain(token);
    expect(listInviteOutbox(r.id)[0].contactMask).toBe("•••• 0123");
  });
  it("invite tap + last name/DOB → Matched with no code; nothing from the referral before Matched", () => {
    const r = referral(); send(r.id); const sid = session();
    const opened = pub({ operation: "invite_open", sessionId: sid, token: tokenOf(r.id) });
    expect(opened.outcome).toBe("invite_identity");
    expect(JSON.stringify({ ...opened, event: undefined })).not.toMatch(new RegExp(`${r.lastName}|Inez|1987|0123`));
    const done = pub({ operation: "invite_identity", sessionId: sid, lastName: r.lastName.toUpperCase(), dob: r.dob });
    expect(done.outcome).toBe("matched");
    expect(done.demoCode).toBeUndefined();
    expect(AdelanteEHR.listReferrals().find((x) => x.id === r.id)?.status).toBe("enrolled");
    expect(pub({ operation: "invite_open", sessionId: session(), token: tokenOf(r.id) }).outcome).toBe("invite_expired");
  });
  it("wrong DOB → generic mismatch; Continue without it creates account + Identity review; 5 tries lock", () => {
    const r = referral(); send(r.id); const sid = session();
    pub({ operation: "invite_open", sessionId: sid, token: tokenOf(r.id) });
    for (let i = 0; i < 4; i++) { const m = pub({ operation: "invite_identity", sessionId: sid, lastName: r.lastName, dob: "1999-01-01" }); expect(m.outcome).toBe("invite_mismatch"); expect(m.limited).toBeUndefined(); }
    expect(pub({ operation: "invite_identity", sessionId: sid, lastName: r.lastName, dob: "1999-01-01" }).limited).toBe(true);
    expect(pub({ operation: "invite_identity", sessionId: sid, lastName: r.lastName, dob: r.dob }).outcome).toBe("invite_mismatch");
    expect(listIdentityReviewItems().some((i) => i.sessionId === sid && i.type === "code_lockout")).toBe(true);
    const made = pub({ operation: "invite_continue", sessionId: sid, firstName: "Ines", lastName: "Other", dob: "1999-01-01" });
    expect(made.outcome).toBe("new");
    expect(listIdentityReviewItems().find((i) => i.patientId === made.patientId && i.type === "invite_identity_mismatch")?.referralId).toBe(r.id);
    expect(AdelanteEHR.listReferrals().find((x) => x.id === r.id)?.status).toBe("submitted");
  });
  it("expired link → resend goes only to the contact on file, rate-limited", () => {
    const t0 = Date.parse("2026-10-01T12:00:00Z"); const r = referral(); send(r.id, t0); const old = tokenOf(r.id);
    const later = t0 + 15 * 86_400_000;
    expect(pub({ operation: "invite_open", sessionId: session(), token: old }, later).outcome).toBe("invite_expired");
    const resent = pub({ operation: "invite_resend", sessionId: session(), token: old }, later);
    expect(resent.contactMask).toBe("•••• 0123");
    expect(listInviteOutbox(r.id).every((o) => o.contactMask === "•••• 0123")).toBe(true);
    expect(pub({ operation: "invite_open", sessionId: session(), token: tokenOf(r.id) }, later + 1).outcome).toBe("invite_identity");
    expect(pub({ operation: "invite_resend", sessionId: session(), token: old }, later + 10).demoLink).toBeUndefined();
    expect(pub({ operation: "invite_resend", sessionId: session(), token: "not-a-token" }, later).demoLink).toBeUndefined();
  });
  it("lost contact → Identity review item, then the not-invited path", () => {
    const r = referral(); send(r.id); const sid = session();
    expect(pub({ operation: "invite_lost", sessionId: sid, token: tokenOf(r.id) }).outcome).toBe("invite_lost");
    expect(listIdentityReviewItems().find((i) => i.sessionId === sid)?.type).toBe("invite_contact_lost");
  });
  it("reminders reuse the same valid invite link; a second send reuses it too", () => {
    const r = referral(); send(r.id, 1_000_000); const link = listInviteOutbox(r.id)[0].link;
    const rem = runAction("signup_invite_remind", intake, undefined, { args: [intake, r.id, "Tue", "Visit soon", 1_100_000], auditReason: "Visit soon" });
    expect(rem.ok).toBe(true);
    expect(send(r.id, 1_200_000).ok).toBe(true);
    expect(listInviteOutbox(r.id).map((o) => o.link)).toEqual([link, link, link]);
    expect(listInviteOutbox(r.id)[1].text.en).toContain("before your visit on Tue");
    expect(listInvitesForReferral(r.id)).toHaveLength(1);
  });
  it("pre-release: default timing schedules for the release date", () => {
    const r = referral({ releaseDate: "2099-01-02" });
    const out = runAction<{ scheduledFor?: string }>("signup_invite_send", intake, undefined, { args: [intake, r.id, {}, "Before release"], auditReason: "Before release" });
    expect(out.ok && out.value.scheduledFor).toBe("2099-01-02");
  });
  it("in-person setup requires staff identity confirmation; then a PIN on the tablet", () => {
    const r = referral({ phone: "", email: "", referrerPhone: "+15559990000" });
    const setup = () => runAction<{ patientId: string }>("signup_in_person_setup", intake, undefined, { args: [intake, r.id, { credential: "4826", confirm: "4826" }, "At the clinic"], auditReason: "At the clinic" });
    expect(setup().ok).toBe(false);
    expect(runAction("referral_identity_confirm", intake, undefined, { args: [intake, r.id, "In person — photo ID", "At the clinic"], auditReason: "At the clinic" }).ok).toBe(true);
    const ok = setup(); expect(ok.ok).toBe(true);
    if (ok.ok) expect(AdelanteEHR.getPatient(ok.value.patientId)?.signupCredential?.kind).toBe("pin");
  });
  it("paper code + last name + DOB → Matched, then one code verifies the new contact", () => {
    const r = referral({ phone: "", email: "", referrerPhone: "+15559990000" });
    runAction("referral_identity_confirm", intake, undefined, { args: [intake, r.id, "Packet reviewed", "Packet code"], auditReason: "Packet code" });
    const code = issueReferralClaimCode(r.id, intake).code;
    const sid = session();
    const m = pub({ operation: "finish", sessionId: sid, path: "code", code, draft: { firstName: "", lastName: r.lastName, dob: r.dob, preferredLanguage: "en", credentialKind: "passwordless" } });
    expect(m.outcome).toBe("matched");
    const sent = pub({ operation: "send_code", sessionId: sid, channel: "email", draft: { firstName: "", lastName: r.lastName, dob: r.dob, email: "inez@example.test", preferredLanguage: "en", credentialKind: "passwordless" } });
    expect(pub({ operation: "verify_code", sessionId: sid, otp: sent.demoCode }).outcome).toBe("matched");
    expect(AdelanteEHR.getPatient(m.patientId!)?.email).toBe("inez@example.test");
  });
  it("audits carry ids only", () => {
    const r = referral(); send(r.id); const sid = session();
    pub({ operation: "invite_open", sessionId: sid, token: tokenOf(r.id) });
    pub({ operation: "invite_identity", sessionId: sid, lastName: r.lastName, dob: r.dob });
    const audits = JSON.stringify(AdelanteEHR.listAuditEvents().filter((e) => (e.detail as { sessionId?: string })?.sessionId === sid));
    expect(audits).not.toMatch(new RegExp(`${r.lastName}|Inez|1987-04|555017|${tokenOf(r.id)}`));
  });
  it("public unverified commands stay public-only", () => {
    expect(() => runSignupCommand({ role: "intake_coordinator", staffId: "s" } as never, { operation: "start" })).toThrow();
  });
});
