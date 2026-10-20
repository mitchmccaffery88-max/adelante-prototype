import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bootTables } from "./helpers/staffTables8b2";

const homes = [
  { role: "therapist", id: "s-th1", route: "/clinician", action: '[data-testid="today-strip"] button:has-text("Unsigned")', summary: '[data-testid="today-strip"]' },
  { role: "ecm_provider", id: "s-ecm1", route: "/case-manager", action: '[data-testid="task-queue-card"] button:has-text("Show all")', summary: '[data-testid="caseload-scope-card"]' },
  { role: "billing", id: "s-bill1", route: "/billing", action: '[data-testid="strip-blocked"]', summary: '[data-testid="billing-kpis"]' },
  { role: "sys_admin", id: "s-admin1", route: "/admin", action: '[data-testid="admin-strip-matching"]', summary: '[data-testid="admin-kpis"]' },
  { role: "credentialing_coordinator", id: "s-cred1", route: "/quality-compliance", action: '[data-testid="restricted-opens"]', summary: '[data-testid="unusual-volume"]' },
] as const;

for (const home of homes) {
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    test(`9c-2 ${home.role} action and summary above fold ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await bootTables(page, home.id, home.role, home.route);
      await expect(page.locator(home.summary)).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      for (const selector of [home.action, home.summary]) {
        const region = page.locator(selector).first();
        await expect(region).toBeVisible();
        const box = await region.boundingBox();
        expect(box).not.toBeNull();
        if (!box) return;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
      const axe = await new AxeBuilder({ page }).include('[data-testid="staff-shell"]').analyze();
      expect(axe.violations).toEqual([]);
      // Exercise the existing action in real seeded state, without changing records.
      if (home.role === "therapist") {
        await page.locator(home.action).click();
        await expect(page.getByTestId("workspace-tile-actions")).toContainText("unsigned");
      } else if (home.role === "ecm_provider") {
        await page.locator(home.action).click();
        await expect(page.getByRole("button", { name: "Hide done" })).toBeVisible();
      } else if (home.role === "billing") {
        await page.locator(home.action).click();
        await expect(page.getByTestId("billing-tile-action").locator('button[aria-expanded]')).toHaveAttribute("aria-expanded", "true");
      }
    });
  }
}

test("9c-2 billing still cannot see admin tiles", async ({ page }) => {
  await bootTables(page, "s-bill1", "billing", "/admin");
  await expect(page.getByTestId("staff-shell")).toBeVisible();
  await expect(page).not.toHaveURL(/\/admin$/);
  await expect(page.getByTestId("admin-kpis")).toHaveCount(0);
});
