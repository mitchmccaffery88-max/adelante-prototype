// §B1 MAT continuity alert + §B4 MAT never conditioned on counseling attendance.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AdelanteEHR } from "@/lib/ehr";
import { isMatOrder } from "@/lib/medAdherence";
import {
  MAT_CONTINUITY_DRAFT, MAT_REFILL_TASK_LABEL, PATIENT_REFILL_NUDGE, matContinuityAlerts, continuityForPatient, sendPatientRefillNudges,
} from "@/lib/medContinuity";
import { listEscalations, NEUTRAL_TYPE_LABEL } from "@/lib/escalations";
import { headerAlerts } from "@/lib/chartBrief";
import { computeAdherence } from "@/lib/adelBrief";

const DAY = 86_400_000;
const jasmine = () => AdelanteEHR.listPatients().find((p) => p.firstName === "Jasmine" && p.lastName === "Holt")!;
const matOrder = () => (jasmine().orders ?? []).find((o) => isMatOrder(o) && o.status === "signed")!;
const at = (daysLeft: number) => new Date(+new Date(`${matOrder().startDate}T00:00:00`) + (30 - daysLeft) * DAY + 3600_000);
const ANITA = { role: "pmhnp" as const, staffId: "s-th3", staffName: "Anita Brooks", clinicianId: "c3" };

describe("B1 thresholds", () => {
  it("draft config is one object and labelled Draft", () => {
    expect(MAT_CONTINUITY_DRAFT).toMatchObject({ refillNeededDays: 5, escalateDays: 2, releaseBridgeDays: 1 });
    expect(MAT_CONTINUITY_DRAFT.label).toMatch(/^Draft/);
  });
  it("seeded patient at 2 days → Medication continuity escalation (demo); 4 days → MAT refill needed", () => {
    const a = continuityForPatient(jasmine().id);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ daysLeft: 2, ownerStaffId: "s-th3", escalation: true });
    const four = continuityForPatient(jasmine().id, at(4));
    expect(four[0]).toMatchObject({ kind: "refill_needed", daysLeft: 4, escalation: false });
    const esc = listEscalations({ role: "pmhnp", staffId: "s-th3" }).find((r) => r.type === "med_continuity" && r.patientId === jasmine().id);
    expect(esc?.typeLabel).toBe("Medication continuity");
    expect(MAT_REFILL_TASK_LABEL).toBe("MAT refill needed");
  });
  it("6 days → nothing; 2 days → Medication continuity escalation owned by the prescriber", () => {
    expect(continuityForPatient(jasmine().id, at(6))).toHaveLength(0);
    const now = at(2);
    const e = listEscalations({ role: "pmhnp", staffId: "s-th3" }, +now).find((r) => r.type === "med_continuity" && r.patientId === jasmine().id)!;
    expect(e.typeLabel).toBe("Medication continuity");
    expect(e.ownerStaffId).toBe("s-th3");
    expect(continuityForPatient(jasmine().id, at(0))[0].escalation).toBe(true);
  });
  it("due same business day — never later than the end of the next working day", () => {
    const now = at(2);
    const a = continuityForPatient(jasmine().id, now)[0];
    expect(+new Date(a.dueAt) - +now).toBeLessThan(4 * DAY);
    expect(+new Date(a.dueAt)).toBeGreaterThan(+now);
  });
  it("no prescriber → coordinator pool", () => {
    const p = jasmine();
    const prev = p.prescriberStaffId;
    const o = matOrder();
    const saved = { a: o.attestedBy, c: o.createdBy, op: o.orderingProviderId };
    p.prescriberStaffId = undefined; o.attestedBy = "nobody"; o.createdBy = undefined; o.orderingProviderId = undefined;
    try {
      expect(continuityForPatient(p.id)[0].ownerStaffId).toBeUndefined();
      const coord = listEscalations({ role: "clinical_coordinator", staffId: "s-cc1" });
      expect(coord.some((r) => r.type === "med_continuity" && r.patientId === p.id)).toBe(true);
    } finally { p.prescriberStaffId = prev; o.attestedBy = saved.a; o.createdBy = saved.c; o.orderingProviderId = saved.op; }
  });
  it("released MAT patient with no active order within 1 day → escalation", () => {
    const p = jasmine();
    const now = at(-3); // supply out
    const ep = AdelanteEHR.openPreReleaseEpisode({ patientId: p.id, anticipatedReleaseDate: new Date(+now - 2 * DAY).toISOString().slice(0, 10), cfCareManagerStaffId: "s-cf2", cfCareManagerName: "Darnell Pope", openedBy: "t", actorRole: "sys_admin" });
    AdelanteEHR.markPreReleaseEpisodeReleased({ episodeId: ep.id, confirmedBy: "t", actorRole: "sys_admin", releasedOn: new Date(+now - 2 * DAY).toISOString().slice(0, 10) });
    expect(matContinuityAlerts(now).some((a) => a.kind === "release_no_bridge" && a.patientId === p.id && a.escalation)).toBe(true);
  });
});

describe("B1 masking", () => {
  it("roles without SUD access see only Follow-up needed", () => {
    const now = at(2);
    const rows = listEscalations({ role: "chw" as never, staffId: "s-chw1" }, +now).filter((r) => r.type === "med_continuity");
    for (const r of rows) { expect(r.typeLabel).toBe(NEUTRAL_TYPE_LABEL); expect(r.detail).toBeUndefined(); }
    expect(computeAdherence(jasmine(), "chw" as never, now).filter((x) => x.id.startsWith("continuity-"))).toHaveLength(0);
  });
  it("Brief and chart header show the alert with its source", () => {
    const b = computeAdherence(jasmine(), "pmhnp", new Date()).find((x) => x.id.startsWith("continuity-"))!;
    expect(b.text).toMatch(/source: Refill runway/);
    const h = headerAlerts(jasmine(), "pmhnp", ["medications"]).find((x) => x.id.startsWith("mat-cont"))!;
    expect(h.label).toMatch(/Medication continuity — Refill runway/);
  });
  it("patient nudge is neutral EN/ES, no medication name, deduped", () => {
    for (const c of [PATIENT_REFILL_NUDGE.en, PATIENT_REFILL_NUDGE.es]) expect(`${c.subject} ${c.body}`).not.toMatch(/bupren|suboxone|naloxone|naltrex|methadone|MAT|opioid/i);
    expect(PATIENT_REFILL_NUDGE.en.body).toBe("It may be time to refill a medication — tap to message your care team");
    const before = AdelanteEHR.listMemberNotifications("patient", jasmine().id).length;
    sendPatientRefillNudges();
    expect(AdelanteEHR.listMemberNotifications("patient", jasmine().id).length).toBe(before);
    const mine = AdelanteEHR.listMemberNotifications("patient", jasmine().id).filter((n) => n.dedupeKey?.startsWith("mat-nudge"));
    expect(mine.length).toBe(1);
    expect(`${mine[0].subject} ${mine[0].body}`).not.toMatch(/bupren|naloxone/i);
  });
  it("missed dose on the MAR → task to the prescriber, never blocks", () => {
    const o = matOrder();
    const sched = new Date(Date.now() - DAY).toISOString();
    AdelanteEHR.chartDose(jasmine().id, o.id, sched, "held", "Did not come for pickup", "Nurse", "b-test", "Charted from pickup log");
    const a = matContinuityAlerts().find((x) => x.kind === "missed_dose" && x.patientId === jasmine().id)!;
    expect(a).toMatchObject({ ownerStaffId: "s-th3", escalation: false });
    expect(a.source).not.toMatch(/bupren/i);
  });
});

describe("B4 — MAT is never conditioned on counseling attendance", () => {
  it("zero attended counseling: can order, refill, administer and get alerts", () => {
    const p = jasmine();
    const attended = AdelanteEHR.listAppointments().filter((a) => a.patientId === p.id && a.status === "attended");
    for (const a of attended) a.status = "no_show";
    expect(AdelanteEHR.listAppointments().filter((a) => a.patientId === p.id && a.status === "attended")).toHaveLength(0);
    const d = AdelanteEHR.addDraftOrder(p.id, { drugName: "Buprenorphine-naloxone 8 MG-2 MG Sublingual Film", ingredientNames: ["buprenorphine", "naloxone"], daysSupply: 7, createdBy: "s-th3" } as never);
    const signed = AdelanteEHR.signOrders(p.id, [d.id], "Anita Brooks");
    expect(signed[0].status).toBe("signed");
    const dose = AdelanteEHR.chartDose(p.id, d.id, new Date().toISOString(), "given", undefined, "Nurse", "b-b4");
    expect(dose.action).toBe("given");
    expect(continuityForPatient(p.id, new Date(Date.now() + 5 * DAY)).length).toBeGreaterThan(0);
  });
  it("guard: no medication path reads attendance", () => {
    const ATTEND = /attend|no_show|listAppointments|groupSession|listGroup/i;
    for (const f of ["medContinuity.ts", "medAdherence.ts", "orders.ts", "mar.ts", "medSchedule.ts", "orderSafety.ts", "chartOrders.ts"]) {
      const src = readFileSync(join(__dirname, "..", f), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      expect(src, f).not.toMatch(ATTEND);
    }
    const ehr = readFileSync(join(__dirname, "..", "ehr.ts"), "utf8");
    for (const m of ["addDraftOrder(", "signOrders(", "requestRefill(", "reviewRefill(", "chartDose("]) {
      const i = ehr.indexOf(`\n  ${m}`);
      expect(i, m).toBeGreaterThan(0);
      const j = ehr.indexOf("\n  },\n", i);
      expect(ehr.slice(i, j).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n"), m).not.toMatch(ATTEND);
    }
  });
});
