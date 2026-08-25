// @vitest-environment jsdom
// Renders the real dashboard section against a real projection, once with no
// engagement (honest "no live metric yet") and once with real completions.
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EngagementSection } from "@/components/dashboards/EngagementSection";
import { engagementProjection } from "@/lib/engagementReporting";
import { __resetEngagement, completeLibraryItem } from "@/lib/engagement";
import { __resetSelfTracking, startCravingLog } from "@/lib/selfTracking";
import { AdelanteEHR } from "@/lib/ehr";
import { LIBRARY_ITEMS } from "@/lib/library";

describe("EngagementSection", () => {
  beforeEach(() => {
    cleanup();
    __resetEngagement();
    __resetSelfTracking();
  });

  it("says so honestly when there is no engagement data", () => {
    render(<EngagementSection projection={engagementProjection()} />);
    expect(screen.getByText(/No live metric yet/)).toBeTruthy();
  });

  it("renders real computed numbers once patients engage", () => {
    const [a, b] = AdelanteEHR.listPatients();
    completeLibraryItem(a!.id, LIBRARY_ITEMS[0]!.id);
    completeLibraryItem(b!.id, LIBRARY_ITEMS[1]!.id);
    startCravingLog(a!.id, 6);

    render(<EngagementSection projection={engagementProjection()} />);
    expect(screen.queryByText(/no patient has completed or started/)).toBeNull();
    expect(screen.getByText("Patients ever engaged")).toBeTruthy();
    // Self-tracking aggregate is present and flagged as small-cohort.
    expect(screen.getByText("Craving logs")).toBeTruthy();
    expect(screen.getByText(/below the .* minimum for safe small-cell reporting/)).toBeTruthy();
  });
});
