// §Access batch A1–A3 — Draft — pending exec RBAC review.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AdelanteEHR, isNotificationReadBy } from "@/lib/ehr";
import { STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import {
  CHART_ENTRY_ROLES, chartEntryFor, searchablePatientsFor, setRecordRestricted, openRestrictedChart,
  listRestrictedOpenItems, _resetChartAccessForTests, roleHasChartEntry, CHART_DENIED_MESSAGE,
} from "@/lib/chartAccess";
import { resolveChartRouteAccess } from "@/lib/navGuard";
import { isStaffWorkPage } from "@/lib/searchPlacement";
import { outsideCaseloadReport, unusualVolumeFlags } from "@/lib/complianceMonitoring";
import { recordView } from "@/lib/accessLog";
import { bellFilterMatch, POINTER_TEXT, POINTER_BODY } from "@/lib/notificationRouting";
import { MENTION_NOTIFY_SUBJECT } from "@/lib/staffThreads";

const luis = () => AdelanteEHR.listPatients().find((p) => p.firstName === "Luis")!;
const staffOf = (role: StaffRole) => STAFF_ROSTER.find((s) => s.role === role)!;
const NO_ENTRY: StaffRole[] = ["sys_admin", "billing", "billing_coordinator", "credentialing_coordinator"];

beforeEach(() => _resetChartAccessForTests());

describe("A1 chart entry + route guard", () => {
  it("clinical delivery/coordination roles enter at their site", () => {
    for (const role of CHART_ENTRY_ROLES) {
      const s = staffOf(role);
      if (!s) continue;
      expect(chartEntryFor(role, s.id, luis().id).ok, role).toBe(true);
      expect(resolveChartRouteAccess(role, s.id, `/record/${luis().id}`)?.status, role).toBe("allowed");
    }
  });
  it("billing, credentialing and sys_admin are redirected with a plain message", () => {
    for (const role of NO_ENTRY) {
      const e = chartEntryFor(role, staffOf(role)?.id, luis().id);
      expect(e.ok).toBe(false);
      if (!e.ok) expect(e.message).toBe(CHART_DENIED_MESSAGE);
      expect(resolveChartRouteAccess(role, staffOf(role)?.id, `/record/${luis().id}`)?.status, role).toBe("denied");
    }
  });
  it("site rule: a patient enrolled at a site the person doesn't work is denied", () => {
    const p = luis();
    const prev = p.enrolledSiteId;
    p.enrolledSiteId = "site-nowhere";
    try {
      const e = chartEntryFor("peer_specialist", staffOf("peer_specialist").id, p.id);
      expect(e.ok).toBe(false);
      if (!e.ok) expect(e.reason).toBe("site");
    } finally { p.enrolledSiteId = prev; }
  });
});

describe("A2 search", () => {
  it("hidden for non-entry roles, empty results", () => {
    for (const role of NO_ENTRY) { expect(roleHasChartEntry(role)).toBe(false); expect(searchablePatientsFor(role, staffOf(role)?.id)).toEqual([]); }
  });
  it("hidden on admin, setup, content and reporting pages", () => {
    for (const path of ["/admin", "/admin-content", "/admin-staff", "/admin-audit", "/quality-compliance"]) expect(isStaffWorkPage(path), path).toBe(false);
    expect(isStaffWorkPage("/clinician")).toBe(true);
  });
  it("results limited to enterable patients", () => {
    const s = staffOf("peer_specialist");
    for (const p of searchablePatientsFor("peer_specialist", s.id)) expect(chartEntryFor("peer_specialist", s.id, p.id).ok).toBe(true);
  });
});

describe("A1 restricted record", () => {
  const admin = { staffId: staffOf("sys_admin").id, name: staffOf("sys_admin").name, role: "sys_admin" as StaffRole };
  const coord = { staffId: staffOf("clinical_coordinator").id, name: staffOf("clinical_coordinator").name, role: "clinical_coordinator" as StaffRole };
  it("needs a reason, logs and creates a compliance item; hidden from search off the care team", () => {
    expect(() => setRecordRestricted({ patientId: luis().id, restricted: true, reason: " ", actor: admin })).toThrow();
    setRecordRestricted({ patientId: luis().id, restricted: true, reason: "Staff member is also a client", actor: admin });
    expect(() => openRestrictedChart({ patientId: luis().id, reason: "", actor: coord })).toThrow();
    const item = openRestrictedChart({ patientId: luis().id, reason: "Covering an urgent call", actor: coord });
    expect(listRestrictedOpenItems().map((i) => i.id)).toContain(item.id);
    expect(AdelanteEHR.listAuditEvents().some((a) => a.action === "record.restricted_opened" && a.patientId === luis().id)).toBe(true);
    const e = chartEntryFor("clinical_coordinator", coord.staffId, luis().id);
    if (e.ok && !e.careTeam) expect(searchablePatientsFor("clinical_coordinator", coord.staffId).some((p) => p.id === luis().id)).toBe(false);
  });
});

describe("A1 compliance reports", () => {
  it("outside-caseload counts and unusual volume (Draft 30/day)", () => {
    const at = new Date();
    const actor = { actorId: "s-probe-1", actorName: "Probe User", role: "peer_specialist" };
    const pts = AdelanteEHR.listPatients();
    for (const p of pts) recordView({ ...actor, patientId: p.id, sectionId: "overview", kind: "open", at });
    const row = outsideCaseloadReport(at).find((r) => r.actorId === "s-probe-1");
    expect(row?.charts).toBe(pts.length);
    expect(unusualVolumeFlags(at, pts.length - 1).some((f) => f.actorId === "s-probe-1")).toBe(true);
    expect(unusualVolumeFlags(at, 30).some((f) => f.actorId === "s-probe-1")).toBe(pts.length > 30);
  });
});

describe("A3 notifications", () => {
  it("role broadcast read state is per person", () => {
    const n = AdelanteEHR.notify({ recipientRole: "nurse_rn", category: "task_assigned", subject: "Shift update", body: "Open the nurse desk.", linkRoute: "/nurse" });
    AdelanteEHR.markNotificationRead(n!.id, "RN One", "s-rn-a");
    const row = AdelanteEHR.listNotifications().find((x) => x.id === n!.id)!;
    expect(isNotificationReadBy(row, "RN One", "s-rn-a")).toBe(true);
    expect(isNotificationReadBy(row, "RN Two", "s-rn-b")).toBe(false);
  });
  it("completing a task closes its bell pointer", () => {
    const p = luis();
    const s = staffOf("therapist");
    const t = AdelanteEHR.createCaseTask({ patientId: p.id, title: "Call back", assignedTo: s.name, dueDate: "2026-01-01" });
    const ptr = () => AdelanteEHR.listNotifications().filter((n) => n.taskKey === `task:${t!.id}`);
    expect(ptr().length).toBeLessThanOrEqual(1);
    AdelanteEHR.completeCaseTask(t!.id);
    expect(ptr().length).toBe(1);
    for (const n of ptr()) expect(n.closedAt).toBeTruthy();
  });
  it("filters split tasks / updates / mentions", () => {
    expect(bellFilterMatch("task", "tasks")).toBe(true);
    expect(bellFilterMatch("mention", "tasks")).toBe(false);
    expect(bellFilterMatch(undefined, "updates")).toBe(true);
    expect(bellFilterMatch("mention", "mentions")).toBe(true);
  });
  it("trims seeded role broadcasts to at most 5 per role", () => {
    AdelanteEHR.trimRoleBroadcasts(5);
    const per: Record<string, number> = {};
    for (const n of AdelanteEHR.listNotifications()) if (n.recipientRole && !n.taskKey) per[n.recipientRole] = (per[n.recipientRole] ?? 0) + 1;
    for (const v of Object.values(per)) expect(v).toBeLessThanOrEqual(5);
  });
});

// --- Part 2 / text lint over every notification template -------------------
const BANNED = /\bpart 2\b|\bsud\b|substance|opioid|buprenorphine|suboxone|methadone|naltrexone|vivitrol|naloxone|schedule ii|phq-?9|gad-?7|c-ssrs|audit-c|dast|\bscore\b/i;
function* files(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "__tests__") yield* files(p); }
    else if (/\.tsx?$/.test(f)) yield p;
  }
}
describe("A3 notification text lint", () => {
  it("pointer and mention templates are neutral", () => {
    for (const t of Object.values(POINTER_TEXT)) expect(t!.subject).not.toMatch(BANNED);
    expect(POINTER_BODY).not.toMatch(BANNED);
    expect(MENTION_NOTIFY_SUBJECT).not.toMatch(BANNED);
  });
  it("no notify() subject/body literal in src/lib names SUD terms, drugs, instruments, scores or Part 2", () => {
    const hits: string[] = [];
    for (const f of files(join(process.cwd(), "src/lib"))) {
      const src = readFileSync(f, "utf8");
      const re = /notify\(\{[\s\S]{0,600}?\}\)/g;
      for (const m of src.match(re) ?? []) {
        for (const lit of m.matchAll(/(subject|body):\s*(["`])([^"`]*)\2/g)) if (BANNED.test(lit[3]!)) hits.push(`${f.split("src/")[1]}: ${lit[3]}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
