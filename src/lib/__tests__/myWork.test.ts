// §Reporting Tier 3 — personal worklist scoping, screener cadence reuse and
// contact semantics. These assert the SCOPING guarantees, not demo numbers.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  DISENGAGEMENT_DRAFT,
  disengagementRows,
  myCaseload,
  myOpenItems,
  screenerDueRows,
  staffAliases,
} from "@/lib/myWork";

const clinician = () => {
  const p = AdelanteEHR.listPatients().find((x) => x.primaryClinicianId)!;
  return p.primaryClinicianId!;
};

describe("staff scoping", () => {
  it("matches a clinician by id, staff id and name", () => {
    const a = staffAliases({ staffId: "s-c1", staffName: "Dr. Example", clinicianId: "c1" });
    expect(a).toContain("c1");
    expect(a).toContain("s-c1");
    expect(a).toContain("Dr. Example");
  });

  it("caseload is only patients whose clinician or case manager is me", () => {
    const id = clinician();
    const rows = myCaseload({ staffId: `s-${id}`, staffName: "x", clinicianId: id });
    expect(rows.length).toBeGreaterThan(0);
    for (const p of rows) {
      expect([p.primaryClinicianId, p.caseManagerId].some((v) => v && v.includes(id))).toBe(true);
    }
  });

  it("an unrelated staff member sees no caseload and no open items", () => {
    const identity = { staffId: "s-nobody", staffName: "Nobody At All" };
    expect(myCaseload(identity)).toEqual([]);
    const open = myOpenItems(identity);
    expect(open.total).toBe(0);
    expect(open.clinicalCrises).toEqual([]);
    expect(open.sdohCrises).toEqual([]);
    expect(open.unsignedNotes).toEqual([]);
    expect(open.overdueTasks).toEqual([]);
  });
});

describe("open items", () => {
  it("only surfaces crisis escalations claimed by me", () => {
    const id = clinician();
    const identity = { staffId: `s-${id}`, staffName: "x", clinicianId: id };
    const aliases = staffAliases(identity);
    for (const c of [...myOpenItems(identity).clinicalCrises, ...myOpenItems(identity).sdohCrises]) {
      expect(aliases.some((a) => c.escalation.claimedBy?.includes(a))).toBe(true);
    }
  });

  it("total equals the sum of its four sources", () => {
    const id = clinician();
    const o = myOpenItems({ staffId: `s-${id}`, staffName: "x", clinicianId: id });
    expect(o.total).toBe(
      o.clinicalCrises.length + o.sdohCrises.length + o.unsignedNotes.length + o.overdueTasks.length,
    );
  });
});

describe("screener due rows", () => {
  it("reuses the existing rescreen cadence rather than inventing due dates", () => {
    const patients = AdelanteEHR.listPatients();
    const rows = screenerDueRows(patients);
    for (const r of rows) {
      expect([30, 60, 90]).toContain(r.cadenceStep);
      expect(r.daysSinceLast).toBeGreaterThanOrEqual(r.cadenceStep);
      const live = AdelanteEHR.rescreensDue(r.patientId).map((x) => x.key);
      expect(live).toContain(r.screenerKey);
    }
  });
});

describe("disengagement rows", () => {
  it("classifies against the draft thresholds and keeps every caseload patient", () => {
    const patients = AdelanteEHR.listPatients().slice(0, 5);
    const rows = disengagementRows(patients);
    expect(rows.length).toBe(patients.length);
    for (const r of rows) {
      if (r.daysSinceContact === null) expect(r.level).toBe("no_contact_recorded");
      else if (r.daysSinceContact >= DISENGAGEMENT_DRAFT.atRisk) expect(r.level).toBe("at_risk");
      else if (r.daysSinceContact >= DISENGAGEMENT_DRAFT.watch) expect(r.level).toBe("watch");
      else expect(r.level).toBe("ok");
    }
  });

  it("never counts a staff-authored message as patient contact", () => {
    const rows = disengagementRows(AdelanteEHR.listPatients());
    for (const r of rows) {
      if (r.lastContactKind !== "message") continue;
      const msgs = AdelanteEHR.listCareMessages(r.patientId).filter(
        (m) => m.authorType === "patient",
      );
      expect(msgs.length).toBeGreaterThan(0);
    }
  });
});
