// Mitch, 31 Oct 18:25 CT. Draft — pending clinical sign-off.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "../ehr";
import { chartAction } from "../chartActions";
import { runAction } from "../actions/runAction";
import { screenerFollowupActor } from "../screenerFollowup";
import { STAFF_ROLES } from "../roles";
const DAY = 86400000;
afterEach(() => vi.useRealTimers());
describe("dedicated re-screen schedule automation", () => {
  it.each(STAFF_ROLES)("$key cannot run cadence automation even with the system staff ID", ({ key: role }) => {
    const p = AdelanteEHR.listPatients()[0];
    if (!p) throw new Error("Existing member fixture missing");
    const actor = { role, staffId: screenerFollowupActor.staffId };
    expect(chartAction("rescreen_cadence_automation").allowed(actor, p)).toEqual({ state: "hidden", reason: "Run by the system only." });
    const result = runAction("rescreen_cadence_automation", actor, p);
    expect(result.ok).toBe(false);
    expect(result.event.detail?.actionId).toBe("rescreen_cadence_automation");
  });
  it("routine prompt, reminders and day-10 task each have one cadence audit, never an item-9 audit", () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-10-31T23:00:00Z");
    vi.setSystemTime(now);
    const p = AdelanteEHR.listPatients().find(x => x.intakeCompletedAt);
    if (!p) throw new Error("Existing intake-complete member fixture missing");
    AdelanteEHR.recordScreener(p.id, { key: "pc-ptsd-5", score: 0, severity: "Negative", completedAt: new Date(now - 400 * DAY).toISOString() });
    for (const day of [0, 3, 7, 10]) {
      vi.setSystemTime(now + day * DAY);
      const kind = day === 0 ? "prompt" : day === 10 ? "followup" : "reminder";
      const operation = AdelanteEHR.automaticRescreenOperations(p.id).find(o => o.kind === kind);
      if (!operation) throw new Error(`Missing real planned ${kind} operation`);
      const before = AdelanteEHR.listAuditEvents({ category: "action" }).length;
      const result = runAction("rescreen_cadence_automation", screenerFollowupActor, p, {
        via: "runAutomaticRescreenStep", args: [p.id, operation, new Date().toISOString(), screenerFollowupActor], auditReason: "Scheduled screening follow-up",
      });
      expect(result.ok).toBe(true);
      expect(result.event.detail?.actionId).toBe("rescreen_cadence_automation");
      expect(result.event.detail?.storeFn).toBe("runAutomaticRescreenStep");
      expect(AdelanteEHR.listAuditEvents({ category: "action" }).length - before).toBe(1);
    }
    expect(AdelanteEHR.caseTasksForPatient(p.id).filter(t => t.taskType === "rescreen_followup")).toHaveLength(1);
    expect(chartAction("screener_item9_followup").store.map(s => s.name)).toEqual(["createItem9FollowupTask"]);
  });
});