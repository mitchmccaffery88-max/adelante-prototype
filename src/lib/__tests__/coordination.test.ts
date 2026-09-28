import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { AdelanteEHRExt } from "../ehr-ext";
import { STAFF_ROLES } from "../roles";
import { resolveNavAccess } from "../navGuard";
import {
  canActOnCoordination,
  canViewCoordination,
  coordinationCancel,
  eligibleReassignTargets,
  formatClinicianName,
  listCoordinationAudit,
  listUnassignedPatients,
  reassignCoverage,
  seedCoordinationDemo,
} from "../coordination";
import { stripTaskPrefix } from "../inboxActions";

describe("clinical coordination (item 6)", () => {
  it("only clinical_coordinator and sys_admin reach the page", () => {
    for (const { key } of STAFF_ROLES) {
      const ok = key === "clinical_coordinator" || key === "sys_admin";
      expect([key, canActOnCoordination(key)]).toEqual([key, ok]);
      const view = ok || ["therapist", "pmhnp", "physician", "ecm_provider"].includes(key);
      expect([key, canViewCoordination(key)]).toEqual([key, view]);
      expect([key, resolveNavAccess(key, "/admin-coordination").status]).toEqual([key, view ? "allowed" : "denied"]);
    }
  });

  it("view-only roles are refused by the actions themselves", () => {
    for (const role of ["therapist", "pmhnp", "physician", "ecm_provider"] as const) {
      const a = AdelanteEHR.listAppointments()[0];
      expect(() => coordinationCancel({ apptId: a.id, reason: "other" as never, actor: { name: "x", role } })).toThrow(/coordinator/);
    }
  });

  it("seeds Kayla, a frozen provider, one reassigned + one pending patient", () => {
    seedCoordinationDemo();
    expect(AdelanteEHRExt.getClinicianProfile("c4")?.active).toBe(true);
    expect(AdelanteEHRExt.getClinicianProfile("c2")?.active).toBe(false);
    const audit = listCoordinationAudit();
    const re = audit.find((e) => e.action === "coordination_reassign");
    expect(re?.detail?.reason).toBe("provider_frozen");
    expect(re?.actorRole).toBe("clinical_coordinator");
    expect(listUnassignedPatients().some((u) => u.why === "Primary clinician frozen")).toBe(true);
  });

  it("reassign needs a coordinator, an eligible clinician and a reason; trainee shows supervisor", () => {
    const pending = AdelanteEHR.listAppointments().find(
      (a) => a.clinicianId === "c2" && a.status === "scheduled" && +new Date(a.start) > Date.now(),
    )!;
    const opts = eligibleReassignTargets(pending);
    expect(opts.some((o) => o.clinicianId === "c2")).toBe(false);
    const kayla = opts.find((o) => o.clinicianId === "c4");
    expect(kayla?.supervisorName).toBe("Marisol Reyes");
    const actor = { name: "Marisol Reyes", role: "therapist" as const };
    expect(() => reassignCoverage({ apptId: pending.id, toClinicianId: "c1", reason: "provider_frozen", actor })).toThrow();
    const priya = { name: "Priya Raman", role: "clinical_coordinator" as const };
    expect(() => reassignCoverage({ apptId: pending.id, toClinicianId: "c1", reason: "other", actor: priya })).toThrow(/Other/);
  });

  it("formats export names and strips doubled task prefixes", () => {
    expect(formatClinicianName("Marisol Reyes", "LCSW")).toBe("Marisol Reyes, LCSW");
    expect(stripTaskPrefix("Task assigned — Coverage needed")).toBe("Coverage needed");
    expect(stripTaskPrefix("Follow up — Task assigned — X")).toBe("X");
  });
});
