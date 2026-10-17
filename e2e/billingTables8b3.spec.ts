import { expect, test, type Page } from "@playwright/test";
import { bootTables, phoneTable, rowIds, tableAxe } from "./helpers/staffTables8b2";

test.use({ viewport: { width: 1280, height: 1800 } });
async function claimProjection(page: Page) {
  return page.evaluate(async () => {
    const app = (window as any).__adelante;
    const { ext } = await app.avail();
    // Formatting helpers are pure; claim records come from the live app instance.
    const { claimUnitLabel } = await import("/src/lib/ehr-ext.ts" as string);
    const { PROGRAM_LABEL } = await import("/src/lib/rates.ts" as string);
    const dollars = (n?: number) => (n === undefined ? "—" : `$${(n / 100).toFixed(2)}`);
    return ext
      .listClaims()
      .map((c: any) => ({
        id: c.id,
        encounter: c.encounterId,
        cents: c.chargeCents ?? -1,
        state: c.state,
        amount: c.rateStatus === "no_rate" ? "No rate on file" : dollars(c.chargeCents),
        units: `${c.serviceCode ?? "no code"}${c.program ? ` · ${PROGRAM_LABEL[c.program]}` : ""} · ${claimUnitLabel(c)}${c.rateCentsPerUnit !== undefined ? ` @ ${dollars(c.rateCentsPerUnit)}` : ""}`,
      }));
  });
}
for (const role of ["billing", "billing_coordinator"]) {
  test(`${role}: live claim amount/units/status parity and numeric sort`, async ({ page }) => {
    await bootTables(page, role === "billing" ? "s-bill1" : "s-bc1", role, "/billing");
    await expect(page.getByTestId("billing-table")).toBeVisible();
    const projection = await claimProjection(page);
    const billingRows = page.getByTestId("billing-row");
    for (const row of await billingRows.all()) {
      const encounter = await row.getAttribute("data-encounter");
      const claim = projection.find((c: any) => c.encounter === encounter);
      if (!claim) continue;
      await expect(row.getByTestId("claim-amount")).toContainText(claim.amount);
      await expect(row.getByTestId("claim-units")).toHaveText(claim.units);
      const buckets: Record<string, string> = {
        documented: "Draft",
        signed: "Draft",
        coded: "Draft",
        generated: "Ready",
        submitted: "Submitted",
        paid: "Paid",
        denied: "Denied",
        written_off: "Write-off",
        partial: "Partial",
      };
      await expect(row.getByTestId("billing-row-status")).toContainText(buckets[claim.state]);
      if (claim.state === "denied")
        expect(
          await row.getByTestId("billing-row-status").locator("span").first().getAttribute("class"),
        ).toBe("text-[10px] rounded-full px-2 py-0.5 bg-destructive/10 text-destructive");
    }
    await tableAxe(page, "billing-table");
    await phoneTable(page, "billing-table");
    await page.evaluate(() => (window as any).__adelante.go("/admin-claims"));
    const ids = await rowIds(page, "claims-table");
    expect(ids).toEqual(projection.slice(0, 50).map((c: any) => c.id));
    for (const row of await page.getByTestId("claim-row").all()) {
      const id = await row.getAttribute("data-row-key");
      const claim = projection.find((c: any) => c.id === id)!;
      await expect(row.getByTestId("claim-amount")).toContainText(claim.amount);
      await expect(row.getByTestId("claim-units")).toHaveText(claim.units);
      const labels: Record<string, string> = {
        documented: "Documented",
        signed: "Ready to send",
        coded: "Ready to send",
        generated: "Ready to send",
        submitted: "With payer",
        partial: "Partly paid — review",
      };
      await expect(row.locator('[data-cell="state"]')).toContainText(
        labels[claim.state] ?? claim.state,
      );
      if (claim.state === "denied")
        expect(await row.locator('[data-cell="state"] > span').first().getAttribute("class")).toBe(
          "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent shadow hover:bg-primary/80 bg-destructive/15 text-destructive",
        );
    }
    await page.getByTestId("sort-charge").click();
    const ascending = [...projection].sort((a: any, b: any) => a.cents - b.cents);
    expect(await rowIds(page, "claims-table")).toEqual(
      ascending.slice(0, 50).map((c: any) => c.id),
    );
    await page.getByTestId("sort-charge").click();
    expect(await rowIds(page, "claims-table")).toEqual(
      [...projection]
        .sort((a: any, b: any) => b.cents - a.cents)
        .slice(0, 50)
        .map((c: any) => c.id),
    );
    await phoneTable(page, "claims-table");
  });
}
test("therapist cannot see billing claim rows", async ({ page }) => {
  await bootTables(page, "s-th1", "therapist", "/billing");
  await expect(page.getByTestId("billing-row")).toHaveCount(0);
  await expect(page.getByTestId("billing-table")).toHaveCount(0);
});
