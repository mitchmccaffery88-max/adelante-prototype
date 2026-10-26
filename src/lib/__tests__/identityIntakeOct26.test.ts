import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { runAction } from "../actions/runAction";
import { canAccess, getActingRole, getStaffMember, roleAssignmentsOf, setActingStaff } from "../roles";
import { createIdentityReviewItem, identityReviewConfirm, identityReviewNotSame, identityReviewNeedInfo, identityReviewLink, identityReviewCompare, linkableReferrals, canActOnIdentityReview, canViewIdentityReview, listIdentityReviewItems } from "../identityReview";
import { referralCriticalProblem } from "../referralChase";
import { referralMatches, publicReferralResembles } from "../signupMatch";
import { canViewAccountSupport, listAccountSupportItems } from "../accountSupport";
import { runSignupCommand, signupActor } from "../website/signupStore";
import { checkBookingRights } from "../bookingRights";
const entered = {firstName:"OctTest",lastName:"Identity",dob:"1990-01-01",phone:"+15550000001"};
const intake = {role:"intake_coordinator" as const,staffId:"s-intake-test",staffName:"Intake"};
const item = () => createIdentityReviewItem({type:"possible_referral_match",source:"sign-up",sessionId:crypto.randomUUID(),entries:entered});
describe("26 Oct intake and identity rules", () => {
  it("family/self may omit DOB; professionals still need DOB or CIN", () => {
    for (const referrerType of ["family","self"]) expect(referralCriticalProblem({...entered,dob:"",referrerType})).toBeNull();
    for (const referrerType of ["covered_provider","community_org"]) expect(referralCriticalProblem({...entered,dob:"",referrerType})).toMatch(/date of birth/);
  });
  it("public_unverified never auto-matches and produces only a review resemblance", () => {
    const referrals = [{...entered,id:"public-test",status:"submitted",identityConfidence:"public_unverified"}];
    expect(referralMatches(entered,referrals)).toEqual([]);
    expect(publicReferralResembles(entered,referrals).map(r => r.id)).toEqual(["public-test"]);
  });
  it("live public referral sends no OTP audit and routes to intake identity review", () => {
    const r = AdelanteEHR.createReferral({...entered,lastName:`Public${crypto.randomUUID()}`,identityConfidence:"public_unverified",referrerType:"family",referringAgency:"",referrerName:"Family",referralSource:"other",consentToContact:false,channel:"public"});
    const session = runSignupCommand(signupActor,{operation:"start"});
    const before = AdelanteEHR.listAuditEvents().filter(e => e.action === "referral_otp_sent").length;
    const result = runSignupCommand(signupActor,{operation:"finish",sessionId:session.sessionId,path:"no_code",draft:{...entered,lastName:r.lastName,preferredLanguage:"en",credentialKind:"pin"}});
    expect(result.outcome).toBe("verify");
    expect(AdelanteEHR.listAuditEvents().filter(e => e.action === "referral_otp_sent")).toHaveLength(before);
    expect(listIdentityReviewItems().find(i => i.sessionId === session.sessionId)).toMatchObject({type:"public_referral_resemblance",assignee:"intake_coordinator"});
  });
  it("all five types stay in identity review, never account support", () => {
    for (const type of ["possible_referral_match","possible_duplicate_account","link_referral_no_code","public_referral_resemblance","code_lockout"] as const) {
      const row = createIdentityReviewItem({type,source:"sign-up",sessionId:crypto.randomUUID(),entries:entered});
      expect(listIdentityReviewItems().find(i => i.id === row.id)?.type).toBe(type);
      expect(listAccountSupportItems().some(i => i.id === row.id)).toBe(false);
    }
  });
  it("clinical coordinator can view, not decide; intake can decide with a reason and IDs-only audit", () => {
    const coordinator = {role:"clinical_coordinator" as const,staffId:"s-cc1"};
    expect(canViewIdentityReview(coordinator)).toBe(true);
    expect(canActOnIdentityReview(coordinator)).toBe(false);
    const row = item();
    expect(() => identityReviewNotSame(coordinator,row.id,"Checked record")).toThrow(/reviewer/);
    expect(() => identityReviewNotSame(intake,row.id," ")).toThrow(/reason/);
    const result = runAction("identity_review_not_same",intake,undefined,{args:[intake,row.id,"Not the same person"]});
    expect(result.ok).toBe(true);
    expect(row.status).toBe("closed");
    const audit = AdelanteEHR.listAuditEvents().find(e => e.action === "identity_review_not_same" && e.detail?.itemId === row.id);
    expect(audit?.actorRole).toBe("intake_coordinator");
    expect(audit?.detail).toEqual({itemId:row.id});
  });
  it("need information waits on others; identity confirmation records provenance and issues a code", () => {
    const row = item();
    expect(identityReviewNeedInfo(intake,row.id,"Need DOB confirmation").status).toBe("withothers");
    const r = AdelanteEHR.createReferral({...entered,referringAgency:"",referrerName:"Family",referralSource:"other",consentToContact:false,channel:"public",identityConfidence:"public_unverified"});
    const review = createIdentityReviewItem({type:"public_referral_resemblance",source:"referral",referralId:r.id,entries:entered});
    const result = identityReviewConfirm(intake,review.id,{how:"Phone call with the person",reason:"Confirmed name and DOB"});
    expect(result.code.code).toMatch(/^RE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(r.identityConfirmedBy?.role).toBe("intake_coordinator");
    expect(r.identityConfidence).toBe("verified_source");
  });
  it("primary plus additional roles never union; audit uses the acting role", () => {
    const admin = getStaffMember("s-admin1");
    expect(roleAssignmentsOf(admin).map(a => a.role)).toContain("intake_coordinator");
    setActingStaff("s-admin1","intake_coordinator");
    expect(getActingRole()).toBe("intake_coordinator");
    expect(canAccess(getActingRole(),"platform_administration").level).toBe("none");
    expect(canViewAccountSupport(getActingRole())).toBe(false);
    expect(runAction("staff_update",{role:getActingRole(),staffId:"s-admin1"},undefined).ok).toBe(false);
    setActingStaff("s-admin1","sys_admin");
    expect(canAccess(getActingRole(),"platform_administration").level).toBe("write");
  });
  it("restricted Part 2 candidates stay visible as locks and cannot be linked or confirmed", () => {
    const r = AdelanteEHR.createReferral({...entered,substanceUseNeed:true,referringAgency:"",referrerName:"Family",referralSource:"other",consentToContact:false,channel:"public",identityConfidence:"public_unverified"});
    const row = createIdentityReviewItem({type:"public_referral_resemblance",source:"referral",referralId:r.id,entries:entered});
    expect(identityReviewCompare(row,intake)).toEqual([expect.objectContaining({id:r.id,restrictedReason:"42 CFR Part 2 — intake consent required",firstName:"",lastName:""})]);
    expect(linkableReferrals(row,intake)).toEqual([]);
    expect(() => identityReviewConfirm(intake,row.id,{how:"Phone",reason:"Identity checked"})).toThrow(/Restricted/);
    expect(() => identityReviewLink(intake,row.id,{referralId:r.id,reason:"Identity checked"})).toThrow(/Restricted/);
    expect(r.identityConfidence).toBe("public_unverified");
  });
  it("a reviewer cannot substitute an unrelated referral ID", () => {
    const row = item();
    const r = AdelanteEHR.createReferral({...entered,referringAgency:"",referrerName:"Family",referralSource:"other",consentToContact:false,channel:"public"});
    expect(() => identityReviewLink(intake,row.id,{referralId:r.id,reason:"Identity checked"})).toThrow(/candidate/);
    expect(r.status).toBe("submitted");
  });
  it("removing an additional role also overrides legacy assignments", () => {
    expect(roleAssignmentsOf({id:"two-role",name:"Demo",role:"sys_admin",roleAssignments:[{role:"sys_admin"},{role:"intake_coordinator"}],additionalRoles:[]}).map(a=>a.role)).toEqual(["sys_admin"]);
  });
  it("intake can book a first intake or peer visit, never ongoing care or a group", () => {
    for (const serviceType of ["intake","peer_support","case_management","med_management"]) expect(checkBookingRights({role:"intake_coordinator",op:"book",inCaseload:false,serviceType,firstVisit:true}).ok).toBe(true);
    expect(checkBookingRights({role:"intake_coordinator",op:"book",inCaseload:false,serviceType:"intake",firstVisit:false}).ok).toBe(false);
    expect(checkBookingRights({role:"intake_coordinator",op:"book",inCaseload:false,serviceType:"therapy_group",firstVisit:true}).ok).toBe(false);
  });
  it("intake row writes identity/consents/eligibility, reads SDOH, locks Part2 and denies clinical/billing/admin", () => {
    for (const cls of ["demographics","consent_ledger","eligibility"] as const) expect(canAccess("intake_coordinator",cls).level).toBe("write");
    expect(canAccess("intake_coordinator","sdoh").level).toBe("read");
    expect(canAccess("intake_coordinator","screeners_sud")).toMatchObject({locked:true,reason:"42 CFR Part 2 — consent required"});
    for (const cls of ["meds_erx","therapy_notes","psychotherapy_notes","care_plan","billing","platform_administration","staff_supervision","crisis_queue"] as const) expect(canAccess("intake_coordinator",cls).level).toBe("none");
  });
});