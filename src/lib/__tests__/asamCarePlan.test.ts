import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { taggedItem } from "@/lib/contentTags";
import { ASAM_DIMENSIONS } from "@/lib/asam";
import { cosignAsamAssessment, signAsamAssessment } from "@/lib/asamFlow";
import { runAction } from "@/lib/actions/runAction";
import {
  ASAM_PLAN_ADEL_LABEL, ASAM_PLAN_DRAFT_LABEL, ASAM_REVIEW_FLAG_LABEL, _resetAsamPlan, asamProvenanceLabel, latestFinalAsam, listAsamSuggestions,
} from "@/lib/asamCarePlan";
import { getStructuredPlan, staffPlanView } from "@/lib/structuredCarePlan";
import type { StaffRole } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";

const BAGGA = { staffId: "s-np1", name: "Dr. M. Bagga", role: "physician" as StaffRole, clinicianId: "c5" };
const REYES = { staffId: "s-th1", name: "Marisol Reyes", role: "therapist" as StaffRole, clinicianId: "c1" };
const RENEE = { staffId: "s-sudc1", name: "Renee Castillo", role: "sud_counselor" as StaffRole, clinicianId: "c7" };
const ATT = { attested: true, signatureDataUrl: "data:image/png;base64,c2VlZA==" };
const luis = () => AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
const run = (role: StaffRole, staffId: string, via: string, ...args: unknown[]) =>
  runAction("asam_plan_suggestion", { role, staffId, staffName: staffId }, luis(), { via, args });

/** Amend the newest signed ASAM and sign it with the given ratings (real store path). */
function resign(author: typeof BAGGA, ratings: Record<string, number>) {
  const p = luis();
  const latest = latestFinalAsam(p)!;
  const v = AdelanteEHR.amendAsam(p.id, latest.id, author, "Follow-up reassessment");
  AdelanteEHR.saveAsamDraft(p.id, {
    dimensions: ASAM_DIMENSIONS.map((d) => ({ key: d.key, documentation: "Documented.", rating: (ratings[d.key] ?? 1) as 0 | 1 | 2 | 3 | 4 })),
    recommendedLevel: "intensive_outpatient",
    actualLevel: "intensive_outpatient",
  }, author);
  return signAsamAssessment(p.id, v.id, author, ATT);
}

beforeEach(() => _resetAsamPlan());

describe("C1 — ASAM → care plan suggestions", () => {
  it("no suggestions while the ASAM is only cosign-pending; they appear after the LPHA co-signs; never auto-activated", () => {
    const p = luis();
    const goalsBefore = getStructuredPlan(p.id).goals.length;
    const pending = resign(RENEE, { d3: 3, d5: 2 });
    expect(pending.status).toBe("cosign_pending");
    expect(listAsamSuggestions(p.id, "physician").filter((s) => s.asamId === pending.id)).toEqual([]);
    cosignAsamAssessment(p.id, pending.id, BAGGA, ATT);
    const sugg = listAsamSuggestions(p.id, "physician").filter((s) => s.asamId === pending.id);
    expect(sugg.map((s) => s.dimensionKey).sort()).toEqual(["d3", "d5"]);
    for (const s of sugg) {
      expect(s.status).toBe("suggested");
      expect(s.problem).toBeTruthy();
      expect(s.goal).toBeTruthy();
      expect(s.interventions.length).toBeGreaterThanOrEqual(1);
      expect(s.interventions.length).toBeLessThanOrEqual(2);
      expect(s.reviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(getStructuredPlan(p.id).goals.length).toBe(goalsBefore);
    expect(ASAM_PLAN_ADEL_LABEL).toBe("Draft by Adel — verify");
    expect(ASAM_PLAN_DRAFT_LABEL).toBe("Draft — pending clinical sign-off");
  });

  it("accept / edit / dismiss each go through runAction and audit; dismiss needs a reason; provenance chip", () => {
    const p = luis();
    const a = resign(BAGGA, { d3: 3, d4: 2, d5: 2 });
    const [s3, s4, s5] = ["d3", "d4", "d5"].map((k) => listAsamSuggestions(p.id, "physician").find((s) => s.dimensionKey === k)!);
    const me = { name: BAGGA.name, role: BAGGA.role, staffId: BAGGA.staffId };

    const e = run("physician", BAGGA.staffId, "editAsamSuggestion", p.id, s4.id, { goal: "Attend 4 of 4 sessions in 30 days." }, me);
    expect(e.ok).toBe(true);
    expect(listAsamSuggestions(p.id, "physician").find((s) => s.id === s4.id)?.status).toBe("suggested");

    const acc = run("physician", BAGGA.staffId, "acceptAsamSuggestion", p.id, s3.id, me, { measure: "PHQ-9 down 5" });
    expect(acc.ok).toBe(true);
    const g = getStructuredPlan(p.id).goals.find((x) => x.source?.suggestionId === s3.id)!;
    expect(g.sud).toBe(true);
    expect(g.status).toBe("active");
    expect(g.measure).toBe("PHQ-9 down 5");
    expect(g.source).toMatchObject({ kind: "asam", asamId: a.id, asamVersion: a.version, dimensionKey: "d3", rating: 3 });
    expect(asamProvenanceLabel(g)).toBe(`ASAM v${a.version} · Dimension 3 (rating 3)`);
    // Recovery-module intervention became a (SUD) assignment.
    expect(getStructuredPlan(p.id).assignments.some((x) => x.goalId === g.id && taggedItem(x.activityId ?? "")?.meta.asam?.includes(3) && x.sud)).toBe(true);

    expect(run("physician", BAGGA.staffId, "dismissAsamSuggestion", p.id, s5.id, "", me).ok).toBe(false);
    expect(run("physician", BAGGA.staffId, "dismissAsamSuggestion", p.id, s5.id, "Already addressed in plan", me).ok).toBe(true);

    const events = AdelanteEHR.listAuditEvents({ patientId: p.id });
    for (const action of ["plan_rule_suggestion_edited", "plan_rule_suggestion_accepted", "plan_rule_suggestion_dismissed"])
      expect(events.some((x) => x.action === action), action).toBe(true);
    const std = events.filter((x) => x.action === "action.succeeded" && (x.detail as { actionId?: string })?.actionId === "asam_plan_suggestion");
    expect(std.length).toBeGreaterThanOrEqual(3);
    expect(events.some((x) => x.action === "action.blocked" && (x.detail as { actionId?: string })?.actionId === "asam_plan_suggestion")).toBe(true);
    expect(listAsamSuggestions(p.id, "physician").map((s) => s.id)).not.toContain(s3.id);
  });

  it("a new ASAM version flags accepted goals whose dimension rating changed (and only those)", () => {
    const p = luis();
    resign(BAGGA, { d1: 2, d2: 3 });
    const me = { name: BAGGA.name, role: BAGGA.role, staffId: BAGGA.staffId };
    for (const k of ["d1", "d2"]) {
      const s = listAsamSuggestions(p.id, "physician").find((x) => x.dimensionKey === k)!;
      expect(run("physician", BAGGA.staffId, "acceptAsamSuggestion", p.id, s.id, me).ok).toBe(true);
    }
    resign(BAGGA, { d1: 4, d2: 3 });
    listAsamSuggestions(p.id, "physician");
    const goals = getStructuredPlan(p.id).goals.filter((g) => g.source?.kind === "asam" && g.status === "active");
    const d3 = goals.filter((g) => g.source!.dimensionKey === "d1").at(-1)!;
    const d5 = goals.filter((g) => g.source!.dimensionKey === "d2").at(-1)!;
    expect(d3.reviewFlag?.label).toBe(ASAM_REVIEW_FLAG_LABEL);
    expect(d3.reviewFlag).toMatchObject({ fromRating: 2, toRating: 4 });
    expect(d5.reviewFlag).toBeUndefined();
    // No duplicate suggestion for a dimension that already has an accepted goal.
    expect(listAsamSuggestions(p.id, "physician").some((s) => s.dimensionKey === "d1")).toBe(false);
    expect(run("physician", BAGGA.staffId, "markAsamGoalReviewed", p.id, d3.id, me).ok).toBe(true);
    expect(d3.reviewFlag).toBeUndefined();
    expect(d3.source!.rating).toBe(4);
  });

  it("dimension 6 cross-links the patient's open SDOH needs", () => {
    const p = luis();
    AdelanteEHR.addSdohItem(p.id, { need: "Housing" }, { staffName: REYES.name, role: "therapist" });
    const open = (AdelanteEHR.getPatient(p.id)!.sdohPlan?.items ?? []).filter((i) => i.status !== "completed").map((i) => i.id);
    resign(BAGGA, { d6: 3 });
    const s = listAsamSuggestions(p.id, "physician").find((x) => x.dimensionKey === "d6")!;
    expect(open.length).toBeGreaterThan(0);
    expect(s.needIds.sort()).toEqual(open.sort());
    expect(s.interventions.some((i) => i.moduleId && taggedItem(i.moduleId)?.meta.asam?.includes(6))).toBe(true);
    const me = { name: BAGGA.name, role: BAGGA.role, staffId: BAGGA.staffId };
    run("physician", BAGGA.staffId, "acceptAsamSuggestion", p.id, s.id, me);
    const g = getStructuredPlan(p.id).goals.find((x) => x.source?.suggestionId === s.id)!;
    expect(g.needIds.sort()).toEqual(open.sort());
  });

  it("Part 2: hidden from roles without SUD access; ECM / care manager can't act on them but keep non-SUD goal edits", () => {
    const p = luis();
    resign(BAGGA, { d4: 3, d5: 3 });
    const me = { name: BAGGA.name, role: BAGGA.role, staffId: BAGGA.staffId };
    const s = listAsamSuggestions(p.id, "physician").find((x) => x.dimensionKey === "d4")!;
    expect(run("physician", BAGGA.staffId, "acceptAsamSuggestion", p.id, s.id, me).ok).toBe(true);
    const restricted = (["ecm_provider", "cf_care_manager", "billing", "peer_specialist", "community_health_worker", "clinical_coordinator"] as StaffRole[]).filter((r) => !roleSeesAsamSection(r, p));
    expect(restricted).toEqual(expect.arrayContaining(["ecm_provider", "cf_care_manager", "billing"]));
    for (const role of restricted) {
      expect(listAsamSuggestions(p.id, role), role).toEqual([]);
      expect(staffPlanView(p.id, role).goals.some((g) => g.source?.kind === "asam"), role).toBe(false);
    }
    const other = listAsamSuggestions(p.id, "physician").find((x) => x.dimensionKey === "d5")!;
    const r = run("ecm_provider", "s-cm1", "acceptAsamSuggestion", p.id, other.id, { name: "Luz", role: "ecm_provider" });
    expect(r.ok).toBe(false);
    // ECM still adds an ordinary (non-SUD) goal.
    const ok = runAction("care_plan_goal", { role: "ecm_provider", staffId: "s-cm1" }, p, { args: [{ patientId: p.id, owner: "patient", measure: "", clinicalText: "Get a bus pass", actor: { name: "Luz", role: "ecm_provider" } }] });
    expect(ok.ok).toBe(true);
  });
});
