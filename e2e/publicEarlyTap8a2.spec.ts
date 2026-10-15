import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("a language tap before the homepage is interactive still applies; 988 stays a plain link", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('a[href="tel:988"]').first()).toBeAttached();
  await page.getByRole("button", { name: "Cambiar idioma a español", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  const axe = await new AxeBuilder({ page }).include('[data-testid="website-header"]').analyze();
  expect(axe.violations.filter(v => v.impact === "critical" || v.impact === "serious")).toEqual([]);
});

test("a menu tap before the phone homepage is interactive opens the menu once", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const menu = page.getByTestId("website-header").locator('button[data-early-tap="menu"]');
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await context.close();
});
