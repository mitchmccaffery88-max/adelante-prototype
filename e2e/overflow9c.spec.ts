// Phase 9c-1 — no page overflows its viewport at 390/768/1280 on the staff
// pages fixed in this batch (case-manager, billing, admin) plus the regression
// set; the staff roster "Change roles/sites" sheet never leaves the mouse
// locked after it closes.
import { expect, test } from "@playwright/test";
import { bootTables } from "./helpers/staffTables8b2";

test.use({ viewport: { width: 1280, height: 1800 } });

const ROUTES: Array<[string, string, string]> = [
  ["/case-manager", "s-ecm1", "ecm_provider"],
  ["/billing", "s-bc1", "billing_coordinator"],
  ["/admin", "s-admin1", "sys_admin"],
  ["/admin-staff", "s-admin1", "sys_admin"],
  ["/dashboards", "s-admin1", "sys_admin"],
  ["/reporting", "s-admin1", "sys_admin"],
  ["/clinician", "s-th1", "therapist"],
  ["/my-work", "s-th1", "therapist"],
];

for (const [route, staffId, role] of ROUTES) {
  test(`9c: ${route} never overflows the viewport`, async ({ page }) => {
    await bootTables(page, staffId, role, route);
    await page.waitForTimeout(1500);
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 1800 });
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(m.scroll, `${route} at ${width}px: scrollWidth ${m.scroll} > viewport ${m.inner}`).toBeLessThanOrEqual(m.inner);
    }
  });
}

test("9c: roster Change roles/sites sheet releases the mouse after closing", async ({ page }) => {
  await bootTables(page, "s-admin1", "sys_admin", "/admin-staff");
  const table = page.getByTestId("staff-members-table");
  await expect(table).toBeVisible();
  const rows = table.locator("[data-row-key]");
  await expect(rows.first()).toBeVisible();

  // Open the More menu on the first row and choose Change roles/sites.
  await rows.nth(0).getByRole("button", { name: /^More:/ }).click();
  await page.getByRole("menuitem", { name: "Change roles/sites" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Change roles/sites");

  // Close the sheet, then a plain mouse click on another row must work.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  const pointerEvents = await page.evaluate(() => getComputedStyle(document.body).pointerEvents);
  expect(pointerEvents).not.toBe("none");
  await rows.nth(1).getByRole("button", { name: /^More:/ }).click();
  await expect(page.getByRole("menuitem", { name: "Change roles/sites" })).toBeVisible();
});
