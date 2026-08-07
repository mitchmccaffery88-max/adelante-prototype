// §v3.0 role architecture Phase 1 — rename + new roles + supervision.
import { describe, it, expect } from "vitest";
import {
  STAFF_ROLES,
  STAFF_ROSTER,
  canAccess,
  canProxyForCfCareManager,
  canRecordMatAdministration,
  getSupervisor,
  isBillableStaff,
  supervisionStatus,
  type RecordClass,
  type StaffRole,
} from "../roles";

const key = (r: StaffRole) => STAFF_ROLES.find((x) => x.key === r);

describe("rename: ecm_provider", () => {
  it("replaces case_manager in the role list", () => {
    expect(key("ecm_provider")?.label).toBe("ECM Provider");
    expect(STAFF_ROLES.map((r) => r.key)).not.toContain("case_manager" as StaffRole);
  });

  it("keeps every grant the old case_manager role held", () => {
    // Spot-check across coordination, clinical-read and consent surfaces.
    expect(canAccess("ecm_provider", "demographics").level).toBe("write");
    expect(canAccess("ecm_provider", "case_notes").level).toBe("write");
    expect(canAccess("ecm_provider", "consent_ledger").level).toBe("write");
    expect(canAccess("ecm_provider", "custody_tracking").level).toBe("write");
    expect(canAccess("ecm_provider", "therapy_notes").level).toBe("read");
    expect(canAccess("ecm_provider", "controlled_substance_custody").level).toBe("read");
  });
});

describe("new roles are narrower than PMHNP/Therapist", () => {
  const narrower: [StaffRole, RecordClass][] = [
    ["cf_care_manager", "therapy_notes"],
    ["cf_care_manager", "meds_erx"],
    ["cf_care_manager", "screeners_sud"],
    ["sud_counselor", "meds_erx"],
    ["sud_counselor", "psychotherapy_notes"],
    ["clinical_trainee", "meds_erx"],
    ["medical_assistant", "therapy_notes"],
    ["medical_assistant", "case_notes"],
    ["medical_assistant", "sud_treatment"],
  ];
  for (const [role, cls] of narrower) {
    it(`${role} has no access to ${cls}`, () => {
      expect(canAccess(role, cls).level).toBe("none");
    });
  }

  it("gives SUD counselor real DMC-ODS write access", () => {
    expect(canAccess("sud_counselor", "sud_treatment").level).toBe("write");
    expect(canAccess("sud_counselor", "case_notes").level).toBe("write");
    expect(canAccess("sud_counselor", "screeners_sud").level).toBe("read");
  });

  it("gives CF Care Manager reentry coordination only", () => {
    expect(canAccess("cf_care_manager", "care_coordination").level).toBe("write");
    expect(canAccess("cf_care_manager", "custody_tracking").level).toBe("write");
    expect(canAccess("cf_care_manager", "worklist").level).toBe("write");
  });

  it("no new role gets cross-patient admin/reporting surfaces", () => {
    for (const role of [
      "cf_care_manager",
      "sud_counselor",
      "clinical_trainee",
      "medical_assistant",
    ] as StaffRole[]) {
      expect(canAccess(role, "population_health").level).toBe("none");
      expect(canAccess(role, "crisis_queue").level).toBe("none");
      expect(canAccess(role, "scheduling_rules").level).toBe("none");
      expect(canAccess(role, "billing").level).toBe("none");
    }
  });
});

describe("supervision is a real, queryable relationship", () => {
  it("resolves the trainee's LPHA supervisor from the data model", () => {
    const trainee = STAFF_ROSTER.find((s) => s.role === "clinical_trainee")!;
    expect(trainee.supervisedBy).toBeTruthy();
    expect(getSupervisor(trainee.id)?.role).toBe("therapist");
    expect(supervisionStatus(trainee.id).satisfied).toBe(true);
    expect(isBillableStaff(trainee.id)).toBe(true);
  });

  it("flags an unsupervised trainee as incomplete and not billable", () => {
    const orphan = { id: "s-tr-orphan", name: "Unsupervised Trainee", role: "clinical_trainee" as StaffRole };
    STAFF_ROSTER.push(orphan);
    try {
      expect(supervisionStatus(orphan.id).satisfied).toBe(false);
      expect(supervisionStatus(orphan.id).reason).toMatch(/incomplete/i);
      expect(isBillableStaff(orphan.id)).toBe(false);
    } finally {
      STAFF_ROSTER.splice(STAFF_ROSTER.indexOf(orphan), 1);
    }
  });

  it("rejects a supervisor who is not LPHA tier", () => {
    const bad = {
      id: "s-ma-bad",
      name: "MA under a peer",
      role: "medical_assistant" as StaffRole,
      supervisedBy: "s-peer1",
    };
    STAFF_ROSTER.push(bad);
    try {
      expect(supervisionStatus(bad.id).satisfied).toBe(false);
      expect(canRecordMatAdministration(bad.id)).toBe(false);
    } finally {
      STAFF_ROSTER.splice(STAFF_ROSTER.indexOf(bad), 1);
    }
  });

  it("scopes MA write access to supervised MAT administration", () => {
    const ma = STAFF_ROSTER.find((s) => s.role === "medical_assistant")!;
    expect(canRecordMatAdministration(ma.id)).toBe(true);
    expect(canAccess("medical_assistant", "meds_erx").level).toBe("read");
    const cm = STAFF_ROSTER.find((s) => s.role === "ecm_provider")!;
    expect(canRecordMatAdministration(cm.id)).toBe(false);
  });
});

describe("CF Care Manager dual access mode", () => {
  it("lets an ECM Provider proxy for a non-platform CF Care Manager", () => {
    expect(canProxyForCfCareManager("s-cm1", "s-cf2").allowed).toBe(true);
  });
  it("refuses to proxy for a direct-login CF Care Manager", () => {
    const r = canProxyForCfCareManager("s-cm1", "s-cf1");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/logs in directly/i);
  });
  it("refuses proxy entry from a role that does not own the hand-off", () => {
    expect(canProxyForCfCareManager("s-th1", "s-cf2").allowed).toBe(false);
  });
});
