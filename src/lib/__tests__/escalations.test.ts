import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, endSeveritySeedQuiet, type ScreenerResult } from "@/lib/ehr";

// Demo seeds are done by test time; flags created in test bodies are live.
endSeveritySeedQuiet();
import { setInFacilityEnabled, inFacilityEnabled } from "@/lib/inFacility";
import {
  _resetEscalationOverlays,
  filterEscalations,
  listEscalations,
  myOpenEscalations,
  NEUTRAL_TYPE_LABEL,
  POOL_LABEL,
  sortEscalations,
  type EscalationRow,
} from "@/lib/escalations";
import { runAction } from "@/lib/actions/runAction";
import { workspaceActionRows } from "@/lib/clinicianWorkspace";
import { STAFF_ROSTER } from "@/lib/roles";
import { Route as CrisisQueueRoute } from "@/routes/crisis-queue";

const COORD = { role: "clinical_coordinator" as const, staffId: "s-cc1", name: "Priya Raman" };
const ANITA = STAFF_ROSTER.find((m) => m.id === "s-th3")!;
const pats = () => AdelanteEHR.listPatients();
const patientWithClinician = () => pats().find((p) => p.primaryClinicianId)!;

function seedAll() {
  const [a, b, c, d] = pats();
  const crisis = AdelanteEHR.flagCrisis(a.id, "Priya Raman", "Unsafe statement in visit");
  const sdoh = AdelanteEHR.flagCrisis(b.id, "Priya Raman", "Losing housing tonight", { triggerSource: "sdoh_urgent", category: "sdoh" });
  const sp = patientWithClinician();
  AdelanteEHR.recordScreener(sp.id, { key: "phq-9", score: 4, severity: "minimal", completedAt: new Date(Date.now() - 2 * 86400000).toISOString() } as ScreenerResult);
  AdelanteEHR.recordScreener(sp.id, { key: "phq-9", score: 16, severity: "moderately severe", completedAt: new Date().toISOString() } as ScreenerResult);
  AdelanteEHR.addProgressNote(c.id, { clinicianId: "c1", date: new Date(Date.now() - 3 * 86400000).toISOString(), sessionType: "individual", subjective: "", objective: "", assessment: "", plan: "", serviceType: "crisis_intervention" } as never);
  AdelanteEHR.generateMissedHandoffCatchUp({ patientId: d.id, ownerStaffId: "s-cm1", ownerName: "Luz Herrera", ownerRole: "ecm_provider", trigger: "intake" as never });
  return { crisis, sdoh, sp };
}

describe("U1 unified escalations", () => {
  beforeEach(() => _resetEscalationOverlays());

  it("every source shows up in one view model", () => {
    seedAll();
    const types = new Set(listEscalations(COORD).map((r) => r.type));
    for (const t of ["crisis", "urgent_social_need", "score_change", "crisis_note", "missed_handoff"]) expect(types.has(t as never)).toBe(true);
  });

  it("owner and pool logic: named owner vs Coordinator pool; Mine vs All", () => {
    const { crisis } = seedAll();
    const rows = listEscalations(COORD);
    const row = rows.find((r) => r.sourceId === crisis.id)!;
    if (crisis.ownerLane === "named") expect(row.ownerStaffId).toBe(crisis.ownerStaffId);
    else expect(row.ownerName).toBe(POOL_LABEL);
    const handoff = rows.find((r) => r.type === "missed_handoff")!;
    expect(handoff.ownerStaffId).toBe("s-cm1");
    const luzMine = filterEscalations(listEscalations({ role: "ecm_provider", staffId: "s-cm1" }), { role: "ecm_provider", staffId: "s-cm1" }, { view: "mine" });
    expect(luzMine.every((r) => r.ownerStaffId === "s-cm1")).toBe(true);
    // A non-supervisor asking for "All" still gets only their own.
    expect(filterEscalations(rows, { role: "ecm_provider", staffId: "s-cm1" }, { view: "all" }).every((r) => r.ownerStaffId === "s-cm1")).toBe(true);
    expect(filterEscalations(rows, COORD, { view: "all" }).length).toBe(rows.length);
    expect(filterEscalations(rows, COORD, { view: "all", ownerStaffId: "pool" }).every((r) => r.pool)).toBe(true);
  });

  it("countdown + overdue sorting: overdue first, then by due time", () => {
    seedAll();
    const rows = listEscalations(COORD);
    const firstNonOverdue = rows.findIndex((r) => !r.overdue);
    expect(rows.slice(firstNonOverdue).some((r) => r.overdue && r.status !== "resolved")).toBe(false);
    const note = rows.find((r) => r.type === "crisis_note")!;
    expect(note.overdue).toBe(true);
    expect(note.countdown).toMatch(/over/);
    const fake = (k: string, dueAt: string, overdue: boolean) => ({ key: k, dueAt, overdue, status: overdue ? "overdue" : "new" }) as EscalationRow;
    expect(sortEscalations([fake("a", "2026-01-03", false), fake("b", "2026-01-05", true), fake("c", "2026-01-01", false)]).map((r) => r.key)).toEqual(["b", "c", "a"]);
    const open = rows.find((r) => r.type === "missed_handoff")!;
    expect(open.countdown).toMatch(/left$/);
  });

  it("shared actions go through runAction and are audited without content", () => {
    const { crisis } = seedAll();
    const handoff = listEscalations(COORD).find((r) => r.type === "missed_handoff")!;
    const ack = runAction("escalation_acknowledge", COORD, AdelanteEHR.getPatient(handoff.patientId), { args: [handoff.key, COORD] });
    expect(ack.ok).toBe(true);
    expect(listEscalations(COORD).find((r) => r.key === handoff.key)!.status).toBe("acknowledged");
    const re = runAction("escalation_reassign", COORD, AdelanteEHR.getPatient(handoff.patientId), { args: [handoff.key, { toStaffId: ANITA.id, reason: "Covering today" }, COORD] });
    expect(re.ok).toBe(true);
    expect(listEscalations(COORD).find((r) => r.key === handoff.key)!.ownerStaffId).toBe(ANITA.id);
    // Peer can't reassign.
    const peer = { role: "peer_specialist" as const, staffId: "s-peer1", name: "Andre Willis" };
    expect(runAction("escalation_reassign", peer, AdelanteEHR.getPatient(handoff.patientId), { args: [handoff.key, { toStaffId: "s-cm1", reason: "x x x" }, peer] }).ok).toBe(false);
    // Crisis hand-off delegates to the crisis store.
    const key = `crisis:${crisis.id}`;
    const h = runAction("escalation_handoff", COORD, AdelanteEHR.getPatient(crisis.patientId), { args: [key, { toStaffId: ANITA.id, reason: "Prescriber follow-up" }, COORD] });
    expect(h.ok).toBe(true);
    expect(AdelanteEHR.getPatient(crisis.patientId)!.crisisEscalations!.find((e) => e.id === crisis.id)!.ownerStaffId).toBe(ANITA.id);
    const audits = AdelanteEHR.listAuditEvents().filter((e) => String(e.action).startsWith("escalation_"));
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(["escalation_acknowledged", "escalation_reassigned", "escalation_handed_off"]));
    for (const a of audits) expect(JSON.stringify(a.detail)).not.toMatch(/Unsafe statement|housing/i);
    // Reason required.
    expect(runAction("escalation_reassign", COORD, AdelanteEHR.getPatient(handoff.patientId), { args: [handoff.key, { toStaffId: "s-cm1", reason: "" }, COORD] }).ok).toBe(false);
    // Handed-to person sees it in Mine and in Needs my action.
    expect(myOpenEscalations({ role: ANITA.role, staffId: ANITA.id }).some((r) => r.key === handoff.key)).toBe(true);
    const wr = workspaceActionRows({ actor: { staffId: ANITA.id, staffName: ANITA.name, clinicianId: ANITA.clinicianId, role: ANITA.role } as never, needsClosing: [] });
    expect(wr.some((r) => r.kind === "escalation" && r.sourceId === handoff.key)).toBe(true);
    expect(wr.some((r) => r.kind === "crisis" && r.sourceId === crisis.id)).toBe(true);
  });

  it("SUD-derived rows are neutral with no detail for roles without SUD access", () => {
    const p = AdelanteEHR.getPatient(demoScenarioPatientId("sud_no_consent")!)!;
    const e = AdelanteEHR.flagCrisis(p.id, "Priya Raman", "Relapse on alcohol after AUDIT rescreen");
    const coordRow = listEscalations(COORD).find((r) => r.sourceId === e.id)!; // coordinator has no SUD access
    expect(coordRow.sud).toBe(true);
    expect(coordRow.typeLabel).toBe(NEUTRAL_TYPE_LABEL);
    expect(coordRow.detail).toBeUndefined();
    const peerRow = listEscalations({ role: "peer_specialist", staffId: "s-peer1" }).find((r) => r.sourceId === e.id)!;
    expect(peerRow.detail).toBeUndefined();
    expect(listEscalations({ role: "billing", staffId: "s-bill1" })).toEqual([]);
  });

  it("nothing in-facility shows while the flag is off", () => {
    expect(inFacilityEnabled()).toBe(false);
    expect(listEscalations(COORD).some((r) => r.type === "refusal")).toBe(false);
    setInFacilityEnabled(true);
    try {
      expect(() => listEscalations(COORD)).not.toThrow();
    } finally {
      setInFacilityEnabled(false);
    }
  });

  it("/crisis-queue redirects to Escalations with a crisis filter", () => {
    const run = (search: Record<string, unknown>) => {
      try {
        (CrisisQueueRoute.options.beforeLoad as (a: unknown) => void)({ search });
      } catch (r) {
        return (r as { options: { to: string; search: Record<string, unknown> } }).options;
      }
      throw new Error("no redirect");
    };
    expect(run({})).toMatchObject({ to: "/escalations", search: { type: "crisis" } });
    expect(run({ lane: "sdoh" })).toMatchObject({ search: { type: "urgent_social_need" } });
    expect(run({ scope: "mine" })).toMatchObject({ search: { type: "crisis", view: "mine" } });
  });
});
