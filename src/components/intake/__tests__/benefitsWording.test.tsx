import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BenefitsStep } from "@/components/intake/BenefitsStep";
import { EMPTY_BENEFITS } from "@/lib/intakeBenefits";

const noop = () => {};

describe("Phase 8b follow-up — benefits wording by audience", () => {
  it("self-service says you", () => {
    render(<BenefitsStep value={EMPTY_BENEFITS} onChange={noop} audience="self" />);
    expect(screen.getByText("What kind of coverage do you have?")).toBeTruthy();
  });
  it("staff-assisted keeps you (staff read it to the patient)", () => {
    render(<BenefitsStep value={EMPTY_BENEFITS} onChange={noop} audience="staff_assisted" />);
    expect(screen.getByText("What kind of coverage do you have?")).toBeTruthy();
  });
  it("third party uses the first name when known", () => {
    render(<BenefitsStep value={{ ...EMPTY_BENEFITS, choice: "medi_cal" }} onChange={noop} audience="third_party" personName="Rosa" />);
    expect(screen.getByText("What kind of coverage does Rosa have?")).toBeTruthy();
    expect(screen.getByText("Is Rosa's Medi-Cal active right now?")).toBeTruthy();
    expect(screen.queryByText(/do you have/)).toBeNull();
  });
  it("third party falls back to this person", () => {
    render(<BenefitsStep value={EMPTY_BENEFITS} onChange={noop} audience="third_party" />);
    expect(screen.getByText("What kind of coverage does this person have?")).toBeTruthy();
    expect(screen.getByText("How this person's care gets paid for")).toBeTruthy();
  });
});
