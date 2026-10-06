import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { seedChartOrdersDemo } from "@/lib/chartOrders";
import { seedStructuredCarePlanDemo } from "@/lib/structuredCarePlan";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import type { StaffRole } from "@/lib/roles";
import {
  BRIEF_ACTION_CAP, BRIEF_SECTION_CAP, BRIEF_SECTIONS, SECTION_DEPS, SOURCE_TO_SECTIONS, _briefCacheKeys,
  _resetAdelBriefCache, adelSummary, briefBulletsFlat, briefStats, getAdelBrief, getBriefActions, isBulletNew, visibilityClass,
} from "@/lib/adelBrief";
import { FEATURE_FLAGS, VENDOR_FLAGS } from "@/lib/features";

const SUD = /substance|opioid|alcohol|asam|sud\b|drug screen|buprenorph|suboxone|methadone|naltrex|vivitrol|audit|dast|MAT\b|part 2/i;
const luis = () => AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
const computes = () => ({ ...briefStats.sectionComputes });

beforeAll(() => {
  seedStructuredCarePlanDemo();
  seedChartOrdersDemo();
});
beforeEach(() => _resetAdelBriefCache());

describe("Adel Brief — four fixed sections", () => {
  it("has exactly the four fixed sections, each capped at 3 bullets with a source chip + date", () => {
    expect(BRIEF_SECTIONS.map((s) => s.id)).toEqual(["adherence", "engagement", "visit_focus", "care_gaps"]);
    for (const p of AdelanteEHR.listPatients().slice(0, 15))
      for (const role of ["physician", "therapist", "ecm_provider", "sud_counselor"] as StaffRole[]) {
        const e = getAdelBrief(p, role);
        for (const { id } of BRIEF_SECTIONS) {
          const bs = e.sections[id]!.bullets;
          expect(bs.length).toBeLessThanOrEqual(BRIEF_SECTION_CAP);
          for (const b of bs) {
            expect(b.sectionId).toBeTruthy();
            expect(Number.isNaN(+new Date(b.at))).toBe(false);
          }
        }
        expect(getBriefActions(p, role, "s-x").length).toBeLessThanOrEqual(BRIEF_ACTION_CAP);
      }
  });
  it("billing gets no suggested actions (registry-gated)", () => {
    expect(getBriefActions(luis(), "billing", "s-bill1")).toEqual([]);
  });
  it("the dependency map covers every section and maps MAR/orders → Adherence, appointments → Engagement", () => {
    expect(SOURCE_TO_SECTIONS.dose_reports).toEqual(["adherence"]);
    expect(SOURCE_TO_SECTIONS.appointments).toContain("engagement");
    for (const s of BRIEF_SECTIONS) expect(SECTION_DEPS[s.id].length).toBeGreaterThan(0);
  });
});

describe("cache + incremental invalidation", () => {
  it("a cache hit does no full-record recompute (no section compute, no fingerprint pass)", () => {
    const p = luis();
    getAdelBrief(p, "physician");
    const before = computes();
    const passes = briefStats.fingerprintPasses;
    const full = briefStats.fullComputes;
    for (let i = 0; i < 5; i++) getAdelBrief(p, "physician");
    expect(computes()).toEqual(before);
    expect(briefStats.fingerprintPasses).toBe(passes);
    expect(briefStats.fullComputes).toBe(full);
    expect(briefStats.hits).toBeGreaterThanOrEqual(5);
  });
  it("an unrelated store change recomputes nothing", () => {
    const p = luis();
    getAdelBrief(p, "physician");
    const before = computes();
    AdelanteEHR._emit();
    getAdelBrief(p, "physician");
    expect(computes()).toEqual(before);
  });
  it("adding a PHQ-9 recomputes only screener-dependent sections (not Engagement)", () => {
    const p = luis();
    getAdelBrief(p, "therapist");
    const before = computes();
    AdelanteEHR.recordScreener(p.id, { key: "phq-9", score: 6, severity: "mild", completedAt: new Date().toISOString() } as never);
    const e = getAdelBrief(AdelanteEHR.getPatient(p.id)!, "therapist");
    const after = computes();
    expect(after.engagement).toBe(before.engagement);
    for (const id of SOURCE_TO_SECTIONS.screeners) expect(after[id]).toBe(before[id] + 1);
    expect(briefBulletsFlat(e).some((b) => /PHQ-9/.test(b.text))).toBe(true);
  });
  it("a new appointment recomputes Engagement (and Visit focus via hie/plan? no) only its dependents", () => {
    const p = luis();
    getAdelBrief(p, "physician");
    const before = computes();
    const appt = AdelanteEHR.listAppointments().find((a) => a.patientId === p.id);
    if (!appt) return;
    (appt as { status: string }).status = appt.status === "attended" ? "no_show" : "attended";
    AdelanteEHR._emit();
    getAdelBrief(p, "physician");
    const after = computes();
    expect(after.engagement).toBe(before.engagement + 1);
    expect(after.adherence).toBe(before.adherence);
    expect(after.care_gaps).toBe(before.care_gaps);
  });
  it("'new' marker = data newer than viewer's last view", () => {
    const b = { id: "x", text: "t", at: "2026-10-06T10:00:00.000Z", sectionId: "tracking" };
    expect(isBulletNew(b, "2026-10-05T00:00:00.000Z")).toBe(true);
    expect(isBulletNew(b, "2026-10-07T00:00:00.000Z")).toBe(false);
    expect(isBulletNew(b, undefined)).toBe(false);
  });
});

describe("Part 2 — never shared across roles", () => {
  it("ECM viewer after a physician viewed the same SUD patient: separate cache entry, no SUD detail", () => {
    const p = luis();
    expect(roleSeesAsamSection("physician", p)).toBe(true);
    const doc = getAdelBrief(p, "physician");
    const ecm = getAdelBrief(p, "ecm_provider");
    expect(visibilityClass(p, "physician")).not.toBe(visibilityClass(p, "ecm_provider"));
    expect(ecm).not.toBe(doc);
    expect(_briefCacheKeys().length).toBe(2);
    const text = briefBulletsFlat(ecm).map((b) => b.text).join(" | ");
    expect(text).not.toMatch(SUD);
    expect(JSON.stringify(adelSummary(ecm, { staffId: "s-cm1", role: "ecm_provider" }))).not.toMatch(SUD);
  });
  it("no role failing the Part 2 check sees SUD detail in any bullet", () => {
    const p = luis();
    for (const role of ["ecm_provider", "cf_care_manager", "billing", "peer_specialist", "community_health_worker", "clinical_coordinator"] as StaffRole[]) {
      if (roleSeesAsamSection(role, p)) continue;
      expect(briefBulletsFlat(getAdelBrief(p, role)).map((b) => b.text).join(" | "), role).not.toMatch(SUD);
    }
  });
  it("ECM therapy-note restriction: no note-body text in any bullet or summary", () => {
    const SECRET = "ZEBRA-BRIEF-BODY-4411";
    const patient = AdelanteEHR.listPatients().find((x) => !AdelanteEHR.getConsentState(x.id).part2Sud)!;
    AdelanteEHR.addProgressNote(patient.id, { clinicianId: "c1", date: new Date().toISOString(), sessionType: "individual", subjective: SECRET, objective: SECRET, assessment: SECRET, plan: SECRET, status: "draft" } as never);
    for (const role of ["ecm_provider", "cf_care_manager", "physician"] as StaffRole[]) {
      const e = getAdelBrief(AdelanteEHR.getPatient(patient.id)!, role);
      expect(JSON.stringify(e.sections)).not.toContain(SECRET);
      expect(JSON.stringify(adelSummary(e, { staffId: "s", role }))).not.toContain(SECRET);
    }
  });
});

describe("Simulated narrative", () => {
  it("each sentence is built only from bullets and links to them; audits simulated:true", () => {
    const p = luis();
    const e = getAdelBrief(p, "physician");
    const ids = new Set(Object.entries(e.sections).flatMap(([sec, r]) => r!.bullets.map((b) => `${sec}:${b.id}`)));
    const out = adelSummary(e, { staffId: "s-np1", role: "physician" });
    expect(out.length).toBeLessThanOrEqual(3);
    for (const s of out) {
      expect(s.sourceIds.length).toBeGreaterThan(0);
      for (const id of s.sourceIds) expect(ids.has(id)).toBe(true);
    }
    const ev = AdelanteEHR.listAuditEvents({ patientId: p.id }).find((x) => x.action === "adel_summary_generated");
    expect((ev as { detail?: Record<string, unknown> } | undefined)?.detail?.["simulated"]).toBe(true);
    expect(VENDOR_FLAGS.llm).toBe("llm_simulated");
    expect(FEATURE_FLAGS.find((f) => f.id === "llm_simulated")?.simulated).toBe(true);
  });
});
