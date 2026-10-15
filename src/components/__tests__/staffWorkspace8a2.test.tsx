// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { WorkspaceSectionOrder } from "../staff/WorkspaceSectionOrder";

describe("staff section ordering without new data", () => {
  afterEach(cleanup);
  it("orders gated children, preserving record labels and actions exactly once", () => {
    render(<WorkspaceSectionOrder waitingIds={["waiting"]} todayIds={["today"]}>
      <div data-testid="today">Existing visit</div>
      <div data-testid="waiting">Existing lab</div>
      {false && <div>Hidden Part 2 record</div>}
      <div data-testid="needs"><a href="/existing">Review content waiting on Cathy</a></div>
    </WorkspaceSectionOrder>);
    expect(screen.getAllByRole("region").map(el => el.getAttribute("aria-label"))).toEqual(["Needs you", "Waiting on others", "Today"]);
    expect(within(screen.getByRole("region", { name: "Needs you" })).getByRole("link").getAttribute("href")).toBe("/existing");
    expect(screen.getAllByText("Existing lab")).toHaveLength(1);
    expect(screen.queryByText("Hidden Part 2 record")).toBeNull();
  });
  it("does not invent waiting or today rows", () => {
    render(<WorkspaceSectionOrder><div>One real item</div></WorkspaceSectionOrder>);
    expect(within(screen.getByRole("region", { name: "Waiting on others" })).getByText("No items.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Today" })).getByText("No items.")).toBeTruthy();
  });
});