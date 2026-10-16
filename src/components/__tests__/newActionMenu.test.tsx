// @vitest-environment jsdom
// Quick-actions batch 2 — shared "+ New" menu: quick section on top, search
// filters All actions, permissions come from the registry, arrow keys move.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NewActionMenu, type NewActionItem } from "@/components/staff/NewActionMenu";
import { CHART_ACTIONS } from "@/lib/chartActions";
import type { ChartActor } from "@/lib/chartActions";

const availableFor = (actor: ChartActor): NewActionItem[] =>
  CHART_ACTIONS.filter((a) => !a.pending && a.menu !== false)
    .map((action) => ({ action, answer: action.allowed(actor, undefined) }))
    .filter((x) => x.answer.state !== "hidden");

const renderMenu = (actor: ChartActor, onPick = vi.fn()) => {
  const available = availableFor(actor);
  render(<NewActionMenu actor={actor} available={available} onPick={onPick} itemTestId={(id) => `item-${id}`} />);
  return { onPick, available };
};

describe("NewActionMenu", () => {
  it("shows the role's quick actions above All actions", () => {
    renderMenu({ role: "therapist", staffId: "s-th1" });
    expect(screen.getByText("Quick actions")).toBeTruthy();
    expect(screen.getByText("All actions")).toBeTruthy();
    expect(screen.getByTestId("item-progress_note")).toBeTruthy();
    // Prescriber-only action is never listed for a therapist.
    expect(screen.queryByTestId("item-med_order")).toBeNull();
  });

  it("quick actions are not duplicated in All actions", () => {
    renderMenu({ role: "therapist", staffId: "s-th1" });
    expect(screen.getAllByTestId("item-progress_note")).toHaveLength(1);
  });

  it("search filters the list by the registry label", () => {
    renderMenu({ role: "clinical_coordinator", staffId: "s-cc2" });
    fireEvent.change(screen.getByLabelText("Search actions"), { target: { value: "eligibility" } });
    expect(screen.queryByTestId("item-progress_note")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search actions"), { target: { value: "zz-no-match" } });
    expect(screen.getByText("No matching actions.")).toBeTruthy();
  });

  it("billing sees claims quick actions and no clinical ones", () => {
    renderMenu({ role: "billing", staffId: "s-b1" });
    expect(screen.getByTestId("item-claim_correct")).toBeTruthy();
    expect(screen.getByTestId("item-eligibility_check")).toBeTruthy();
    expect(screen.queryByTestId("item-progress_note")).toBeNull();
  });

  it("picking an item reports the registry action id; arrow keys move focus", () => {
    const { onPick } = renderMenu({ role: "therapist", staffId: "s-th1" });
    const first = screen.getByTestId("item-progress_note");
    first.focus();
    fireEvent.keyDown(first.closest("[data-testid='new-action-menu']")!, { key: "ArrowDown" });
    expect(document.activeElement).not.toBe(first);
    expect((document.activeElement as HTMLElement).dataset.actionId).toBeTruthy();
    fireEvent.click(first);
    expect(onPick).toHaveBeenCalledWith("progress_note");
  });

  it("nurse quick actions exclude the actions pending clinical sign-off", () => {
    renderMenu({ role: "nurse_rn", staffId: "s-n1" });
    expect(screen.queryByTestId("item-clinic_dose_give")).toBeNull();
    expect(screen.queryByTestId("item-refill_coordinate")).toBeNull();
    expect(screen.getByTestId("item-triage_call")).toBeTruthy();
  });
});
