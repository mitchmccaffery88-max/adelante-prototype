import { describe, expect, it } from "vitest";
import { CHART_ACTIONS } from "@/lib/chartActions";
import { scheduleSegments, workspaceActionRows, workspaceTileOrder } from "@/lib/clinicianWorkspace";
import { getStaffMember } from "@/lib/roles";
import type { Appointment } from "@/lib/ehr";

const actor = (id: string) => {
  const staff = getStaffMember(id);
  if (!staff) throw new Error(`Missing staff ${id}`);
  return { role: staff.role, staffId: staff.id, staffName: staff.name, clinicianId: staff.clinicianId, caseManagerId: staff.caseManagerId };
};

describe("clinician workspace tiles", () => {
  it("orders tiles by role", () => {
    expect(workspaceTileOrder("pmhnp")).toEqual(["schedule", "actions", "caseload", "requests"]);
    expect(workspaceTileOrder("therapist")).toEqual(["schedule", "actions", "caseload", "requests"]);
    expect(workspaceTileOrder("ecm_provider")).toEqual(["actions", "caseload", "schedule", "requests"]);
    expect(workspaceTileOrder("clinical_coordinator")).toEqual(["coordinator", "actions", "schedule"]);
  });

  it("segments today's visit statuses without mixing closed rows into Up next", () => {
    const now = new Date(2026, 8, 29, 10, 0);
    const visit = (id: string, hour: number, status: Appointment["status"]): Appointment => ({
      id, patientId: "p1", clinicianId: "c1", start: new Date(2026, 8, 29, hour).toISOString(), durationMin: 30,
      serviceType: "therapy_individual", modality: "video", status, source: "staff_scheduled",
    });
    const result = scheduleSegments([visit("future", 14, "scheduled"), visit("checked", 9, "checked_in"), visit("done", 8, "attended"), visit("late", 7, "late_cancel")], now);
    expect(result.up_next.map((v) => v.id)).toEqual(["future"]);
    expect(result.in_progress.map((v) => v.id)).toEqual(["checked"]);
    expect(result.done.map((v) => v.id)).toEqual(["done"]);
    expect(result.closed.map((v) => v.id)).toEqual(["late"]);
  });

  it("keeps contacts first for ECM and never exposes SUD medication names there", () => {
    const rows = workspaceActionRows({ actor: actor("s-cm1"), needsClosing: [], now: new Date() });
    const contact = rows.findIndex((row) => row.kind === "contact");
    if (contact >= 0) expect(contact).toBe(0);
    expect(rows.map((row) => row.label).join(" ")).not.toMatch(/buprenorphine|naltrexone|acamprosate|disulfiram/i);
  });

  it("counts each open visit once in Needs closing and puts its work in the same action queue", () => {
    const pending: Appointment = {
      id: "closing-example", patientId: "p1", clinicianId: "c1", start: "2026-09-28T18:00:00.000Z", durationMin: 30,
      serviceType: "therapy_individual", modality: "video", status: "scheduled", source: "staff_scheduled",
    };
    const rows = workspaceActionRows({ actor: actor("s-th1"), needsClosing: [pending], now: new Date("2026-09-29T18:00:00.000Z") });
    const closing = rows.filter((row) => row.id === "closing:closing-example");
    expect(closing).toHaveLength(1);
    expect(closing[0].group).toBe("now");
    expect(closing[0].action).toBe("Mark attended");
  });
});

describe("dashboard registry", () => {
  it("declares four patient-free starters with existing permission checks", () => {
    const ids = ["dashboard_task", "dashboard_book", "dashboard_contact", "dashboard_referral"];
    const actions = CHART_ACTIONS.filter((action) => ids.includes(action.id));
    expect(actions).toHaveLength(4);
    expect(actions.every((action) => action.needsPatient === false)).toBe(true);
    expect(actions.find((a) => a.id === "dashboard_task")?.allowed(actor("s-th1")).state).not.toBe("hidden");
    expect(actions.find((a) => a.id === "dashboard_contact")?.allowed(actor("s-cm1")).state).not.toBe("hidden");
    expect(actions.find((a) => a.id === "dashboard_contact")?.allowed(actor("s-th1")).state).toBe("hidden");
  });
});