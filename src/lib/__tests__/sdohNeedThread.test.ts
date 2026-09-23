// §5d-4 — the unified patient thread, advocate tier rules, and the funnel.
import { describe, expect, it, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import {
  patientNeedThreads,
  recentlyResolvedNeeds,
  unlinkedPatientReferrals,
  openNeedCount,
} from "@/lib/patientNeedThread";
import {
  barrierFrequency,
  needsByCategory,
  needsByProvenance,
  needsByTrack,
  sdohFunnel,
  reportableCategory,
  needRecords,
  CONFIDENTIAL_CATEGORY_KEY,
} from "@/lib/sdohReporting";
import { MIN_COHORT_SIZE } from "@/lib/cohortGuard";

const actor = { staffName: "Test Staff", role: "ecm_provider" as StaffRole };

/** `addSdohItem` returns void; the new item is always first on the plan. */
function addNeed(
  pid: string,
  input: { need: string; source?: "staff_assessed" | "intake_self_report"; safetySensitive?: boolean },
) {
  AdelanteEHR.addSdohItem(pid, input, actor);
  return AdelanteEHR.getPatient(pid)!.sdohPlan!.items[0]!;
}

function freshPatientId(): string {
  const p = AdelanteEHR.listPatients()[0]!;
  // Work on a clean slate for this patient's SDOH plan.
  for (const i of [...(p.sdohPlan?.items ?? [])]) AdelanteEHR.removeSdohItem(p.id, i.id);
  if (p.resourceReferrals) p.resourceReferrals.length = 0;
  return p.id;
}

describe("patient need thread", () => {
  let pid = "";
  beforeEach(() => {
    pid = freshPatientId();
  });

  it("pairs a referral with the need it was made for", () => {
    const need = addNeed(pid, { need: "Needs housing", source: "staff_assessed" });
    AdelanteEHR.addResourceReferral(
      pid,
      { category: "housing", provider: "Casa Esperanza", sdohItemId: need.id },
      actor,
    );
    const threads = patientNeedThreads(pid);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.referrals).toHaveLength(1);
    expect(threads[0]!.referrals[0]!.orgName).toBe("Casa Esperanza");
    expect(threads[0]!.referrals[0]!.statusKey).toBe("needRefPending");
    expect(openNeedCount(pid)).toBe(1);
  });

  it("uses a key, not English, for every status line", () => {
    const need = addNeed(pid, { need: "Needs food", source: "staff_assessed" });
    const r = AdelanteEHR.addResourceReferral(
      pid,
      { category: "food", provider: "Food Bank", sdohItemId: need.id },
      actor,
    );
    AdelanteEHR.setResourceReferralStatus(pid, r!.id, "waitlisted", undefined, actor, "No slots");
    expect(patientNeedThreads(pid)[0]!.referrals[0]!.statusKey).toBe("needRefWaitlisted");
  });

  it("shows a closure message for a recently resolved need, then drops it", () => {
    const need = addNeed(pid, { need: "Needs a ride", source: "staff_assessed" });
    AdelanteEHR.setSdohStatus(pid, need.id, "completed", undefined, actor);
    expect(patientNeedThreads(pid)).toHaveLength(0);
    const closures = recentlyResolvedNeeds(pid);
    expect(closures).toHaveLength(1);
    expect(closures[0]!.closureKey).toBe("needClosureResolved");
    // Outside the window it leaves the list entirely.
    const later = new Date(Date.now() + 40 * 86_400_000);
    expect(recentlyResolvedNeeds(pid, later)).toHaveLength(0);
  });

  it("never names a Part 2 sensitive organisation to the patient", () => {
    AdelanteEHR.setConsent(pid, "part2Sud", true);
    const need = addNeed(pid, { need: "Wants a group", source: "staff_assessed" });
    AdelanteEHR.addResourceReferral(
      pid,
      { category: "support_groups", provider: "Sunrise Group", sdohItemId: need.id },
      actor,
    );
    const line = patientNeedThreads(pid)[0]!.referrals[0]!;
    expect(line.orgWithheld).toBe(true);
    expect(line.orgName).toBeUndefined();
    expect(JSON.stringify(line)).not.toContain("Sunrise Group");
  });

  it("hides a staff-only need and a staff-only referral from the patient", () => {
    const safety = addNeed(pid, {
      need: "Unsafe at home",
      source: "staff_assessed",
      safetySensitive: true,
    });
    expect(safety.visibleToPatient).toBe(false);
    AdelanteEHR.addResourceReferral(
      pid,
      { category: "legal", provider: "Legal Aid", sdohItemId: safety.id },
      actor,
    );
    expect(patientNeedThreads(pid)).toHaveLength(0);
    expect(unlinkedPatientReferrals(pid)).toHaveLength(0);
  });

  it("keeps a referral with no linked need visible under its own block", () => {
    AdelanteEHR.addResourceReferral(pid, { category: "food", provider: "Pantry" }, actor);
    expect(unlinkedPatientReferrals(pid)).toHaveLength(1);
  });

  it("never exposes the staff activity log", () => {
    const need = addNeed(pid, { need: "Needs ID", source: "staff_assessed" });
    AdelanteEHR.appendSdohNeedLog(
      pid,
      need.id,
      { entryType: "barrier", text: "Called the county clerk", barriers: ["id_documents"] },
      actor,
    );
    expect(JSON.stringify(patientNeedThreads(pid)[0]!.referrals)).not.toContain("county clerk");
  });
});

describe("social-needs funnel", () => {
  let pid = "";
  beforeEach(() => {
    pid = freshPatientId();
  });

  it("counts identified, referred, connected and resolved", () => {
    const a = addNeed(pid, { need: "Housing", source: "staff_assessed" });
    const b = addNeed(pid, { need: "Food", source: "intake_self_report" });
    const ra = AdelanteEHR.addResourceReferral(
      pid,
      { category: "housing", provider: "Casa", sdohItemId: a.id },
      actor,
    );
    AdelanteEHR.setResourceReferralStatus(pid, ra!.id, "connected", undefined, actor, "Intake booked");
    AdelanteEHR.setSdohStatus(pid, a.id, "completed", undefined, actor);

    const f = sdohFunnel();
    expect(f.identified).toBeGreaterThanOrEqual(2);
    expect(f.referred).toBeGreaterThanOrEqual(1);
    expect(f.connected).toBeGreaterThanOrEqual(1);
    expect(f.resolved).toBeGreaterThanOrEqual(1);
    expect(b.status).toBe("identified");
  });

  it("carries the shared small-cohort guard on every breakdown", () => {
    const f = sdohFunnel();
    expect(f.minimumCohortSize).toBe(MIN_COHORT_SIZE);
    for (const bd of [
      needsByCategory(),
      needsByProvenance(),
      needsByTrack(),
      barrierFrequency(),
    ]) {
      expect(bd.minimumCohortSize).toBe(MIN_COHORT_SIZE);
      expect(typeof bd.belowMinimumCohort).toBe("boolean");
    }
  });

  it("folds Part 2 sensitive categories into the confidential bucket", () => {
    AdelanteEHR.setConsent(pid, "part2Sud", true);
    const need = addNeed(pid, { need: "Group", source: "staff_assessed" });
    AdelanteEHR.addResourceReferral(
      pid,
      { category: "recovery_meetings", provider: "Sunrise Group", sdohItemId: need.id },
      actor,
    );
    const rec = needRecords([pid]).find((r) => r.item.id === need.id)!;
    expect(reportableCategory(rec).key).toBe(CONFIDENTIAL_CATEGORY_KEY);
    const rows = needsByCategory().rows.map((r) => r.key);
    expect(rows).not.toContain("recovery_meetings");
    expect(rows).not.toContain("support_groups");
    expect(JSON.stringify(needsByCategory())).not.toContain("Sunrise Group");
  });

  it("counts barriers from the activity log", () => {
    const need = addNeed(pid, { need: "Housing", source: "staff_assessed" });
    AdelanteEHR.appendSdohNeedLog(
      pid,
      need.id,
      { entryType: "barrier", text: "No bus pass", barriers: ["transportation"] },
      actor,
    );
    expect(barrierFrequency().rows.find((r) => r.key === "transportation")?.count).toBeGreaterThan(
      0,
    );
  });
});
