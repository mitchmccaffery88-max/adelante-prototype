// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function Harness() {
  const [v, setV] = useState("all");
  return (<div>
    <span data-testid="val">{v}</span>
    <ToggleGroup type="single" value={v} onValueChange={(x) => x && setV(x)}>
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      <ToggleGroupItem value="peer">Peer</ToggleGroupItem>
    </ToggleGroup>
  </div>);
}
describe("tg", () => {
  it("clicks", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Peer"));
    expect(screen.getByTestId("val").textContent).toBe("peer");
  });
});
