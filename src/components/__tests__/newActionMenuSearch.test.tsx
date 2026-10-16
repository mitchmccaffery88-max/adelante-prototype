// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NewActionMenu } from "@/components/staff/NewActionMenu";
import { CHART_ACTIONS, type ChartActor } from "@/lib/chartActions";

afterEach(cleanup);

it("search filters both groups without duplicating actions and clearing restores the available set", () => {
  const actor: ChartActor = { role: "therapist", staffId: "s-th1" };
  const available = CHART_ACTIONS.filter((a) => !a.pending && a.menu !== false)
    .map((action) => ({ action, answer: action.allowed(actor, undefined) }))
    .filter((x) => x.answer.state !== "hidden");
  const onPick = vi.fn();
  render(<NewActionMenu actor={actor} available={available} onPick={onPick} itemTestId={(id) => `search-${id}`} />);
  const input = screen.getByLabelText("Search actions");
  const ids = () => Array.from(document.querySelectorAll<HTMLElement>("[data-action-id]"), (el) => el.dataset.actionId);
  const original = ids();
  fireEvent.change(input, { target: { value: "task" } });
  const expected = available.filter((x) => x.action.label.en.toLowerCase().includes("task")).map((x) => x.action.id);
  expect(expected.length).toBeGreaterThan(0);
  expect(new Set(ids())).toEqual(new Set(expected));
  expect(ids()).toHaveLength(expected.length);
  expect(ids()).not.toContain("dashboard_book");
  input.focus();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect((document.activeElement as HTMLElement).dataset.actionId).toBe(ids()[0]);
  fireEvent.keyDown(document.activeElement ?? input, { key: "ArrowUp" });
  expect((document.activeElement as HTMLElement).dataset.actionId).toBe(ids().at(-1));
  fireEvent.click(screen.getByTestId(`search-${expected[0]}`));
  expect(onPick).toHaveBeenCalledWith(expected[0]);
  fireEvent.change(input, { target: { value: "zz-no-match" } });
  expect(ids()).toEqual([]);
  fireEvent.change(input, { target: { value: "" } });
  expect(ids()).toEqual(original);
});