// @vitest-environment jsdom
// §Claims Worklist follow-up — real interaction coverage for the two things
// Group C left unproven: the Radix segmented filter actually toggling on click,
// and column sorting cycling asc -> desc.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { SegmentedFilter, sortClaimRows, nextSort } from "@/routes/admin-claims";

type Svc = "all" | "peer" | "chw";

function Harness() {
  const [v, setV] = useState<Svc>("all");
  return (
    <div>
      <span data-testid="value">{v}</span>
      <SegmentedFilter<Svc>
        label="Service line"
        idPrefix="filter-service"
        value={v}
        onChange={setV}
        options={[
          { value: "all", label: "All" },
          { value: "peer", label: "Peer" },
          { value: "chw", label: "CHW" },
        ]}
      />
    </div>
  );
}

afterEach(cleanup);

describe("Radix segmented filter", () => {
  it("changes selection on click and reflects pressed state", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("filter-service-peer"));
    expect(screen.getByTestId("value").textContent).toBe("peer");
    expect(screen.getByTestId("filter-service-peer").getAttribute("data-state")).toBe("on");
    expect(screen.getByTestId("filter-service-all").getAttribute("data-state")).toBe("off");

    fireEvent.click(screen.getByTestId("filter-service-chw"));
    expect(screen.getByTestId("value").textContent).toBe("chw");
  });

  it("ignores the deselect event so one option stays active", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("filter-service-peer"));
    fireEvent.click(screen.getByTestId("filter-service-peer")); // Radix emits ""
    expect(screen.getByTestId("value").textContent).toBe("peer");
  });
});

describe("claims sorting", () => {
  const rows = [
    { code: "H0038", state: "submitted", charge: 300 },
    { code: "G0019", state: "denied", charge: 100 },
    { code: "H0025", state: "generated", charge: 200 },
  ];
  const value = (r: (typeof rows)[number], k: string) =>
    k === "charge" ? r.charge : k === "code" ? r.code : r.state;

  it("sorts code ascending then descending", () => {
    const asc = sortClaimRows(rows, { key: "code", dir: "asc" }, value as never);
    expect(asc.map((r) => r.code)).toEqual(["G0019", "H0025", "H0038"]);
    const desc = sortClaimRows(rows, { key: "code", dir: "desc" }, value as never);
    expect(desc.map((r) => r.code)).toEqual(["H0038", "H0025", "G0019"]);
  });

  it("sorts state/outcome both directions", () => {
    expect(
      sortClaimRows(rows, { key: "state", dir: "asc" }, value as never).map((r) => r.state),
    ).toEqual(["denied", "generated", "submitted"]);
    expect(
      sortClaimRows(rows, { key: "state", dir: "desc" }, value as never).map((r) => r.state),
    ).toEqual(["submitted", "generated", "denied"]);
  });

  it("sorts numeric charge numerically and leaves order untouched with no sort", () => {
    expect(
      sortClaimRows(rows, { key: "charge", dir: "asc" }, value as never).map((r) => r.charge),
    ).toEqual([100, 200, 300]);
    expect(sortClaimRows(rows, null, value as never)).toBe(rows);
  });

  it("cycles asc -> desc on the same column and resets to asc on a new one", () => {
    expect(nextSort(null, "code")).toEqual({ key: "code", dir: "asc" });
    expect(nextSort({ key: "code", dir: "asc" }, "code")).toEqual({ key: "code", dir: "desc" });
    expect(nextSort({ key: "code", dir: "desc" }, "code")).toEqual({ key: "code", dir: "asc" });
    expect(nextSort({ key: "code", dir: "desc" }, "state")).toEqual({ key: "state", dir: "asc" });
  });
});
