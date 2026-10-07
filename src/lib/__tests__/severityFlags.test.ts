import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { SEVERITY_RULES, evaluateSeverity } from "@/lib/severityRules";
import { listSeverityFlags, openSeverityFlags, severityAssignee } from "@/lib/severityFlags";
import { workspaceActionRows } from "@/lib/clinicianWorkspace";
import { headerAlerts } from "@/lib/chartBrief";
import { _resetAdelBriefCache, briefBulletsFlat, getAdelBrief } from "@/lib/adelBrief";
import { checkBriefFor } from "@/lib/adelBriefCheck";
import { runAction } from "@/lib/actions/runAction";
import type { Patient, ScreenerResult } from "@/lib/ehr";
import { STAFF_ROSTER } from "@/lib/roles";

const r = (key: string, score: number, day: number, extra: Partial<ScreenerResult> = {}): ScreenerResult =>
  ({ key, score, severity: "x", completedAt: `2026-0${day < 10 ? "9" : "9"}-${String(day).padStart(2, "0")}T10:00:00.000Z`, ...extra }) as ScreenerResult;

describe("C3 — severity rules per instrument (Draft config)", () => {
  it("PHQ-9 / GAD-7 rise ≥5 flags; rise of 4 doesn't", () => {
    expect(evaluateSeverity(r("phq-9", 6, 1), r("phq-9", 11, 2))?.reasons).toEqual(["rise"]);
    expect(evaluateSeverity(r("phq-9", 6, 1), r("phq-9", 10, 2))).toBeUndefined();
    expect(evaluateSeverity(r("gad-7", 3, 1), r("gad-7", 8, 2))?.reasons).toEqual(["rise"]);
  });
  it("crossing into moderately-severe / severe flags even under 5 points", () => {
    expect(evaluateSeverity(r("phq-9", 13, 1), r("phq-9", 15, 2))?.reasons).toEqual(["band"]);
    expect(evaluateSeverity(r("gad-7", 13, 1), r("gad-7", 16, 2))?.reasons).toEqual(["band"]);
    expect(evaluateSeverity(r("phq-9", 16, 1), r("phq-9", 17, 2))).toBeUndefined();
  });
  it("PHQ-9 item 9 above 0 flags", () => {
    const f = evaluateSeverity(r("phq-9", 4, 1), r("phq-9", 5, 2, { responses: [0, 0, 0, 0, 0, 0, 0, 0, 1] }));
    expect(f?.reasons).toEqual(["item9"]);
    expect(f?.text).not.toMatch(/answer.*1\b/);
  });
  it("C-SSRS moving to moderate or high flags; staying high or moving to low doesn't", () => {
    expect(evaluateSeverity(r(SEVERITY_RULES.cssrsKey, 0, 1, { cssrsRisk: "low" }), r(SEVERITY_RULES.cssrsKey, 2, 2, { cssrsRisk: "moderate" }))?.reasons).toEqual(["cssrs"]);
    expect(evaluateSeverity(undefined, r(SEVERITY_RULES.cssrsKey, 3, 2, { cssrsRisk: "high" }))?.reasons).toEqual(["cssrs"]);
    expect(evaluateSeverity(r(SEVERITY_RULES.cssrsKey, 3, 1, { cssrsRisk: "high" }), r(SEVERITY_RULES.cssrsKey, 3, 2, { cssrsRisk: "high" }))).toBeUndefined();
    expect(evaluateSeverity(r(SEVERITY_RULES.cssrsKey, 0, 1, { cssrsRisk: "none" }), r(SEVERITY_RULES.cssrsKey, 1, 2, { cssrsRisk: "low" }))).toBeUndefined();
  });
  it("improving gets a note, not a flag", () => {
    expect(evaluateSeverity(r("phq-9", 14, 1), r("phq-9", 8, 2))).toMatchObject({ kind: "improving", reasons: [] });
  });
});

describe("C3 — flags in the store, Needs my action, header and Brief", () => {
  const CLIN = ["therapist", "pmhnp", "physician"];
  const staffFor = (a?: string) => STAFF_ROSTER.find((x) => (x.clinicianId === a || x.id === a) && CLIN.includes(x.role));
  const used = new Set<string>();
  const pick = () => {
    const p = AdelanteEHR.listPatients().find((x) => !used.has(x.id) && staffFor(severityAssignee(x)) && !(x.severityFlags ?? []).some((f) => f.key === "phq-9" || f.key === "gad-7"))!;
    used.add(p.id);
    return p;
  };
  const ownerOf = (p: Patient) => {
    const s = staffFor(severityAssignee(p))!;
    return { staffId: s.id, staffName: s.name, clinicianId: s.clinicianId, role: s.role as "therapist" };
  };
  const now = () => new Date().toISOString();

  it("one flag per result, routed to the assigned clinician only, neutral, shown in header + Brief (checker agrees)", () => {
    const p = pick();
    const t0 = new Date(Date.now() - 2 * 86400000).toISOString();
    AdelanteEHR.recordScreener(p.id, { key: "phq-9", score: 6, severity: "mild", completedAt: t0 } as ScreenerResult);
    const res = { key: "phq-9", score: 13, severity: "moderate", completedAt: now() } as ScreenerResult;
    AdelanteEHR.recordScreener(p.id, res);
    // Re-recording the same result never adds a second flag.
    AdelanteEHR.recordScreener(p.id, { ...res });
    const flags = (AdelanteEHR.getPatient(p.id)!.severityFlags ?? []).filter((f) => f.kind === "flag");
    expect(flags.length).toBe(1);
    expect(flags[0].text).toBe("PHQ-9 rose 7 points (6 → 13).");

    const reyes = ownerOf(p);
    const rows = workspaceActionRows({ actor: reyes, needsClosing: [] }).filter((x) => x.kind === "severity" && x.patientId === p.id);
    expect(rows.length).toBe(1);
    expect(rows[0].label).toMatch(/^Severity change — /);
    expect(rows[0].label).not.toMatch(/substance|opioid|alcohol|asam|sud\b/i);
    const o = STAFF_ROSTER.find((x) => CLIN.includes(x.role) && x.id !== reyes.staffId)!;
    const other = { staffId: o.id, staffName: o.name, clinicianId: o.clinicianId, role: o.role as "therapist" };
    expect(workspaceActionRows({ actor: other, needsClosing: [] }).some((x) => x.kind === "severity" && x.patientId === p.id)).toBe(false);

    expect(headerAlerts(AdelanteEHR.getPatient(p.id)!, reyes.role, ["tracking"]).some((a) => a.label.startsWith("Severity change"))).toBe(true);
    _resetAdelBriefCache();
    const bullets = briefBulletsFlat(getAdelBrief(AdelanteEHR.getPatient(p.id)!, reyes.role));
    const sev = bullets.find((b) => b.id.startsWith("sev-"))!;
    expect(sev.text).toBe("Severity change: PHQ-9 rose 7 points (6 → 13).");
    expect(sev.sources).toEqual([{ kind: "severity_flag", id: flags[0].id }]);
    expect(checkBriefFor(AdelanteEHR.getPatient(p.id)!, reyes.role)).toEqual([]);
    // Roles without MH screener access never see it.
    expect(listSeverityFlags(AdelanteEHR.getPatient(p.id)!, "billing")).toEqual([]);

    // Review clears the row (registry + runAction).
    const done = runAction("severity_flag_review", { role: reyes.role, staffId: reyes.staffId }, p, { args: [p.id, flags[0].id, { name: reyes.staffName, role: reyes.role, staffId: reyes.staffId }] });
    expect(done.ok).toBe(true);
    expect(openSeverityFlags(AdelanteEHR.getPatient(p.id)!, reyes.role)).toEqual([]);
  });

  it("improving score: positive note, no Needs my action row", () => {
    const p = pick();
    AdelanteEHR.recordScreener(p.id, { key: "gad-7", score: 14, severity: "moderate", completedAt: new Date(Date.now() - 86400000).toISOString() } as ScreenerResult);
    AdelanteEHR.recordScreener(p.id, { key: "gad-7", score: 7, severity: "mild", completedAt: now() } as ScreenerResult);
    const f = AdelanteEHR.getPatient(p.id)!.severityFlags!.find((x) => x.key === "gad-7")!;
    expect(f.kind).toBe("improving");
    const rows = workspaceActionRows({ actor: ownerOf(p), needsClosing: [] });
    expect(rows.some((x) => x.id === `severity:${f.id}`)).toBe(false);
  });

  it("PHQ-9 item 9 still routes through the existing crisis path (C-SSRS request)", () => {
    const p = AdelanteEHR.listPatients().filter((x) => !(x.severityFlags ?? []).length)[2]!;
    const before = AdelanteEHR.listAuditEvents({ patientId: p.id }).length;
    AdelanteEHR.recordScreener(p.id, { key: "phq-9", score: 5, severity: "mild", completedAt: now(), responses: [0, 0, 0, 1, 1, 1, 1, 0, 1] } as ScreenerResult);
    const ev = AdelanteEHR.listAuditEvents({ patientId: p.id }).slice(0, AdelanteEHR.listAuditEvents({ patientId: p.id }).length - before);
    expect(AdelanteEHR.getPatient(p.id)!.severityFlags!.some((f) => f.reasons.includes("item9"))).toBe(true);
    expect(ev.some((e) => /cssrs/i.test(e.action))).toBe(true);
  });
});
