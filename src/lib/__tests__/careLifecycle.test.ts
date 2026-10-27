// 27 Oct (Mitch) lifecycle rules — Draft pending EHR/Admin audit.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { runAction } from "../actions/runAction";
import { canAccess } from "../roles";
import { lifecycleForReferral, lifecycleForPatient, billingReadiness } from "../careLifecycle";
import { canCloseReferral, canEnrollReferral, canLogReferralContact, IDENTITY_NEEDED } from "../referralLifecycleActions";
import { didntStartCareFor } from "../lifecycleState";
import { referralFunnel } from "../referralFunnel";
import { patientGettingStarted } from "../gettingStarted";
import { planSuggestions } from "../structuredCarePlan";
import { importIntakeStaging, patientOwnPacketNeeds } from "../intakePacket";

const intake = { role: "intake_coordinator" as const, staffId: "s-intake1" };
const coord = { role: "clinical_coordinator" as const, staffId: "s-coord1" };
const peer = { role: "peer_specialist" as const, staffId: "s-peer1" };
const trainee = { role: "clinical_trainee" as const, staffId: "s-trainee1" };
let n = 0;
function referral(extra: Record<string, unknown> = {}) {
  return AdelanteEHR.createReferral({ firstName: "Lifecycle", lastName: `Fixture${++n}`, dob: "1990-04-12", email: `lifecycle-${n}@example.invalid`, referringAgency: "Fixture agency", referrerName: "Fixture", referralSource: "other", consentToContact: false, channel: "public", identityConfidence: "verified_source", ...extra } as never)!;
}
const run = (id: string, actor: { role: string; staffId?: string }, ...args: unknown[]) =>
  runAction(id, actor as never, undefined, { args: [actor, ...args], auditReason: "Fixture reason" });

describe("lifecycle permissions (Mitch 27 Oct)", () => {
  it("peer logs outreach but cannot enroll or close", () => {
    const r = referral();
    expect(run("referral_outreach_log", peer, r.id, "no_answer", "Called, no answer").ok).toBe(true);
    expect(run("referral_enroll", peer, r.id, "Try enroll").ok).toBe(false);
    expect(run("referral_close", peer, r.id, { reason: "duplicate" }, "Try close").ok).toBe(false);
    expect(canAccess("peer_specialist", "care_coordination").level).toBe("read");
  });
  it("trainee can neither log contact nor enroll nor close", () => {
    expect(canLogReferralContact("clinical_trainee")).toBe(false);
    expect(canEnrollReferral("clinical_trainee")).toBe(false);
    expect(canCloseReferral("clinical_trainee")).toBe(false);
    expect(run("referral_outreach_log", trainee, referral().id, "no_answer", "x reason").ok).toBe(false);
  });
  it("Intake enrollment needs actual identity evidence — DOB and verified_source alone do not count", () => {
    const r = referral();
    const blocked = run("referral_enroll", intake, r.id, "Enroll now");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe(IDENTITY_NEEDED);
    expect(run("referral_identity_confirm", intake, r.id, "Checked ID at the front desk", "Identity checked").ok).toBe(true);
    const ok = run("referral_enroll", intake, r.id, "Enroll now");
    expect(ok.ok).toBe(true);
    expect(AdelanteEHR.listReferrals().find((x) => x.id === r.id)?.status).toBe("enrolled");
  });
  it("Intake closes only duplicate or unable_to_reach", () => {
    expect(run("referral_close", intake, referral().id, { reason: "not_eligible" }, "Close it").ok).toBe(false);
    expect(run("referral_close", intake, referral().id, { reason: "declined_services" }, "Close it").ok).toBe(false);
    expect(run("referral_close", intake, referral().id, { reason: "duplicate" }, "Close it").ok).toBe(true);
    expect(run("referral_close", intake, referral().id, { reason: "unable_to_reach" }, "Close it").ok).toBe(true);
    expect(run("referral_close", coord, referral().id, { reason: "not_eligible" }, "Close it").ok).toBe(true);
  });
  it("enrolling creates one 'Draft first care plan' task, never a pre-enrollment plan", () => {
    const r = referral();
    expect(run("referral_enroll", coord, r.id, "Enroll now").ok).toBe(true);
    const pid = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!.enrolledPatientId!;
    const tasks = AdelanteEHR.listCaseTasks().filter((t) => t.patientId === pid && t.taskType === "first_care_plan");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Draft first care plan");
  });
});

describe("shared stages", () => {
  it("a new referral is Stage 2 with the identity gap; enrolled without paperwork keeps earlier gaps", () => {
    const r = referral();
    const v = lifecycleForReferral(r);
    expect(v.stage).toBe(2);
    expect(v.gaps).toEqual([]);
    run("referral_enroll", coord, r.id, "Enroll now");
    const p = AdelanteEHR.getPatient(AdelanteEHR.listReferrals().find((x) => x.id === r.id)!.enrolledPatientId!)!;
    const pv = lifecycleForPatient(p);
    expect(pv.stage).toBe(5);
    expect(billingReadiness(p.id).ready).toBe(false);
  });
  it("funnel keeps the cohort guard at 11", () => {
    expect(referralFunnel().minimumCohortSize).toBe(11);
    expect(referralFunnel().lifecycleReached).toHaveLength(8);
  });
});

describe("didn't start care", () => {
  it("is reopenable and Intake may record only 'couldn't reach'", () => {
    const r = referral();
    run("referral_enroll", coord, r.id, "Enroll now");
    const pid = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!.enrolledPatientId!;
    const p = AdelanteEHR.getPatient(pid);
    const mark = (actor: typeof intake | typeof coord, reason: string) => runAction("didnt_start_care_mark", actor, p, { args: [actor, pid, { reason }, "Fixture reason"] });
    expect(mark(intake, "chose_not_to_start").ok).toBe(false);
    expect(mark(intake, "unable_to_reach").ok).toBe(true);
    expect(lifecycleForPatient(p!).closed?.kind).toBe("didnt_start");
    expect(runAction("didnt_start_care_reopen", coord, p, { args: [coord, pid, "They called back"] }).ok).toBe(true);
    expect(didntStartCareFor(pid)?.reopenedAt).toBeTruthy();
    expect(lifecycleForPatient(p!).closed).toBeUndefined();
  });
});

describe("getting started — Dana pre-release scenario", () => {
  it("packet needs reach the person and the clinician; Part 2 needs never become suggestions", () => {
    const { referralIds } = importIntakeStaging(coord, "pre_release_packet", "packet-dana", [{ firstName: "Dana", lastName: "Fixture", email: "dana@example.invalid", referrerName: "Release planner", releaseDate: "2026-11-01", sdoh: [{ kind: "housing" }, { kind: "food", part2: true }] }], "Packet received");
    const id = referralIds[0];
    expect(run("referral_identity_confirm", intake, id, "Verified with the release planner", "Identity checked").ok).toBe(true);
    expect(run("referral_enroll", intake, id, "Enroll after release").ok).toBe(true);
    const pid = AdelanteEHR.listReferrals().find((x) => x.id === id)!.enrolledPatientId!;
    expect(patientOwnPacketNeeds(pid).map((n) => n.kind).sort()).toEqual(["food", "housing"]);
    const sugg = planSuggestions(pid).filter((s) => s.intakeNeed);
    expect(sugg.map((s) => s.intakeNeed!.label)).toEqual(["A place to live"]);
    const items = patientGettingStarted(pid, "es");
    expect(items.some((i) => i.label === "Un lugar donde vivir")).toBe(true);
    expect(JSON.stringify(items)).not.toMatch(/SUD|Part 2|sustancia/i);
  });
});
