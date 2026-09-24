// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BenefitsStep } from "@/components/intake/BenefitsStep";
import { EMPTY_BENEFITS } from "@/lib/intakeBenefits";

const noop = () => {};
afterEach(cleanup);

describe("Phase 8b follow-up — benefits wording by audience", () => {
  it("self-service says you", () => {
    render(<BenefitsStep value={EMPTY_BENEFITS} onChange={noop} audience="self" />);
    expect(screen.getAllByText("What kind of coverage do you have?").length).toBeGreaterThan(0);
  });
  it("staff-assisted keeps you (staff read it to the patient)", () => {
    render(<BenefitsStep value={EMPTY_BENEFITS} onChange={noop} audience="staff_assisted" />);
    expect(screen.getAllByText("What kind of coverage do you have?").length).toBeGreaterThan(0);
  });
  it("third party uses the first name when known", () => {
    render(<BenefitsStep value={{ ...EMPTY_BENEFITS, choice: "medi_cal" }} onChange={noop} audience="third_party" personName="Rosa" />);
    expect(screen.getAllByText("What kind of coverage does Rosa have?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Is Rosa's Medi-Cal active right now?").length).toBeGreaterThan(0);
    expect(screen.queryByText(/do you have/)).toBeNull();
  });
  it("third party falls back to this person", () => {
    render(<BenefitsStep value={EMPTY_BENEFITS} onChange={noop} audience="third_party" />);
    expect(screen.getAllByText("What kind of coverage does this person have?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("How this person's care gets paid for").length).toBeGreaterThan(0);
  });
});
