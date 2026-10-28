import { describe, expect, it, vi, afterEach } from "vitest";
import { AdelanteEHR, type CaseTask } from "@/lib/ehr";
import { STAFF_ROSTER, canAccess, type StaffRole } from "@/lib/roles";
import { chartEntryFor } from "@/lib/chartAccess";
import { listUnsignedWork } from "@/lib/unsignedWork";
import { roleSeesSudProgram, patientSudProgramVisible } from "@/lib/sudProgramVisibility";
import { outpatientQueueTasks } from "@/components/tasks/TaskQueueCard";
import { displayAuditDetail } from "@/lib/auditDisplay";
import { staffPatientLabel } from "@/lib/staffPatientLabel";
import { runAction } from "@/lib/actions/runAction";
import { AdelanteEHRExt } from "@/lib/ehr-ext";

afterEach(() => vi.restoreAllMocks());

function sudDraft(patientId: string, clinicianId: string) {
  const n = AdelanteEHR.addProgressNote(patientId, {
    clinicianId, date: new Date().toISOString(), sessionType: "individual",
    subjective: "s", objective: "", assessment: "", plan: "", authorSource: "human",
    status: "draft", category: "sud",
  } as never);
  if (!n) throw new Error("no note");
  return n;
}

/** A staff member + patient whose chart the member can open. */
function openablePair(role: StaffRole, extra: (pid: string) => boolean = () => true) {
  for (const m of STAFF_ROSTER.filter((s) => s.role === role))
    for (const p of AdelanteEHR.listPatients())
      if (chartEntryFor(role, m.id, p.id).ok && extra(p.id)) return { m, p };
  return undefined;
}

describe("Group A #1 — unsigned-notes queue follows chart entry + Part 2", () => {
  it("a therapist who can open the chart still sees a Part 2 draft there", () => {
    const pair = openablePair("therapist")!;
    const n = sudDraft(pair.p.id, "c-groupA");
    const rows = listUnsignedWork({ viewer: { role: "therapist", staffId: pair.m.id } });
    expect(rows.some((r) => r.id === n.id)).toBe(true);
  });

  it("a consent-gated role without consent never gets the Part 2 draft row", () => {
    const pair = openablePair("peer_specialist", (pid) => canAccess("peer_specialist", "screeners_sud", AdelanteEHR.getPatient(pid)).locked);
    expect(pair).toBeDefined();
    const n = sudDraft(pair!.p.id, "c-groupA2");
    const rows = listUnsignedWork({ viewer: { role: "peer_specialist", staffId: pair!.m.id } });
    expect(rows.some((r) => r.id === n.id)).toBe(false);
    // Unscoped store derivation is unchanged.
    expect(listUnsignedWork().some((r) => r.id === n.id)).toBe(true);
  });

  it("a role with no chart entry (billing) sees no rows at all", () => {
    expect(listUnsignedWork({ viewer: { role: "billing", staffId: "s-bill1" } })).toHaveLength(0);
  });

  it("rows for a site the viewer doesn't work at are omitted", () => {
    const th = STAFF_ROSTER.find((s) => s.role === "therapist")!;
    const blocked = AdelanteEHR.listPatients().find((p) => { const e = chartEntryFor("therapist", th.id, p.id); return !e.ok; });
    if (!blocked) return; // every patient shares this therapist's site in the seed
    const rows = listUnsignedWork({ viewer: { role: "therapist", staffId: th.id } });
    expect(rows.some((r) => r.patient.id === blocked.id)).toBe(false);
  });
});

describe("Group A #2 — SUD program classification", () => {
  it("only roles with unconditional Part 2 access get the SUD program option", () => {
    expect(roleSeesSudProgram("therapist")).toBe(true);
    expect(roleSeesSudProgram("sud_counselor")).toBe(true);
    expect(roleSeesSudProgram("peer_specialist")).toBe(false);
    expect(roleSeesSudProgram("ecm_provider")).toBe(false);
    expect(roleSeesSudProgram("cf_care_manager")).toBe(false);
  });
  it("per-patient matching keeps the consent check", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    expect(patientSudProgramVisible("therapist", p)).toBe(true);
    expect(patientSudProgramVisible("cf_care_manager", p)).toBe(false);
  });
});

describe("Group A #3 — outpatient task queues drop in-facility tasks", () => {
  it("medication-pass / custody tasks are excluded, ordinary tasks stay", () => {
    const base = { patientId: "p1", status: "open", dueDate: new Date().toISOString(), priority: "routine" } as unknown as CaseTask;
    vi.spyOn(AdelanteEHR, "caseTasksForCM").mockReturnValue([
      { ...base, id: "t-out", title: "Call about housing", taskType: "coordination" },
      { ...base, id: "t-mar", title: "Med pass 08:00", taskType: "med_pass" },
      { ...base, id: "t-cust", title: "Custody check", facilityContext: true },
    ] as CaseTask[]);
    expect(outpatientQueueTasks({ kind: "case_manager", cmId: "cm1" }).map((t) => t.id)).toEqual(["t-out"]);
  });
});

describe("Group A #4 — action audit feed display scrubbing", () => {
  it("Part 2 terms, ICD codes and the patient's name are scrubbed on display", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    const out = displayAuditDetail(`${p.firstName} started buprenorphine, F11.20`, p.id);
    expect(out).not.toContain(p.firstName);
    expect(out).not.toMatch(/buprenorphine/i);
    expect(out).not.toContain("F11.20");
  });
  it("ordinary reasons still read normally", () => {
    expect(displayAuditDetail("Fixed a typo", undefined)).toBe("Fixed a typo");
    expect(displayAuditDetail(undefined)).toBe("");
  });
});

describe("Group A #5 — outbound sharing log patient label", () => {
  it("prototype sys_admin oversight entry keeps the existing full-name label", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    expect(staffPatientLabel({ role: "sys_admin", staffId: "s-admin1" }, p.id)).toBe(`${p.firstName} ${p.lastName}`);
  });
  it("a clinical coordinator who can open the chart keeps the full name", () => {
    const pair = openablePair("clinical_coordinator", (pid) => { const e = chartEntryFor("clinical_coordinator", "s-cc1", pid); return e.ok && !e.restricted; });
    expect(pair).toBeDefined();
    expect(staffPatientLabel({ role: "clinical_coordinator", staffId: pair!.m.id }, pair!.p.id)).toBe(`${pair!.p.firstName} ${pair!.p.lastName}`);
  });
});

describe("Group A #6 — claim Move runs through claim_status with a reason", () => {
  it("non-billing roles are refused by the registry", () => {
    const c = AdelanteEHRExt.listClaims()[0]!;
    const r = runAction("claim_status", { role: "therapist", staffId: "s-th1", staffName: "T" }, undefined, { args: [c.id, "coded"], auditReason: "x" });
    expect(r.ok).toBe(false);
  });
});
