import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function bootTables(page: Page, id: string, role: string, route: string) {
  await page.goto("/clinician");
  await page.waitForFunction(() => Boolean((window as any).__adelante?.j));
  await page.evaluate(({ id, role, route }) => {
    const app = (window as any).__adelante;
    app.setActingStaff(id, role);
    app.go(route);
  }, { id, role, route });
}

export async function rowIds(page: Page, testId: string) {
  const table = page.getByTestId(testId);
  await expect(table).toBeVisible();
  return table.locator("[data-row-key]").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-row-key")));
}

export async function tableAxe(page: Page, testId: string) {
  const results = await new AxeBuilder({ page }).include(`[data-testid="${testId}"]`).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
}

export async function phoneTable(page: Page, testId: string) {
  await page.setViewportSize({ width: 390, height: 1800 });
  await expect(page.getByTestId(testId)).toBeVisible();
  const width = await page.getByTestId(testId).evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(390);
  await tableAxe(page, testId);
}