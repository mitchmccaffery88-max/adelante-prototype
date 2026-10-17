// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffTable, RestrictedCell } from "@/components/staff/StaffTable";
afterEach(cleanup);
const rows = Array.from({ length: 101 }, (_, i) => ({ id: String(i), value: 101 - i, needs: i < 3 }));
const columns = [{ id: "value", label: "Value", cell: (r: typeof rows[number]) => r.value, sortValue: (r: typeof rows[number]) => r.value }];
function table(extra = {}) { return <StaffTable rows={rows} columns={columns} rowKey={(r) => r.id} label="Work" {...extra} />; }
it("pages at exactly 50 without losing the final row", () => {
  render(table()); expect(screen.getAllByRole("row").length - 1).toBe(50);
  fireEvent.click(screen.getByRole("button", { name: "Next page" })); expect(screen.getAllByRole("row").length - 1).toBe(50);
  fireEvent.click(screen.getByRole("button", { name: "Next page" })); expect(screen.getAllByRole("row").length - 1).toBe(1);
  expect(screen.getByRole("cell").textContent).toBe("1");
});
it("sorts concrete numeric values ascending and descending", () => {
  render(table()); fireEvent.click(screen.getByRole("button", { name: "Value" }));
  expect(screen.getAllByRole("cell")[0].textContent).toBe("1");
  expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("ascending");
  fireEvent.click(screen.getByRole("button", { name: "Value" })); expect(screen.getAllByRole("cell")[0].textContent).toBe("101");
  expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("descending");
});
it("counts views only from caller rows and resets paging on selection", () => {
  render(table({ views: [{ id: "needs", label: "Needs you", matches: (r: typeof rows[number]) => r.needs }, { id: "all", label: "All", matches: () => true }], defaultView: "all" }));
  fireEvent.click(screen.getByRole("button", { name: "Next page" })); fireEvent.click(screen.getByRole("button", { name: "Needs you (3)" }));
  expect(screen.getAllByRole("cell").map((c) => c.textContent)).toEqual(["101", "100", "99"]);
});
it("represents a restricted cell with an accessible lock without receiving secret content", () => {
  render(<StaffTable rows={[{id:"safe"}]} rowKey={(r)=>r.id} label="Restricted work" columns={[{id:"cell",label:"Cell",cell:()=> <RestrictedCell label="Consent required"/>}]}/>);
  expect(within(screen.getByRole("cell")).getByRole("img", {name:"Consent required"})).toBeTruthy();
});
it("keyboard activation sorts and pages", async () => {
  const user = userEvent.setup(); render(table());
  screen.getByRole("button", { name: "Value" }).focus(); await user.keyboard("{Enter}");
  expect(screen.getAllByRole("cell")[0].textContent).toBe("1");
  screen.getByRole("button", { name: "Next page" }).focus(); await user.keyboard(" ");
  expect(screen.getAllByRole("cell")[0].textContent).toBe("51");
});