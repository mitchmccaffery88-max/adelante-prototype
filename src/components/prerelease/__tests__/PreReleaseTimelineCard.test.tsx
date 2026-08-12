// §Build 5 — the timeline card renders the real staged window.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreReleaseTimelineCard } from "../PreReleaseTimelineCard";
import type { PreReleaseEpisode } from "@/lib/ehr";

const plus = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const ep = (over: Partial<PreReleaseEpisode>): PreReleaseEpisode =>
  ({
    id: "e1",
    patientId: "p1",
    anticipatedReleaseDate: plus(75),
    cfCareManagerStaffId: "cf1",
    cfCareManagerName: "CF",
    status: "open",
    openedAt: new Date().toISOString(),
    openedBy: "CF",
    ...over,
  }) as PreReleaseEpisode;

describe("PreReleaseTimelineCard", () => {
  it("shows the intake window phase for a T-75 episode", () => {
    render(<PreReleaseTimelineCard episode={ep({})} />);
    expect(screen.getByTestId("pre-release-phase").textContent).toContain("T-90");
    expect(screen.queryByTestId("warm-handoff-notice")).toBeNull();
  });

  it("shows the 72-hour warm-handoff notice inside the final stretch", () => {
    render(<PreReleaseTimelineCard episode={ep({ anticipatedReleaseDate: plus(2) })} />);
    expect(screen.getByTestId("warm-handoff-notice").textContent).toContain("Final 72 hours");
  });

  it("renders a missed-handoff episode as the catch-up lane", () => {
    render(
      <PreReleaseTimelineCard
        episode={ep({ anticipatedReleaseDate: plus(-1), missedHandoff: true })}
      />,
    );
    expect(screen.getByTestId("catch-up-notice")).toBeTruthy();
    expect(screen.queryByTestId("pre-release-days")).toBeNull();
  });
});
