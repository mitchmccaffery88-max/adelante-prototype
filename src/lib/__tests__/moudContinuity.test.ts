// §Phase 3 Part B — MOUD continuity record, writers, release-cycle linkage and display table.
import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, type MedOrder } from "@/lib/ehr";
import {
  _resetMoudContinuityForTests, canViewMoudContinuity, confirmMoudContinuity, getMoudContinuity,
  moudContinuityView, moudWriterCheck, recordMoudPlan, releaseCycleFor, supplyView,
  type MoudContinuityRecord, type ReleaseCycle,
} from "@/lib/moudContinuity";
import { runAction } from "@/lib/actions/runAction";

const luisId = () => demoScenarioPatientId("sud_consented")!;
const jordanId = () => demoScenarioPatientId("sud_no_consent")!;
const cf = { role: "cf_care_manager" as const, staffId: "s-cf2" };
const rx = { role: "physician" as const, staffId: "s-np1" };
const other = { role: "billing" as const, staffId: "s-bill1" };

function openEpisode(patientId: string) {
  return AdelanteEHR.openPreReleaseEpisode({
    patientId, anticipatedReleaseDate: "2026-11-01", cfCareManagerStaffId: "s-cf2", cfCareManagerName: "Darnell Pope",
    openedBy: "s-cf2", actorRole: "cf_care_manager",
  });
}

beforeEach(() => _resetMoudContinuityForTests());

describe("MOUD continuity store + permissions", () => {
  it("assigned reentry guide and prescriber may write; other staff are refused", () => {
    const pid = luisId();
    openEpisode(pid);
    expect(moudWriterCheck(cf, pid).ok).toBe(true);
    expect(moudWriterCheck(rx, pid).ok).toBe(true);
    expect(moudWriterCheck(other, pid).ok).toBe(false);
    expect(() => recordMoudPlan({ patientId: pid, type: "bridge_prescription", actor: other })).toThrow();
    const r = recordMoudPlan({ patientId: pid, type: "bridge_prescription", at: "2026-10-20", actor: cf });
    expect(r.planInPlace).toEqual({ type: "bridge_prescription", at: "2026-10-20", byStaffId: "s-cf2" });
    const ev = AdelanteEHR.listAuditEvents({ patientId: pid }).find((e) => e.action === "continuity_plan_recorded")!;
    expect(ev.actorId).toBe("s-cf2");
    expect(ev.detail?.before).toEqual({ planInPlace: null, confirmed: null });
    expect((ev.detail?.after as { planInPlace: unknown }).planInPlace).toBeTruthy();
    expect(JSON.stringify(ev)).not.toMatch(/buprenorphine|suboxone|methadone/i);
  });

  it("runs through the registry with one standard event; refusal is blocked", () => {
    const pid = luisId();
    openEpisode(pid);
    const p = AdelanteEHR.getPatient(pid);
    const okRun = runAction("moud_plan_record", rx, p, { args: [{ patientId: pid, type: "moud_appointment", actor: rx }] });
    expect(okRun.ok).toBe(true);
    const bad = runAction("moud_plan_record", other, p, { args: [{ patientId: pid, type: "moud_appointment", actor: other }] });
    expect(bad.ok).toBe(false);
    expect(bad.event.action).toBe("action.blocked");
  });

  it("viewer without Part 2 consent sees nothing MOUD-specific", () => {
    const pid = jordanId();
    openEpisode(pid);
    expect(canViewMoudContinuity(rx, pid)).toBe(false);
    expect(getMoudContinuity(pid, rx)).toBeUndefined();
    expect(moudWriterCheck(rx, pid).ok).toBe(false);
  });

  it("confirmation requires a recorded release and a later release cycle starts clean", () => {
    const pid = luisId();
    const ep = openEpisode(pid);
    expect(() => confirmMoudContinuity({ patientId: pid, type: "first_community_dose", actor: cf })).toThrow(/after the release/);
    AdelanteEHR.markPreReleaseEpisodeReleased({ episodeId: ep.id, confirmedBy: "s-cf2", actorRole: "cf_care_manager", releasedOn: "2026-10-10" });
    const c = confirmMoudContinuity({ patientId: pid, type: "first_community_dose", at: "2026-10-11", actor: cf });
    expect(c.confirmed?.type).toBe("first_community_dose");
    expect(c.episodeId).toBe(ep.id);
    expect(getMoudContinuity(pid)?.releaseDate).toBe("2026-10-10");
    AdelanteEHR.closePreReleaseEpisode?.({ episodeId: ep.id, reason: "test", closedBy: "s-cf2", actorRole: "cf_care_manager" } as never);
    const next = AdelanteEHR.openPreReleaseEpisode({
      patientId: pid, anticipatedReleaseDate: "2027-03-01", cfCareManagerStaffId: "s-cf2", cfCareManagerName: "Darnell Pope",
      openedBy: "s-cf2", actorRole: "cf_care_manager",
    });
    if (next.id !== ep.id) {
      expect(releaseCycleFor(pid)?.episodeId).toBe(next.id);
      expect(getMoudContinuity(pid)?.confirmed).toBeUndefined();
    }
  });
});

describe("display table", () => {
  const now = new Date("2026-10-20T18:00:00Z");
  const tz = "America/Los_Angeles";
  const rec = (r: Partial<MoudContinuityRecord> = {}): MoudContinuityRecord => ({ patientId: "p", episodeId: "e", ...r });
  const pre: ReleaseCycle = { episodeId: "e", released: false };
  const rel = (d: string): ReleaseCycle => ({ episodeId: "e", released: true, releaseDate: d });
  const confirmed = { type: "moud_visit_kept" as const, at: "2026-10-19", byStaffId: "s" };
  const plan = { type: "bridge_prescription" as const, at: "2026-10-01", byStaffId: "s" };

  it("each row", () => {
    expect(moudContinuityView(rec({ confirmed }), rel("2026-10-15"), now, tz)).toEqual({ state: "done", label: "Confirmed" });
    expect(moudContinuityView(rec(), rel("2026-10-20"), now, tz)).toEqual({ state: "urgent", label: "Reach out today" });
    expect(moudContinuityView(rec(), rel("2026-10-06"), now, tz)?.label).toBe("Reach out today");
    expect(moudContinuityView(rec(), rel("2026-10-05"), now, tz)).toEqual({ state: "yourturn", label: "Confirm MOUD continuity" });
    expect(moudContinuityView(rec(), pre, now, tz)).toEqual({ state: "yourturn", label: "Set MOUD plan" });
    expect(moudContinuityView(rec({ planInPlace: plan }), pre, now, tz)).toEqual({ state: "upnext", label: "Plan in place" });
  });

  it("no cycle or no runnable release date gives no urgency", () => {
    expect(moudContinuityView(undefined, undefined, now, tz)).toBeUndefined();
    expect(moudContinuityView(rec(), { episodeId: "e", released: true }, now, tz)).toBeUndefined();
    expect(moudContinuityView(rec(), rel("not-a-date"), now, tz)).toBeUndefined();
  });

  const order = (o: Partial<MedOrder>): MedOrder => ({ id: "o", patientId: "p", status: "signed", drugName: "Sertraline", ...o }) as MedOrder;
  it("supply rows from existing runway; no supply → nothing", () => {
    const n = new Date("2026-10-20T12:00:00Z");
    expect(supplyView(order({ drugName: "Buprenorphine", startDate: "2026-10-01", daysSupply: 7 }), n)).toEqual({ state: "urgent", label: "Out of MAT — reach out" });
    expect(supplyView(order({ startDate: "2026-10-01", daysSupply: 7 }), n)).toEqual({ state: "yourturn", label: "Ask for a refill" });
    expect(supplyView(order({ startDate: "2026-10-01", daysSupply: 60 }), n)).toBeUndefined();
    expect(supplyView(order({ drugName: "Buprenorphine" }), n)).toBeUndefined();
  });
});
