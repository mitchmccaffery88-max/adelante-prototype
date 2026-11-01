// R53 part 2 — clinician Re-screens due tile (Mitch, 31 Oct 16:36 CT). Draft — pending clinical sign-off.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR, type Patient } from "../ehr";
import { canAccess, STAFF_ROSTER, type StaffRole } from "../roles";
import { runAction } from "../actions/runAction";
import { groupRescreenRows, rescreenDashboardRows, rescreenInstrumentView, RESCREEN_EMPTY_TEXT, sendableKeys, sendRescreens } from "../rescreenDashboard";
import { rescreenTileRole, workspaceActionRows, workspaceTileOrder, workspaceTodayTiles, attentionCaseload } from "../clinicianWorkspace";
import { myCaseload, type ScreenerDueRow } from "../myWork";

const DAY = 86400000;
const now = Date.parse("2026-11-01T16:00:00Z");
const iso = (d: number) => new Date(now - d * DAY).toISOString();
const due = (patientId: string, screenerKey: string, daysSinceLast = 35, cadenceStep = 30): ScreenerDueRow => ({ patientId, patientName: patientId, screenerKey, daysSinceLast, cadenceStep, taskAlreadySent: false });
function member(id: string, extra: Partial<Patient> = {}): Patient {
  const base = AdelanteEHR.listPatients()[0];
  return { ...base, id, firstName: id, lastName: "Test", screeners: {}, screenerHistory: [], incompleteScreeners: [], tasks: [], ...extra };
}
afterEach(() => vi.restoreAllMocks());

describe("R53 part 2 rows", () => {
  it("groups one row per patient with one chip per due instrument", () => {
    const rows = groupRescreenRows([due("a", "phq-9"), due("b", "gad-7"), due("a", "gad-7")], [member("a"), member("b")], now);
    expect(rows.map((r) => [r.patientId, r.instruments.map((i) => i.key)])).toEqual([["a", ["phq-9", "gad-7"]], ["b", ["gad-7"]]]);
  });
  it("shows Due, Due N days ago and Requested by staff N days ago", () => {
    expect(rescreenInstrumentView(member("a"), due("a", "phq-9", 30, 30), now).chipText).toBe("Due");
    expect(rescreenInstrumentView(member("a"), due("a", "phq-9", 33, 30), now).chipText).toBe("Due 3 days ago");
    const p = member("a", { tasks: [{ id: "t", kind: "rescreen", label: "x", screenerKey: "phq-9", createdAt: iso(2) }] });
    expect(rescreenInstrumentView(p, due("a", "phq-9", 33, 30), now).chipText).toBe("Requested by staff 2 days ago");
  });
  it("shows the estimate label and a trend against the previous scored result", () => {
    const p = member("a", { screenerHistory: [
      { key: "phq-9", score: 10, severity: "Moderate", completedAt: iso(70) },
      { key: "phq-9", score: 14, severity: "Moderate", completedAt: iso(35), estimated: true, missingItems: [3] },
    ] });
    const v = rescreenInstrumentView(p, due("a", "phq-9"), now);
    expect(v.lastText).toBe("14 · Estimated (1 item missing)");
    expect([v.trend, v.previousScore]).toEqual(["up", 10]);
  });
  it("a newer incomplete submission replaces the old score", () => {
    const p = member("a", {
      screenerHistory: [{ key: "phq-9", score: 12, severity: "Moderate", completedAt: iso(40) }],
      incompleteScreeners: [{ key: "phq-9", status: "incomplete", completedAt: iso(5), shownCount: 9, answeredCount: 7 } as never],
    });
    const v = rescreenInstrumentView(p, due("a", "phq-9"), now);
    expect(v.lastText).toBe("Incomplete · 7 of 9 answered");
    expect(v.trend).toBeUndefined();
  });
  it("carries the configured cadence step", () => expect(rescreenInstrumentView(member("a"), due("a", "pc-ptsd-5", 95, 90), now).cadenceNote).toBe("90-day step"));
  it("has the empty-state text", () => expect(RESCREEN_EMPTY_TEXT).toBe("No re-screens due on your caseload."));
});

describe("R53 part 2 Part 2 gate", () => {
  it("SUD chips appear only where screeners_sud resolves, with no stub", () => {
    const roles = [...new Set(STAFF_ROSTER.map((s) => s.role))] as StaffRole[];
    const sees = (role: StaffRole, p: Patient) => { const a = canAccess(role, "screeners_sud", p); return !a.locked && a.level !== "none"; };
    const pair = AdelanteEHR.listPatients().flatMap((p) => { const yes = roles.find((r) => sees(r, p)); const no = roles.find((r) => !sees(r, p)); return yes && no ? [{ p, yes, no }] : []; })[0];
    expect(pair).toBeTruthy();
    vi.spyOn(AdelanteEHR, "rescreensDue").mockImplementation((id) => id === pair.p.id ? [{ key: "phq-9", lastDays: 35, nextDue: 30 }, { key: "audit", lastDays: 95, nextDue: 90 }] : []);
    const allowed = rescreenDashboardRows([pair.p], { role: pair.yes }, now);
    const denied = rescreenDashboardRows([pair.p], { role: pair.no }, now);
    expect(allowed[0].instruments.map((i) => i.key).sort()).toEqual(["audit", "phq-9"]);
    expect(denied[0].instruments.map((i) => i.key)).toEqual(["phq-9"]);
    expect(JSON.stringify(denied)).not.toMatch(/audit|AUDIT|dast|DAST|Restricted|lock/i);
  });
});

describe("R53 part 2 actions", () => {
  it("Send and Send all due run rescreen_send once per visible instrument", () => {
    const row = groupRescreenRows([due("a", "phq-9"), due("a", "gad-7")], [member("a")], now)[0];
    const run = vi.fn();
    expect(sendRescreens("a", ["phq-9"], run)).toBe(1);
    expect(sendRescreens("a", sendableKeys(row), run)).toBe(2);
    expect(run.mock.calls).toEqual([["rescreen_send", "sendRescreenTask", "a", "phq-9"], ["rescreen_send", "sendRescreenTask", "a", "phq-9"], ["rescreen_send", "sendRescreenTask", "a", "gad-7"]]);
  });
  it("a real Send goes through the registry and shows Requested", () => {
    const p = AdelanteEHR.listPatients()[0];
    const therapist = STAFF_ROSTER.find((s) => s.role === "therapist")!;
    const before = (p.tasks ?? []).length;
    sendRescreens(p.id, ["phq-9"], (id, via, pid, key) => { const r = runAction(id, { role: therapist.role, staffId: therapist.id }, AdelanteEHR.getPatient(pid), { via, args: [pid, key] }); expect(r.ok).toBe(true); });
    const after = AdelanteEHR.getPatient(p.id)!;
    expect((after.tasks ?? []).length).toBe(before + 1);
    expect(rescreenInstrumentView(after, due(p.id, "phq-9"), Date.now()).chipText).toBe("Requested by staff 0 days ago");
  });
  it("Send is disabled for 7 days, then shows Send again", () => {
    const at = (d: number) => rescreenInstrumentView(member("a", { tasks: [{ id: "t", kind: "rescreen", label: "x", screenerKey: "phq-9", createdAt: iso(d) }] }), due("a", "phq-9"), now);
    expect([at(6).sendEnabled, at(6).sendLabel]).toEqual([false, "Sent"]);
    expect([at(7).sendEnabled, at(7).sendLabel]).toEqual([true, "Send again"]);
    expect(rescreenInstrumentView(member("a"), due("a", "phq-9"), now).sendLabel).toBe("Send");
    const row = groupRescreenRows([due("b", "phq-9"), due("b", "gad-7")], [member("b", { tasks: [{ id: "t", kind: "rescreen", label: "x", screenerKey: "phq-9", createdAt: iso(1) }] })], now)[0];
    expect(sendableKeys(row)).toEqual(["gad-7"]);
  });
});

describe("R53 part 2 placement", () => {
  it("clinician Today goes from 4 to 5 tiles, never over 6; other roles unchanged", () => {
    for (const role of ["therapist", "pmhnp", "physician"] as StaffRole[]) {
      expect(workspaceTileOrder(role)).toHaveLength(4);
      expect(workspaceTodayTiles(role)).toEqual(["schedule", "actions", "rescreens", "caseload", "requests"]);
    }
    for (const role of [...new Set(STAFF_ROSTER.map((s) => s.role))] as StaffRole[]) expect(workspaceTodayTiles(role).length).toBeLessThanOrEqual(6);
    for (const role of ["ecm_provider", "peer_specialist", "clinical_coordinator", "sys_admin"] as StaffRole[]) {
      expect(rescreenTileRole(role)).toBe(false);
      expect(workspaceTodayTiles(role)).toEqual(workspaceTileOrder(role));
    }
  });
  it("clinician screener rows leave Needs my action but stay on caseload badges", () => {
    const actor = STAFF_ROSTER.filter((s) => rescreenTileRole(s.role)).map((s) => ({ staffId: s.id, staffName: s.name, clinicianId: s.clinicianId, role: s.role })).find((a) => myCaseload(a).length > 0)!;
    expect(actor).toBeTruthy();
    vi.spyOn(AdelanteEHR, "rescreensDue").mockReturnValue([{ key: "phq-9", lastDays: 35, nextDue: 30 }]);
    const rows = workspaceActionRows({ actor, needsClosing: [] });
    expect(rows.some((r) => r.kind === "screener")).toBe(false);
    const badges = attentionCaseload(actor, rows).flatMap((c) => c.reasons).filter((r) => r.kind === "screener");
    expect(badges.length).toBeGreaterThan(0);
  });
});
