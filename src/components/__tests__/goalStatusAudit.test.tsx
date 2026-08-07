// @vitest-environment jsdom
//
// Every path that can move a goal must leave a trace. These cover the Patient
// Home tap-to-cycle loop (open -> in_progress -> done -> open) plus the
// staff-side call shape, asserting the audit row content, not just its count.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CarePlanCard } from "@/components/CarePlanCard";
import { AdelanteEHR, type AuditEvent } from "@/lib/ehr";

afterEach(cleanup);

let patientId: string;
let goalId: string;
let baseline = 0;

// listAuditEvents returns newest-first; reverse so assertions read in the
// order the clinician actually performed the changes.
const goalAudits = (): AuditEvent[] =>
  AdelanteEHR.listAuditEvents({ patientId, category: "care_plan" })
    .filter((e) => e.action === "goal_status_changed" && e.detail!.goalId === goalId)
    .reverse();

beforeEach(() => {
  const patient = AdelanteEHR.listPatients()[0]!;
  patientId = patient.id;
  AdelanteEHR.addGoal(patientId, `Test goal ${Math.random()}`);
  const goals = AdelanteEHR.getPatient(patientId)!.goals!;
  goalId = goals[goals.length - 1]!.id;
  baseline = goalAudits().length; // fresh goal id per test => always 0
  expect(baseline).toBe(0);
});

describe("PatientHome goal cycling — audit trail", () => {
  function renderPatientCard() {
    render(<CarePlanCard patientId={patientId} audience="patient" />);
    const goalText = AdelanteEHR.getPatient(patientId)!.goals!.find((g) => g.id === goalId)!.text;
    return screen.getByLabelText(`Update goal: ${goalText}`);
  }

  it("writes one audit row per tap with the correct from/to transition", () => {
    const row = renderPatientCard();
    fireEvent.click(row); // open -> in_progress
    fireEvent.click(row); // in_progress -> done
    fireEvent.click(row); // done -> open

    const events = goalAudits();
    expect(events.map((e) => [e.detail!.from, e.detail!.to])).toEqual([
      ["open", "in_progress"],
      ["in_progress", "done"],
      ["done", "open"],
    ]);
    expect(AdelanteEHR.getPatient(patientId)!.goals!.find((g) => g.id === goalId)!.status).toBe(
      "open",
    );
  });

  it("attributes patient-driven changes to the patient, with goal identity", () => {
    const patient = AdelanteEHR.getPatient(patientId)!;
    fireEvent.click(renderPatientCard());

    const e = goalAudits()[0]!;
    expect(e.category).toBe("care_plan");
    expect(e.patientId).toBe(patientId);
    expect(e.actorRole).toBe("patient");
    expect(e.actorId).toBe(`${patient.firstName} ${patient.lastName}`);
    expect(e.detail!.goalId).toBe(goalId);
    expect(e.detail!.goalText).toBe(patient.goals!.find((g) => g.id === goalId)!.text);
    expect(Number.isNaN(Date.parse(e.at))).toBe(false);
  });

  it("renders the resulting history in the timeline the same session", () => {
    fireEvent.click(renderPatientCard());
    expect(screen.getAllByText(/open\s*→\s*in progress/i).length).toBeGreaterThan(0);
  });
});

describe("staff-side goal changes", () => {
  it("records the acting staff role and name", () => {
    AdelanteEHR.setGoalStatus(patientId, goalId, "done", "Christi R", "ecm_provider");
    const e = goalAudits().at(-1)!;
    expect(e.actorRole).toBe("ecm_provider");
    expect(e.actorId).toBe("Christi R");
    expect(e.detail!.to).toBe("done");
  });

  it("defaults actorRole to staff when only a name is supplied", () => {
    AdelanteEHR.setGoalStatus(patientId, goalId, "in_progress", "Dr. Bagga");
    expect(goalAudits().at(-1)!.actorRole).toBe("staff");
  });

  it("still logs a no-change transition so re-saves are traceable", () => {
    AdelanteEHR.setGoalStatus(patientId, goalId, "open", "Christi R", "ecm_provider");
    const e = goalAudits().at(-1)!;
    expect(e.detail!.from).toBe("open");
    expect(e.detail!.to).toBe("open");
  });

  it("writes nothing when the goal does not exist", () => {
    AdelanteEHR.setGoalStatus(patientId, "missing-goal", "done", "Christi R", "ecm_provider");
    expect(goalAudits().length).toBe(0);
  });
});
