// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StaffTable } from "@/components/staff/StaffTable";
import { TaskQueueCard } from "@/components/tasks/TaskQueueCard";

vi.mock("@/lib/roles", () => ({ useActingStaff: () => ({ staffId: "staff-one", role: "ecm_provider", staffName: "Test owner" }) }));
vi.mock("@/lib/staffPatientLabel", () => ({ staffPatientLabel: () => "Client", viewerCanOpenChart: () => false }));
vi.mock("@/lib/actions/act", () => ({ act: vi.fn(), actFor: vi.fn() }));
vi.mock("@/components/clinical/AutomationTrace", () => ({ AutoCreatedFromNote: () => null }));
vi.mock("@/lib/ehr", () => {
  const tasks = Array.from({ length: 51 }, (_, i) => ({ id: `task-${i}`, patientId: "p-one", title: `Task ${i}`, status: "open", dueDate: "2026-10-20", priority: "routine", origin: "manual", assignedTo: "cm-one", createdAt: "2026-10-17", notes: [] }));
  return { useEhr: (fn: () => unknown) => fn(), taskPriority: () => "routine", worklistStatusFor: () => "pending", AdelanteEHR: { caseTasksForCM: () => tasks, listPatients: () => [] } };
});
afterEach(cleanup);

it("retains an unsaved task note and open editor across a 50-row page boundary", () => {
  render(<TaskQueueCard source={{ kind: "case_manager", cmId: "cm-one" }} onOpenPatient={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /^Task 0routine/ }));
  fireEvent.change(screen.getByPlaceholderText("What happened on this task?"), { target: { value: "Unfinished private draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.queryByPlaceholderText("What happened on this task?")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
  expect((screen.getByPlaceholderText("What happened on this task?") as HTMLTextAreaElement).value).toBe("Unfinished private draft");
});

it("a zero-result saved view retains its own empty state and excludes other rows", () => {
  render(<StaffTable rows={[{ id: "other" }]} rowKey={(r) => r.id} label="Work" columns={[{ id: "id", label: "ID", cell: (r) => r.id }]} views={[{ id: "none", label: "Needs you", matches: () => false, emptyState: <span data-testid="empty-selection" /> }, { id: "all", label: "Everyone", matches: () => true }]} />);
  expect(screen.getByTestId("empty-selection")).toBeTruthy();
  expect(screen.queryByRole("cell")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Everyone (1)" }));
  expect(screen.getAllByRole("cell")).toHaveLength(1);
});