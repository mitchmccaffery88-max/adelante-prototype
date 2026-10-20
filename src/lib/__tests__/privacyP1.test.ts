import { describe, expect, it, afterEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { STAFF_ROSTER, canAccess, type StaffRole } from "@/lib/roles";
import { chartEntryFor, onCareTeam, openRestrictedChart, _resetChartAccessForTests } from "@/lib/chartAccess";
import { viewerSeesSelfTracking } from "@/lib/careTeamTrackingGate";
import { checkInSummary } from "@/lib/caseloadReview";
import { canSeeNavEntry, staffNavForRole } from "@/lib/navSections";
import { hasSudReportingAccess } from "@/lib/sudReportingAccess";
import { asamAccessMode, aggregatePatients } from "@/lib/asamReporting";
import { buildNoteDraft } from "@/lib/adelDrafts";

const BILLING: StaffRole[] = ["billing", "billing_coordinator"];
const navPaths = (r: StaffRole) => staffNavForRole(r).map((e) => (e as { path?: string; to?: string }).path ?? (e as { to?: string }).to);

afterEach(() => {
  for (const p of AdelanteEHR.listPatients()) delete p.sudCoordinationConsent;
  _resetChartAccessForTests();
});

describe("Privacy P1 rule 3 — billing roles see claims, nothing clinical", () => {
  it.each(BILLING)("%s has no population-health, dashboards or SUD reporting access", (r) => {
    expect(canAccess(r, "population_health").level).toBe("none");
    expect(hasSudReportingAccess(r)).toBe(false);
    expect(navPaths(r)).not.toContain("/dashboards");
    expect(navPaths(r)).not.toContain("/dmc-ods-readiness");
  });
  it.each(BILLING)("%s keeps the claims workflow (billing write, claims + billing pages)", (r) => {
    expect(canAccess(r, "billing").level).toBe("write");
    expect(navPaths(r)).toContain("/admin-claims");
    expect(navPaths(r)).toContain("/billing");
    expect(staffNavForRole(r).every((e) => canSeeNavEntry(r, e))).toBe(true);
  });
  it("a clinical reader still sees population health", () => {
    expect(canAccess("therapist", "population_health").level).toBe("read");
  });
});

function caseManagerPair() {
  for (const m of STAFF_ROSTER.filter((s) => s.caseManagerId))
    for (const p of AdelanteEHR.listPatients())
      if (p.caseManagerId === m.caseManagerId && chartEntryFor(m.role, m.id, p.id).ok) return { m, p };
  return undefined;
}

describe("Privacy P1 rule 2 — self-tracking only for the care team", () => {
  it("the patient's case manager sees self-tracking participation", () => {
    const pair = caseManagerPair()!;
    expect(pair).toBeTruthy();
    expect(onCareTeam(pair.m.id, pair.p)).toBe(true);
    expect(viewerSeesSelfTracking(pair.m.role, pair.m.id, pair.p)).toBe(true);
    expect(checkInSummary(pair.p, pair.m.role, new Date(), pair.m.id).moodDaysThisWeek).not.toBeNull();
  });
  it("a chart-entry role off the care team does not", () => {
    const pair = caseManagerPair()!;
    const other = STAFF_ROSTER.find((s) => chartEntryFor(s.role, s.id, pair.p.id).ok && !onCareTeam(s.id, pair.p))!;
    expect(other).toBeTruthy();
    expect(viewerSeesSelfTracking(other.role, other.id, pair.p)).toBe(false);
    expect(checkInSummary(pair.p, other.role, new Date(), other.id).moodDaysThisWeek).toBeNull();
  });
  it.each(BILLING)("%s never sees self-tracking", (r) => {
    const m = STAFF_ROSTER.find((s) => s.role === r)!;
    for (const p of AdelanteEHR.listPatients()) expect(viewerSeesSelfTracking(r, m.id, p)).toBe(false);
  });
});

describe("Privacy P1 rule 4 + addendum D — SUD aggregates", () => {
  it("coordinator gets no SUD totals without consent on file", () => {
    expect(asamAccessMode("clinical_coordinator")).toBeNull();
    expect(aggregatePatients("clinical_coordinator")).toEqual([]);
  });
  it("coordinator counts only consented patients, and only at 11 or more", () => {
    const ps = AdelanteEHR.listPatients();
    const eligible = ps.filter((p) => p.consents.part2Sud);
    eligible.slice(0, 10).forEach((p) => (p.sudCoordinationConsent = "tpo"));
    expect(asamAccessMode("clinical_coordinator")).toBeNull();
    if (eligible.length >= 11) {
      eligible[10].sudCoordinationConsent = "specific_written";
      expect(asamAccessMode("clinical_coordinator")).toBe("totals");
      expect(aggregatePatients("clinical_coordinator").map((p) => p.id).sort()).toEqual(eligible.slice(0, 11).map((p) => p.id).sort());
    }
  });
  it("a Part 2 reader keeps full access; billing has none", () => {
    expect(asamAccessMode("therapist")).toBe("full");
    expect(asamAccessMode("billing")).toBeNull();
    expect(asamAccessMode("billing_coordinator")).toBeNull();
  });
});

describe("Privacy P1 rule 5 + addendum C — generated note draft filters notes", () => {
  function withNote(cat: "sud" | undefined, tier?: "psychotherapy_notes", marker = "PRIVATE-P1-PLAN") {
    const p = AdelanteEHR.listPatients().find((x) => !x.consents.part2Sud) ?? AdelanteEHR.listPatients()[0];
    const n = AdelanteEHR.addProgressNote(p.id, {
      clinicianId: "c-p1", date: new Date().toISOString(), sessionType: "individual",
      subjective: "", objective: "", assessment: "", plan: marker, authorSource: "human",
      status: "draft", category: cat, restrictedTier: tier,
    } as never)!;
    n.signedAt = new Date(Date.now() + 60_000).toISOString();
    return p;
  }
  const planText = (p: ReturnType<typeof withNote>, r: StaffRole) => JSON.stringify(buildNoteDraft(p, r));
  it("an SUD note plan never reaches a role without Part 2 access", () => {
    const p = withNote("sud");
    expect(planText(p, "peer_specialist")).not.toContain("PRIVATE-P1-PLAN");
    expect(planText(p, "therapist")).toContain("PRIVATE-P1-PLAN");
  });
  it("a counseling (psychotherapy-tier) note never reaches the coordinator, even with TPO consent", () => {
    const p = withNote(undefined, "psychotherapy_notes", "PRIVATE-P1-COUNSELING");
    p.sudCoordinationConsent = "tpo";
    expect(planText(p, "clinical_coordinator")).not.toContain("PRIVATE-P1-COUNSELING");
  });
  it("a standard SUD note reaches the coordinator only with consent on file", () => {
    const p = withNote("sud");
    expect(planText(p, "clinical_coordinator")).not.toContain("PRIVATE-P1-PLAN");
    p.sudCoordinationConsent = "tpo";
    expect(planText(p, "clinical_coordinator")).toContain("PRIVATE-P1-PLAN");
  });
});

describe("Addendum A3 — existing restricted-chart path needs a reason and audits", () => {
  it("rejects a blank reason and audits a real one", () => {
    const m = STAFF_ROSTER.find((s) => s.role === "clinical_coordinator")!;
    const p = AdelanteEHR.listPatients().find((x) => chartEntryFor(m.role, m.id, x.id).ok)!;
    const actor = { staffId: m.id, name: m.name, role: m.role };
    expect(() => openRestrictedChart({ patientId: p.id, reason: " ", actor })).toThrow();
    openRestrictedChart({ patientId: p.id, reason: "Medical emergency", actor });
    const ev = AdelanteEHR.listAuditEvents({});
    expect(JSON.stringify(ev)).toContain("record.restricted_opened");
  });
});
