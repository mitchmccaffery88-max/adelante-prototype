// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StaffTable } from "@/components/staff/StaffTable";
afterEach(cleanup);

it("counts and pages only the caller's supplied records, never excluded identities", () => {
  const all = Array.from({ length: 105 }, (_, i) => ({ id: `credential-${i}`, permitted: i < 102, pending: i < 51 }));
  render(<StaffTable rows={all.filter((r) => r.permitted)} rowKey={(r) => r.id} label="Credentials" columns={[{ id: "id", label: "ID", cell: (r) => r.id, sortValue: (r) => r.id }]}
    views={[{ id: "pending", label: "Pending", matches: (r) => r.pending }, { id: "all", label: "All", matches: () => true }]} />);
  expect(screen.getAllByRole("cell")).toHaveLength(50);
  expect(screen.getByRole("button", { name: "Pending (51)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "All (102)" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getAllByRole("cell").map((c) => c.textContent)).toEqual(["credential-50"]);
  fireEvent.click(screen.getByRole("button", { name: "All (102)" }));
  expect(screen.getAllByRole("cell")[0].textContent).toBe("credential-0");
  expect(screen.queryByText("credential-104")).toBeNull();
});

it("secondary row actions run their original handler once, never a record action on view changes", async () => {
  let writes = 0;
  render(<StaffTable rows={[{ id: "visible" }]} rowKey={(r) => r.id} label="Queue" columns={[{ id: "id", label: "ID", cell: (r) => r.id }]}
    views={[{ id: "all", label: "All", matches: () => true }, { id: "none", label: "None", matches: () => false }]}
    moreActions={() => [{ label: "Existing action", onSelect: () => { writes += 1; } }]} />);
  fireEvent.click(screen.getByRole("button", { name: "None (0)" }));
  fireEvent.click(screen.getByRole("button", { name: "All (1)" }));
  expect(writes).toBe(0);
  // Radix responds to pointer activation, preserving its keyboard/menu behavior.
  const trigger = screen.getByRole("button", { name: "More: visible" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  const item = screen.getByRole("menuitem", { name: "Existing action" });
  fireEvent.click(item);
  await vi.waitFor(() => expect(writes).toBe(1));
});

it("visible cell projections and host-owned details never introduce additional table records", () => {
  render(<StaffTable rows={[{ id: "safe" }]} rowKey={(r) => r.id} label="Review" columns={[{ id: "id", label: "ID", cell: (r) => r.id }]}
    rowDetails={() => <input aria-label="Review reason" defaultValue="Draft remains local" />} />);
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(within(screen.getByRole("cell")).getByRole("textbox", { name: "Review reason" }).getAttribute("value")).toBe("Draft remains local");
});