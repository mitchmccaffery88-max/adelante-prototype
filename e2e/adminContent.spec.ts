import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 1800 } });
test("coordinator starts with coordination work and verifies resources in the renamed center", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const app = (window as unknown as { __adelante: { setActingStaff: (id: string, role: string) => void; go: (path: string) => void } }).__adelante;
    app.setActingStaff("s-cc2", "clinical_coordinator");
    app.go("/admin-coordination");
  });
  await expect(page.getByTestId("coverage-list")).toBeVisible();
  await expect(page.getByTestId("resource-verification-queue")).toHaveCount(0);
  const order = await page.locator('[data-testid="coverage-list"], [data-testid="unassigned-list"], [data-testid="post-enrollment-setup"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(order.slice(0, 2)).toEqual(["coverage-list", "unassigned-list"]);
  await page.screenshot({ path: "/tmp/browser/admin-content/coordination.png" });
  await page.getByRole("link", { name: "Resource verification → Patient Content & Resources Center" }).click();
  await expect(page).toHaveURL(/\/admin-content$/);
  await expect(page.getByRole("heading", { name: "Patient Content & Resources Center", exact: true })).toBeVisible();
  await expect(page.locator('a[data-nav-id="admin-content"]')).toHaveText("Patient Content & Resources Center");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Patient Content & Resources Center");
  // §C2 The center opens on its Home digest; listings live under Manage → Directory.
  await expect(page.getByText("Awaiting my review")).toBeVisible();
  await page.getByRole("tab", { name: "Manage" }).click();
  await page.getByTestId("content-groups").getByRole("button", { name: "Directory" }).click();
  await page.getByTestId("content-type-select").click();
  await page.getByRole("option", { name: "Community resources", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Resource verification filter" })).toHaveText("Not verified");
  const row = page.getByTestId("resource-listing").first();
  const id = await row.getAttribute("data-resource-id");
  for (const [field, value] of [["Address", "123 Main St, Visalia, CA"], ["Phone", "559-555-0101"], ["Hours", "Weekdays 9am–5pm"]]) await row.getByRole("textbox", { name: field, exact: true }).fill(value);
  for (const checkbox of await row.getByRole("checkbox").all()) await checkbox.check();
  await row.getByRole("button", { name: "Verify and publish" }).click();
  await expect(page.getByText(/is now live for patients/).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Resource verification filter" }).click();
  await page.getByRole("option", { name: "Verified", exact: true }).click();
  const verified = page.locator(`[data-resource-id="${id}"]`);
  await expect(verified.getByText("Verified", { exact: true })).toBeVisible();
  await expect(verified.getByTestId("resource-verifier")).toContainText("Verified by Cathy ·");
  await expect(verified.getByTestId("resource-verifier")).not.toContainText("—");
  await verified.screenshot({ path: "/tmp/browser/admin-content/verified-listing.png" });
  await page.getByRole("combobox", { name: "Resource verification filter" }).click();
  await page.getByRole("option", { name: "All", exact: true }).click();
  await expect(verified).toBeVisible();
});