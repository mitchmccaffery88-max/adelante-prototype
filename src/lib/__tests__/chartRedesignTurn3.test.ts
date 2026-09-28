import { beforeAll, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { seedChartOrdersDemo } from "@/lib/chartOrders";
import { seedStructuredCarePlanDemo } from "@/lib/structuredCarePlan";
import {
  adelBrief, briefHasNew, canEditSticky, chartEvents, dueNow, getStickyNote, headerAlerts, markBriefSeen, reentryDay,
  roleCardOrder, setStickyNote, bucketOf,
} from "@/lib/chartBrief";

beforeAll(() => {
  seedStructuredCarePlanDemo();
  seedChartOrdersDemo();
});
const luis = () => AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
const SUD = /substance|opioid|alcohol|asam|sud\b|drug screen|buprenorph|methadone|naltrex|audit|dast/i;

describe("role-default Brief card order", () => {
  it("matches the medical director's order per role", () => {
    expect(roleCardOrder("physician").slice(0, 5)).toEqual(["due", "measures", "meds", "problems", "visits"]);
    expect(roleCardOrder("therapist").slice(0, 5)).toEqual(["due", "measures", "careplan", "visits", "problems"]);
    expect(roleCardOrder("ecm_provider").slice(0, 5)).toEqual(["due", "needs", "visits", "outside", "careplan"]);
    expect(roleCardOrder("peer_specialist").slice(0, 4)).toEqual(["due", "needs", "visits", "careplan"]);
    expect(roleCardOrder("clinical_coordinator").slice(0, 4)).toEqual(["due", "visits", "referrals", "outside"]);
  });
});

describe("sticky note", () => {
  it("patient-contact roles edit, billing/sys_admin can't, every change audited", () => {
    const p = luis();
    expect(canEditSticky("billing")).toBe(false);
    expect(canEditSticky("sys_admin")).toBe(false);
    expect(() => setStickyNote(p.id, "x", { name: "Bill", role: "billing" })).toThrow();
    const before = AdelanteEHR.listAuditEvents({ patientId: p.id }).length;
    setStickyNote(p.id, "Prefers texts after 3pm", { name: "Luz", role: "ecm_provider" });
    expect(getStickyNote(p.id)?.text).toBe("Prefers texts after 3pm");
    expect(AdelanteEHR.listAuditEvents({ patientId: p.id }).length).toBe(before + 1);
  });
});

describe("header + Adel Brief", () => {
  it("Luis shows a reentry day within 90 days", () => {
    const d = reentryDay(luis());
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(91);
  });
  it("nothing SUD-related reaches the ECM provider (alerts, due now, brief, events)", () => {
    const p = luis();
    const all = ["tracking", "outside-records", "appointments", "safety-plan", "alerts", "care-plan", "tasks"];
    const text = [
      ...headerAlerts(p, "ecm_provider", all).map((a) => a.label),
      ...dueNow(p, "ecm_provider").map((r) => r.label),
      ...chartEvents(p, "ecm_provider").map((e) => e.label),
      ...adelBrief(p, "ecm_provider", "s-cm1", undefined).bullets,
    ].join(" | ");
    expect(text).not.toMatch(SUD);
  });
  it("glow clears once the user opens the brief", () => {
    const p = luis();
    expect(briefHasNew(p, "physician", "s-np1")).toBe(true);
    markBriefSeen("s-np1", p.id);
    expect(briefHasNew(p, "physician", "s-np1")).toBe(false);
  });
  it("suggested actions never include hidden registry actions", () => {
    const acts = adelBrief(luis(), "billing", "s-bill1", undefined).actions;
    expect(acts).toEqual([]);
  });
  it("due buckets", () => {
    const now = new Date("2026-09-28T12:00:00");
    expect(bucketOf("2026-09-20", now)).toBe("past");
    expect(bucketOf("2026-09-28", now)).toBe("today");
    expect(bucketOf("2026-10-02", now)).toBe("week");
  });
});
