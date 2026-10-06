import { beforeAll, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { seedChartOrdersDemo } from "@/lib/chartOrders";
import { seedStructuredCarePlanDemo } from "@/lib/structuredCarePlan";
import { STAFF_ROLES, type StaffRole } from "@/lib/roles";
import { _resetAdelBriefCache } from "@/lib/adelBrief";
import { checkAllBriefs, checkBriefFor } from "@/lib/adelBriefCheck";

beforeAll(() => {
  seedStructuredCarePlanDemo();
  seedChartOrdersDemo();
  _resetAdelBriefCache();
});

describe("V1 — every Brief bullet matches the chart section it links to", () => {
  it("every seeded patient × every staff role: no mismatch, no missing source, no leak", () => {
    const r = checkAllBriefs(STAFF_ROLES.map((x) => x.key));
    expect(r.bullets).toBeGreaterThan(50);
    expect(r.issues.slice(0, 15)).toEqual([]);
  });
  it("Luis Camacho (SUD) as Dr. Bagga, therapist, Luz (ECM), peer, billing and admin", () => {
    const p = AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
    const roles: StaffRole[] = ["physician", "therapist", "ecm_provider", "peer_specialist", "billing", "sys_admin"];
    for (const role of roles) expect(checkBriefFor(p, role), role).toEqual([]);
  });
  it("the checker catches a tampered bullet, a sourceless bullet and a SUD leak", async () => {
    const { getAdelBrief } = await import("@/lib/adelBrief");
    const p = AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
    const e = getAdelBrief(p, "ecm_provider");
    const sec = e.sections.engagement!;
    const saved = sec.bullets;
    sec.bullets = [
      { id: "visits", text: "Visits: 99 attended / 0 missed (30 d); 99 / 0 (60 d).", at: new Date().toISOString(), sectionId: "appointments", sources: saved.find((b) => b.id === "visits")?.sources ?? [{ kind: "appointment", id: "nope" }] },
      { id: "x", text: "Buprenorphine supply ran out.", at: new Date().toISOString(), sectionId: "medications" },
    ];
    const probs = checkBriefFor(p, "ecm_provider").map((i) => i.problem);
    sec.bullets = saved;
    expect(probs).toContain("no_source");
    expect(probs).toContain("sud_leak");
    expect(probs.some((x) => x === "mismatch" || x === "unresolved_source")).toBe(true);
  });
});

describe("V1 fixes — bullets only for chart sections the role can open", () => {
  it("billing / admin / coordinators get no PHQ-9/GAD-7 scores or pending lab results", async () => {
    const { getAdelBrief, briefBulletsFlat } = await import("@/lib/adelBrief");
    const p = AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
    for (const role of ["billing", "sys_admin", "clinical_coordinator", "billing_coordinator", "community_health_worker", "cf_care_manager"] as StaffRole[]) {
      const text = briefBulletsFlat(getAdelBrief(p, role)).map((b) => b.text).join(" | ");
      expect(text, role).not.toMatch(/PHQ-9|GAD-7|Pending result/);
    }
  });
});
