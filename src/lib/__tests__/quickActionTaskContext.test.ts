import { expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { quickActionsFor } from "@/lib/quickActions";

it("therapist chart defaults never show the patientless Task twin; chart Task follows the case_notes write gate", () => {
  const patient = AdelanteEHR.listPatients()[0];
  expect(patient).toBeDefined();
  if (!patient) throw new Error("Expected a real demo patient");
  const ids = quickActionsFor({ role: "therapist", staffId: "s-th1" }, patient).map((a) => a.id);
  expect(ids).not.toContain("task");
  expect(ids).not.toContain("dashboard_task");
});

it("therapist and SUD counselor patientless defaults include only the dashboard Task twin", () => {
  for (const role of ["therapist", "sud_counselor"] as const) {
    const ids = quickActionsFor({ role, staffId: "s-th1" }).map((a) => a.id);
    expect(ids).toContain("dashboard_task");
    expect(ids).not.toContain("task");
  }
});