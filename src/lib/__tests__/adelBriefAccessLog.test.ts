import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { _resetAccessLogForTests, accessEventsFor, recordBriefView } from "@/lib/accessLog";
import { _resetAdelBriefCache, briefBulletsFlat, getAdelBrief, warmAdelBriefs } from "@/lib/adelBrief";

const luis = () => AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
const events = (pid: string, action: string) => AdelanteEHR.listAuditEvents({ patientId: pid }).filter((e) => e.action === action);

beforeEach(() => {
  _resetAccessLogForTests();
  _resetAdelBriefCache();
});

describe("V2 — Brief events in the record-access log", () => {
  it("brief.viewed is logged once per 5 minutes per viewer", () => {
    const p = luis();
    const before = events(p.id, "brief.viewed").length;
    const t0 = new Date("2026-10-06T15:00:00Z");
    const v = { actorId: "s-np1", actorName: "Dr. Bagga", role: "physician", patientId: p.id };
    expect(recordBriefView({ ...v, at: t0 })).toBe(true);
    expect(recordBriefView({ ...v, at: new Date(+t0 + 60_000) })).toBe(false);
    expect(recordBriefView({ ...v, at: new Date(+t0 + 4 * 60_000) })).toBe(false);
    expect(events(p.id, "brief.viewed").length).toBe(before + 1);
    expect(recordBriefView({ ...v, at: new Date(+t0 + 6 * 60_000) })).toBe(true);
    const ev = events(p.id, "brief.viewed")[0];
    expect(ev.actorId).toBe("s-np1");
    expect(ev.actorRole).toBe("physician");
    // shows in "Who accessed this record"
    expect(accessEventsFor(p.id).some((r) => r.action === "brief.viewed" && !r.system)).toBe(true);
  });

  it("section computes are system events listing their triggering sources", () => {
    const p = luis();
    getAdelBrief(p, "physician");
    const initial = events(p.id, "brief.section_computed");
    expect(initial.length).toBeGreaterThanOrEqual(4);
    for (const e of initial) {
      const d = e.detail as Record<string, unknown>;
      expect(e.actorId).toBe("system");
      expect(d["system"]).toBe(true);
      expect(d["simulated"]).toBe(true);
      expect(d["visibilityClass"]).toBe("physician|sud:1");
      expect(Array.isArray(d["triggeredBy"])).toBe(true);
    }
    const n = initial.length;
    AdelanteEHR.recordScreener(p.id, { key: "phq-9", score: 4, severity: "minimal", completedAt: new Date().toISOString() } as never);
    getAdelBrief(AdelanteEHR.getPatient(p.id)!, "physician");
    const after = events(p.id, "brief.section_computed").slice(0, events(p.id, "brief.section_computed").length - n);
    expect(after.length).toBeGreaterThan(0);
    for (const e of after) expect((e.detail as { triggeredBy: string[] }).triggeredBy).toContain("screeners");
    // computes never appear as views
    expect(accessEventsFor(p.id).filter((r) => r.action === "brief.section_computed").every((r) => r.system && r.kind === "compute")).toBe(true);
  });

  it("no bullet text or note content in any Brief event", () => {
    const p = luis();
    const e = getAdelBrief(p, "therapist");
    recordBriefView({ actorId: "s-th1", actorName: "T", role: "therapist", patientId: p.id });
    const texts = briefBulletsFlat(e).map((b) => b.text);
    const blob = JSON.stringify(AdelanteEHR.listAuditEvents({ patientId: p.id }).filter((x) => x.action.startsWith("brief.")));
    for (const t of texts) expect(blob).not.toContain(t);
    expect(blob).not.toMatch(/PHQ-9 \d|runs out|supply ran out|open social need/);
  });

  it("warm-up computes are logged as system 'warm' events, not views", async () => {
    const p = luis();
    const views = events(p.id, "brief.viewed").length;
    warmAdelBriefs([p.id], "ecm_provider");
    await new Promise((r) => setTimeout(r, 30));
    const warm = events(p.id, "brief.section_computed").filter((x) => (x.detail as { trigger?: string }).trigger === "warm");
    expect(warm.length).toBeGreaterThan(0);
    expect(events(p.id, "brief.viewed").length).toBe(views);
  });
});
