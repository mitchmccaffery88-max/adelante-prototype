import { describe, expect, it } from "vitest";
import { AdelanteEHR, endSeveritySeedQuiet, type Patient, type ScreenerResult } from "@/lib/ehr";

// Module-load demo seeds are done by the time tests run; severity flags
// created inside test bodies must be live, not historical.
endSeveritySeedQuiet();
import { STAFF_ROSTER } from "@/lib/roles";
import { workspaceActionRows } from "@/lib/clinicianWorkspace";
import { SEVERITY_FYI_SUBJECT, SEVERITY_NOTIFY_SUBJECT } from "@/lib/severityRules";

const DAY = 86_400_000;
const at = (daysAgo: number, h = 0) => new Date(Date.now() - daysAgo * DAY - h * 3600_000).toISOString();
const res = (key: string, score: number, completedAt: string) => ({ key, score, severity: "x", completedAt }) as ScreenerResult;
const staff = (id: string) => STAFF_ROSTER.find((s) => s.id === id || s.clinicianId === id)!;
const actor = (id: string) => { const s = staff(id); return { staffId: s.id, staffName: s.name, clinicianId: s.clinicianId, role: s.role }; };
const sevNotes = (staffId: string, pid: string) =>
  AdelanteEHR.listNotificationsFor(staff(staffId).name, staff(staffId).role, staffId).filter((n) => n.patientId === pid && /score change/i.test(n.subject));
const fresh = (): Patient => {
  const p = AdelanteEHR.listPatients().find((x) => !(x.severityFlags ?? []).length && !(x.screenerHistory ?? []).some((h) => h.key === "gad-7" && +new Date(h.completedAt) > Date.now() - 90 * DAY))!;
  (p.severityFlags ??= []);
  return p;
};
const signedNonSud = (p: Patient) => (p.orders ?? []).some((o) => o.status === "signed" && !/bupren|naltrex|methadone|acampros|disulf/i.test(o.drugName));

describe("F0 — seeding", () => {
  it("demo seed creates no open severity tasks or notifications", () => {
    for (const p of AdelanteEHR.listPatients()) expect((p.severityFlags ?? []).filter((f) => f.kind === "flag" && !f.historical && !f.reviewedAt), p.firstName).toEqual([]);
    for (const s of STAFF_ROSTER) expect(AdelanteEHR.listNotificationsFor(s.name, s.role, s.id).some((n) => n.subject === SEVERITY_NOTIFY_SUBJECT || n.subject === SEVERITY_FYI_SUBJECT)).toBe(false);
  });
});

describe("F1 — owner task + notification, prescriber FYI", () => {
  it("owner = primary clinician gets row + neutral notification; prescriber FYI only when psych meds active", () => {
    const p = fresh();
    p.primaryClinicianId = "c1";
    p.prescriberStaffId = "s-np1";
    AdelanteEHR.recordScreener(p.id, res("gad-7", 4, at(3)));
    AdelanteEHR.recordScreener(p.id, res("gad-7", 12, at(0)));
    expect(workspaceActionRows({ actor: actor("s-th1"), needsClosing: [] }).some((r) => r.kind === "severity" && r.patientId === p.id)).toBe(true);
    expect(workspaceActionRows({ actor: actor("s-np1"), needsClosing: [] }).some((r) => r.kind === "severity" && r.patientId === p.id)).toBe(false);
    const own = sevNotes("s-th1", p.id);
    expect(own.map((n) => n.subject)).toEqual([SEVERITY_NOTIFY_SUBJECT]);
    for (const n of own) expect(`${n.subject} ${n.body}`).not.toMatch(/\d|PHQ|GAD|C-SSRS|AUDIT|DAST|substance|alcohol|opioid/i);
    expect(sevNotes("s-np1", p.id).map((n) => n.subject)).toEqual(signedNonSud(p) ? [SEVERITY_FYI_SUBJECT] : []);
    expect(AdelanteEHR.listMemberNotifications("patient", p.id).some((n) => /score change/i.test(n.subject))).toBe(false);
  });
  it("no FYI without an active psych order; FYI with one", () => {
    const p = fresh();
    p.primaryClinicianId = "c1"; p.prescriberStaffId = "s-np1";
    const saved = p.orders; p.orders = [];
    AdelanteEHR.recordScreener(p.id, res("gad-7", 2, at(5)));
    AdelanteEHR.recordScreener(p.id, res("gad-7", 9, at(4)));
    expect(sevNotes("s-np1", p.id)).toEqual([]);
    p.orders = [{ ...(saved?.[0] ?? {}), id: "o-psy", patientId: p.id, drugName: "Sertraline 50 mg", status: "signed" } as never];
    AdelanteEHR.recordScreener(p.id, res("gad-7", 16, at(1)));
    expect(sevNotes("s-np1", p.id).map((n) => n.subject)).toEqual([SEVERITY_FYI_SUBJECT]);
    p.orders = saved;
  });
  it("owner = prescriber: one notification, no duplicate FYI", () => {
    const p = fresh();
    p.primaryClinicianId = undefined; p.prescriberStaffId = "s-np1";
    const saved = p.orders;
    p.orders = [{ id: "o-psy2", patientId: p.id, drugName: "Sertraline 50 mg", status: "signed" } as never];
    AdelanteEHR.recordScreener(p.id, res("gad-7", 3, at(6)));
    AdelanteEHR.recordScreener(p.id, res("gad-7", 10, at(2)));
    expect(sevNotes("s-np1", p.id).map((n) => n.subject)).toEqual([SEVERITY_NOTIFY_SUBJECT]);
    p.orders = saved;
  });
});

describe("F2 — past-dated scores", () => {
  it("in-window back-entry flags in date order; out-of-window only updates history; re-import is idempotent", () => {
    const p = fresh();
    p.primaryClinicianId = "c1";
    AdelanteEHR.recordHistoricalScreener(p.id, res("gad-7", 3, at(80)));
    AdelanteEHR.recordHistoricalScreener(p.id, res("gad-7", 11, at(60))); // old worsening
    AdelanteEHR.recordHistoricalScreener(p.id, res("gad-7", 4, at(45))); // old improving
    const hist = (p.severityFlags ?? []).filter((f) => f.historical);
    expect(hist.map((f) => f.kind).sort()).toEqual(["flag", "improving"]);
    expect(workspaceActionRows({ actor: actor("s-th1"), needsClosing: [] }).some((r) => r.kind === "severity" && r.patientId === p.id)).toBe(false);
    expect(sevNotes("s-th1", p.id)).toEqual([]);
    // Back-entry within 30 days, compared with the result dated before it (score 4).
    AdelanteEHR.recordHistoricalScreener(p.id, res("gad-7", 10, at(10)));
    const live = (p.severityFlags ?? []).filter((f) => !f.historical && f.kind === "flag");
    expect(live.map((f) => f.text)).toEqual(["GAD-7 rose 6 points (4 → 10)."]);
    expect(sevNotes("s-th1", p.id).length).toBe(1);
    const n = (p.severityFlags ?? []).length;
    for (const d of [80, 60, 45]) AdelanteEHR.recordHistoricalScreener(p.id, res("gad-7", d === 60 ? 11 : d === 80 ? 3 : 4, at(d)));
    AdelanteEHR.recordHistoricalScreener(p.id, res("gad-7", 10, at(10)));
    expect((p.severityFlags ?? []).length).toBe(n);
    expect(sevNotes("s-th1", p.id).length).toBe(1);
  });
});
