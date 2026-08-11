// @vitest-environment jsdom
// §Group sessions — the point-of-choice billing indicator. This is the
// PREVENTIVE surface; the hard block stays in upsertClaimFromGroupAttendee.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { fireEvent } from "@testing-library/dom";
import { GroupBillingStatus } from "@/routes/group-sessions";
import { GROUP_CATEGORIES, type GroupCategory } from "@/lib/ehr";

describe("group billing status indicator", () => {
  it("renders the right status for each of the three categories", () => {
    const cases: [GroupCategory, string, string][] = [
      ["sud_clinical_preauth", "true", "H0005"],
      ["skills_education", "true", "H2014"],
      ["open_psychoeducational", "false", "Non-billable"],
    ];
    for (const [category, billable, text] of cases) {
      const { unmount } = render(<GroupBillingStatus category={category} />);
      const el = screen.getByTestId("group-billing-status");
      expect(el.dataset["billable"]).toBe(billable);
      expect(el.textContent).toContain(text);
      unmount();
    }
  });

  it("updates immediately when the category changes", () => {
    function Harness() {
      const [c, setC] = useState<GroupCategory>("open_psychoeducational");
      return (
        <div>
          {GROUP_CATEGORIES.map((x) => (
            <button key={x.key} onClick={() => setC(x.key)}>
              {x.key}
            </button>
          ))}
          <GroupBillingStatus category={c} />
        </div>
      );
    }
    render(<Harness />);
    expect(screen.getByTestId("group-billing-status").textContent).toContain("Non-billable");
    fireEvent.click(screen.getByText("skills_education"));
    expect(screen.getByTestId("group-billing-status").textContent).toContain("H2014");
    fireEvent.click(screen.getByText("sud_clinical_preauth"));
    expect(screen.getByTestId("group-billing-status").textContent).toContain("H0005");
  });
});
