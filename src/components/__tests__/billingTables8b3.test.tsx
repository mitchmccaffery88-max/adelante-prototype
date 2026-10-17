// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { StaffTable } from "@/components/staff/StaffTable";
import { ClaimAmount } from "@/components/billing/RatesPanel";
import { AdelanteEHRExt, claimUnitLabel, type Claim } from "@/lib/ehr-ext";
import { PROGRAM_LABEL } from "@/lib/rates";
import { StatusChip } from "@/components/ui/status-chip";

afterEach(cleanup);
test("claim ids retain exact monetary, units and status projections and numeric sorting", () => {
  const claims = AdelanteEHRExt.listClaims();
  expect(claims.length).toBeGreaterThan(0);
  const rows: Claim[] = claims.slice(0, 40);
  const { container, getByTestId } = render(
    <StaffTable
      rows={rows}
      rowKey={(c) => c.id}
      label="Claims"
      testId="claims-table"
      columns={[
        {
          id: "charge",
          label: "Charge",
          sortTestId: "sort-charge",
          sortValue: (c) => c.chargeCents ?? -1,
          cell: (c) => <ClaimAmount claim={c} />,
        },
        {
          id: "state",
          label: "State",
          cell: (c) => <StatusChip lang="en" state="team" label={c.state} />,
        },
      ]}
    />,
  );
  const elements = () => [...container.querySelectorAll("[data-row-key]")];
  expect(elements().map((e) => e.getAttribute("data-row-key"))).toEqual(rows.map((c) => c.id));
  rows.forEach((c, i) => {
    const row = elements()[i];
    expect(row.textContent).toContain(
      c.rateStatus === "no_rate"
        ? "No rate on file"
        : c.chargeCents === undefined
          ? "—"
          : `$${(c.chargeCents / 100).toFixed(2)}`,
    );
    const dollars = (n: number) => `$${(n / 100).toFixed(2)}`;
    const units = `${c.serviceCode ?? "no code"}${c.program ? ` · ${PROGRAM_LABEL[c.program]}` : ""} · ${claimUnitLabel(c)}${c.rateCentsPerUnit !== undefined ? ` @ ${dollars(c.rateCentsPerUnit)}` : ""}`;
    expect(row.querySelector('[data-testid="claim-units"]')?.textContent).toBe(units);
    expect(row.textContent).toContain(c.state);
  });
  fireEvent.click(getByTestId("sort-charge"));
  expect(elements().map((e) => e.getAttribute("data-row-key"))).toEqual(
    [...rows].sort((a, b) => (a.chargeCents ?? -1) - (b.chargeCents ?? -1)).map((c) => c.id),
  );
  fireEvent.click(getByTestId("sort-charge"));
  expect(elements().map((e) => e.getAttribute("data-row-key"))).toEqual(
    [...rows].sort((a, b) => (b.chargeCents ?? -1) - (a.chargeCents ?? -1)).map((c) => c.id),
  );
});
