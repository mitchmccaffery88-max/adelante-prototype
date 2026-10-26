import { AdelanteEHR } from "./ehr";
import { registerIntakeSafetySource } from "./intakeTriage";
import { canIntakeAct, assignIntakeTeam, type IntakeActor } from "./intakePhaseA";
import { runAction } from "./actions/runAction";
export function seedIntakePhaseA(actor: IntakeActor) {
  if (!canIntakeAct(actor, "completion")) throw new Error("Intake Coordinator required.");
  if (AdelanteEHR.listReferrals().some(r => r.email === "phase-a-new@example.invalid")) return { seeded: false };
  const make = (firstName: string, suffix: string, extra: Partial<Parameters<typeof AdelanteEHR.createReferral>[0]> = {}) => AdelanteEHR.createReferral({ firstName, lastName: "Demo", dob: "1990-04-12", email: `phase-a-${suffix}@example.invalid`, referringAgency: "Demo referral", referrerName: "Demo referrer", referrerEmail: "demo@example.invalid", referralSource: "other", consentToContact: false, channel: "public", identityConfidence: "verified_source", ...extra });
  make("Alex", "new");
  const outreach = make("Sam", "outreach"); AdelanteEHR.logReferralOutreachAttempt(outreach.id, { outcome: "no_answer" });
  const waiting = make("Casey", "paperwork", { dob: undefined, dobUnknown: true, identityConfidence: "public_unverified", referralSource: "self" });
  AdelanteEHR.markReferralContacted(waiting.id);
  const ready = make("Morgan", "ready", { intakeServices: { source: "referral", kinds: ["care_manager", "assessment", "psych_evaluation"] } });
  const pid = AdelanteEHR.enrollReferral(ready.id, { websiteSignup: true });
  if (pid) {
    assignIntakeTeam(actor, ready.id, "care_manager", "s-cm2", new Date().toISOString().slice(0, 10), "Demo first contact assignment");
    assignIntakeTeam(actor, ready.id, "clinician", "s-th2", new Date().toISOString().slice(0, 10), "Demo initial clinician assignment");
  }
  registerIntakeSafetySource({ role: "clinical_coordinator", staffId: "s-cc1" }, { source: { kind: "referral", id: waiting.id, field: "referrer_safety_flag", trigger: "reported_safety_flag" }, tier: "red" }, "Demo recorded safety flag");
  return { seeded: true, safetyReferralId: waiting.id };
}
export function seedIntakePhaseAThroughRegistry(actor: IntakeActor) {
  const r = runAction<{ seeded: boolean; safetyReferralId?: string }>("intake_demo_seed", actor, undefined, { args: [actor] });
  if (r.ok && r.value.safetyReferralId) runAction("intake_safety_escalate", actor, undefined, { args: [actor, "referral", r.value.safetyReferralId, "Demo safety escalation"] });
}