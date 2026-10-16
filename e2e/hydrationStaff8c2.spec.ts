// Page-loading (hydration) check: /clinician and /admin render the same on the
// server and in the browser, and an early "+ New" click opens the menu.
import { test, expect, type Page } from "@playwright/test";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
function collect(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => { if (/hydrat/i.test(e.message)) errors.push(e.message); });
  return errors;
}

for (const path of ["/clinician", "/admin"]) {
  test(`${path} loads with no hydration warnings`, async ({ page }) => {
    const errors = collect(page);
    await page.goto("/clinician");
    await page.waitForFunction(() => Boolean((window as W).__adelante));
    await page.evaluate(() => (window as W).__adelante.setActingStaff("s-cc2", "clinical_coordinator"));
    await page.goto(path);
    await page.waitForFunction(() => Boolean((window as W).__adelante));
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}

test("an early + New click on /admin opens the menu with no hydration warnings", async ({ page }) => {
  const errors = collect(page);
  await page.goto("/clinician");
  await page.waitForFunction(() => Boolean((window as W).__adelante));
  await page.evaluate(() => (window as W).__adelante.setActingStaff("s-cc2", "clinical_coordinator"));
  await page.evaluate(() => (window as W).__adelante.go("/admin"));
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByTestId("staff-new-slot").getByRole("button").first().click();
  await expect(page.getByTestId("ops-add-menu").getByTestId("ops-item-review_matching")).toBeVisible();
  expect(errors).toEqual([]);
});
